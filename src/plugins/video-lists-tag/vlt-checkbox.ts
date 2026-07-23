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
    if (!lname.includes(AUTO_FAVORITE_KEYWORD)) return;

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

    if (checked && !options.skipAutomation && result.association !== 'limit_exceeded') {
        autoFavoriteIfPendingUpdate(movieInfo, lname).then();
        if (!lname.includes(AUTO_FAVORITE_KEYWORD)) {
            uncheckPendingUpdateListCheckboxes();
        }
    }

    console.log(`${LOG_PREFIX} ═══ 完成 ═══`);

    broadcastSyncComplete(des, action, result.association);
    return result;
}

/**
 * 评分/已读（0–5 星）后：若当前视频在名称含「等待更新」的清单中，自动移出。
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
        const { enqueueServerCheckboxMutation } = await import('./vlt-server');
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
        clog.error(`${LOG_PREFIX} 评分后移出「等待更新」失败`, err);
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
