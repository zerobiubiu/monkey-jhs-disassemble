/**
 * SiteResultTag —— 第三方站点"多结果"角标（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/other-site-plugin.ts 的 handleSite（L196/L223/L280）与
 * src/plugins/preview-video-plugin.ts 的 _searchContentIds（L250）：多处
 * `buttonEl.append('<span class="site-tag" style="top:-15px">多结果</span>')`，
 * 标注搜索命中多条结果。无动态值，固定文案。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 handleSite / _searchContentIds
 * 中 `.append()` 消费时，需先用 `jsxToString`（来自 ../core/jsx-to-string，
 * 轻量 JSX→HTML 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `buttonEl.append(jsxToString(<SiteResultTag />))`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义。
 */

/**
 * 渲染"多结果"角标的 JSX。
 * @returns site-tag span JSX，经 jsxToString 转 HTML 字符串后供 `.append()` 消费。
 */
export function SiteResultTag() {
    return (
        <span className="site-tag" style={{ top: "-15px" }}>
            多结果
        </span>
    );
}
