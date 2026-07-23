/**
 * 详情页星星评分组件的 javdb 原生评价 API 与快捷操作。
 * 从 dpb-rating.tsx 提取，逻辑与原实现一致。
 */
import { FILTER_ACTION, FAVORITE_ACTION, HAS_WATCH_ACTION } from '../../constants/status';

import { jsxToString } from '../../core/jsx-to-string';

import type { DetailPageButtonPlugin } from '../detail-page-button-plugin';
import { autoRemoveFromPendingUpdateOnWatch } from '../video-lists-tag/vlt-sync';

import { QuickBlockConfirmMessage } from '../../components/dpb/quick-block-confirm-message';

/**
 * 一键设为已观看并设置评鉴分数。对应原 L5846-5895。
 * @param score 评分 0-5
 */
export async function quickSetHasWatch(plugin: DetailPageButtonPlugin, score: number): Promise<void> {
    const pageInfo = plugin.getPageInfo();
    if (!pageInfo.carNum) return;
    // ---- JHS 端更新 ----
    try {
        const carRecord = await storageManager.getCar(pageInfo.carNum);
        if (carRecord && carRecord.status === FAVORITE_ACTION) {
            await storageManager.removeCar(pageInfo.carNum);
        }
        if (carRecord && carRecord.status === HAS_WATCH_ACTION && carRecord.score === score) {
            show.ok(pageInfo.carNum + ' 评分未变化');
            return;
        }
        await storageManager.saveCar({
            carNum: pageInfo.carNum,
            url: pageInfo.url ?? undefined,
            names: pageInfo.actress ?? undefined,
            actionType: HAS_WATCH_ACTION,
            publishTime: pageInfo.publishTime ?? undefined,
            score: score
        });
        plugin.broadcastWantWatchedSync({
            carNum: pageInfo.carNum,
            status: HAS_WATCH_ACTION,
            op: 'add',
            score
        });
        show.ok(
            pageInfo.carNum +
                ' \u5df2\u6807\u8bb0\u770b\u8fc7 ' +
                (score > 0 ? '\u2605' + score : '')
        );
        // 已读/评分后：若在「等待更新」清单中则自动移出（不在则 noop）
        autoRemoveFromPendingUpdateOnWatch().then();
    } catch (err: unknown) {
        clog.error('[JHS-快键] 设为已观看失败', err);
        show.error('操作失败: ' + (err instanceof Error ? err.message : String(err)));
        return;
    }
    // 串行化 javdb 原生端操作，避免连续点击并发冲突；
    // _wantWatchedSyncing 期间阻断 MutationObserver，完成后立即释放
    plugin._reviewChain = (plugin._reviewChain || Promise.resolve())
        .then(async () => {
            plugin._wantWatchedSyncing = true;
            try {
                await plugin._triggerJavdbReview(score);
                plugin._syncRatingBar();
            } finally {
                plugin._wantWatchedSyncing = false;
            }
        })
        .catch(() => {});
}

/**
 * 快捷拉黑：弹确认框警告严重性 → 确认后写 FILTER_ACTION + 设为已读0星 + 关闭页面。
 *
 * 与 filterOne 的区别：
 * - filterOne 仅写 JHS FILTER_ACTION，不调 javdb 原生端
 * - quickBlock 额外调 _triggerJavdbReview(0) 设为已读0星（让影片不在想看列表，
 *   不出现在推荐），并用 _wantWatchedSyncing 阻断 MutationObserver 防止
 *   onWatchedAdded 覆盖 JHS 的 FILTER_ACTION 状态
 * - 广播 filter+add 让列表页实时隐藏该卡片
 */
