/**
 * 站点原生卡片标签采集 —— 提取卡片 `div.tags.has-addons` 中的站点原生 `span` 标签。
 *
 * 刻意排除扩展注入的状态标签（`.status-tag`，如已收藏/已观看/已屏蔽）与扩展兜底容器
 * （`.jhs-status-tags`），且不预设任何固定标签列表，始终按当前页面实际内容实时统计。
 */
import type { FilterScope } from '../../types/filter-scope';

import { queryFilterItems } from '../../core/util/site/filter-scope';
import { siteSelector } from '../../core/util/site/selectors';

/** 本筛选器隐藏卡片使用的语义属性（参与 filter-scope 交集协同）。 */
export const SITE_TAG_HIDDEN_ATTR = 'data-site-tag-hidden';

/** 无原生标签芯片的值。 */
export const SITE_TAG_NO_TAG_VALUE = 'no-tag';

/** JHS 基础屏蔽标记（被屏蔽卡片不纳入计数）。 */
const JHS_HIDE_ATTR = 'data-hide';

/**
 * 提取单张卡片内的站点原生标签文本集合（去空白、单卡去重）。
 *
 * @param item 列表卡片元素
 * @returns 该卡片包含的原生标签文本集合
 */
export function getItemNativeTags(item: Element): Set<string> {
    const tags = new Set<string>();
    item.querySelectorAll(siteSelector('listNativeTag')).forEach((el: Element) => {
        const text = el.textContent?.trim() ?? '';
        if (text) tags.add(text);
    });
    return tags;
}

/**
 * 统计当前范围内各原生标签覆盖的可见卡片数（排除 JHS 基础屏蔽卡片）。
 *
 * @param scope 可选：独立筛选作用域（如首页推荐浮层）；省略时面向主列表
 * @returns 标签文本 → 卡片数映射
 */
export function collectSiteTagCounts(scope?: FilterScope): Record<string, number> {
    const counts: Record<string, number> = {};
    queryFilterItems(scope).forEach((item: Element) => {
        if (item.hasAttribute(JHS_HIDE_ATTR)) return;
        getItemNativeTags(item).forEach((tag) => {
            counts[tag] = (counts[tag] ?? 0) + 1;
        });
    });
    return counts;
}

/**
 * 统计当前范围内没有任何原生标签的可见卡片数（排除 JHS 基础屏蔽卡片）。
 *
 * @param scope 可选：独立筛选作用域；省略时面向主列表
 * @returns 无原生标签的卡片数
 */
export function countNoSiteTagItems(scope?: FilterScope): number {
    let count = 0;
    queryFilterItems(scope).forEach((item: Element) => {
        if (item.hasAttribute(JHS_HIDE_ATTR)) return;
        if (getItemNativeTags(item).size === 0) count++;
    });
    return count;
}
