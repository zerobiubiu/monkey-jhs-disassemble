/**
 * MissAV 列表页瀑布流 —— 纯函数选择器与解析模块。
 *
 * 职责：从 MissAV 列表页 DOM 中提取「下一页链接 / 缩略图元素 / 番号数组」，
 * 不持有任何状态，供瀑布流获取/渲染流程复用的纯函数。
 */
import { normalizeCarNum } from '../car-status-sync/missav-renderer';

export const MAP_SEL = {
    thumb: '.thumbnail.group',
    grid: 'div.grid.grid-cols-2.md\\:grid-cols-3.xl\\:grid-cols-4.gap-5',
    nextLink: "a[href*='page=']"
} as const;

export function findNextUrl(doc: Document | Element): string | null {
    const links = Array.from(doc.querySelectorAll<HTMLAnchorElement>(MAP_SEL.nextLink));
    const next = links.find((a) => {
        const text = a.textContent?.trim() || '';
        return text === '下一页' || text === 'Next';
    });
    return next ? next.href : null;
}

export function extractThumbs(container: ParentNode): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>(MAP_SEL.thumb));
}

export function collectCarNums(thumbs: HTMLElement[]): string[] {
    return thumbs.map((t) => {
        const a = t.querySelector<HTMLAnchorElement>('a[alt]');
        return a ? normalizeCarNum(a.getAttribute('alt') || '') : '';
    }).filter(Boolean);
}