export async function quickBlock(plugin: DetailPageButtonPlugin): Promise<void> {
    const pageInfo = plugin.getPageInfo();
    if (!pageInfo.carNum) return;
    utils.q(
        null,
        jsxToString(<QuickBlockConfirmMessage carNum={pageInfo.carNum!} />),
        async () => {
            plugin._setRatingBusy(true);
            try {
                // 1) JHS 端：先移除已有记录（避免 saveCar 抛"已在屏蔽列表中"），再写 FILTER_ACTION
                const carRecord = await storageManager.getCar(pageInfo.carNum!);
                if (carRecord) {
                    await storageManager.removeCar(pageInfo.carNum!);
                }
                await storageManager.saveCar({
                    carNum: pageInfo.carNum!,
                    url: pageInfo.url ?? undefined,
                    names: pageInfo.actress ?? undefined,
                    actionType: FILTER_ACTION,
                    publishTime: pageInfo.publishTime ?? undefined
                });
                // 2) 广播 filter+add（列表页实时隐藏该卡片）
                plugin.broadcastWantWatchedSync({
                    carNum: pageInfo.carNum!,
                    status: FILTER_ACTION,
                    op: 'add'
                });
                show.ok(`${pageInfo.carNum} 已拉黑`);
            } catch (err: unknown) {
                clog.error('[JHS-快键] 拉黑失败', err);
                show.error('操作失败: ' + (err instanceof Error ? err.message : String(err)));
                return;
            }
            // 3) javdb 原生端：设为已读0星（串行 + 阻断 observer）
            plugin._reviewChain = (plugin._reviewChain || Promise.resolve())
                .then(async () => {
                    plugin._wantWatchedSyncing = true;
                    try {
                        await plugin._triggerJavdbReview(0);
                        plugin._syncRatingBar();
                    } finally {
                        plugin._wantWatchedSyncing = false;
                    }
                })
                .catch(() => {});
            // 4) 关闭页面 + 刷新
            plugin.showStatus(pageInfo.carNum!).then();
            refresh();
            utils.closePage();
        }
    );
}

/**
 * 一键转为收藏（想看）。对应原 L6066-6105。
 */
export async function quickConvertToFav(plugin: DetailPageButtonPlugin): Promise<void> {
    const pageInfo = plugin.getPageInfo();
    if (!pageInfo.carNum) return;
    try {
        const carRecord = await storageManager.getCar(pageInfo.carNum);
        if (carRecord && carRecord.status === FAVORITE_ACTION) {
            show.ok(pageInfo.carNum + ' 已是已收藏');
            return;
        }
        if (carRecord) await storageManager.removeCar(pageInfo.carNum);
        await storageManager.saveCar({
            carNum: pageInfo.carNum,
            url: pageInfo.url ?? undefined,
            names: pageInfo.actress ?? undefined,
            actionType: FAVORITE_ACTION,
            publishTime: pageInfo.publishTime ?? undefined
        });
        plugin.broadcastWantWatchedSync({
            carNum: pageInfo.carNum,
            status: FAVORITE_ACTION,
            op: 'add'
        });
        show.ok(pageInfo.carNum + ' \u5df2\u8f6c\u4e3a\u6536\u85cf');
    } catch (err: unknown) {
        clog.error('[JHS-快键] 转为已收藏失败', err);
        show.error('操作失败: ' + (err instanceof Error ? err.message : String(err)));
        return;
    }
    plugin._reviewChain = (plugin._reviewChain || Promise.resolve())
        .then(async () => {
            plugin._wantWatchedSyncing = true;
            try {
                await plugin._triggerJavdbWant();
                plugin._syncRatingBar();
            } finally {
                plugin._wantWatchedSyncing = false;
            }
        })
        .catch(() => {});
}

/**
 * 获取 javdb 的 CSRF token。对应原 L5900-5903。
 * @returns CSRF token 或 null
 */
export function getCsrfToken(): string | null {
    const meta = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null;
    return meta ? meta.content : null;
}

/**
 * 从当前 URL 提取 videoId（如 /v/Ebqv9 → Ebqv9）。对应原 L5909-5911。
 * @returns videoId 或 null
 */
export function getVideoId(): string | null {
    return location.pathname.match(/\/v\/([^/]+)/)?.[1] || null;
}

/**
 * 从 .review-buttons 的删除链接提取当前 reviewId。对应原 L5917-5923。
 * @returns reviewId 或 null
 */
