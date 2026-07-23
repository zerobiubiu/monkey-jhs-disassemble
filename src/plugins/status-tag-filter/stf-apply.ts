/**
 * 筛选应用 —— 从 status-tag-filter-plugin.ts 拆出的 applyFilter 方法。
 *
 * 根据当前激活的芯片显示/隐藏 .item 元素。协同安全：被 jhs 或其他脚本
 * 隐藏的卡片不纳入管理（doc/48 增强：检查 data-hide 属性）。
 */
import { JHS_HIDE_ATTR, NO_TAG_VALUE, STATUS_TAG_SELECTOR } from './stf-collect';

/** 标记本脚本隐藏的卡片（与 jhs 的 data-hide 区分，协同安全设计）。 */
const HIDDEN_ATTR = 'data-status-tag-hidden';

/**
 * 应用筛选：根据当前激活的芯片显示/隐藏 .item 元素。对应原 L75-120。
 *
 * 协同安全（与 jhs 兼容的关键）：
 * - 被其他脚本隐藏的卡片（display:none 且无 data-status-tag-hidden）不纳入管理
 * - jhs 用 jQuery .hide() + data-hide 属性隐藏卡片，本脚本识别为"被其他脚本隐藏"并跳过
 *
 * 筛选逻辑：
 * - 无激活芯片：仅恢复本脚本隐藏的卡片（不触碰其他脚本已隐藏的）
 * - 激活"无状态标签"芯片：仅显示无任何状态标签的项
 * - 激活其他芯片：OR 逻辑，命中任一选中标签即显示
 */
export function applyFilter(): void {
    const activeChips = document.querySelectorAll('.status-tag-filter-chip.active');
    const selectedValues = new Set(
        Array.from(activeChips).map((c: Element) => (c as HTMLElement).dataset.value || '')
    );

    // 无筛选时：仅恢复本脚本隐藏的卡片，不清除其他脚本的隐藏
    // doc/48 增强：恢复时检查 data-hide，避免恢复被 jhs 屏蔽的卡片
    if (selectedValues.size === 0) {
        document.querySelectorAll(`.item[${HIDDEN_ATTR}]`).forEach((item: Element) => {
            const htmlItem = item as HTMLElement;
            // 被jhs 屏蔽的卡片不恢复显示（保持隐藏）
            if (htmlItem.hasAttribute(JHS_HIDE_ATTR)) return;
            htmlItem.removeAttribute(HIDDEN_ATTR);
            htmlItem.style.display = '';
        });
        return;
    }

    const showNoTag = selectedValues.has(NO_TAG_VALUE);
    const selectedTags = new Set([...selectedValues].filter((v) => v !== NO_TAG_VALUE));

    document.querySelectorAll('.item').forEach((item: Element) => {
        const htmlItem = item as HTMLElement;
        // 协同安全（doc/48 增强）：被 jhs 屏蔽的卡片不纳入管理。
        // 优先检查稳定的语义属性 data-hide（jhs 两种隐藏标记：
        // "yes"=filterMovieList 屏蔽 / "<carNum>-hide"=showCarNumBox 临时隐藏），
        // 而非易变的 style.display——排序/筛选时序竞争中 style.display 可能
        // 被临时清除/覆盖，但 data-hide 属性在同一节点引用上不会丢失
        // （jQuery empty+append 移动节点不丢属性）。同时保留 style.display
        // 检查作为兼底（兼容未知脚本的隐藏）。
        const hiddenByJhs = htmlItem.hasAttribute(JHS_HIDE_ATTR);
        const hiddenByOther =
            htmlItem.style.display === 'none' && !htmlItem.hasAttribute(HIDDEN_ATTR);
        if (hiddenByJhs || hiddenByOther) return;

        // 收集当前卡片内所有 status-tag 的文本
        const itemStatusTags = new Set<string>();
        item.querySelectorAll(STATUS_TAG_SELECTOR).forEach((el: Element) => {
            const text = el.textContent?.trim() || '';
            if (text) itemStatusTags.add(text);
        });

        // 标签匹配：命中任一选定标签即显示（OR 逻辑）
        let tagMatch = false;
        if (selectedTags.size > 0) {
            tagMatch = [...selectedTags].some((t) => itemStatusTags.has(t));
        }

        // 无标签条件独立判断，与标签匹配用 OR 连接
        const noTagMatch = showNoTag && itemStatusTags.size === 0;

        const shouldShow = tagMatch || noTagMatch;

        if (shouldShow) {
            htmlItem.removeAttribute(HIDDEN_ATTR);
            htmlItem.style.display = '';
        } else {
            htmlItem.setAttribute(HIDDEN_ATTR, '');
            htmlItem.style.display = 'none';
        }
    });
}
