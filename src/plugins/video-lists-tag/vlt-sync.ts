/**
 * 同步逻辑模块 —— 清单 checkbox 勾选/取消 → IDB 同步 + 三重广播。
 *
 * 提取自 archetype/listsOptionSync.user.js L334-600（getMovieInfo/getListInfo/
 * syncMoviesLists/handleCheckboxChange + change 事件监听）。
 *
 * 原脚本通过 GM_xmlhttpRequest POST /api/sync/movies_lists 同步到远程服务器，
 * 此处改为调用 VltDb.sync() 写入本地 IndexedDB（寄生 JAV-JHS/appData）。
 *
 * 三重广播机制保留（GM_setValue/localStorage/CustomEvent），通知 VltTags
 * 自动刷新标签显示。跨标签页同步通过 GM_addValueChangeListener 实现。
 */

import { VltDb, type SyncResult } from './vlt-db';
import { showToast } from './vlt-toast';
import { FAVORITE_ACTION } from '../../constants/status';

/** 日志前缀。 */
const LOG_PREFIX = '[JavDB]';

/** 同步事件广播键。 */
const LAST_SYNC_KEY = 'jdb:last-sync';

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
    action: 'add' | 'remove'
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
        action
    );

    console.log(
        `${LOG_PREFIX} 同步结果: movie=${result.movie} list=${result.list} association=${result.association}`
    );
    return result;
}

/** 防抖计时器映射。 */
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

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
    checked: boolean
): Promise<void> {
    const des = movieInfo.designation;
    const lname = listInfo.info.name;
    const action = checked ? 'add' : 'remove';

    console.log(`${LOG_PREFIX} ═══ ${checked ? '勾选' : '取消'} [${des}] → ${lname} ═══`);

    let result: SyncResult;
    try {
        result = await syncMoviesLists(movieInfo, listInfo, action);
    } catch (err: any) {
        console.error(`${LOG_PREFIX} 同步失败`, err);
        showToast(`✗ [${des}] 同步失败：${err.message || '请检查 IndexedDB'}`, 'error');
        return;
    }

    // 收集实际新创建了什么
    const created: string[] = [];
    if (result.movie === 'created') created.push('影片');
    if (result.list === 'created') created.push('清单');

    const entry = ASSOC_TOAST[result.association];
    if (entry) {
        const { msg, type } = entry(des, lname, created);
        showToast(msg, type);
    } else {
        showToast(`✗ [${des}] 未知响应：${result.association}`, 'error');
    }

    // 勾选（添加到清单）且清单名称包含「等待更新」时，自动收藏未收藏视频
    if (checked) {
        autoFavoriteIfPendingUpdate(movieInfo, lname).then();
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
    GM_setValue(LAST_SYNC_KEY, payloadStr);

    // 2) 跨脚本跨标签页（localStorage 触发 storage 事件）
    localStorage.setItem(LAST_SYNC_KEY, payloadStr);

    // 3) 跨脚本同页面（CustomEvent 即时）
    document.dispatchEvent(new CustomEvent('jdb:sync-complete', { detail: syncPayload }));
}

/**
 * 注册 checkbox change 事件监听。
 * 对应原 L573-600。
 *
 * 监听 `input[type=checkbox][data-action="change->list#listCheckboxChanged"]`
 * 的 change 事件，防抖后调用 handleCheckboxChange。
 */
export function setupCheckboxListener(): void {
    document.addEventListener('change', (e: Event) => {
        const target = e.target as HTMLElement;

        if (
            target.tagName !== 'INPUT' ||
            (target as HTMLInputElement).type !== 'checkbox' ||
            target.dataset.action !== 'change->list#listCheckboxChanged'
        ) {
            return;
        }

        const input = target as HTMLInputElement;
        const movieInfo = getMovieInfo(input.value);
        if (!movieInfo) {
            console.warn(`${LOG_PREFIX} 无法获取影片信息，跳过`);
            return;
        }
        const listInfo = getListInfo(input.dataset.listId || '');
        if (!listInfo.info.name) {
            console.warn(`${LOG_PREFIX} 无法获取清单名称，跳过`);
            return;
        }
        const checked = input.checked;
        const key = `${movieInfo.designation}::${listInfo.list_id}`;

        clearTimeout(debounceTimers.get(key));
        debounceTimers.set(
            key,
            setTimeout(() => {
                handleCheckboxChange(movieInfo, listInfo, checked).then();
            }, 300)
        );
    });
}
