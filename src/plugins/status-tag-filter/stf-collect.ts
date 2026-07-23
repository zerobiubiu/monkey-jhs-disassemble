/**
 * 状态标签收集 —— 从 status-tag-filter-plugin.ts 拆出的收集函数。
 *
 * collectStatusTagCounts：收集每个 status-tag 文本的出现次数（排除 jhs 屏蔽卡片）。
 * countNoStatusItems：计算无状态标签的卡片数（排除 jhs 屏蔽卡片）。
 */

/** status-tag 选择器（与 jhs StatusTagHtml 生成的 class 一致）。 */
export const STATUS_TAG_SELECTOR = '.item .tags.has-addons .tag.is-success.status-tag';

/**
 * jhs 主项目的隐藏标记属性名。
 * jhs ListPagePlugin.filterMovieList 用 `$item.hide().attr('data-hide', YES)`
 * （值为 "yes"），showCarNumBox 用 `data-hide="<carNum>-hide"`（临时隐藏）。
 * 两种值都表示卡片被 jhs 隐藏，本脚本统一检查属性是否存在（不关心值）。
 */
export const JHS_HIDE_ATTR = 'data-hide';

/** 无状态标签芯片的值。 */
export const NO_TAG_VALUE = 'no-tag';

/**
 * 收集每个 status-tag 文本的出现次数。
 * 对应原 L40-52。
 *
 * doc/48 增强：排除被 jhs 屏蔽的卡片（带 data-hide 属性），
 * 芯片计数只反映实际可见的卡片，避免计数失真。
 *
 * @returns 标签文本→计数映射
 */
export function collectStatusTagCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    document.querySelectorAll(STATUS_TAG_SELECTOR).forEach((el: Element) => {
        // 向上查找最近的 .item 容器，跳过被 jhs 屏蔽的卡片
        const itemEl = el.closest('.item');
        if (itemEl && itemEl.hasAttribute(JHS_HIDE_ATTR)) return;
        const text = el.textContent?.trim() || '';
        if (text) {
            counts[text] = (counts[text] || 0) + 1;
        }
    });
    return counts;
}

/**
 * 计算无状态标签的卡片数。
 * 对应原 L57-66。
 *
 * doc/48 增强：排除被 jhs 屏蔽的卡片（带 data-hide 属性），
 * 计数只反映实际可见的卡片。
 *
 * @returns 无状态标签的卡片数
 */
export function countNoStatusItems(): number {
    let count = 0;
    document.querySelectorAll('.item').forEach((item: Element) => {
        // 跳过被 jhs 屏蔽的卡片
        if (item.hasAttribute(JHS_HIDE_ATTR)) return;
        if (!item.querySelector(STATUS_TAG_SELECTOR)) {
            count++;
        }
    });
    return count;
}
