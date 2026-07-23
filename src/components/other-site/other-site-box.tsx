/**
 * OtherSiteBox —— 详情页第三方站点按钮容器（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/other-site-plugin.ts 的 loadOtherSite（L132-143）：原模板
 * 拼接 `<div id="otherSiteBox" class="panel-block">` 内含站点按钮（由 siteConfigs
 * map 生成），由 `.append(boxHtml)` 消费（同时追加到 .movie-panel-info 与
 * .container .info）。站点按钮由调用方循环调用 OtherSiteBtn 拼接后以
 * siteButtonsHtml prop 注入。
 *
 * 保留原 id/类名、内联 style（isJavdbSite 决定 margin-top，user-select:none）
 * 原样不动；siteButtonsHtml / isJavdbSite 通过 prop 注入。
 * siteButtonsHtml 为预拼接 HTML 字符串，经 dangerouslySetInnerHTML 注入
 * （jsxToString 支持，原样输出 __html）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 loadOtherSite 中 `.append()` 消费时，
 * 需先用 `jsxToString`（来自 ../core/jsx-to-string，轻量 JSX→HTML
 * 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `.append(jsxToString(<OtherSiteBox siteButtonsHtml={...} isJavdbSite={...} />))`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义。
 */

/** OtherSiteBox 的属性。 */
export interface OtherSiteBoxProps {
    /** 预拼接的站点按钮 HTML（由调用方循环 OtherSiteBtn 生成）。 */
    siteButtonsHtml: string;
    /** 是否 JavDb 站点（决定 margin-top 数值）。 */
    isJavdbSite: boolean;
}

/**
 * 渲染第三方站点按钮容器的 JSX。
 * @returns otherSiteBox JSX，经 jsxToString 转 HTML 字符串后供 `.append()` 消费。
 */
export function OtherSiteBox({ siteButtonsHtml, isJavdbSite }: OtherSiteBoxProps) {
    return (
        <div
            id="otherSiteBox"
            className="panel-block"
            style={{
                marginTop: isJavdbSite ? '8px' : '10px',
                fontSize: '13px',
                userSelect: 'none'
            }}
        >
            <div
                style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}
                dangerouslySetInnerHTML={{ __html: siteButtonsHtml }}
            />
        </div>
    );
}
