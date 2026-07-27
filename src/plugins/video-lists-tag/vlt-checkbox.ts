/**
 * Checkbox 同步逻辑 —— handleCheckboxChange + 自动收藏 + 等待更新清单移出。
 *
 * 提取自 vlt-sync.tsx：
 * - handleCheckboxChange：checkbox 勾选/取消 → IDB 同步 + 三重广播
 * - autoRemoveFromPendingUpdateOnWatch：评分/已读后自动移出「等待更新」清单
 * - syncMoviesLists：聚合同步（影片 upsert + 清单 upsert + 关联 add/remove）
 * - autoFavoriteIfPendingUpdate：添加至「等待更新」清单时自动收藏
 */

import { FAVORITE_ACTION } from '../../constants/status';

import { VltDb } from './vlt-db';
import type { SyncResult } from './vlt-db';
import { showToast } from './vlt-toast';
import { broadcastSyncComplete, broadcastWantWatchedSync } from './vlt-broadcast';
import {
    AUTO_FAVORITE_KEYWORD,
    getActressNames,
    getListName,
    getMovieInfo,
    LOG_PREFIX,
    triggerJavdbWantAndSyncRatingBar
} from './vlt-helpers';
import type { ListInfo, MovieInfo } from './vlt-helpers';
import { enqueueServerCheckboxMutation } from './vlt-server';

// ── doc/205 自动化配置（由 VLT 插件 handle 从设置注入） ──
/** 自动收藏/移除总开关（doc/205 D5，默认开）。 */
let autoFavCleanupEnabled = true;
/** 受保护清单关键词（doc/205 D4，包含匹配，默认「值得复盘」）。 */
let protectedKeywords: string[] = ['值得复盘'];

/** 设置自动收藏/移除总开关。 */
export function setAutoFavCleanupEnabled(enabled: boolean): void {
    autoFavCleanupEnabled = enabled;
}

/** 设置受保护清单关键词（空数组不覆盖默认）。 */
export function setProtectedKeywords(keywords: string[]): void {
    if (keywords.length > 0) protectedKeywords = keywords;
}

/** 清单名是否受保护（含任一受保护关键词则不自动收藏/不移出，doc/205）。 */
export function isProtectedList(name: string): boolean {
    return protectedKeywords.some((kw) => kw !== '' && name.includes(kw));
}

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
 * 聚合同步：影片 upsert + 清单 upsert + 关联 add/remove。
 * 对应原 L438-481 的 syncMoviesLists，但调用 VltDb.sync() 替代 GM_xmlhttpRequest。
 */
async function syncMoviesLists(
    movieInfo: MovieInfo,
    listInfo: ListInfo,
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
 * 当向名称包含「等待更新」的清单添加视频时，自动将未收藏视频收藏。
 */
async function autoFavoriteIfPendingUpdate(movieInfo: MovieInfo, lname: string): Promise<void> {
    // doc/205 Feature A：除受保护清单外的任意清单均自动收藏（泛化自 doc/53 的等待更新专属）
    if (!autoFavCleanupEnabled) return;
    if (isProtectedList(lname)) return;

    const des = movieInfo.designation;
    try {
        const carRecord = await storageManager.getCar(des);
        if (carRecord && carRecord.status === FAVORITE_ACTION) {
            return;
        }
        if (carRecord && carRecord.status) {
            showToast(`ℹ️ [${des}] 已标记为「${carRecord.status}」，跳过自动收藏`, 'info');
            return;
        }
        await storageManager.saveCar({
            carNum: des,
            url: movieInfo.info.href,
            names: getActressNames(),
            actionType: FAVORITE_ACTION,
            publishTime: movieInfo.info.release_date
        });
        broadcastWantWatchedSync(des, FAVORITE_ACTION, 'add');
        showToast(`⭐ [${des}] 已自动收藏（添加至「${lname}」）`, 'success');
        console.log(`${LOG_PREFIX} 自动收藏: ${des}（触发清单：${lname}）`);
        triggerJavdbWantAndSyncRatingBar(des);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '未知错误';
        clog.error(`${LOG_PREFIX} 自动收藏失败: ${des}`, err);
        showToast(`✗ [${des}] 自动收藏失败：${message}`, 'error');
    }
}

/**
 * 处理 checkbox 勾选/取消。
 * 对应原 L515-571 的 handleCheckboxChange。
 */
export async function handleCheckboxChange(
    movieInfo: MovieInfo,
    listInfo: ListInfo,
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
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '请检查 IndexedDB';
        clog.error(`${LOG_PREFIX} 同步失败`, err);
        if (!options.silent) {
            showToast(`✗ [${des}] 同步失败：${message}`, 'error');
        }
        return null;
    }

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

    if (
        checked &&
        !options.skipAutomation &&
        result.association !== 'limit_exceeded' &&
        autoFavCleanupEnabled
    ) {
        autoFavoriteIfPendingUpdate(movieInfo, lname).then();
        // doc/125 保留：加入非等待更新清单时移出等待更新（等待更新专属逻辑）
        if (!lname.includes(AUTO_FAVORITE_KEYWORD)) {
            uncheckPendingUpdateListCheckboxes();
        }
    }

    console.log(`${LOG_PREFIX} ═══ 完成 ═══`);

    broadcastSyncComplete(des, action, result.association);
    return result;
}

