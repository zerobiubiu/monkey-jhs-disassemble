/**
 * MissAV 视频预览 —— 纯函数选择器与事件判定模块。
 *
 * 职责：提供卡片选择器常量、从卡片 DOM 提取详情绝对 URL、判定鼠标事件是否为
 * 「普通左键单击」（用于拦截点击打开视频预览弹窗），不持有任何状态，
 * 供视频预览流程复用的纯函数。
 */
export const CARD_SEL = '.thumbnail.group';

/**
 * 从卡片内取首个 `a[href]` 的详情绝对 URL。
 *
 * @param card 卡片元素（.thumbnail.group）
 * @returns 详情页绝对 URL；卡片内无 `a[href]` 时返回 null
 */
export function findDetailUrl(card: Element): string | null {
    const a = card.querySelector<HTMLAnchorElement>('a[href]');
    return a ? a.href : null;
}

/**
 * 判定鼠标事件是否为「普通左键单击」（无任何修饰键）。
 *
 * Ctrl/Meta/Shift/Alt 组合键点击通常用于新标签页打开或浏览器扩展快捷键，
 * 不应被拦截为视频预览触发。
 *
 * @param e 鼠标事件
 * @returns true 表示普通左键单击
 */
export function isPlainLeftClick(e: MouseEvent): boolean {
    return e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey;
}