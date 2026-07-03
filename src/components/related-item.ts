/**
 * RelatedItem —— 相关清单区单条清单卡片 HTML 字符串组件。
 *
 * 为 RelatedPlugin.displayRelateds 提供：清单卡片含序号、创建时间、名称链接、
 * 视频个数、收藏次数、被查看次数，由 `container.append(html)` 消费。
 * 结构对称 ReviewItem（doc/13 已提取），字段与 HTML 已对照 archetype L10702 精确校准：
 * - 序号 `<span style="position:absolute;top:5px;right:10px;color:#999;...">#序号</span>`（floorIndex++ 自增）
 * - 创建时间 `<span style="position:absolute;bottom:5px;right:10px;color:#999;...">创建时间: {createTime}</span>`
 * - 名称链接 `<p><a href="/lists/{relatedId}" target="_blank" style="color:#2e8abb">{name}</a></p>`
 * - 视频个数 `<p style="margin-top: 5px;">视频个数: {movieCount}</p>`
 * - 收藏/查看 `<p style="margin-top: 5px;">收藏次数: {collectionCount} 被查看次数: {viewCount}</p>`
 *
 * 字段来自 RelatedCollection（src/constants/api.ts 由 fetchRelatedCollections 映射：
 * relatedId←id, name←name, movieCount←movies_count, collectionCount←collections_count,
 * viewCount←views_count, createTime←utils.formatDate(created_at)）。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/** RelatedItem 的属性。 */
export interface RelatedItemProps {
    /** 序号（调用方传入当前序号，自增由调用方处理）。 */
    index: number;
    /** 清单 ID（用于跳转链接 /lists/{relatedId}）。 */
    relatedId: string | number;
    /** 清单名称。 */
    name: string;
    /** 视频个数。 */
    movieCount: number;
    /** 收藏次数。 */
    collectionCount: number;
    /** 被查看次数。 */
    viewCount: number;
    /** 格式化后的创建时间文本。 */
    createTime: string;
}

/**
 * 渲染单条清单卡片的 HTML 字符串。
 * @returns related item HTML，供 `.append()` 消费。
 */
export function RelatedItem({
    index,
    relatedId,
    name,
    movieCount,
    collectionCount,
    viewCount,
    createTime,
}: RelatedItemProps): string {
    return `\n                <div class="item columns is-desktop" style="display:block;margin-top:6px;background-color:#ffffff;padding:10px;margin-left: -10px;word-break: break-word;position:relative;">\n                    <span style="position:absolute;top:5px;right:10px;color:#999;font-size:12px;">#${index}</span>\n                    <span style="position:absolute;bottom:5px;right:10px;color:#999;font-size:12px;">创建时间: ${createTime}</span>\n                    <p><a href="/lists/${relatedId}" target="_blank" style="color:#2e8abb">${name}</a></p>\n                    <p style="margin-top: 5px;">视频个数: ${movieCount}</p>\n                    <p style="margin-top: 5px;">收藏次数: ${collectionCount} 被查看次数: ${viewCount}</p>\n                </div>\n            `;
}