/**
 * doc/205 Feature B：收藏→已读星级后，移出所有非受保护清单（泛化自 doc/124 的等待更新专属）。
 * DOM 优先（取消勾选派发 change），DOM 不可用时退而查 VltDb 直接服务端移除。
 */
export async function removeFromNonProtectedListsOnWatch(): Promise<void> {
    if (!autoFavCleanupEnabled) return;
    try {
        if (uncheckNonProtectedListCheckboxes() > 0) return;

        const pending = await findCurrentMovieListsMatching((name) => !isProtectedList(name));
        if (pending.length === 0) return;

        for (let i = 0; i < 15; i++) {
            await new Promise((r) => setTimeout(r, 200));
            if (uncheckNonProtectedListCheckboxes() > 0) return;
        }

        // DOM 仍不可用：直接请求 JavDB 服务端移除
        for (const item of pending) {
            const movieInfo = getMovieInfo(item.videoId);
            if (!movieInfo) continue;
            const listInfo = {
                list_id: item.listId,
                info: { url: item.url, name: item.name }
            };
            await enqueueServerCheckboxMutation(movieInfo, listInfo, false, null, true);
        }
    } catch (err: unknown) {
        clog.error(`${LOG_PREFIX} 评分后移出非受保护清单失败`, err);
    }
}

/**
 * 取消勾选符合谓词的已勾选清单 checkbox（doc/125 等待更新 / doc/205 非保护 共用核心）。
 * @param predicate 清单名判定（true 则取消勾选）
 * @returns 成功触发取消的清单数量（按 listId 去重）
 */
function uncheckListsMatching(predicate: (name: string) => boolean): number {
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
        if (!predicate(name)) continue;

        seen.add(listId);
        count++;
        input.checked = false;
        input.dispatchEvent(new Event('change', { bubbles: true }));

        const panelCb = document.querySelector(
            `.jhs-list-panel input[data-list-id="${listId}"]`
        ) as HTMLInputElement | null;
        if (panelCb) panelCb.checked = false;

        console.log(`${LOG_PREFIX} 取消勾选「${name}」(listId=${listId})`);
    }

    return count;
}

/** doc/125：取消勾选名称含「等待更新」的已勾选清单。 */
function uncheckPendingUpdateListCheckboxes(): number {
    return uncheckListsMatching((name) => name.includes(AUTO_FAVORITE_KEYWORD));
}

/** doc/205 Feature B：取消勾选所有非受保护清单的已勾选清单。 */
function uncheckNonProtectedListCheckboxes(): number {
    return uncheckListsMatching((name) => !isProtectedList(name));
}

/**
 * 从 VltDb 查询当前详情页影片关联的符合谓词的清单（doc/125/doc/205 共用核心）。
 * @param predicate 清单名判定（true 则纳入）
 */
async function findCurrentMovieListsMatching(
    predicate: (name: string) => boolean
): Promise<{ videoId: string; listId: string; name: string; url: string }[]> {
    const m = window.location.pathname.match(/\/v\/([^/?#]+)/);
    const videoId = m?.[1];
    if (!videoId) return [];

    const movieInfo = getMovieInfo(videoId);
    if (!movieInfo) return [];

    const map = await VltDb.queryMoviesLists([movieInfo.designation]);
    const lists = map[movieInfo.designation] || [];
    const result: { videoId: string; listId: string; name: string; url: string }[] = [];

    for (const item of lists) {
        if (!predicate(item.name)) continue;
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
