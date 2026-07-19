/**
 * 同步逻辑模块 —— 清单 checkbox 勾选/取消 → IDB 同步 + 三重广播。
 *
 * 提取自 archetype/listsOptionSync.user.js L334-600（getMovieInfo/getListInfo/
 * syncMoviesLists/handleCheckboxChange + change 事件监听）。
 *
 * 原脚本的第三方 /api/sync/movies_lists 已改为本地 VltDb；但 JavDB 自身的
 * /users/save_video_to_list 必须先成功，再把权威状态镜像进 IndexedDB。
 *
 * 三重广播机制保留（GM_setValue/localStorage/CustomEvent），通知 VltTags
 * 自动刷新标签显示。跨标签页同步通过 GM_addValueChangeListener 实现。
 */

import { VltDb } from './vlt-db';
import type { SyncResult } from './vlt-db';
import { showToast } from './vlt-toast';
import { FAVORITE_ACTION } from '../../constants/status';
import {
    reconcileAfterConfirmedMutation,
    reconcileListBeforeMutation,
    reconcileListWithJavdb,
    setupAutomaticListReconciliation
} from './vlt-reconcile';

/** 日志前缀。 */
const LOG_PREFIX = '[JavDB]';

/** 同步事件广播键。 */
const LAST_SYNC_KEY = 'jdb:last-sync';

/** 服务端写入已发出、但尚未完成本地镜像的持久化日志前缀。 */
const PENDING_SYNC_PREFIX = 'jdb:vlt-pending-server-sync:';

/** 触发自动收藏的清单名称关键词（清单名称包含此词时，添加视频自动收藏）。 */
const AUTO_FAVORITE_KEYWORD = '等待更新';

/** association → toast 映射。 */
const ASSOC_TOAST: Record<
    string,
    (des: string, lname: string, created: string[]) => { msg: string; type: 'success' | 'error' }
> = {
    created: (des: string, lname: string, created: string[]) => {
        const extra = created.length > 0 ? `（已登记${created.join('和')}）` : '';
        return { msg: `✓ [${des}] 已添加至「${lname}」${extra}`, type: 'success' };
    },
    existed: (des: string, lname: string) => ({
        msg: `✓ [${des}] 已在「${lname}」中，数据一致`,
        type: 'success'
    }),
    limit_exceeded: (des: string, lname: string) => ({
        msg: `✗ [${des}]「${lname}」已达收藏上限（501 条）`,
        type: 'error'
    }),
    deleted: (des: string, lname: string) => ({
        msg: `✓ [${des}] 已从「${lname}」移除`,
        type: 'success'
    }),
    unchanged: (des: string, lname: string) => ({
        msg: `✓ [${des}] 未关联「${lname}」，数据一致`,
        type: 'success'
    })
};

/**
 * 从番号提取系列名（`-` 前部分）。
 * 对应原 L334-338。
 */
function getSeries(d: string): string {
    if (!d) return d;
    const i = d.indexOf('-');
    return i > 0 ? d.slice(0, i) : d;
}

/**
 * 从番号提取后缀编号（`-` 后部分）。
 * 对应原 L339-343。
 */
function getCode(d: string): string | null {
    if (!d) return null;
    const i = d.indexOf('-');
    return i > 0 ? d.slice(i + 1) : null;
}

/**
 * 从详情页提取评分。
 * 对应原 L344-355。
 * @returns 评分数值，找不到返回 0
 */
function getScore(): number {
    const spans = document.querySelectorAll('nav span');
    const found = Array.from(spans).find((s: Element) => s.textContent?.trim().endsWith('人評價'));
    if (!found) return 0.0;
    const m = found.innerHTML.match(/(\d+\.\d+)/);
    return m ? parseFloat(m[1]) : 0.0;
}

/** 缓存的评分（单次页面加载只计算一次）。 */
let _cachedScore: number | undefined;

/** 获取缓存的评分。 */
function getScoreCached(): number {
    if (_cachedScore === undefined) _cachedScore = getScore();
    return _cachedScore;
}

/**
 * 从详情页 DOM 提取影片信息。
 * 对应原 L364-405。
 * @param videoId 视频 ID（URL 末段）
 * @returns 影片信息或 null
 */
export function getMovieInfo(videoId: string): {
    designation: string;
    info: {
        href: string;
        title: string;
        release_date: string;
        cover_src: string;
        score: number;
        series: string;
        code: string;
    };
} | null {
    const detail = document.querySelector('.video-detail');
    if (!detail) {
        console.warn(`${LOG_PREFIX} 未找到 .video-detail，跳过`);
        return null;
    }

    const desEl = detail.querySelector('.panel-block.first-block a[data-clipboard-text]');
    if (!desEl) {
        console.warn(`${LOG_PREFIX} 未找到番号元素，跳过`);
        return null;
    }
    const designation = (desEl as HTMLElement).dataset.clipboardText || '';
    if (!designation) {
        console.warn(`${LOG_PREFIX} 番号为空，跳过`);
        return null;
    }
    const href = 'https://javdb.com/v/' + videoId;

    const titleEl = detail.querySelector('strong.current-title');
    const title = titleEl ? titleEl.innerHTML : '';

    const dateEl = detail.querySelector('.video-meta-panel nav > div:nth-child(2) > span');
    const release_date = dateEl ? dateEl.innerHTML : '';

    const coverEl = detail.querySelector('.column-video-cover img');
    const cover_src = coverEl ? (coverEl as HTMLImageElement).src : '';

    const score = getScoreCached();
    const series = getSeries(designation);
    const code = getCode(designation);

    return {
        designation,
        info: { href, title, release_date, cover_src, score, series, code: code || '' }
    };
}

/**
 * 从 DOM 提取清单名称。
 * 对应原 L407-424。
 */
