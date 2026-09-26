/**
 * JavDB 详情页女演员链接兼容读取器。
 *
 * 2026-09-26 在真实详情页（`/v/pkWq0q`）实测：`.female` 数量为 0，
 * `a.actor-female` 数量为 11；演员链接现在直接带 `actor-female` 类，位于
 * `.value` 容器内。原有读法 `$('.female').prev()` 因锚点类名/节点关系改变而返回空集。
 *
 * 读取策略：优先查询新选择器 `a.actor-female`；若无结果，再回退旧版 `.female`
 * 性别标记的前置兄弟读法，避免破坏仍使用旧结构的列表页或历史 HTML。
 * `root` 支持传入当前 `document` 或通过 GMHttp 下载后解析得到的 detached DOM。
 *
 * **纯读取**：不修改 DOM、不读写存储、不执行迁移，与用户数据无关。
 */

/** 演员链接类名选择器。 */
export const ACTRESS_LINK_SELECTORS = {
    current: 'a.actor-female',
    legacyMarker: '.female'
} as const;

/**
 * 取出指定 DOM 树中的女演员链接（新结构优先，旧结构回退）。
 *
 * @param root 当前文档或 detached HTML 根节点
 * @returns 命中的链接元素；均无匹配时返回空数组
 */
export function queryActressLinks(root: ParentNode = document): HTMLElement[] {
    const current = Array.from(root.querySelectorAll<HTMLElement>(ACTRESS_LINK_SELECTORS.current));
    if (current.length > 0) {
        return current;
    }

    return Array.from(root.querySelectorAll<HTMLElement>(ACTRESS_LINK_SELECTORS.legacyMarker))
        .map((marker) => marker.previousElementSibling)
        .filter((element): element is HTMLElement => element !== null);
}

/**
 * 将元素文本去空白后以空格连接。
 *
 * @param elements 演员链接元素
 * @returns 演员名称串；空集合返回空串
 */
export function joinElementText(elements: HTMLElement[]): string {
    return elements
        .map((element) => (element.textContent ?? '').trim())
        .filter((text) => text !== '')
        .join(' ');
}

/**
 * 读取当前详情页或传入 DOM 中的女演员名（空格连接）。
 *
 * @param root 当前文档或 detached HTML 根节点
 * @returns 演员名字符串；无演员时为空串
 */
export function getActressNames(root: ParentNode = document): string {
    return joinElementText(queryActressLinks(root));
}
