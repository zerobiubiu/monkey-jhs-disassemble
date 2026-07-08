/**
 * 评分标签渲染层 —— 对应 archetype/jhsRatingDisplay.user.js L395-474 `Renderer`。
 *
 * 在列表页卡片封面上注入 `.jhs-user-rating` 标签：
 *  - 占位态（is-placeholder）：绿色「已看」
 *  - 已评分态（is-rated）：金色「★ N」
 *  - 加载态（is-loading）：呼吸动画（由 net/loadAll 切换 class，不由本模块管理）
 *
 * 同时负责隐藏封面默认的评分 span（避免双显示）与移除标签时恢复原生 span。
 *
 * 原脚本用 `el.innerHTML = '<span class="jhs-rd-icon">★</span>...'` 字符串拼接，
 * 此处改为 jsxToString 生成等价 HTML，满足工程 TSX 化要求（DOM 等价）。
 */
import { jsxToString } from '../../core/jsx-to-string';

/** 评分标签渲染层（保持原对象字面量风格）。 */
export const RatingRenderer = {
    /**
     * 隐藏卡片封面上默认的评分 span（避免双显示）。对应原 L399-407。
     * 隐藏条件：span 无 class 或 class 为 "score"。
     * @param cover 卡片封面元素
     */
    hideNativeBadge(cover: HTMLElement): void {
        const spans = cover.querySelectorAll(':scope > span');
        spans.forEach((s) => {
            if (s.classList.length === 0 || s.className === 'score') {
                (s as HTMLElement).style.display = 'none';
            }
        });
    },

    /**
     * 显示「已看」占位标签（绿色，无分值）。对应原 L412-424。
     * 已存在标签时不重复创建；同时隐藏封面原生评分 span。
     * @param item 列表页卡片元素
     */
    showPlaceholder(item: HTMLElement): void {
        const cover = item.querySelector('.cover');
        if (!cover) return;
        if (cover.querySelector('.jhs-user-rating')) return;

        this.hideNativeBadge(cover as HTMLElement);

        const el = document.createElement('div');
        el.className = 'jhs-user-rating is-placeholder';
        el.textContent = '已看';
        el.title = '已看（悬停加载评分）';
        cover.appendChild(el);
    },

    /**
     * 替换为评分标签（金色 ★ N）；若元素不存在则自行创建。对应原 L429-455。
     * rating 为 0 时显示 ★0（已读未评分），1-5 显示 ★N，falsy/越界降级为占位「已看」。
     *
     * innerHTML 改用 jsxToString 生成等价 HTML 片段（原脚本为字符串拼接）。
     * @param item   列表页卡片元素
     * @param rating 评分值（0=已读未评分，1-5=星级）；null/undefined/越界降级为占位
     */
    showRating(item: HTMLElement, rating: number | null | undefined): void {
        const cover = item.querySelector('.cover');
        if (!cover) return;

        let el = cover.querySelector('.jhs-user-rating') as HTMLElement | null;
        // 缓存命中时元素尚未创建，自行创建
        if (!el) {
            this.hideNativeBadge(cover as HTMLElement);
            el = document.createElement('div');
            el.className = 'jhs-user-rating';
            cover.appendChild(el);
        }

        // 重置 className 后设置正确状态
        el.className = 'jhs-user-rating';
        el.innerHTML = '';

        if (rating === 0) {
            // 0 星：已读未评分，显示 ★0（金色 is-rated 样式，与 1-5 一致）
            el.classList.add('is-rated');
            el.innerHTML = jsxToString(
                <>
                    <span className="jhs-rd-icon">★</span>
                    <span className="jhs-rd-num">0</span>
                </>
            );
            el.title = '已看 · 0/5 星（未评分）';
        } else if (rating && rating >= 1 && rating <= 5) {
            el.classList.add('is-rated');
            // 原脚本: `<span class="jhs-rd-icon">★</span><span class="jhs-rd-num">${rating}</span>`
            el.innerHTML = jsxToString(
                <>
                    <span className="jhs-rd-icon">★</span>
                    <span className="jhs-rd-num">{rating}</span>
                </>
            );
            el.title = `已看 · ${rating}/5 星`;
        } else {
            el.classList.add('is-placeholder');
            el.textContent = '已看';
            el.title = '已看（未评分）';
        }
    },

    /**
     * 移除单个卡片的评分标签，并恢复被隐藏的原生 span。对应原 L458-473。
     * @param item 列表页卡片元素；可为 null（不抛出）
     */
    removeFrom(item: HTMLElement | null): void {
        const el = item?.querySelector('.jhs-user-rating');
        if (el) el.remove();
        // 恢复被隐藏的原生 span
        const cover = item?.querySelector('.cover');
        if (cover) {
            cover.querySelectorAll(':scope > span').forEach((s) => {
                if (
                    (s as HTMLElement).style.display === 'none' &&
                    (s.classList.length === 0 || s.className === 'score')
                ) {
                    (s as HTMLElement).style.display = '';
                }
            });
        }
    }
};
