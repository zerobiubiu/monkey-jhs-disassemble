/**
 * NavSearchBox —— 导航栏自定义检索框 HTML 字符串组件。
 *
 * 提取自 src/plugins/nav-bar-plugin.ts 的 hookSearch（L91-93）：原字符串注入
 * `#navbar-menu-hero` 之后，含搜索类型下拉（影片/演員/系列/片商/導演/番號/清單）、
 * 关键词输入、进阶检索链接、检索按钮。由 `$("#navbar-menu-hero").after(html)` 消费。
 *
 * 保留原 `<div class="navbar-menu" id="search-box">` 结构、所有 id/类名/内联 style、
 * option value、placeholder、\n 转义原样不动。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
 */

/**
 * 渲染导航栏自定义检索框的 HTML 字符串。
 * @returns search-box HTML，供 `.after()` 消费。
 */
export function NavSearchBox(): string {
    return '\n            <div class="navbar-menu" id="search-box">\n                <div class="navbar-start" style="display: flex; align-items: center; gap: 5px;">\n                    <select id="search-type" style="padding: 8px 12px; border: 1px solid #555; border-radius: 4px; background-color: #333; color: #eee; font-size: 14px; outline: none;">\n                        <option value="all">影片</option>\n                        <option value="actor">演員</option>\n                        <option value="series">系列</option>\n                        <option value="maker">片商</option>\n                        <option value="director">導演</option>\n                        <option value="code">番號</option>\n                        <option value="list">清單</option>\n                    </select>\n                    <input id="search-keyword" type="text" placeholder="輸入影片番號，演員名等關鍵字進行檢索" style="padding: 8px 12px; border: 1px solid #555; border-radius: 4px; flex-grow: 1; font-size: 14px; background-color: #333; color: #eee; outline: none;">\n                    <a href="/advanced_search?noFold=1" title="進階檢索" style="padding: 6px 12px; background-color: #444; border-radius: 4px; text-decoration: none; color: #ddd; font-size: 14px; border: 1px solid #555;"><span>...</span></a>\n                    <a id="search-btn" style="padding: 6px 16px; background-color: #444; color: #fff; border-radius: 4px; text-decoration: none; font-weight: 500; cursor: pointer; border: 1px solid #555;">檢索</a>\n                </div>\n            </div>\n        ';
}
