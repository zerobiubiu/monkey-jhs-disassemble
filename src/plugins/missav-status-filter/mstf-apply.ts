// mstf-apply.ts —— 状态筛选过滤逻辑
//
// shouldShow：OR 判定；applyFilter：对 grid cell（外层包装或缩略图自身）显隐。
import { NO_TAG_VALUE } from './mstf-collect';

export function shouldShow(itemStatus: string | null, activeValues: Set<string>): boolean {
    if (activeValues.size === 0) return true;
    return activeValues.has(itemStatus ?? NO_TAG_VALUE);
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
 *
 * @param item .thumbnail.group 元素
 * @returns 应显隐的 grid cell
 */
function getCell(item: HTMLElement): HTMLElement {
    const parent = item.parentElement;
    // 父元素是非 grid 容器、非 body 的普通元素（初始页包装 DIV）→ 返回父元素；
    // 否则返回缩略图自身（瀑布流追加项 / 异常 DOM）。
    if (parent && parent !== document.body && !String(parent.className).includes('grid-cols')) {
        return parent;
    }
    return item;
}

export function applyFilter(activeValues: Set<string>): void {
    document.querySelectorAll<HTMLElement>('.thumbnail.group').forEach((item) => {
        const tag = item.querySelector<HTMLElement>('.missav-status-tag');
        const status = tag?.dataset.status ?? null;
        const cell = getCell(item);
        if (shouldShow(status, activeValues)) {
            cell.style.display = '';
            cell.removeAttribute('data-mstf-hidden');
        } else {
            cell.style.display = 'none';
            cell.setAttribute('data-mstf-hidden', 'yes');
        }
    });
}