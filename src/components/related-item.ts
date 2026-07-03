/**
 * RelatedItem —— 相关合集区单条合集卡片 HTML 字符串组件。
 *
 * 为 RelatedPlugin.displayRelateds 提供：合集卡片含序号、名称、影片数、收藏数、观看数、
 * 创建时间，由 `container.append(html)` 消费。结构对称 ReviewItem（doc/13 已提取），
 * 字段来自 RelatedCollection（src/constants/api.ts 由 fetchRelatedCollections 映射）。
 *
 * 字段展示语义为推断（archetype 无原始 RelatedPlugin 实现可核对，请人工校准）：
 * - movieCount → 影片数
 * - collectionCount → 收藏数（字段名字面"合集数"，但条目本身即为合集，疑为被收藏数）
 * - viewCount → 观看数
 * - createTime → 创建时间（fetchRelatedCollections 内部已 utils.formatDate）
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/** RelatedItem 的属性。 */
export interface RelatedItemProps {
    /** 序号（调用方传入当前序号，自增由调用方处理）。 */
    index: number;
    /** 合集名称。 */
    name: string;
    /** 影片数。 */
    movieCount: number;
    /** 收藏数。 */
    collectionCount: number;
    /** 观看数。 */
    viewCount: number;
    /** 格式化后的创建时间文本。 */
    createTime: string;
}

/**
 * 渲染单条合集卡片的 HTML 字符串。
 * @returns related item HTML，供 `.append()` 消费。
 */
export function RelatedItem({
    index,
    name,
    movieCount,
    collectionCount,
    viewCount,
    createTime,
}: RelatedItemProps): string {
    return `\n                <div class="item columns is-desktop" style="display:block;margin-top:6px;background-color:#ffffff;padding:10px;margin-left: -10px;word-break: break-word;position:relative;">\n                    <span style="position:absolute;top:5px;right:10px;color:#999;font-size:12px;">#${index}</span>\n                    📁 ${name} \n                    &nbsp;&nbsp; 影片:${movieCount} 收藏:${collectionCount} 观看:${viewCount}\n                    <span class="time">${createTime}</span>\n                </div>\n            `;
}
