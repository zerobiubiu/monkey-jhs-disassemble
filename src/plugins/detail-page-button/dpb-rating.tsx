/**
 * 详情页星星评分组件与快捷操作功能模块。
 * 从 detail-page-button-plugin.tsx 提取，逻辑与原实现一致。
 */
import { FILTER_ACTION } from '../../constants/status';

import { jsxToString } from '../../core/jsx-to-string';

import type { DetailPageButtonPlugin } from '../detail-page-button-plugin';

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
        const nav = document.querySelector<HTMLElement>(
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
        const rb = nav.querySelector('.review-buttons') as (Element & { __jhsRatingObserved?: boolean }) | null;
        if (rb && !rb.__jhsRatingObserved) {
            rb.__jhsRatingObserved = true;
            new MutationObserver(() => {
                if (self._wantWatchedSyncing) return;
                clearTimeout(self._ratingSyncDebounce ?? undefined);
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
export function buildRatingBar(plugin: DetailPageButtonPlugin, nav: Element): void {
    const column = nav.querySelector('div.review-buttons > div:nth-child(1) > div > div');
    if (!column) return;
    if (column.querySelector('.jhs-rating-bar')) return; // 已存在
    const self = plugin;
    const bar = document.createElement('div');
    bar.className = 'jhs-rating-bar';
    bar.innerHTML = jsxToString(<RatingBarHtml />);
    const starsEl = bar.querySelector('.jhs-stars');
    const stars = bar.querySelectorAll<HTMLElement>('.jhs-star');
    const readBtn = bar.querySelector('.jhs-read-btn');
    const favBtn = bar.querySelector('.jhs-fav-btn');
    const blockBtn = bar.querySelector('.jhs-block-btn');
    if (!starsEl || !readBtn || !favBtn || !blockBtn) return;
    // hover 预览
    starsEl.addEventListener('pointerover', (e: Event) => {
        const star = (e.target as HTMLElement).closest<HTMLElement>('.jhs-star');
        if (!star) return;
        const score = +star.dataset.score!;
        stars.forEach((s: HTMLElement, i: number) => s.classList.toggle('is-preview', i < score));
    });
    starsEl.addEventListener('pointerleave', () =>
        stars.forEach((s: HTMLElement) => s.classList.remove('is-preview'))
    );
    // 点击星星 → 已观看 + N星
    stars.forEach((star: HTMLElement) => {
        star.addEventListener('click', async (e: Event) => {
            e.preventDefault();
            const score = +star.dataset.score!;
            star.classList.add('is-popping');
            setTimeout(() => star.classList.remove('is-popping'), 300);
            self._setRatingBusy(true);
            try {
                await self.quickSetHasWatch(score);
            } finally {
                self._setRatingBusy(false);
                self.showStatus(self.getPageInfo().carNum!).then();
            }
        });
    });
    // 已读 → 已观看 + 0星
    readBtn.addEventListener('click', async (e: Event) => {
        e.preventDefault();
        readBtn.classList.add('is-popping');
        setTimeout(() => readBtn.classList.remove('is-popping'), 300);
        self._setRatingBusy(true);
        try {
            await self.quickSetHasWatch(0);
        } finally {
            self._setRatingBusy(false);
            self.showStatus(self.getPageInfo().carNum!).then();
        }
    });
    // 收藏 → 想看
    favBtn.addEventListener('click', async (e: Event) => {
        e.preventDefault();
        favBtn.classList.add('is-popping');
        setTimeout(() => favBtn.classList.remove('is-popping'), 300);
        self._setRatingBusy(true);
        try {
            await self.quickConvertToFav();
        } finally {
            self._setRatingBusy(false);
            self.showStatus(self.getPageInfo().carNum!).then();
        }
    });
    // 拉黑 → 屏蔽 + 设为已读0星 + 关闭页面（需确认）
    blockBtn.addEventListener('click', async (e: Event) => {
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
    let bar = document.querySelector('.jhs-rating-bar');
    // 组件被 Rails ajax innerHTML 替换销毁 → 重建
    if (!bar) {
        const nav = document.querySelector(
            'body > section > div > div.video-detail > div.video-meta-panel > div > div:nth-child(2) > nav'
        );
        if (nav) plugin._buildRatingBar(nav);
        bar = document.querySelector('.jhs-rating-bar');
    }
    if (!bar) return;
    const rb = document.querySelector('.review-buttons');
    if (!rb) return;
    const want = !!rb.querySelector("a[href='/users/want_watch_videos'] .tag.is-info.is-light");
    const watched = !!rb.querySelector(
        "a[href='/users/watched_videos'] .tag.is-success.is-light"
    );
    const checked = rb.querySelector('input[name="video_review[score]"][checked]') as HTMLInputElement | null;
    const score = checked ? +checked.value : 0;

    const stars = bar.querySelectorAll<HTMLElement>('.jhs-star');
    const starsEl = bar.querySelector('.jhs-stars');
    const readBtn = bar.querySelector('.jhs-read-btn');
    const favBtn = bar.querySelector('.jhs-fav-btn');
    const blockBtn = bar.querySelector('.jhs-block-btn');
    if (!starsEl || !readBtn || !favBtn || !blockBtn) return;

    // 先清除所有状态类
    stars.forEach((s: HTMLElement) => s.classList.remove('is-active'));
    starsEl.classList.remove('is-disabled');
    readBtn.classList.remove('is-active');
    favBtn.classList.remove('is-active');
    blockBtn.classList.remove('is-active');

    if (want) {
        // 想看：收藏高亮，星星保持可用（可随时点击切换为已观看+N星）
        favBtn.classList.add('is-active');
    } else if (watched) {
        // 已观看：前 N 星高亮，已读看 N 是否 0
        stars.forEach((s: HTMLElement, i: number) => s.classList.toggle('is-active', i < score));
        readBtn.classList.toggle('is-active', score === 0);
    } else {
        // 未评价
    }

    // 额外检查 JHS 是否已拉黑（filter 状态是 JHS 独有，javdb 原生无屏蔽概念）
    const carNum = plugin.getPageInfo().carNum;
    if (carNum) {
        storageManager.getCar(carNum).then((carRecord) => {
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
    const bar = document.querySelector('.jhs-rating-bar');
    if (bar) bar.classList.toggle('is-busy', busy);
}

export {
    quickSetHasWatch,
    quickBlock,
    quickConvertToFav,
    getCsrfToken,
    getVideoId,
    getReviewId,
    execRailsJs,
    javdbReviewApi,
    triggerJavdbReview,
    triggerJavdbWant
} from './dpb-rating-api';
