/**
 * MissAV 多栏筛选过滤逻辑 —— 状态 / MissAV 原生收藏 / JavDB 归属清单三栏交集显隐。
 *
 * - `shouldShow` / `applyFilter` 保留既有签名与 `data-mstf-hidden` 属性契约；
 * - 新增 `shouldShowByMissavSaved`、`shouldShowByVltTags` 及对应 apply 函数，
 *   三栏各自维护独立隐藏属性，统一由 `syncCellDisplay` 合成 grid cell 的最终显隐，
 *   实现跨栏交集与网格无缝重排。
 */
import {
    hasActiveSelections,
    matchesIncludeExclude,
    type FilterSelections
} from '../../core/util/site/filter-chips';

import {
    MISSAV_SAVED_VALUE,
    MISSAV_UNSAVED_VALUE,
    NO_TAG_VALUE,
    NO_VLT_TAG_VALUE,
    getItemMissavSaved,
    getItemVltTags
} from './mstf-collect';

/** 兼容旧调用方（直接传包含集合）与新版三态（包含 + 排除集合）。 */
export type MissavFilterInput = ReadonlySet<string> | FilterSelections;

/** 三栏独立隐藏标记属性（交集判定：任一为 yes 即隐藏 cell）。 */
export const HIDE_ATTR_STATUS = 'data-mstf-hidden';
export const HIDE_ATTR_SAVED = 'data-msf-saved-hidden';
export const HIDE_ATTR_VLT = 'data-msf-vlt-hidden';

function normalizeSelections(input: MissavFilterInput): FilterSelections {
    if (input instanceof Set) {
        return { included: new Set(input), excluded: new Set() };
    }
    return input as FilterSelections;
}

export function shouldShow(itemStatus: string | null, filter: MissavFilterInput): boolean {
    const selections = normalizeSelections(filter);
    if (!hasActiveSelections(selections)) return true;
    const key = itemStatus ?? NO_TAG_VALUE;
    return matchesIncludeExclude(selections, (values) => values.has(key));
}

/** 判定单张卡片是否通过「MissAV 原生收藏」筛选条件。 */
export function shouldShowByMissavSaved(isSaved: boolean, filter: MissavFilterInput): boolean {
    const selections = normalizeSelections(filter);
    if (!hasActiveSelections(selections)) return true;
    const key = isSaved ? MISSAV_SAVED_VALUE : MISSAV_UNSAVED_VALUE;
    return matchesIncludeExclude(selections, (values) => values.has(key));
}

/** 判定单张卡片是否通过「JavDB 归属清单」筛选条件。 */
export function shouldShowByVltTags(
    itemTags: readonly string[],
    filter: MissavFilterInput
): boolean {
    const selections = normalizeSelections(filter);
    if (!hasActiveSelections(selections)) return true;
    if (itemTags.length === 0) {
        return matchesIncludeExclude(selections, (values) => values.has(NO_VLT_TAG_VALUE));
    }
    return matchesIncludeExclude(selections, (values) => itemTags.some((tag) => values.has(tag)));
}

/**
 * 返回缩略图所属的 grid cell（网格直接子项）——显隐必须作用在 cell 上，
 * 隐藏后 grid 才自动重排、不留空洞。
 *
 * missav 初始页结构为 `grid > 包装DIV > .thumbnail.group`（包装 DIV 无样式，
 * 是 grid 的直接子项）；瀑布流追加项为 `grid > .thumbnail.group`（缩略图自身
 * 是 grid 直接子项）。Camoufox 实测根因（doc/223）。
 *
 * 判定用 className 而非 CSS 选择器：grid 容器 class 含 `grid-cols`（Tailwind），
 * 包装 DIV 无 class、缩略图自身 class 为 `thumbnail group`——避免 `md\:grid-cols`
 * 这类 CSS 转义在部分环境（jsdom nwsapi）匹配失败的问题。
 */
export function getMissavGridCell(item: HTMLElement): HTMLElement {
    const parent = item.parentElement;
    if (parent && parent !== document.body && !String(parent.className).includes('grid-cols')) {
        return parent;
    }
    return item;
}

/** 根据三栏独立隐藏属性合成 grid cell 最终 display 状态。 */
function syncCellDisplay(cell: HTMLElement): void {
    const hidden =
        cell.getAttribute(HIDE_ATTR_STATUS) === 'yes' ||
        cell.getAttribute(HIDE_ATTR_SAVED) === 'yes' ||
        cell.getAttribute(HIDE_ATTR_VLT) === 'yes';
    cell.style.display = hidden ? 'none' : '';
}

function setCellBarHidden(cell: HTMLElement, attr: string, hidden: boolean): void {
    if (hidden) {
        cell.setAttribute(attr, 'yes');
    } else {
        cell.removeAttribute(attr);
    }
    syncCellDisplay(cell);
}

/** 应用「状态」栏筛选（保留 `applyFilter` 导出与 `data-mstf-hidden` 契约）。 */
export function applyFilter(filter: MissavFilterInput): void {
    const selections = normalizeSelections(filter);
    document.querySelectorAll<HTMLElement>('.thumbnail.group').forEach((item) => {
        const tag = item.querySelector<HTMLElement>('.missav-status-tag');
        const status = tag?.dataset.status ?? null;
        const cell = getMissavGridCell(item);
        setCellBarHidden(cell, HIDE_ATTR_STATUS, !shouldShow(status, selections));
    });
}

/** 应用「MissAV 原生收藏」栏筛选。 */
export function applyMissavSavedFilter(filter: MissavFilterInput): void {
    const selections = normalizeSelections(filter);
    document.querySelectorAll<HTMLElement>('.thumbnail.group').forEach((item) => {
        const cell = getMissavGridCell(item);
        const isSaved = getItemMissavSaved(item);
        setCellBarHidden(cell, HIDE_ATTR_SAVED, !shouldShowByMissavSaved(isSaved, selections));
    });
}

/** 应用「JavDB 归属清单」栏筛选。 */
export function applyMissavVltFilter(filter: MissavFilterInput): void {
    const selections = normalizeSelections(filter);
    document.querySelectorAll<HTMLElement>('.thumbnail.group').forEach((item) => {
        const cell = getMissavGridCell(item);
        const tags = getItemVltTags(item);
        setCellBarHidden(cell, HIDE_ATTR_VLT, !shouldShowByVltTags(tags, selections));
    });
}
