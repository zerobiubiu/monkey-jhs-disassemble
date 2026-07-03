/**
 * OtherSiteBtn —— 详情页第三方站点按钮（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/other-site-plugin.ts 的 loadOtherSite（L141）map 回调：
 * 每个站点产出 `<a target="_blank" class="site-btn">` 含 `<span>` 站点名
 * （id 去掉 "Btn" 后缀），未启用时 display:none。由调用方循环拼接为
 * siteButtonsHtml 后注入 OtherSiteBox。
 *
 * 保留原 target/class/style/id/\<span> 结构原样不动；id / enabled 通过 prop 注入。
 * enabled 为 false 时 style={display:"none"}，true 时无 style 属性
 * （原模板 true 时 style=""，DOM 渲染等价）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 loadOtherSite 循环拼接 siteButtonsHtml
 * 时，需先用 `jsxToString`（来自 ../core/jsx-to-string，轻量 JSX→HTML
 * 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串再拼接：
 *   `siteButtonsHtml += jsxToString(<OtherSiteBtn id={...} enabled={...} />)`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义。
 */

/** OtherSiteBtn 的属性。 */
export interface OtherSiteBtnProps {
    /** 站点 id（如 "missAvBtn"，按钮 id 与显示名去 "Btn" 后缀）。 */
    id: string;
    /** 是否启用（未启用时 display:none）。 */
    enabled: boolean;
}

/**
 * 渲染单个第三方站点按钮的 JSX。
 * @returns site-btn JSX，经 jsxToString 转 HTML 字符串后供循环拼接。
 */
export function OtherSiteBtn({ id, enabled }: OtherSiteBtnProps) {
    return (
        <a
            target="_blank"
            className="site-btn"
            style={enabled ? undefined : { display: "none" }}
            id={id}
        >
            <span>{id.replace("Btn", "")}</span>
        </a>
    );
}
