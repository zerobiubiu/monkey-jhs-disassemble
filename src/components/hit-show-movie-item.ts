/**
 * HitShowMovieItem —— 热播榜单单个影片卡片 HTML 字符串组件。
 *
 * 提取自 src/plugins/hit-show-plugin.ts 的 markDataListHtml（L219-221）循环体：
 * 每个影片产出 `<div class="item">` 包裹封面图（替换 CDN 域名）、番号+标题、
 * 评分占位（#score_<id>）、发布日期、磁链标签（含中字/含磁链/无磁链/今日新種）。
 * 调用方 markDataListHtml 遍历 movies 调用本组件拼接后由 `.html(html)` 消费。
 *
 * 保留原 HTML 结构、类名、内联 style、\n 转义与缩进、三元嵌套（has_cnsub /
 * magnets_count / new_magnets）原样不动；movie 通过 prop 注入。
 * 封面 cover_url 的 CDN 域名替换（tp-iu.cmastd.com → c0.jdbstatic.com）
 * 保留在组件内，与原模板行为一致。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/** HitShowMovieItem 的属性（movie 为原始影片对象，字段为 any）。 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface HitShowMovieItemProps {
    /** 热播影片对象（含 id/cover_url/origin_title/number/release_date/has_cnsub/magnets_count/new_magnets）。 */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    movie: any;
}

/**
 * 渲染单个热播影片卡片的 HTML 字符串。
 * @param props.movie 影片对象
 * @returns item 卡片 HTML，供拼接后 `.html()` 消费。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function HitShowMovieItem({ movie }: HitShowMovieItemProps): string {
    return `\n                <div class="item" id="${movie.id}">\n                    <a href="/v/${movie.id}" class="box" title="${movie.origin_title}">\n                        <div class="cover ">\n                            <img loading="lazy" src="${movie.cover_url.replace("https://tp-iu.cmastd.com/rhe951l4q", "https://c0.jdbstatic.com")}" alt="">\n                        </div>\n                        <div class="video-title"><strong>${movie.number}</strong> ${movie.origin_title}</div>\n                        <div class="score" id="score_${movie.id}">\n                        </div>\n                        <div class="meta">\n                            ${movie.release_date}\n                        </div>\n                        <div class="tags has-addons">\n                           ${movie.has_cnsub ? '<span class="tag is-warning">含中字磁鏈</span>' : movie.magnets_count > 0 ? '<span class="tag is-success">含磁鏈</span>' : '<span class="tag is-info">无磁鏈</span>'}\n                           ${movie.new_magnets ? '<span class="tag is-info">今日新種</span>' : ""}\n                        </div>\n                    </a>\n                </div>\n            `;
}
