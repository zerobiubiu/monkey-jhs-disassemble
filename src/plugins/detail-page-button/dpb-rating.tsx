/**
 * 详情页星星评分组件与快捷操作功能模块。
 * 从 detail-page-button-plugin.tsx 提取，逻辑与原实现一致。
 */
import { FILTER_ACTION, FAVORITE_ACTION, HAS_WATCH_ACTION } from '../../constants/status';

import { jsxToString } from '../../core/jsx-to-string';

import type { DetailPageButtonPlugin } from '../detail-page-button-plugin';
import { autoRemoveFromPendingUpdateOnWatch } from '../video-lists-tag/vlt-sync';

import { QuickBlockConfirmMessage } from '../../components/dpb/quick-block-confirm-message';
import { RatingBarHtml } from '../../components/dpb/rating-bar-html';

import ratingBarCssRaw from '../../styles/rating-bar.css?raw';

/**
 * 在详情页注入星星评分组件（5星 + 已读 + 收藏）。
 * 组件会被 Rails ajax 替换销毁，用 MutationObserver 监听变化自动重建。
 * 对应原 L5508-5542。
 */
export function addQuickActionButtons(plugin: DetailPageButtonPlugin): void {
    if (!window.isDetailPage) return;
    if (plugin._quickActionAdded) return;
    plugin._quickActionAdded = true;
    const self = plugin;
    plugin._injectRatingStyles();
    const ensure = () => {
        const nav: any = document.querySelector(
            'body > section > div > div.video-detail > div.video-meta-panel > div > div:nth-child(2) > nav'
        );
        if (!nav) {
            setTimeout(ensure, 400);
            return;
        }
        // 构建组件（如果不存在）
        self._buildRatingBar(nav);
        self._syncRatingBar();
        // 清单面板独立等待 #otherSiteBox 出现（OtherSitePlugin 异步注入）
        self._ensureListPanel(nav);
        // 监听 .review-buttons 变化（Rails ajax 替换 innerHTML 会销毁组件 → 重建 + 状态刷新）
        const rb: any = nav.querySelector('.review-buttons');
        if (rb && !rb.__jhsRatingObserved) {
            rb.__jhsRatingObserved = true;
            new MutationObserver(() => {
                if (self._wantWatchedSyncing) return;
                clearTimeout(self._ratingSyncDebounce);
                self._ratingSyncDebounce = setTimeout(() => {
                    self._buildRatingBar(nav);
                    self._syncRatingBar();
                }, 200);
            }).observe(rb, { childList: true, subtree: true });
        }
    };
    ensure();
}

/**
 * 构建星星评分组件 DOM 并插入 .column 上方（如已存在则跳过）。
 * 对应原 L5548-5631。
 * @param nav nav 容器
 */
export function buildRatingBar(plugin: DetailPageButtonPlugin, nav: any): void {
    const column: any = nav.querySelector('div.review-buttons > div:nth-child(1) > div > div');
    if (!column) return;
    if (column.querySelector('.jhs-rating-bar')) return; // 已存在
    const self = plugin;
    const bar = document.createElement('div');
    bar.className = 'jhs-rating-bar';
    bar.innerHTML = jsxToString(<RatingBarHtml />);
    const starsEl: any = bar.querySelector('.jhs-stars');
    const stars: any = bar.querySelectorAll('.jhs-star');
    const readBtn: any = bar.querySelector('.jhs-read-btn');
    const favBtn: any = bar.querySelector('.jhs-fav-btn');
    const blockBtn: any = bar.querySelector('.jhs-block-btn');
    // hover 预览
    starsEl.addEventListener('pointerover', (e: any) => {
        const star = e.target.closest('.jhs-star');
        if (!star) return;
        const score = +star.dataset.score;
        stars.forEach((s: any, i: number) => s.classList.toggle('is-preview', i < score));
    });
    starsEl.addEventListener('pointerleave', () =>
        stars.forEach((s: any) => s.classList.remove('is-preview'))
    );
    // 点击星星 → 已观看 + N星
    stars.forEach((star: any) => {
        star.addEventListener('click', async (e: any) => {
            e.preventDefault();
            const score = +star.dataset.score;
            star.classList.add('is-popping');
            setTimeout(() => star.classList.remove('is-popping'), 300);
            self._setRatingBusy(true);
            try {
                await self.quickSetHasWatch(score);
            } finally {
                self._setRatingBusy(false);
                self.showStatus(self.getPageInfo().carNum).then();
            }
        });
    });
    // 已读 → 已观看 + 0星
    readBtn.addEventListener('click', async (e: any) => {
        e.preventDefault();
        readBtn.classList.add('is-popping');
        setTimeout(() => readBtn.classList.remove('is-popping'), 300);
        self._setRatingBusy(true);
        try {
            await self.quickSetHasWatch(0);
        } finally {
            self._setRatingBusy(false);
            self.showStatus(self.getPageInfo().carNum).then();
        }
    });
    // 收藏 → 想看
    favBtn.addEventListener('click', async (e: any) => {
        e.preventDefault();
        favBtn.classList.add('is-popping');
        setTimeout(() => favBtn.classList.remove('is-popping'), 300);
        self._setRatingBusy(true);
        try {
            await self.quickConvertToFav();
        } finally {
            self._setRatingBusy(false);
            self.showStatus(self.getPageInfo().carNum).then();
        }
    });
    // 拉黑 → 屏蔽 + 设为已读0星 + 关闭页面（需确认）
    blockBtn.addEventListener('click', async (e: any) => {
        e.preventDefault();
        blockBtn.classList.add('is-popping');
        setTimeout(() => blockBtn.classList.remove('is-popping'), 300);
        await self.quickBlock();
    });
    column.insertBefore(bar, column.firstChild);
}