export function getReviewId(): string | null {
    const del = document.querySelector(
        ".review-buttons a[data-method='delete'][href*='/reviews/']"
    );
    if (!del) return null;
    return del.getAttribute('href')?.match(/\/reviews\/(\d+)/)?.[1] || null;
}

/**
 * 在页面主上下文执行 javdb Rails 返回的 JS（text/javascript）。
 * 用 <script> 标签注入而非 eval，确保在 Tampermonkey 沙箱中也运行于页面主上下文。
 * 对应原 L5933-5942。
 * @param jsText Rails 返回的 JS 源码
 */
export function execRailsJs(jsText: string): void {
    try {
        const script = document.createElement('script');
        script.textContent = jsText;
        document.head?.appendChild(script);
        script.remove();
    } catch (err: unknown) {
        clog.error('[JHS-快键] 执行 Rails JS 失败', err);
    }
}

/**
 * 通过 javdb 原生评价 API 设置状态（已观看/想看），替代不可靠的 DOM form 操作。
 * 对应原 L5951-6011。
 * @param action 目标状态（'watched' 或 'wanted'）
 * @param score 评分 0-5（仅 watched 有效）
 */
export async function javdbReviewApi(plugin: DetailPageButtonPlugin, action: 'watched' | 'wanted', score: number = 0): Promise<void> {
    const token = getCsrfToken();
    if (!token) throw new Error('无法获取 CSRF token');
    const videoId = getVideoId();
    if (!videoId) throw new Error('无法获取 videoId');
    const reviewId = getReviewId();

    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-CSRF-Token': token
    };
    const tokenParam = `authenticity_token=${encodeURIComponent(token)}`;

    if (action === 'watched') {
        // 有 reviewId → PATCH 改状态；无 → POST 新建
        const url = reviewId ? `/v/${videoId}/reviews/${reviewId}` : `/v/${videoId}/reviews`;
        const methodParam = reviewId ? '&_method=patch' : '';
        const body = `${tokenParam}${methodParam}&video_review[status]=watched&video_review[score]=${score}&video_review[content]=`;
        const res = await fetch(url, {
            method: 'POST',
            headers,
            body,
            credentials: 'same-origin'
        });
        if (!res.ok) throw new Error(`设为已观看失败: HTTP ${res.status}`);
        // 执行 Rails 返回的 JS：更新 DOM + 重绑定 UJS 事件
        execRailsJs(await res.text());
    } else if (action === 'wanted') {
        // 想看与已评价互斥：已有 review 先删除再建想看
        if (reviewId) {
            const delRes = await fetch(`/v/${videoId}/reviews/${reviewId}`, {
                method: 'POST',
                headers,
                body: `${tokenParam}&_method=delete`,
                credentials: 'same-origin'
            });
            if (!delRes.ok) throw new Error(`删除旧评价失败: HTTP ${delRes.status}`);
            execRailsJs(await delRes.text());
        }
        const res = await fetch(`/v/${videoId}/reviews/want_to_watch`, {
            method: 'POST',
            headers,
            body: tokenParam,
            credentials: 'same-origin'
        });
        if (!res.ok) throw new Error(`设为想看失败: HTTP ${res.status}`);
        execRailsJs(await res.text());
    }

    // 同步 _lastWantState 防止 MutationObserver 误触发
    const rb = document.querySelector('.review-buttons');
    if (rb && plugin._wantWatchedObserved) {
        plugin._lastWantState = plugin.detectWantWatchedState(rb);
    }
}

/**
 * 一键设为已观看并设置评鉴分数（javdb 原生端）。对应原 L6017-6019。
 * @param score 评分 0-5
 */
export async function triggerJavdbReview(plugin: DetailPageButtonPlugin, score: number): Promise<void> {
    await javdbReviewApi(plugin, 'watched', score);
}

/**
 * 将当前影片在 javdb 原生端设为「想看」（通过 API）。对应原 L6109-6111。
 */
export async function triggerJavdbWant(plugin: DetailPageButtonPlugin): Promise<void> {
    await javdbReviewApi(plugin, 'wanted');
}
