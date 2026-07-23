/**
 * 标签筛选应用逻辑 —— 筛选执行 + 标签统计。
 *
 * 提取自 vlt-filter-bar.ts：
 * - applyFilter：应用当前筛选（4 种模式）
 * - collectAllUniqueTags：收集所有唯一标签名
 * - collectTagCounts：收集标签计数
 * - countNoTagItems：计算无标签卡片数
 */
import type { VltTags } from './vlt-tags';

/** 标记本脚本隐藏的卡片（与其他脚本的 hidden 属性区分，协同安全设计）。 */
export const TAG_HIDDEN_ATTR = 'data-video-lists-tag-hidden';

/** 筛选模式枚举（4 种）。 */
export const FILTER_MODES = {
    CONTAINS_ANY: 'contains-any',
    CONTAINS_ALL: 'contains-all',
    EXCLUDES_ALL: 'excludes-all',
    EXCLUDES_ANY: 'excludes-any'
} as const;

/**
 * 收集页面上所有唯一的标签名称（排除占位符）（对应原 L668-681）。
 * 占位符（pointer-events: none 的 —）被选择器排除。
 *
 * @returns 去重排序后的标签名数组
 */
export function collectAllUniqueTags(): string[] {
    const tagNames = new Set<string>();
    document
        .querySelectorAll(".jhs-vlt-tag-link:not([style*='pointer-events: none'])")
        .forEach((el: Element) => {
            const name = el.textContent?.trim() || '';
            if (name && name !== '\u2014') {
                tagNames.add(name);
            }
        });
    return [...tagNames].sort();
}

/**
 * 收集每个标签的出现次数（对应原 L684-697）。
 * 占位符被选择器排除。
 *
 * @returns 标签名→计数映射
 */
export function collectTagCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    document
        .querySelectorAll(".jhs-vlt-tag-link:not([style*='pointer-events: none'])")
        .forEach((el: Element) => {
            const name = el.textContent?.trim() || '';
            if (name && name !== '\u2014') {
                counts[name] = (counts[name] || 0) + 1;
            }
        });
    return counts;
}

/**
 * 计算无标签的卡片数（对应原 L700-709）。
 * 占位符被选择器排除，仅有占位符的卡片计为无标签。
 *
 * @returns 无标签的卡片数
 */
export function countNoTagItems(): number {
    let count = 0;
    document.querySelectorAll('.item').forEach((item: Element) => {
        const links = item.querySelectorAll(
            ".jhs-vlt-tag-link:not([style*='pointer-events: none'])"
        );
        if (links.length === 0) count++;
    });
    return count;
}

/**
 * 应用当前筛选（对应原 L717-807）。
 *
 * 支持 4 种模式：
 * - CONTAINS_ANY：包含任意一个选中标签即显示（OR）
 * - CONTAINS_ALL：全都包含才显示（AND）
 * - EXCLUDES_ALL：一个都不包含才显示（NOR）
 * - EXCLUDES_ANY：至少缺少一个才显示（NAND）
 *
 * 协同安全：被其他脚本隐藏的卡片（display:none 且无 TAG_HIDDEN_ATTR）
 * 不纳入管理，跳过。无筛选时仅恢复本脚本隐藏的卡片。
 *
 * @param plugin VltTags 实例
 */
export function applyFilter(plugin: VltTags): void {
    const activeChips = document.querySelectorAll('.jhs-vlt-filter-chip.jhs-vlt-active');
    const selectedValues = new Set(
        Array.from(activeChips).map((c: Element) => (c as HTMLElement).dataset.value || '')
    );

    // 无筛选时：仅恢复本脚本隐藏的卡片
    if (selectedValues.size === 0) {
        document.querySelectorAll(`.item[${TAG_HIDDEN_ATTR}]`).forEach((item: Element) => {
            (item as HTMLElement).removeAttribute(TAG_HIDDEN_ATTR);
            (item as HTMLElement).style.display = '';
        });
        return;
    }

    const showNoTag = selectedValues.has('no-tag');
    const selectedTags = new Set([...selectedValues].filter((v: string) => v !== 'no-tag'));

    document.querySelectorAll('.item').forEach((item: Element) => {
        const htmlItem = item as HTMLElement;
        // 协同安全：已被其他脚本隐藏的卡片不纳入管理
        const hiddenByOther =
            htmlItem.style.display === 'none' && !htmlItem.hasAttribute(TAG_HIDDEN_ATTR);
        if (hiddenByOther) return;

        const tagLinks = item.querySelectorAll(
            ".jhs-vlt-tag-link:not([style*='pointer-events: none'])"
        );
        const itemTagNames = new Set(
            Array.from(tagLinks).map((el: Element) => el.textContent?.trim() || '')
        );

        let tagMatch = false;

        if (selectedTags.size > 0) {
            switch (plugin.currentFilterMode) {
                case FILTER_MODES.CONTAINS_ANY:
                    // 包含任意一个：命中任一标签即显示
                    tagMatch = [...selectedTags].some((t) => itemTagNames.has(t));
                    break;
                case FILTER_MODES.CONTAINS_ALL:
                    // 全都包含：命中全部标签才显示
                    tagMatch = [...selectedTags].every((t) => itemTagNames.has(t));
                    break;
                case FILTER_MODES.EXCLUDES_ALL:
                    // 不包含以下标签：一个都不包含才显示
                    tagMatch = ![...selectedTags].some((t) => itemTagNames.has(t));
                    break;
                case FILTER_MODES.EXCLUDES_ANY:
                    // 不包含以下任意一个：至少缺少一个才显示
                    tagMatch = ![...selectedTags].every((t) => itemTagNames.has(t));
                    break;
                default:
                    tagMatch = [...selectedTags].some((t) => itemTagNames.has(t));
            }
        }

        // 无标签条件独立判断，与标签匹配用 OR 连接
        const noTagMatch = showNoTag && itemTagNames.size === 0;

        const shouldShow = tagMatch || noTagMatch;

        if (shouldShow) {
            htmlItem.removeAttribute(TAG_HIDDEN_ATTR);
            htmlItem.style.display = '';
        } else {
            htmlItem.setAttribute(TAG_HIDDEN_ATTR, '');
            htmlItem.style.display = 'none';
        }
    });
}