/**
 * 注入星星评分组件的 CSS 样式。对应原 L5738-5778。
 */
export function injectRatingStyles(): void {
    if (document.getElementById('jhs-rating-styles')) return;
    const style = document.createElement('style');
    style.id = 'jhs-rating-styles';
    style.textContent = ratingBarCssRaw;
    document.head?.appendChild(style);
}

/**
 * 从 javdb 原生 DOM 检测当前评价状态，同步星星组件显示。
 * 状态：want（想看）/ watched+N（已观看 N 星）/ filter（已拉黑）/ none（未评价）。
 * filter 状态是 JHS 独有（javdb 原生无屏蔽概念），需额外查 JHS 记录。
 * 对应原 L5784-5832。
 */
export function syncRatingBar(plugin: DetailPageButtonPlugin): void {
    let bar: any = document.querySelector('.jhs-rating-bar');
    // 组件被 Rails ajax innerHTML 替换销毁 → 重建
    if (!bar) {
        const nav: any = document.querySelector(
            'body > section > div > div.video-detail > div.video-meta-panel > div > div:nth-child(2) > nav'
        );
        if (nav) plugin._buildRatingBar(nav);
        bar = document.querySelector('.jhs-rating-bar');
    }
    if (!bar) return;
    const rb: any = document.querySelector('.review-buttons');
    if (!rb) return;
    const want = !!rb.querySelector("a[href='/users/want_watch_videos'] .tag.is-info.is-light");
    const watched = !!rb.querySelector(
        "a[href='/users/watched_videos'] .tag.is-success.is-light"
    );
    const checked: any = rb.querySelector('input[name="video_review[score]"][checked]');
    const score = checked ? +checked.value : 0;

    const stars: any = bar.querySelectorAll('.jhs-star');
    const starsEl: any = bar.querySelector('.jhs-stars');
    const readBtn: any = bar.querySelector('.jhs-read-btn');
    const favBtn: any = bar.querySelector('.jhs-fav-btn');
    const blockBtn: any = bar.querySelector('.jhs-block-btn');

    // 先清除所有状态类
    stars.forEach((s: any) => s.classList.remove('is-active'));
    starsEl.classList.remove('is-disabled');
    readBtn.classList.remove('is-active');
    favBtn.classList.remove('is-active');
    blockBtn.classList.remove('is-active');

    if (want) {
        // 想看：收藏高亮，星星保持可用（可随时点击切换为已观看+N星）
        favBtn.classList.add('is-active');
    } else if (watched) {
        // 已观看：前 N 星高亮，已读看 N 是否 0
        stars.forEach((s: any, i: number) => s.classList.toggle('is-active', i < score));
        readBtn.classList.toggle('is-active', score === 0);
    } else {
        // 未评价
    }

    // 额外检查 JHS 是否已拉黑（filter 状态是 JHS 独有，javdb 原生无屏蔽概念）
    const carNum = plugin.getPageInfo().carNum;
    if (carNum) {
        storageManager.getCar(carNum).then((carRecord: any) => {
            if (carRecord && carRecord.status === FILTER_ACTION) {
                blockBtn.classList.add('is-active');
            }
        });
    }
}

/**
 * 设置评分组件忙碌状态（操作期间禁用交互）。对应原 L5837-5840。
 * @param busy 是否忙碌
 */
export function setRatingBusy(busy: boolean): void {
    const bar: any = document.querySelector('.jhs-rating-bar');
    if (bar) bar.classList.toggle('is-busy', busy);
}

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
    } catch (err: any) {
        clog.error('[JHS-快键] 设为已观看失败', err);
        show.error('操作失败: ' + err.message);
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
                    carNum: pageInfo.carNum,
                    status: FILTER_ACTION,
                    op: 'add'
                });
                show.ok(`${pageInfo.carNum} 已拉黑`);
            } catch (err: any) {
                clog.error('[JHS-快键] 拉黑失败', err);
                show.error('操作失败: ' + err.message);
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
            plugin.showStatus(pageInfo.carNum).then();
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
    } catch (err: any) {
        clog.error('[JHS-快键] 转为已收藏失败', err);
        show.error('操作失败: ' + err.message);
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
    const del: any = document.querySelector(
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
    } catch (err: any) {
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
    const rb: any = document.querySelector('.review-buttons');
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