function getListName(listId: string): string {
    const input = document.querySelector(
        `input[data-list-id="${listId}"]`
    ) as HTMLInputElement | null;
    if (!input) return '';
    const label = input.closest('label');
    if (!label) return '';
    return label.textContent
        .replace(/\(.*?\)/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * 获取清单信息。
 * 对应原 L426-430。
 */
export function getListInfo(listId: string): {
    list_id: string;
    info: { url: string; name: string };
} {
    const url = 'https://javdb.com/lists/' + listId + '?locale=zh';
    const name = getListName(listId);
    return { list_id: listId, info: { url, name } };
}

/**
 * 聚合同步：影片 upsert + 清单 upsert + 关联 add/remove。
 * 对应原 L438-481 的 syncMoviesLists，但调用 VltDb.sync() 替代 GM_xmlhttpRequest。
 *
 * @param movieInfo 影片信息（getMovieInfo 返回）
 * @param listInfo 清单信息（getListInfo 返回）
 * @param action "add" | "remove"
 * @returns SyncResult { movie, list, association }
 */
async function syncMoviesLists(
    movieInfo: NonNullable<ReturnType<typeof getMovieInfo>>,
    listInfo: ReturnType<typeof getListInfo>,
    action: 'add' | 'remove',
    serverConfirmed = false
): Promise<SyncResult> {
    console.log(
        `${LOG_PREFIX} 同步(IDB): ${movieInfo.designation} → ${listInfo.info.name} (${action})`
    );

    const result = await VltDb.sync(
        movieInfo.designation,
        listInfo.list_id,
        {
            href: movieInfo.info.href,
            title: movieInfo.info.title,
            cover_src: movieInfo.info.cover_src,
            score: movieInfo.info.score,
            release_date: movieInfo.info.release_date,
            series: movieInfo.info.series,
            code: movieInfo.info.code
        },
        {
            url: listInfo.info.url,
            name: listInfo.info.name
        },
        action,
        { serverConfirmed }
    );

    console.log(
        `${LOG_PREFIX} 同步结果: movie=${result.movie} list=${result.list} association=${result.association}`
    );
    return result;
}

/**
 * 从详情页 DOM 提取演员名（与 BasePlugin.getPageInfo 的 actress 提取逻辑一致）。
 * 用于自动收藏时填充 CarRecord.names 字段。
 *
 * @returns 女演员名拼接字符串（空时返回空字符串）
 */
function getActressNames(): string {
    try {
        return $('.female')
            .prev()
            .map((_index: number, el: any) => $(el).text())
            .get()
            .join(' ')
            .trim();
    } catch {
        return '';
    }
}

/** 「想看/观看」状态变更广播键（与 DetailPageButtonPlugin.broadcastWantWatchedSync 一致）。 */
const WANT_WATCHED_SYNC_KEY = 'jdb:want-watched-sync';

/**
 * 广播「想看/观看」状态变更，与 DetailPageButtonPlugin.broadcastWantWatchedSync 等价。
 *
 * 三重通道：GM_setValue（跨标签页）/ localStorage（跨脚本同源）/ CustomEvent（同页面即时）。
 * 接收方为 DetailPageButtonPlugin.setupWantWatchedSyncListener，会：
 *   1. 详情页：showStatus 刷新菜单按钮文案（屏蔽/收藏/已观看）
 *   2. 列表页：refreshItemStatusTag 刷新匹配卡片 status-tag
 *
 * 自动收藏必须广播，才能让其他标签页/列表页/当前详情页同步刷新状态，
 * 与手动点击收藏（onWantAdded/quickConvertToFav）效果一致。
 *
 * @param carNum 番号
 * @param status 状态动作（FAVORITE_ACTION 等）
 * @param op 操作类型（'add' / 'remove'）
 */
function broadcastWantWatchedSync(carNum: string, status: string, op: 'add' | 'remove'): void {
    try {
        const payload = { carNum, status, op, time: Date.now() };
        const json = JSON.stringify(payload);
        // 1) GM 原生通道（跨标签页）
        try {
            GM_setValue(WANT_WATCHED_SYNC_KEY, json);
        } catch {}
        // 2) localStorage（跨脚本同源）
        try {
            localStorage.setItem(WANT_WATCHED_SYNC_KEY, json);
        } catch {}
        // 3) CustomEvent（同页面即时，DetailPageButtonPlugin.setupWantWatchedSyncListener 接收）
        try {
            document.dispatchEvent(new CustomEvent(WANT_WATCHED_SYNC_KEY, { detail: payload }));
        } catch {}
    } catch (err: any) {
        console.error(`${LOG_PREFIX} 自动收藏广播失败`, err);
    }
}

/**
 * 当向名称包含「等待更新」的清单添加视频时，自动将未收藏视频收藏。
 *
 * 策略（保守，不覆盖用户已设置的其它状态）：
 * - 记录不存在或 status 为空 → 自动收藏
 * - status 已是 FAVORITE_ACTION → 跳过（不重复收藏）
 * - status 为其它状态（屏蔽/已观看等）→ 跳过并提示
 *
 * 收藏成功后：
 * 1. 广播三重事件（与 onWantAdded/quickConvertToFav 一致），让当前详情页菜单按钮
 *    文案、其他标签页列表页 status-tag 同步刷新
 * 2. 通过 DetailPageButtonPlugin 调用 JavDB API 设为「想看」+ _syncRatingBar 刷新
 *    星标评分组件收藏状态（quickConvertToFav 同款事件链）
 *
 * @param movieInfo 影片信息（getMovieInfo 返回）
 * @param lname 清单名称
 */
async function autoFavoriteIfPendingUpdate(
    movieInfo: NonNullable<ReturnType<typeof getMovieInfo>>,
    lname: string
): Promise<void> {
    if (!lname.includes(AUTO_FAVORITE_KEYWORD)) return;

    const des = movieInfo.designation;
    try {
        const carRecord = await storageManager.getCar(des);
        if (carRecord && carRecord.status === FAVORITE_ACTION) {
            // 已收藏，跳过
            return;
        }
        if (carRecord && carRecord.status) {
            // 已有其它状态（屏蔽/已观看等），不覆盖
            showToast(`ℹ️ [${des}] 已标记为「${carRecord.status}」，跳过自动收藏`, 'info');
            return;
        }
        // 未收藏 → 自动收藏（写入 IndexedDB）
        await storageManager.saveCar({
            carNum: des,
            url: movieInfo.info.href,
            names: getActressNames(),
            actionType: FAVORITE_ACTION,
            publishTime: movieInfo.info.release_date
        });
        // 广播三重事件：让当前详情页 showStatus + 其他标签页 refreshItemStatusTag 同步刷新
        broadcastWantWatchedSync(des, FAVORITE_ACTION, 'add');
        showToast(`⭐ [${des}] 已自动收藏（添加至「${lname}」）`, 'success');
        console.log(`${LOG_PREFIX} 自动收藏: ${des}（触发清单：${lname}）`);
        // 联动星标评分组件：调 JavDB API 设为「想看」+ 刷新评分条收藏高亮
        // 与 quickConvertToFav 同款事件链（_reviewChain 串行化 + _wantWatchedSyncing 守卫）
        triggerJavdbWantAndSyncRatingBar(des);
    } catch (err: any) {
        console.error(`${LOG_PREFIX} 自动收藏失败: ${des}`, err);
        showToast(`✗ [${des}] 自动收藏失败：${err.message || '未知错误'}`, 'error');
    }
}

/**
 * 通过 DetailPageButtonPlugin 调用 JavDB API 设为「想看」并刷新星标评分组件。
 *
 * 复用 DetailPageButtonPlugin 的 _triggerJavdbWant（发 JavDB API 请求 + 执行 Rails JS
 * 同步更新 DOM）和 _syncRatingBar（从 .review-buttons DOM 检测 want 状态，刷新
 * 评分条收藏按钮高亮），与 quickConvertToFav 的事件链完全一致。
 *
 * 通过 _reviewChain 串行化（防止与 MutationObserver 竞争）+ _wantWatchedSyncing
 * 守卫（防止 onWantAdded 重复写入），均复用 DetailPageButtonPlugin 实例字段。
 *
 * @param carNum 番号（仅用于日志）
 */
function triggerJavdbWantAndSyncRatingBar(carNum: string): void {
    try {
        const detailPlugin: any = pluginManager?.getBean?.('DetailPageButtonPlugin');
        if (!detailPlugin) {
            console.warn(`${LOG_PREFIX} DetailPageButtonPlugin 未注册，跳过星标评分联动`);
            return;
        }
        // 复用 _reviewChain 串行化（与 quickConvertToFav 完全一致的结构）
        detailPlugin._reviewChain = (detailPlugin._reviewChain || Promise.resolve())
            .then(async () => {
                detailPlugin._wantWatchedSyncing = true;
                try {
                    await detailPlugin._triggerJavdbWant();
                    detailPlugin._syncRatingBar();
                } finally {
                    detailPlugin._wantWatchedSyncing = false;
                }
            })
            .catch(() => {});
    } catch (err: any) {
        console.error(`${LOG_PREFIX} 星标评分联动失败: ${carNum}`, err);
    }
}

/**
 * 处理 checkbox 勾选/取消。
 * 对应原 L515-571 的 handleCheckboxChange。
 *
 * @param movieInfo 影片信息
 * @param listInfo 清单信息
 * @param checked 是否勾选
 */
export async function handleCheckboxChange(
    movieInfo: NonNullable<ReturnType<typeof getMovieInfo>>,
    listInfo: ReturnType<typeof getListInfo>,
    checked: boolean,
    options: {
        serverConfirmed?: boolean;
        silent?: boolean;
        skipAutomation?: boolean;
    } = {}
): Promise<SyncResult | null> {
    const des = movieInfo.designation;
    const lname = listInfo.info.name;
    const action = checked ? 'add' : 'remove';

    console.log(`${LOG_PREFIX} ═══ ${checked ? '勾选' : '取消'} [${des}] → ${lname} ═══`);

    let result: SyncResult;
    try {
        result = await syncMoviesLists(
            movieInfo,
            listInfo,
            action,
            options.serverConfirmed === true
        );
    } catch (err: any) {
        console.error(`${LOG_PREFIX} 同步失败`, err);
        if (!options.silent) {
            showToast(`✗ [${des}] 同步失败：${err.message || '请检查 IndexedDB'}`, 'error');
        }
        return null;
    }

    // 收集实际新创建了什么
    const created: string[] = [];
    if (result.movie === 'created') created.push('影片');
    if (result.list === 'created') created.push('清单');

    if (!options.silent) {
        const entry = ASSOC_TOAST[result.association];
        if (entry) {
            const { msg, type } = entry(des, lname, created);
            showToast(msg, type);
        } else {
            showToast(`✗ [${des}] 未知响应：${result.association}`, 'error');
        }
    }

    // 勾选（添加到清单）且清单名称包含「等待更新」时，自动收藏未收藏视频
    if (checked && !options.skipAutomation && result.association !== 'limit_exceeded') {
        autoFavoriteIfPendingUpdate(movieInfo, lname).then();
        // 加入「非等待更新」清单时，若视频仍在名称含「等待更新」的清单中，自动移出
        // （关键词匹配：清单名包含「等待更新」即视为等待更新清单，非精确字符匹配）
        if (!lname.includes(AUTO_FAVORITE_KEYWORD)) {
            uncheckPendingUpdateListCheckboxes();
        }
    }

    console.log(`${LOG_PREFIX} ═══ 完成 ═══`);

    // 广播同步事件（三重机制确保跨脚本/跨标签页联动）
    const syncPayload = {
        designation: des,
        action,
        association: result.association,
        time: Date.now()
    };
    const payloadStr = JSON.stringify(syncPayload);

    // 1) 同脚本跨标签页（GM 原生通道）
    try {
        GM_setValue(LAST_SYNC_KEY, payloadStr);
    } catch (error) {
        console.warn(`${LOG_PREFIX} GM 同步广播失败`, error);
    }

    // 2) 跨脚本跨标签页（localStorage 触发 storage 事件）
    try {
        localStorage.setItem(LAST_SYNC_KEY, payloadStr);
    } catch (error) {
        console.warn(`${LOG_PREFIX} localStorage 同步广播失败`, error);
    }

    // 3) 跨脚本同页面（CustomEvent 即时）
    try {
        document.dispatchEvent(new CustomEvent('jdb:sync-complete', { detail: syncPayload }));
    } catch (error) {
        console.warn(`${LOG_PREFIX} 页面同步广播失败`, error);
    }
    return result;
}

/**
 * 评分/已读（0–5 星）后：若当前视频在名称含「等待更新」的清单中，自动移出。
 *
 * 主路径：取消勾选 `#modal-save-list` 内已勾选的匹配 checkbox 并派发 change，
 * 复用 setupCheckboxListener 的“JavDB 成功后再写 IDB”链路。
 * 同步取消 `.jhs-list-panel` 克隆勾选态（仅 UI，不二次派发）。
 *
 * 若清单 DOM 尚未加载：先查 VltDb 是否仍有关联；有则短轮询等待 checkbox，
 * 超时后直接调用同一 JavDB 请求链路，禁止只删除本地关联。
 *
 * fire-and-forget 调用，不阻塞评分主流程。
 */
export async function autoRemoveFromPendingUpdateOnWatch(): Promise<void> {
    try {
        if (uncheckPendingUpdateListCheckboxes() > 0) return;

        const pending = await findPendingUpdateListsForCurrentMovie();
        if (pending.length === 0) return;

        for (let i = 0; i < 15; i++) {
            await new Promise((r) => setTimeout(r, 200));
            if (uncheckPendingUpdateListCheckboxes() > 0) return;
        }

        // DOM 仍不可用：仍先请求 JavDB，确认成功后才删除本地关联
        for (const item of pending) {
            const movieInfo = getMovieInfo(item.videoId);
            if (!movieInfo) continue;
            const listInfo = {
                list_id: item.listId,
                info: { url: item.url, name: item.name }
            };
            await enqueueServerCheckboxMutation(movieInfo, listInfo, false, null, true);
        }
    } catch (err: any) {
        console.error(`${LOG_PREFIX} 评分后移出「等待更新」失败`, err);
    }
}

/**
 * 取消勾选名称含「等待更新」且已勾选的清单 checkbox。
 * @returns 成功触发取消的清单数量（按 listId 去重）
 */
function uncheckPendingUpdateListCheckboxes(): number {
    const inputs = document.querySelectorAll(
        '#modal-save-list input[type="checkbox"][data-action="change->list#listCheckboxChanged"]'
    ) as NodeListOf<HTMLInputElement>;

    const seen = new Set<string>();
    let count = 0;

    for (const input of inputs) {
        if (!input.checked) continue;
        const listId = input.dataset.listId || '';
        if (!listId || seen.has(listId)) continue;
        const name = getListName(listId);
        if (!name.includes(AUTO_FAVORITE_KEYWORD)) continue;

        seen.add(listId);
        count++;
        input.checked = false;
        input.dispatchEvent(new Event('change', { bubbles: true }));

        // 平铺面板克隆仅同步 UI，避免二次 change → 双重 handleCheckboxChange
        const panelCb = document.querySelector(
            `.jhs-list-panel input[data-list-id="${listId}"]`
        ) as HTMLInputElement | null;
        if (panelCb) panelCb.checked = false;

        console.log(`${LOG_PREFIX} 评分后取消勾选「${name}」(listId=${listId})`);
    }

    return count;
}

/**
 * 从 VltDb 查询当前详情页影片是否关联名称含「等待更新」的清单。
 */
async function findPendingUpdateListsForCurrentMovie(): Promise<
    { videoId: string; listId: string; name: string; url: string }[]
> {
    const m = window.location.pathname.match(/\/v\/([^/?#]+)/);
    const videoId = m?.[1];
    if (!videoId) return [];

    const movieInfo = getMovieInfo(videoId);
    if (!movieInfo) return [];

    const map = await VltDb.queryMoviesLists([movieInfo.designation]);
    const lists = map[movieInfo.designation] || [];
    const result: { videoId: string; listId: string; name: string; url: string }[] = [];

    for (const item of lists) {
        if (!item.name.includes(AUTO_FAVORITE_KEYWORD)) continue;
        const listId = item.url?.match(/\/lists\/([^/?#]+)/)?.[1];
        if (!listId) continue;
        result.push({
            videoId,
            listId,
            name: item.name,
            url: item.url || `https://javdb.com/lists/${listId}?locale=zh`
        });
    }

    return result;
}

type MovieInfo = NonNullable<ReturnType<typeof getMovieInfo>>;
type ListInfo = ReturnType<typeof getListInfo>;

interface PendingServerSync {
    version: 1;
    videoId: string;
    desiredChecked: boolean;
    movieInfo: MovieInfo;
    listInfo: ListInfo;
    createdAt: number;
}

interface AuthoritativeCheckboxState {
    checked: boolean;
    count: number | null;
    name: string | null;
}

type ServerMutationResult =
    | { kind: 'confirmed'; message: string }
    | { kind: 'rejected'; message: string }
    | { kind: 'unknown'; message: string };

const checkboxMutationQueues = new Map<string, Promise<void>>();
let checkboxListenerInstalled = false;

function getCheckboxCount(input: HTMLInputElement): number | null {
    const text = input.closest('label')?.querySelector('span')?.textContent || '';
    const match = text.match(/\((\d+)\)/);
    if (!match) return null;
    const count = Number(match[1]);
    return Number.isSafeInteger(count) ? count : null;
}

function matchingListCheckboxes(listId: string): HTMLInputElement[] {
    return (Array.from(
        document.querySelectorAll(
            '#modal-save-list input[type="checkbox"][data-list-id], ' +
                '.jhs-list-panel input[type="checkbox"][data-list-id]'
        )
    ) as HTMLInputElement[]).filter((input) => input.dataset.listId === listId);
}

function setListCheckboxState(listId: string, checked: boolean): void {
    for (const input of matchingListCheckboxes(listId)) input.checked = checked;
}

function setListCheckboxBusy(listId: string, busy: boolean): void {
    for (const input of matchingListCheckboxes(listId)) {
        if (busy) {
            if (input.dataset.vltWasDisabled === undefined) {
                input.dataset.vltWasDisabled = input.disabled ? '1' : '0';
            }
            input.disabled = true;
        } else {
            if (input.dataset.vltWasDisabled === undefined) continue;
            input.disabled = input.dataset.vltWasDisabled === '1';
            delete input.dataset.vltWasDisabled;
        }
    }
}

function setListDisplayedCount(listId: string, count: number): void {
    for (const input of matchingListCheckboxes(listId)) {
        const span = input.closest('label')?.querySelector('span');
        if (span) span.textContent = `(${count})`;
    }
}

function createPendingJournal(entry: PendingServerSync): string | null {
    try {
        const randomPart =
            typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : `${Math.random().toString(36).slice(2)}-${Date.now()}`;
        const key = `${PENDING_SYNC_PREFIX}${entry.createdAt}:${randomPart}`;
        localStorage.setItem(key, JSON.stringify(entry));
        return key;
    } catch (error) {
        console.error(`${LOG_PREFIX} 无法写入清单同步恢复日志`, error);
        return null;
    }
}

function removePendingJournal(key: string | null): void {
    if (!key) return;
    try {
        localStorage.removeItem(key);
    } catch {}
}

function readPendingJournals(): { key: string; entry: PendingServerSync }[] {
    const keys: string[] = [];
    try {
        for (let index = 0; index < localStorage.length; index++) {
            const key = localStorage.key(index);
            if (key?.startsWith(PENDING_SYNC_PREFIX)) keys.push(key);
        }
    } catch {
        return [];
    }

    const entries: { key: string; entry: PendingServerSync }[] = [];
    for (const key of keys) {
        try {
            const value = localStorage.getItem(key);
            if (!value) continue;
            const entry = JSON.parse(value) as Partial<PendingServerSync>;
            if (
                entry.version !== 1 ||
                !entry.videoId ||
                !entry.movieInfo?.designation ||
                !entry.listInfo?.list_id ||
                typeof entry.desiredChecked !== 'boolean' ||
                typeof entry.createdAt !== 'number'
            ) {
                removePendingJournal(key);
                continue;
            }
            entries.push({ key, entry: entry as PendingServerSync });
        } catch {
            removePendingJournal(key);
        }
    }
    return entries.sort((left, right) => left.entry.createdAt - right.entry.createdAt);
}

async function postJavdbListMutation(
    videoId: string,
    listId: string,
    checked: boolean
): Promise<ServerMutationResult> {
    const csrfToken = getCsrfToken();
    if (!csrfToken) return { kind: 'rejected', message: '无法获取 CSRF token' };

    try {
        const response = await fetch(
            new URL('/users/save_video_to_list', window.location.origin).href,
            {
                method: 'POST',
                body: JSON.stringify({ video_id: videoId, checked, list_id: listId }),
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                credentials: 'same-origin'
            }
        );
        const data = (await response.json().catch(() => null)) as {
            success?: unknown;
            message?: unknown;
        } | null;
        const message = typeof data?.message === 'string' ? data.message : `HTTP ${response.status}`;
        if (response.ok && data?.success === true) return { kind: 'confirmed', message };
        if (response.ok && data?.success === false) return { kind: 'rejected', message };
        return { kind: 'unknown', message };
    } catch (error) {
        return {
            kind: 'unknown',
            message: error instanceof Error ? error.message : String(error)
        };
    }
}

async function fetchAuthoritativeCheckboxState(
    videoId: string,
    listId: string
): Promise<AuthoritativeCheckboxState | null> {
    try {
        let url: URL | null = new URL('/users/simple_lists', window.location.origin);
        url.searchParams.set('vid', videoId);
        const visited = new Set<string>();

        for (let page = 0; url && page < 50; page++) {
            if (visited.has(url.href)) return null;
            visited.add(url.href);
            const response = await fetch(url.href, {
                credentials: 'same-origin',
                cache: 'no-store',
                headers: { Accept: 'application/json' }
            });
            if (!response.ok) return null;
            const payload = (await response.json()) as { lists?: unknown; page?: unknown };
            if (typeof payload.lists !== 'string') return null;

            const documentNode = new DOMParser().parseFromString(payload.lists, 'text/html');
            const input = (Array.from(
                documentNode.querySelectorAll('input[type="checkbox"][data-list-id]')
            ) as HTMLInputElement[]).find((item) => item.dataset.listId === listId);
            if (input) {
                const labelText = (input.closest('label')?.textContent || '')
                    .replace(/\s+/g, ' ')
                    .trim();
                return {
                    checked: input.checked,
                    count: getCheckboxCount(input),
                    name: labelText.replace(/\s*\(\d+\).*$/, '').trim() || null
                };
            }

            const pageHtml = typeof payload.page === 'string' ? payload.page : '';
            const pageDocument = new DOMParser().parseFromString(pageHtml, 'text/html');
            const nextHref = pageDocument.querySelector('a[rel="next"]')?.getAttribute('href');
            if (!nextHref) return { checked: false, count: null, name: null };
            const nextUrl: URL = new URL(nextHref, url.href);
            if (
                nextUrl.origin !== window.location.origin ||
                nextUrl.pathname !== '/users/simple_lists'
            ) {
                return null;
            }
            url = nextUrl;
        }
        return null;
    } catch (error) {
        console.error(`${LOG_PREFIX} 查询 JavDB 权威清单状态失败`, error);
        return null;
    }
}

async function commitAuthoritativeState(
    entry: PendingServerSync,
    authoritative: AuthoritativeCheckboxState,
    notify: boolean
): Promise<boolean> {
    const listInfo: ListInfo = {
        ...entry.listInfo,
        info: {
            ...entry.listInfo.info,
            name: authoritative.name || entry.listInfo.info.name
        }
    };
    let reconciledBeforeCommit = false;
    if (authoritative.count !== null) {
        const before = await VltDb.getListReconcileState(
            entry.listInfo.list_id,
            entry.movieInfo.designation
        );
        const projectedCount =
            before.actualCount +
            (authoritative.checked && before.hasDesignation === false
                ? 1
                : !authoritative.checked && before.hasDesignation === true
                  ? -1
                  : 0);
        if (projectedCount !== authoritative.count) {
            reconciledBeforeCommit = await reconcileListWithJavdb(entry.listInfo.list_id, {
                expectedCount: authoritative.count,
                designation: entry.movieInfo.designation,
                checked: authoritative.checked,
                quiet: !notify
            });
            if (!reconciledBeforeCommit) return false;
        }
    }

    const result = await handleCheckboxChange(
        entry.movieInfo,
        listInfo,
        authoritative.checked,
        {
            serverConfirmed: true,
            silent: !notify || reconciledBeforeCommit,
            skipAutomation: !notify
        }
    );
    if (!result) return false;

    setListCheckboxState(entry.listInfo.list_id, authoritative.checked);
    if (authoritative.count !== null) {
        setListDisplayedCount(entry.listInfo.list_id, authoritative.count);
        const state = await VltDb.getListReconcileState(
            entry.listInfo.list_id,
            entry.movieInfo.designation
        );
        if (
            state.inventory &&
            (state.actualCount !== authoritative.count ||
                state.hasDesignation !== authoritative.checked)
        ) {
            return reconcileListWithJavdb(entry.listInfo.list_id, {
                expectedCount: authoritative.count,
                designation: entry.movieInfo.designation,
                checked: authoritative.checked,
                quiet: !notify
            });
        }
    }
    return true;
}

async function withAssociationLock(key: string, task: () => Promise<void>): Promise<void> {
    if (!navigator.locks) {
        await task();
        return;
    }
    await navigator.locks.request(`javdb-power-tools:vlt:${key}`, { mode: 'exclusive' }, task);
}

function enqueueAssociationTask(key: string, task: () => Promise<void>): Promise<void> {
    const previous = checkboxMutationQueues.get(key) || Promise.resolve();
    const current = previous
        .catch(() => {})
        .then(() => withAssociationLock(key, task));
    checkboxMutationQueues.set(key, current);
    current.finally(() => {
        if (checkboxMutationQueues.get(key) === current) checkboxMutationQueues.delete(key);
    });
    return current;
}

async function recoverPendingServerSyncs(): Promise<void> {
    for (const { key, entry } of readPendingJournals()) {
        const associationKey = `${entry.movieInfo.designation}::${entry.listInfo.list_id}`;
        await enqueueAssociationTask(associationKey, async () => {
            const authoritative = await fetchAuthoritativeCheckboxState(
                entry.videoId,
                entry.listInfo.list_id
            );
            if (!authoritative) return;
            if (await commitAuthoritativeState(entry, authoritative, false)) {
                removePendingJournal(key);
                console.log(
                    `${LOG_PREFIX} 已恢复未完成清单同步：${entry.movieInfo.designation} ` +
                        `${authoritative.checked ? 'add' : 'remove'} ${entry.listInfo.list_id}`
                );
            }
        });
    }
}

async function performServerCheckboxMutation(
    movieInfo: MovieInfo,
    listInfo: ListInfo,
    checked: boolean,
    input: HTMLInputElement | null,
    checkedBeforeMutation: boolean
): Promise<void> {
    const listId = listInfo.list_id;
    let confirmedChecked: boolean | null = null;
    setListCheckboxState(listId, checked);
    setListCheckboxBusy(listId, true);

    try {
        if (input) {
            await reconcileListBeforeMutation(input, movieInfo.designation, checkedBeforeMutation);
        }

        const pending: PendingServerSync = {
            version: 1,
            videoId: input?.value || movieInfo.info.href.match(/\/v\/([^/?#]+)/)?.[1] || '',
            desiredChecked: checked,
            movieInfo,
            listInfo,
            createdAt: Date.now()
        };
        if (!pending.videoId) throw new Error('无法识别 JavDB 影片 ID');
        const journalKey = createPendingJournal(pending);
        if (!journalKey) throw new Error('无法建立清单同步恢复日志，本次操作已取消');
        const serverResult = await postJavdbListMutation(pending.videoId, listId, checked);

        if (serverResult.kind === 'rejected') {
            removePendingJournal(journalKey);
            setListCheckboxState(listId, checkedBeforeMutation);
            showToast(`✗ JavDB 清单更新失败：${serverResult.message}`, 'error');
            return;
        }

        if (serverResult.kind === 'unknown') {
            // POST 可能仍在服务端排队；紧随其后的 GET 即使读到旧值也不能证明 POST
            // 最终未生效，因此本轮绝不写本地、绝不清日志，留到下次页面加载再确认。
            const observed = await fetchAuthoritativeCheckboxState(pending.videoId, listId);
            setListCheckboxState(listId, observed?.checked ?? checkedBeforeMutation);
            if (observed?.count !== null && observed?.count !== undefined) {
                setListDisplayedCount(listId, observed.count);
            }
            showToast(
                `⚠ 无法确认 JavDB 最终状态（${serverResult.message}），本地未改动；下次打开页面会自动核对`,
                'warning'
            );
            return;
        }

        confirmedChecked = checked;
        const authoritative = await fetchAuthoritativeCheckboxState(pending.videoId, listId);
        if (authoritative) {
            confirmedChecked = authoritative.checked;
            if (await commitAuthoritativeState(pending, authoritative, true)) {
                removePendingJournal(journalKey);
            } else {
                showToast(
                    '⚠ JavDB 已更新，本地完整清单将在下次打开页面时继续校准',
                    'warning'
                );
            }
            return;
        }

        // success=true 已确认本次服务端请求被接受；若轻量权威查询临时失败，先用
        // 完整清单快照校准，禁止在旧集合上盲目 ±1。快照失败时保留原本地状态与日志。
        setListCheckboxState(listId, checked);
        const reconciled = await reconcileAfterConfirmedMutation(
            listId,
            movieInfo.designation,
            checked
        );
        const result = reconciled
            ? await handleCheckboxChange(movieInfo, listInfo, checked, {
                  serverConfirmed: true
              })
            : null;
        if (result) {
            removePendingJournal(journalKey);
        } else {
            showToast(
                '⚠ JavDB 已更新，但暂时无法复核最终清单；恢复日志已保留',
                'warning'
            );
        }
    } catch (error) {
        setListCheckboxState(
            listId,
            confirmedChecked === null ? checkedBeforeMutation : confirmedChecked
        );
        const message = error instanceof Error ? error.message : String(error);
        console.error(`${LOG_PREFIX} JavDB 清单同步失败`, error);
        showToast(
            confirmedChecked === null
                ? `✗ JavDB 清单同步失败：${message}`
                : `⚠ JavDB 已更新，本地镜像将在下次打开页面时继续恢复：${message}`,
            confirmedChecked === null ? 'error' : 'warning'
        );
    } finally {
        setListCheckboxBusy(listId, false);
    }
}

function enqueueServerCheckboxMutation(
    movieInfo: MovieInfo,
    listInfo: ListInfo,
    checked: boolean,
    input: HTMLInputElement | null,
    checkedBeforeMutation: boolean
): Promise<void> {
    const key = `${movieInfo.designation}::${listInfo.list_id}`;
    return enqueueAssociationTask(key, () =>
        performServerCheckboxMutation(
            movieInfo,
            listInfo,
            checked,
            input,
            checkedBeforeMutation
        )
    );
}

/**
 * 接管 JavDB 原生清单 checkbox：先等待 `/users/save_video_to_list` 明确成功，
 * 再写本地 IDB。网络结果不确定时保留恢复日志，下次加载后用
 * `/users/simple_lists` 的最终权威状态恢复。
 */
export function setupCheckboxListener(): void {
    if (checkboxListenerInstalled) return;
    checkboxListenerInstalled = true;

    document.addEventListener(
        'change',
        (event: Event) => {
            const input = event.target as HTMLInputElement;
            if (
                input.tagName !== 'INPUT' ||
                input.type !== 'checkbox' ||
                input.dataset.action !== 'change->list#listCheckboxChanged' ||
                !input.closest('#modal-save-list')
            ) {
                return;
            }

            // 捕获阶段阻止 Stimulus 再发第二个相同请求；平铺面板事件会先映射到这里。
            event.preventDefault();
            event.stopImmediatePropagation();

            const checked = input.checked;
            const checkedBeforeMutation = !checked;
            const movieInfo = getMovieInfo(input.value);
            const listInfo = getListInfo(input.dataset.listId || '');
            if (!movieInfo || !listInfo.list_id || !listInfo.info.name) {
                setListCheckboxState(listInfo.list_id, checkedBeforeMutation);
                showToast('✗ 无法读取影片或清单信息，本次操作已取消', 'error');
                return;
            }

            enqueueServerCheckboxMutation(
                movieInfo,
                listInfo,
                checked,
                input,
                checkedBeforeMutation
            ).then();
        },
        true
    );

    const currentVideoId = window.location.pathname.match(/\/v\/([^/?#]+)/)?.[1];
    const currentMovie = currentVideoId ? getMovieInfo(currentVideoId) : null;
    if (currentMovie) setupAutomaticListReconciliation(currentMovie.designation);
    recoverPendingServerSyncs().then();
}

/* ============================================================
 * 新增清单功能（修复展开面板下原生弹窗不可达 + 自动同步关联）
 * ============================================================
 *
 * 背景：
 * 原生「存入清单」模态框被 CSS 永久隐藏（rating-bar.css
 * `#modal-save-list{display:none}`），其 footer 的「創建新清单」按钮
 * 对用户不可达，导致展开布局下新增清单功能失效。
 *
 * 方案（零侵入已定稿插件，与网站原始功能相符）：
 * 1. 在 .jhs-list-panel 后方插入一份同款 Bulma 风格的「➕ 新增清单」
 *    UI（按钮 + 行内表单）。
 * 2. 提交时改用 GM_xmlhttpRequest 直接发 ajax POST /lists/remote_create
 *    （doc/58 终极修复：原方案驱动原生 #new_list 表单 submit，依赖
 *    Rails UJS data-remote 拦截，但 JavDB 已迁移到 Turbo，data-remote
 *    不再被拦截 → submitBtn.click() 触发常规表单 POST → 页面导航 →
 *    脚本环境卸载 → 所有后续效果丢失。改用 GM_xmlhttpRequest 完全
 *    绕过原生表单链路，自控请求与响应）。从 #new_list 表单收集字段
 *    （list[name]/video_id/authenticity_token）+ meta csrf-token，
 *    服务端创建清单后自动关联当前视频。
 * 3. 响应处理（doc/59 修复）：服务端响应仅为 `Toastr.success("...")` JS，
 *    不含 list-id、不更新 DOM。故多级兜底：轮询 2s 检测 listContainer 更新 →
 *    从响应正则提取 data-list-id → GET /users/lists 匹配清单名称提取 list-id →
 *    手动克隆 checkbox 构建。检测到后直接调用
 *    handleCheckboxChange(movieInfo, listInfo, true) 完成本地 IDB 同步，
 *    彻底消除手动「取消关联→再关联」步骤（用户核心诉求）。
 *
 * doc/57 修复（已失效）：挂 modal + 200ms 轮询。无效（原生表单 POST 导致
 * 页面导航，无新 checkbox 出现在 DOM 中）。
 * doc/58 修复：改用 GM_xmlhttpRequest 绕过原生表单。但响应无 list-id。
 * doc/59 修复：增加 GET /users/lists 查找新清单 list-id 兜底（失效：
 *   页面通过 JS 动态加载清单数据，原始 HTML 不含清单列表）。
 * doc/60 修复：增加 #save-list-button 切换重载兜底：点击两次（关闭→
 *   重新打开模态框），触发 JavDB 原生 Stimulus list 控制器重新 ajax
 *   加载清单列表，获取含新 checkbox 的完整 DOM。
 */

/** 新增清单 UI 是否已注入（幂等标记）。 */
let _createListUiInjected = false;

/**
 * 在 .jhs-list-panel 后插入「新增清单」UI。
 * 由于 .jhs-list-panel 由 DetailPageButtonPlugin 异步创建，此处轮询等待。
 */
export function setupCreateListButton(): void {
    if (_createListUiInjected) return;
    const panel = document.querySelector('.jhs-list-panel');
    if (!panel) {
        setTimeout(setupCreateListButton, 400);
        return;
    }
    if (document.querySelector('.jhs-list-create-wrap')) {
        _createListUiInjected = true;
        return;
    }
    const wrap = document.createElement('div');
    wrap.className = 'jhs-list-create-wrap';
    wrap.innerHTML =
        '<button type="button" class="button is-info is-small jhs-list-create-btn">➕ 新增清单</button>' +
        '<span class="jhs-list-create-form" style="display:none;">' +
        '<input type="text" class="input is-small jhs-list-create-input" placeholder="输入新清单名稱" maxlength="50" />' +
        '<button type="button" class="button is-info is-small jhs-list-create-save">保存</button>' +
        '<button type="button" class="button is-light is-small jhs-list-create-cancel">取消</button>' +
        '</span>';
    panel.insertAdjacentElement('afterend', wrap);
    bindCreateListEvents(wrap);
    _createListUiInjected = true;
}

/**
 * 绑定新增清单 UI 的事件。
 */
function bindCreateListEvents(wrap: HTMLElement): void {
    const btn = wrap.querySelector('.jhs-list-create-btn') as HTMLButtonElement;
    const form = wrap.querySelector('.jhs-list-create-form') as HTMLElement;
    const input = wrap.querySelector('.jhs-list-create-input') as HTMLInputElement;
    const saveBtn = wrap.querySelector('.jhs-list-create-save') as HTMLButtonElement;
    const cancelBtn = wrap.querySelector('.jhs-list-create-cancel') as HTMLButtonElement;

    btn.addEventListener('click', () => {
        btn.style.display = 'none';
        form.style.display = 'inline-flex';
        input.value = '';
        input.focus();
    });

    cancelBtn.addEventListener('click', () => {
        form.style.display = 'none';
        btn.style.display = 'inline-flex';
        input.value = '';
    });

    saveBtn.addEventListener('click', () => {
        const name = input.value.trim();
        if (!name) {
            showToast('请输入清单名稱', 'warning');
            input.focus();
            return;
        }
        createList(name).then();
    });

    input.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveBtn.click();
        } else if (e.key === 'Escape') {
            cancelBtn.click();
        }
    });
}

/**
 * 创建新清单并自动关联当前影片。
 *
 * doc/56 原方案驱动原生 #new_list 表单 submit（`submitBtn.click()`），依赖
 * Rails UJS `data-remote` 拦截为 ajax。但实测：JavDB 已迁移到 Turbo，
 * `data-remote="true"` 不再被拦截 → `submitBtn.click()` 触发的是**常规表单
 * POST**（非 ajax），页面导航到 `/lists/remote_create`，脚本环境被卸载，
 * 所有 setTimeout/MutationObserver/setInterval 全部销毁。服务端虽创建了
 * 清单（刷新后可见），但客户端无任何后续效果（无 toast、无 IDB 同步、
 * 无自动收藏），且 listContainer 未被更新。doc/57 的「挂 modal + 轮询」
 * 修复也无效，因为根本没有新 checkbox 出现在 DOM 中。
 *
 * doc/58-59 修复：改用 `GM_xmlhttpRequest` 直接发 ajax POST，自控请求
 * 与响应。服务端响应仅为 `Toastr.success("...")` JS，不含 list-id、
 * 不含 HTML 片段、不更新 listContainer。
 *
 * doc/60 修复（增加多级兜底，按优先级依次尝试）：
 * 1. 从 #new_list 表单收集字段 + meta csrf-token，GM_xmlhttpRequest POST
 * 2. 注入 `<script>` 执行 JS 响应（显示 JavDB 原生 Toastr 通知）
 * 3. 轮询 2s 检测 listContainer 是否被更新（若响应含 DOM 更新）
 * 4. 从响应正则提取 data-list-id 并手动构建 checkbox
 * 5. **核心兜底**：点击 #save-list-button 两次（关闭→重新打开模态框），
 *    触发 JavDB 原生 Stimulus list 控制器重新 ajax 加载清单列表（含新清单
 *    的 checkbox），轮询 5s 检测新 checkbox
 * 6. **最后兜底**：GET /users/lists 页面解析 /lists/{id} 链接匹配清单名
 *    （可能因页面 JS 动态加载而失效）
 * 7. 完成：refreshListPanel() 刷新平铺面板 + handleCheckboxChange(add)
 *    同步本地 IDB + 三重广播 + 自动收藏
 *
 * @param listName 新清单名称
 */
async function createList(listName: string): Promise<void> {
    const modal = document.querySelector('#modal-save-list');
    if (!modal) {
        showToast('✗ 未找到存入清单弹窗，请重新进入详情页', 'error');
        return;
    }
    const nameInput = modal.querySelector(
        'input[data-list-target="listNewNameInput"]'
    ) as HTMLInputElement | null;
    const form = modal.querySelector('#new_list') as HTMLFormElement | null;
    const listContainer = modal.querySelector(
        '[data-list-target="listContainer"]'
    ) as HTMLElement | null;
    if (!nameInput || !form || !listContainer) {
        showToast('✗ 清单建立表单未就绪，请重新进入详情页', 'error');
        return;
    }

    // ── 收集表单字段 ──
    const formData: Record<string, string> = {};
    Array.from(form.querySelectorAll('input, textarea, select')).forEach((el: any) => {
        if (el.name && el.type !== 'submit' && el.type !== 'button' && el.type !== 'reset') {
            formData[el.name] = el.value;
        }
    });
    // 用新清单名覆盖名称字段（nameInput.name 通常是 list[name]）
    if (nameInput.name) {
        formData[nameInput.name] = listName;
    }

    // ── CSRF token ──
    const csrfMeta = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null;
    const csrfToken = csrfMeta?.content || formData['authenticity_token'] || '';

    // ── 提交前快照 ──
    const beforeIds = new Set(
        Array.from(listContainer.querySelectorAll('input[type="checkbox"][data-list-id]')).map(
            (el: any) => el.dataset.listId
        )
    );
    const videoId =
        formData['video_id'] ||
        (form.querySelector('input[name="video_id"]') as HTMLInputElement | null)?.value ||
        '';

    // ── 还原我们的展开 UI（立即恢复，不等待请求完成） ──
    restoreCreateListUi();

    showToast('正在建立清单…', 'info');
    console.log(`${LOG_PREFIX} ═══ 新增清单「${listName}」(video_id=${videoId}) ═══`);

    // ── 发送 ajax 请求 ──
    let responseText = '';
    try {
        responseText = await new Promise<string>((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: 'https://javdb.com/lists/remote_create',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                    Accept: 'text/javascript, application/javascript, application/ecmascript, application/x-ecmascript, */*;q=0.01',
                    'X-CSRF-Token': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest'
                },
                data: Object.entries(formData)
                    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
                    .join('&'),
                timeout: 15000,
                onload: (r: any) => {
                    if (r.status >= 200 && r.status < 300) {
                        resolve(r.responseText || '');
                    } else {
                        reject(
                            new Error(`HTTP ${r.status}: ${r.responseText?.slice(0, 200) || ''}`)
                        );
                    }
                },
                onerror: () => reject(new Error('网络错误')),
                ontimeout: () => reject(new Error('请求超时'))
            });
        });
    } catch (err: any) {
        console.error(`${LOG_PREFIX} 新增清单失败`, err);
        showToast(`✗ 新增清单失败：${err.message || '请稍后重試'}`, 'error');
        return;
    }

    console.log(`${LOG_PREFIX} 服务端响应（前 500 字）: ${responseText.slice(0, 500)}`);

    // ── 在页面上下文执行 JS 响应 ──
    // 服务端返回的是 JS（如 Toastr.success("...")），注入 <script> 执行，
    // 让 JavDB 原生 Toastr 通知正常显示。
    if (responseText.trim()) {
        try {
            const script = document.createElement('script');
            script.textContent = responseText;
            (document.body || document.documentElement).appendChild(script);
            script.remove();
            console.log(`${LOG_PREFIX} JS 响应已注入执行`);
        } catch (e) {
            console.warn(`${LOG_PREFIX} JS 响应注入失败`, e);
        }
    }

    // ── 快速检测列表是否被 JS 响应直接更新（最多 200ms） ──
    // JavDB 的响应通常是 Toastr.success，不会更新 DOM，所以很短的轮询
    // 即可。保留这段是为了应对响应格式可能变化（保险）。
    let newCheckboxes = await pollForNewCheckboxes(modal, beforeIds, 200);
    if (newCheckboxes.length > 0) {
        console.log(`${LOG_PREFIX} 侦测到 ${newCheckboxes.length} 个新 checkbox，走正常完成流程`);
        finishCreateList(newCheckboxes, listName);
        return;
    }

    // ── 从响应提取 list-id（若响应含 HTML 片段） ──
    const listIdMatch = responseText.match(/data-list-id=["']([^"']+)["']/);
    if (listIdMatch) {
        const listId = listIdMatch[1];
        const manualCb = manuallyBuildCheckbox(listContainer, listId, listName, videoId);
        if (manualCb) {
            console.log(`${LOG_PREFIX} 从响应提取 list-id 成功 (list_id=${listId})`);
            finishCreateList([manualCb], listName);
            return;
        }
    }

    // ── 核心兜底：通过切换 #save-list-button 重新加载模态框的清单列表 ──
    // 服务端响应只有 Toastr.success，不含 list-id、不更新 DOM。
    // 但 JavDB 的 Stimulus list 控制器在模态框打开时会 ajax 加载清单列表，
    // 新建清单后关闭再打开即可拉取到含新清单的完整列表（包含新 checkbox）。
    console.log(`${LOG_PREFIX} 响应无 list-id，通过切换 #save-list-button 重载清单列表`);
    const saveListBtn = document.querySelector('#save-list-button') as HTMLElement | null;
    if (saveListBtn) {
        // 第一次点击：关闭模态框（Stimulus 切换状态）
        saveListBtn.click();
        // 等待 Stimulus 处理关闭（短延迟可避免下次开关合并）
        await new Promise((r) => setTimeout(r, 200));
        // 第二次点击：重新打开模态框（触发 ajax 加载新清单列表）
        saveListBtn.click();
        // 轮询检测新增 checkbox（最多 5s）
        newCheckboxes = await pollForNewCheckboxes(modal, beforeIds, 5000);
        if (newCheckboxes.length > 0) {
            console.log(
                `${LOG_PREFIX} 重载后侦测到 ${newCheckboxes.length} 个新 checkbox，走正常完成流程`
            );
            finishCreateList(newCheckboxes, listName);
            return;
        }
    }

    // ── 最后兜底：尝试 GET /users/lists 查找 list-id（可能因 JS 动态加载而失败） ──
    console.log(`${LOG_PREFIX} 按钮重载未找到新 checkbox，尝试 /users/lists 作为最后手段`);
    const listId = await fetchListIdByName(listName);
    if (listId) {
        const manualCb = manuallyBuildCheckbox(listContainer, listId, listName, videoId);
        if (manualCb) {
            console.log(`${LOG_PREFIX} 从 /users/lists 查得 list_id=${listId}，手动构建 checkbox`);
            finishCreateList([manualCb], listName);
            return;
        }
    }

    // ── 全部失败 ──
    // 服务端可能已创建清单（HTTP 200），但无法定位新 checkbox。
    // 仍尝试刷新平铺面板，并提示用户。
    console.error(
        `${LOG_PREFIX} 新增清单后无法定位新 checkbox。响应前 300 字: ${responseText.slice(0, 300)}`
    );
    refreshListPanel();
    showToast(`⚠ 清单「${listName}」可能已建立，请刷新页面确认`, 'warning');
}

/**
 * 轮询检测 modal 内 listContainer 是否出现新增 checkbox。
 *
 * @param modal     #modal-save-list 元素
 * @param beforeIds 提交前快照的 data-list-id 集合
 * @param timeoutMs 超时毫秒
 * @returns 新增的 checkbox 数组（超时则为空数组）
 */
function pollForNewCheckboxes(
    modal: Element,
    beforeIds: Set<string | undefined>,
    timeoutMs: number
): Promise<HTMLInputElement[]> {
    return new Promise((resolve) => {
        const start = Date.now();
        const check = () => {
            const lc = modal.querySelector('[data-list-target="listContainer"]');
            if (lc) {
                const after = Array.from(
                    lc.querySelectorAll('input[type="checkbox"][data-list-id]')
                ) as HTMLInputElement[];
                const newOnes = after.filter((cb) => !beforeIds.has(cb.dataset.listId));
                if (newOnes.length > 0) {
                    resolve(newOnes);
                    return;
                }
            }
            if (Date.now() - start < timeoutMs) {
                setTimeout(check, 100);
            } else {
                resolve([]);
            }
        };
        check();
    });
}

/**
 * 通过 GET /users/lists 查找指定名称的清单 ID。
 *
 * JavDB 的 /lists/remote_create 响应仅返回 Toastr.success("...") JS，
 * 不含新清单的 list-id。为完成本地 IDB 同步，需额外请求 /users/lists
 * 页面，解析其中指向 /lists/{id} 的链接，匹配清单名称后提取 id。
 *
 * @param listName 新清单名称
 * @returns list-id 字符串，找不到返回 null
 */
async function fetchListIdByName(listName: string): Promise<string | null> {
    try {
        const html: string = await new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: 'https://javdb.com/users/lists',
                timeout: 10000,
                onload: (r: any) => {
                    if (r.status >= 200 && r.status < 300) {
                        resolve(r.responseText || '');
                    } else {
                        reject(new Error(`HTTP ${r.status}`));
                    }
                },
                onerror: () => reject(new Error('网络错误')),
                ontimeout: () => reject(new Error('请求超时'))
            });
        });

        // 解析 HTML，查找指向 /lists/{id} 的链接中匹配清单名称的项。
        // 注意：/users/lists 页面可能通过 JS（Turbo/Stimulus）动态加载
        // 清单数据，服务端返回的原始 HTML 中可能不包含清单列表。此时此
        // 兜底方案会失败，依赖前面的 #save-list-button 重载方案。
        const doc = new DOMParser().parseFromString(html, 'text/html');

        // 先尝试直接匹配 a[href*="/lists/"]
        let links = doc.querySelectorAll('a[href*="/lists/"]');
        if (links.length === 0) {
            // 可能页面结构不同，尝试更宽泛的查找
            links = doc.querySelectorAll('[href*="/lists/"]');
        }

        console.log(`${LOG_PREFIX} /users/lists 页面解析到 ${links.length} 条 /lists/ 链接`);

        for (const link of Array.from(links)) {
            const href = (link as Element).getAttribute('href') || '';
            // 提取 /lists/{id} 中的 id（排除 /users/lists 自身）
            const m = href.match(/\/lists\/([^/?#]+)/);
            if (!m) continue;
            const id = m[1];
            if (id === 'users' || id === '' || id === 'new') continue;
            // 匹配清单名称
            const text = (link as Element).textContent || '';
            if (text.trim().includes(listName)) {
                console.log(`${LOG_PREFIX} /users/lists 匹配到清单「${listName}」→ list_id=${id}`);
                return id;
            }
        }

        // 未匹配到：打印部分 HTML 以便排查
        const bodyText = doc.body?.textContent?.slice(0, 1000) || '';
        console.warn(
            `${LOG_PREFIX} /users/lists 未找到名称含「${listName}」的清单（共 ${links.length} 条链接）。` +
                `页面文本前 500 字: ${bodyText.slice(0, 500)}`
        );
        return null;
    } catch (err: any) {
        console.error(`${LOG_PREFIX} 获取 /users/lists 失败`, err);
        return null;
    }
}

/**
 * 手动构建新清单的 checkbox 并插入 listContainer（兜底方案）。
 *
 * 克隆 listContainer 内已有的一个 checkbox <label>，修改 data-list-id /
 * value / 文案 / checked，插入 listContainer 末尾。这样即使 JS 响应未成功
 * 更新 DOM，也能让平铺面板和后续同步流程拿到合法的 checkbox 元素。
 *
 * @param listContainer 原生清单容器
 * @param listId        从响应提取的新清单 ID
 * @param listName      新清单名称
 * @param videoId       当前影片 ID
 * @returns 构建的新 checkbox input 元素，失败返回 null
 */
function manuallyBuildCheckbox(
    listContainer: HTMLElement,
    listId: string,
    listName: string,
    videoId: string
): HTMLInputElement | null {
    // 找一个已有的 checkbox label 作为模板克隆
    const existingCb = listContainer.querySelector(
        'input[type="checkbox"][data-list-id]'
    ) as HTMLInputElement | null;
    if (!existingCb) return null;
    const existingLabel = existingCb.closest('label');
    if (!existingLabel) return null;

    const clone = existingLabel.cloneNode(true) as HTMLElement;
    const cb = clone.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    if (!cb) return null;
    cb.dataset.listId = listId;
    cb.value = videoId;
    cb.checked = true;
    // Stimulus action 属性保留（克隆已带）

    // 更新 label 文案为「清单名 (1)」——尝试替换最后一个 (N) 计数
    // label 文本结构通常是「清单名 (count)」，克隆后改成新名 + (1)
    const textNodes = Array.from(clone.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE);
    if (textNodes.length > 0) {
        // 替换最后一个文本节点的计数部分
        const lastText = textNodes[textNodes.length - 1] as Text;
        lastText.nodeValue = ` ${listName} (1)`;
    } else {
        // 无独立文本节点，追加
        clone.append(` ${listName} (1)`);
    }

    listContainer.appendChild(clone);
    return cb;
}

/**
 * 新建清单完成态：toast + 刷新平铺面板 + 触发本地 IDB 同步 + 还原 UI。
 *
 * @param newCheckboxes 检测/构建出的新增 checkbox 数组
 * @param listName      新清单名称（用于 toast 文案）
 */
function finishCreateList(newCheckboxes: HTMLInputElement[], listName: string): void {
    // 还原 newListArea 状态（点击 list#cancelNewList，避免下次打开仍在新增态）
    const modal = document.querySelector('#modal-save-list');
    if (modal) {
        try {
            const cancelLink = modal.querySelector(
                'a[data-action="list#cancelNewList"]'
            ) as HTMLAnchorElement | null;
            cancelLink?.click();
        } catch {}
    }

    restoreCreateListUi();
    showToast(`✓ 清单「${listName}」已建立，已自动关联當前影片`, 'success');

    // 立即刷新 .jhs-list-panel 平铺面板
    refreshListPanel();

    // 对每个新增 checkbox，触发本地 IDB 同步（核心优化：消除手动取消/关联步骤）
    for (const cb of newCheckboxes) {
        const movieInfo = getMovieInfo(cb.value);
        if (!movieInfo) {
            console.warn(`${LOG_PREFIX} 新建清单后无法取得影片资讯，跳过同步`, cb);
            continue;
        }
        const listInfo = getListInfo(cb.dataset.listId || '');
        if (!listInfo.info.name) {
            // 手动构建的 checkbox 文案可能读不到名称，用 listName 兜底
            console.warn(
                `${LOG_PREFIX} 新建清单后无法从 DOM 取得清单名稱，使用传入名稱「${listName}」`
            );
        }
        // JavDB 创建清单时已自动关联当前视频，只提交本地镜像，禁止再发第二次服务端请求
        handleCheckboxChange(movieInfo, listInfo, true, { serverConfirmed: true }).then();
    }
}

/**
 * 还原「新增清单」展开 UI 到初始按钮态。幂等。
 */
function restoreCreateListUi(): void {
    const w = document.querySelector('.jhs-list-create-wrap') as HTMLElement | null;
    if (!w) return;
    const btn = w.querySelector('.jhs-list-create-btn') as HTMLElement | null;
    const f = w.querySelector('.jhs-list-create-form') as HTMLElement | null;
    const inp = w.querySelector('.jhs-list-create-input') as HTMLInputElement | null;
    if (btn) btn.style.display = 'inline-flex';
    if (f) f.style.display = 'none';
    if (inp) inp.value = '';
}

/**
 * 刷新 `.jhs-list-panel` 平铺面板：从 modal 内最新 listContainer 克隆全部
 * 条目（跳过「预设清单」），与 DetailPageButtonPlugin._initListPanel 的 sync
 * 逻辑等价、幂等。
 *
 * 用途：新建清单后，若 _initListPanel 的 MutationObserver 因 listContainer
 * 被替换而失效，不会自动 clone 新条目到平铺面板，用户需刷新页面才能看到
 * 新清单。此处主动重建，消除该等待。
 */
function refreshListPanel(): void {
    const panel = document.querySelector('.jhs-list-panel');
    if (!panel) return;
    const lc = document.querySelector('#modal-save-list [data-list-target="listContainer"]');
    if (!lc) return;
    panel.innerHTML = '';
    Array.from(lc.children).forEach((child: any) => {
        // 跳过「预设清单」/「預設清單」（简/繁体均匹配）
        if (/[预預][设設]清[单單]/.test(child.textContent)) return;
        panel.appendChild(child.cloneNode(true));
    });
}

/* ============================================================
 * /users/lists 页面：删除/改名清单监听 → 同步本地 IDB（doc/61）
 * ============================================================
 *
 * 背景：
 * 用户在 /users/lists 管理页面删除或改名清单后，JavDB 服务端数据已变更，
 * 但本地 IndexedDB（VltDb 的 vlt_inventory / vlt_movie_inventory）仍保留
 * 旧数据，导致标签显示与筛选不再与服务端一致。
 *
 * 方案（拦截原生操作 + 自行发请求 + 实时广播）：
 * 1. 删除：捕获阶段拦截删除链接 click → preventDefault → 自行 confirm →
 *    GM_xmlhttpRequest DELETE /users/remove_list?id=<listId> →
 *    成功后 VltDb.deleteList() + 广播 + 移除 DOM <li> + toast
 *    （不用 MutationObserver 等 DOM 移除——JavDB 删除后不实时移除 <li>，
 *     需刷新才消失，observer 永远不触发）
 * 2. 改名：捕获阶段拦截保存按钮 click → preventDefault →
 *    GM_xmlhttpRequest POST /users/update_list {id, name} →
 *    成功后 VltDb.renameList() + 广播 + 更新 DOM .list-name + 关闭弹窗 + toast
 *    （Stimulus list#updateList 的 ajax 虽能更新 DOM，但无法实时广播，
 *     且拦截后自行控制全链路更可靠）
 * 3. 三重广播 jdb:list-mgmt → 详情页移除/更新 checkbox + 列表页 refreshAllTags
 */

/** 清单管理广播键（独立通道，不与 jdb:last-sync 混用）。 */
const LIST_MGMT_KEY = 'jdb:list-mgmt';

/** 从删除链接 href 提取 listId（/users/remove_list?id=<listId>）。 */
function extractListIdFromHref(href: string): string | null {
    const m = href.match(/[?&]id=([^&]+)/);
    return m ? m[1] : null;
}

/** 获取 CSRF token（与 createList 同源，从 meta[name=csrf-token] 读取）。 */
function getCsrfToken(): string {
    const meta = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null;
    return meta?.content || '';
}

/**
 * 三重广播清单管理事件（删除/改名），独立通道 jdb:list-mgmt。
 * 接收方：详情页 setupListMgmtBroadcastListener（移除/更新 checkbox）+
 * 列表页 setupListMgmtBroadcastListener（refreshAllTags）。
 *
 * @param type 'delete' | 'rename'
 * @param listId 清单 ID
 * @param extra 额外字段（rename 时带 newName）
 */
function broadcastListMgmt(
    type: 'delete' | 'rename',
    listId: string,
    extra?: { newName?: string }
): void {
    const payload = { type, listId, newName: extra?.newName, time: Date.now() };
    const json = JSON.stringify(payload);
    try {
        GM_setValue(LIST_MGMT_KEY, json);
    } catch {}
    try {
        localStorage.setItem(LIST_MGMT_KEY, json);
    } catch {}
    try {
        document.dispatchEvent(new CustomEvent(LIST_MGMT_KEY, { detail: payload }));
    } catch {}
}

/**
 * 在 /users/lists 页面监听清单删除与改名，同步本地 IndexedDB。
 *
 * DOM 结构（每个清单条目）：
 * <li class="list-item columns" id="list-<listId>">
 *   <div class="column is-10">
 *     <a href="/lists/<listId>"><strong class="list-name">清单名</strong></a>
 *   </div>
 *   <div class="column is-2">
 *     <div class="operation field has-addons">
 *       <p class="control"><button ...>分享</button></p>
 *       <p class="control"><button data-list-id="<listId>" class="modal-edit-list-button">修改</button></p>
 *       <p class="control"><a href="/users/remove_list?id=<listId>" data-method="delete" data-remote="true" data-confirm="...">刪除</a></p>
 *     </div>
 *   </div>
 * </li>
 *
 * 编辑弹窗（Stimulus list 控制器管理）：
 * #modal-edit-list > .modal-card
 *   input[data-list-target="inputName"]  ← 清单名称输入框
 *   input[type=hidden][data-list-target="inputId"]  ← 清单 ID 隐藏域
 *   button[data-action="list#updateList"] ← 保存按钮
 *
 * 服务端 API（从 app.js 逆向确认）：
 * - 删除：DELETE /users/remove_list?id=<listId>，Rails UJS dataType=script
 * - 改名：POST /users/update_list {id, name}，返回 JSON {success, name, message}
 */
export function setupListManagementListener(): void {
    console.log(`${LOG_PREFIX} /users/lists 清单管理监听已启动`);

    // ===== 删除：拦截删除链接 click → 自行发 GM_xmlhttpRequest DELETE =====
    document.addEventListener(
        'click',
        (e: Event) => {
            const target = e.target as HTMLElement;
            const deleteLink = target.closest?.(
                'a[href*="remove_list"][data-method="delete"]'
            ) as HTMLAnchorElement | null;
            if (!deleteLink) return;

            // 阻止 Rails UJS / Turbo 处理（我们全权接管）
            e.preventDefault();
            e.stopPropagation();

            const href = deleteLink.getAttribute('href') || '';
            const listId = extractListIdFromHref(href);
            if (!listId) {
                console.warn(`${LOG_PREFIX} 删除链接无法提取 listId: ${href}`);
                return;
            }

            // 显示确认对话框（与原生 data-confirm 等价）
            const confirmMsg = deleteLink.dataset.confirm || '確認移除嗎?';
            if (!confirm(confirmMsg)) return;

            handleListDeletion(listId, href).then();
        },
        true // 捕获阶段，抢在 Rails UJS 之前
    );

    // ===== 改名：拦截保存按钮 click → 自行发 GM_xmlhttpRequest POST =====
    // 捕获阶段监听「修改」按钮 click，快照 listId + oldName（用于判断是否变化）
    const editing: { listId: string; oldName: string } = { listId: '', oldName: '' };

    document.addEventListener(
        'click',
        (e: Event) => {
            const target = e.target as HTMLElement;
            const editBtn = target.closest?.('.modal-edit-list-button') as HTMLElement | null;
            if (!editBtn) return;
            const listId = editBtn.dataset.listId || '';
            if (!listId) return;
            const li = editBtn.closest('[id^="list-"]');
            const nameEl = li?.querySelector('.list-name');
            editing.listId = listId;
            editing.oldName = nameEl?.textContent?.trim() || '';
            console.log(`${LOG_PREFIX} 编辑清单快照: listId=${listId} oldName=${editing.oldName}`);
        },
        true
    );

    // 捕获阶段监听弹窗「保存」按钮 click，自行发请求
    document.addEventListener(
        'click',
        (e: Event) => {
            const target = e.target as HTMLElement;
            const saveBtn = target.closest?.(
                '[data-action="list#updateList"]'
            ) as HTMLElement | null;
            if (!saveBtn) return;

            // 阻止 Stimulus list#updateList 执行（我们全权接管）
            e.preventDefault();
            e.stopPropagation();

            if (!editing.listId) {
                console.warn(`${LOG_PREFIX} 保存清单改名但无快照，跳过`);
                return;
            }
            const modal = document.querySelector('#modal-edit-list');
            const nameInput = modal?.querySelector(
                '[data-list-target="inputName"]'
            ) as HTMLInputElement | null;
            const newName = nameInput?.value?.trim() || '';
            if (!newName) {
                showToast('請輸入清單名稱', 'warning');
                return;
            }
            if (newName === editing.oldName) {
                console.log(`${LOG_PREFIX} 清单改名前后名称相同（${newName}），跳过`);
                // 关闭弹窗（名称未变，直接关闭）
                closeEditModal();
                return;
            }

            handleListRename(editing.listId, newName).then();
        },
        true
    );
}

/**
 * 关闭编辑弹窗（模拟 Stimulus 关闭：移除 is-active 类 + 重置 body）。
 */
function closeEditModal(): void {
    const modal = document.querySelector('#modal-edit-list');
    if (!modal) return;
    modal.classList.remove('is-active');
    document.documentElement.classList.remove('is-clipped');
}

/**
 * 处理清单删除：乐观 UI 移除 DOM → 并行发 DELETE 请求 + 删 IDB → 广播 + toast。
 *
 * 优化（doc/64）：原方案串行等待服务器响应后才移除 DOM，用户感知延迟大。
 * 现改为 confirm 后立即移除 DOM（乐观更新），网络请求与 IDB 删除并行执行。
 * 瓶颈分析：GM_xmlhttpRequest DELETE 等待 JavDB 服务器响应是最大延迟源
 * （服务器需删除清单 + 关联表 + 更新计数），IDB 操作（83KB / 3563 条）仅几十 ms。
 *
 * @param listId 清单 ID
 * @param href 删除链接的 href（/users/remove_list?id=<listId>）
 */
async function handleListDeletion(listId: string, href: string): Promise<void> {
    const csrfToken = getCsrfToken();
    if (!csrfToken) {
        showToast('✗ 无法获取 CSRF token，删除失败', 'error');
        return;
    }

    console.log(`${LOG_PREFIX} ═══ 删除清单 listId=${listId} ═══`);

    showToast('正在同步删除…', 'info');

    // 必须先确认 JavDB 删除成功，禁止服务器失败时仍提前清掉本地镜像。
    const serverOk = await sendDeleteRequest(href, csrfToken);
    if (!serverOk) {
        showToast('✗ JavDB 删除清单失败，本地数据未改动', 'error');
        return;
    }

    const idbResult = await VltDb.deleteList(listId);
    document.querySelector(`#list-${listId}`)?.remove();

    console.log(
        `${LOG_PREFIX} 删除完成: listId=${listId} server=${serverOk} inventory=${idbResult.inventory} associations=${idbResult.associations}`
    );

    // JavDB 与本地均成功后再广播
    broadcastListMgmt('delete', listId);

    showToast(`✓ 清单已删除（${idbResult.associations} 条关联已清除）`, 'success');
    console.log(`${LOG_PREFIX} ═══ 删除完成 ═══`);
}

/**
 * 发送 DELETE 请求到 JavDB 服务器删除清单。
 * @param href 删除链接 href（/users/remove_list?id=<listId>）
 * @param csrfToken CSRF token
 * @returns 服务器是否返回成功（HTTP 2xx/3xx）
 */
function sendDeleteRequest(href: string, csrfToken: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
        GM_xmlhttpRequest({
            method: 'DELETE',
            url: window.location.origin + href,
            headers: {
                'X-CSRF-Token': csrfToken,
                'X-Requested-With': 'XMLHttpRequest',
                Accept: 'text/javascript, application/javascript, application/xhtml+xml, */*'
            },
            timeout: 15000,
            onload: (r: any) => resolve(r.status >= 200 && r.status < 400),
            onerror: () => resolve(false),
            ontimeout: () => resolve(false)
        });
    });
}

/**
 * 处理清单改名：发 POST /users/update_list → 成功后同步 IDB + 广播 + 更新 DOM + toast。
 *
 * @param listId 清单 ID
 * @param newName 新清单名称
 */
async function handleListRename(listId: string, newName: string): Promise<void> {
    const csrfToken = getCsrfToken();
    if (!csrfToken) {
        showToast('✗ 无法获取 CSRF token，改名失败', 'error');
        return;
    }

    showToast('正在改名…', 'info');
    console.log(`${LOG_PREFIX} ═══ 改名清单 listId=${listId} newName=${newName} ═══`);

    try {
        const response = await new Promise<{ success: boolean; name: string; message: string }>(
            (resolve) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: 'https://javdb.com/users/update_list',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                        'X-CSRF-Token': csrfToken,
                        'X-Requested-With': 'XMLHttpRequest',
                        Accept: 'application/json, text/javascript, */*;q=0.01'
                    },
                    data: `id=${encodeURIComponent(listId)}&name=${encodeURIComponent(newName)}`,
                    timeout: 15000,
                    onload: (r: any) => {
                        if (r.status >= 200 && r.status < 300) {
                            try {
                                resolve(JSON.parse(r.responseText));
                            } catch {
                                resolve({
                                    success: false,
                                    name: '',
                                    message: '响应解析失败'
                                });
                            }
                        } else {
                            resolve({
                                success: false,
                                name: '',
                                message: `HTTP ${r.status}`
                            });
                        }
                    },
                    onerror: () => resolve({ success: false, name: '', message: '网络错误' }),
                    ontimeout: () => resolve({ success: false, name: '', message: '请求超时' })
                });
            }
        );

        if (!response.success) {
            showToast(`✗ 改名失败：${response.message || '未知错误'}`, 'error');
            return;
        }

        const finalName = response.name || newName;
        console.log(`${LOG_PREFIX} 服务端改名成功: listId=${listId} name=${finalName}`);

        // 1. 同步 IDB
        const ok = await VltDb.renameList(listId, finalName);
        if (ok) {
            console.log(`${LOG_PREFIX} IDB 清单改名完成: listId=${listId} name=${finalName}`);
        } else {
            console.warn(`${LOG_PREFIX} IDB 清单改名跳过: listId=${listId} 不在本地 inventory 中`);
        }

        // 2. 广播：通知所有页面（详情页更新 checkbox 标签 + 列表页刷新标签）
        broadcastListMgmt('rename', listId, { newName: finalName });

        // 3. 更新 DOM .list-name（与 Stimulus updateList 的 DOM 更新等价）
        const nameEl = document.querySelector(`#list-${listId} .list-name`);
        if (nameEl) {
            nameEl.textContent = finalName;
        }

        // 4. 关闭弹窗
        closeEditModal();

        // 5. toast
        showToast(`✓ 清单已改名为「${finalName}」`, 'success');
        console.log(`${LOG_PREFIX} ═══ 改名完成 ═══`);
    } catch (err: any) {
        console.error(`${LOG_PREFIX} 清单改名失败: listId=${listId}`, err);
        showToast(`✗ 清单改名失败：${err.message || '未知错误'}`, 'error');
    }
}

/* ============================================================
 * 广播接收：详情页 + 列表页监听 jdb:list-mgmt 事件
 * ============================================================ */

/**
 * 注册清单管理广播监听器（三重通道：GM / localStorage / CustomEvent）。
 *
 * 在详情页调用时，onDelete 移除对应清单 checkbox，onRename 更新标签文本；
 * 在列表页调用时，onDelete/onRename 均触发 refreshAllTags。
 *
 * @param onDelete 删除回调
 * @param onRename 改名回调
 */
export function setupListMgmtBroadcastListener(
    onDelete: (listId: string) => void,
    onRename: (listId: string, newName: string) => void
): void {
    /** 处理收到的广播 payload */
    const handlePayload = (payload: any): void => {
        if (!payload || !payload.type || !payload.listId) return;
        console.log(`${LOG_PREFIX} 收到清单管理广播:`, payload);
        if (payload.type === 'delete') {
            onDelete(payload.listId);
        } else if (payload.type === 'rename' && payload.newName) {
            onRename(payload.listId, payload.newName);
        }
    };

    // 1) 同脚本同页面（CustomEvent 即时）
    document.addEventListener(LIST_MGMT_KEY, (e: Event) => {
        handlePayload((e as CustomEvent).detail);
    });

    // 2) 跨脚本跨标签页（localStorage storage 事件，只在其他标签页触发）
    window.addEventListener('storage', (e: StorageEvent) => {
        if (e.key !== LIST_MGMT_KEY || !e.newValue) return;
        try {
            handlePayload(JSON.parse(e.newValue));
        } catch {}
    });

    // 3) 同脚本跨标签页（GM 原生通道）
    try {
        GM_addValueChangeListener(
            LIST_MGMT_KEY,
            (_name: string, _oldValue: any, newValue: any, _remote: boolean) => {
                if (!newValue) return;
                try {
                    handlePayload(JSON.parse(newValue));
                } catch {}
            }
        );
    } catch {}
}

/**
 * 详情页：移除指定清单的 checkbox（从 .jhs-list-panel 和 #modal-save-list 两处）。
 * @param listId 清单 ID
 */
export function removeDetailPageCheckbox(listId: string): void {
    // .jhs-list-panel（展开面板）
    const panelCb = document.querySelector(`.jhs-list-panel input[data-list-id="${listId}"]`);
    if (panelCb) {
        panelCb.closest('p.control')?.remove() || panelCb.closest('label')?.remove();
    }
    // #modal-save-list listContainer（隐藏原生弹窗）
    const modalCb = document.querySelector(`#modal-save-list input[data-list-id="${listId}"]`);
    if (modalCb) {
        modalCb.closest('p.control')?.remove() || modalCb.closest('label')?.remove();
    }
    console.log(`${LOG_PREFIX} 详情页已移除清单 ${listId} 的 checkbox`);
}

/**
 * 详情页：更新指定清单 checkbox 的标签文本。
 * @param listId 清单 ID
 * @param newName 新清单名称
 */
export function updateDetailPageCheckboxLabel(listId: string, newName: string): void {
    // 更新 .jhs-list-panel 和 #modal-save-list 两处
    const checkboxes = document.querySelectorAll(`input[data-list-id="${listId}"]`);
    checkboxes.forEach((cb: Element) => {
        const label = cb.closest('label');
        if (!label) return;
        // label 结构：<input> 清单名&nbsp; <span>(count)</span>
        // 保留 <span>(count)</span>，替换名称文本
        // 清空 label 内除 input 和 span 外的文本节点，再插入新名称
        Array.from(label.childNodes).forEach((node: Node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                node.textContent = '';
            }
        });
        // 在 input 后插入新名称文本
        const inputEl = label.querySelector('input');
        if (inputEl && inputEl.nextSibling) {
            inputEl.nextSibling.textContent = `\u00A0\n    ${newName}\u00A0\n    `;
        } else if (inputEl) {
            inputEl.insertAdjacentText('afterend', `\u00A0${newName}\u00A0`);
        }
    });
    console.log(`${LOG_PREFIX} 详情页已更新清单 ${listId} 的标签为「${newName}」`);
}
