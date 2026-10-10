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
 * 本次新增（外部站点访问统计，见 docs/45）：
 * - 锚点增加稳定身份属性 `data-site-id`（`#otherSiteBox` 可能被重复 append 而出现重复 id，
 *   统计刷新不能依赖 id）；
 * - 站点名后增加计数徽标 `<span class="site-open-count">`（`count` 为 0 时 display:none）。
 *   这是**有意的功能增量**，非移植零偏差范围内的结构；原 target/class/id/站点名 span 未改。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 loadOtherSite 循环拼接 siteButtonsHtml
 * 时，需先用 `jsxToString`（来自 ../core/jsx-to-string，轻量 JSX→HTML
 * 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串再拼接：
 *   `siteButtonsHtml += jsxToString(<OtherSiteBtn id={...} enabled={...} count={...} />)`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义。
 */

/** 站点按钮内计数徽标的 class（渲染层与统计刷新共用的契约）。 */
export const SITE_OPEN_COUNT_CLASS = 'site-open-count';

/** 站点按钮的稳定身份属性（容器重复时 id 会冲突，故统计刷新按此属性定位）。 */
export const SITE_BTN_ID_ATTR = 'data-site-id';

/** OtherSiteBtn 的属性。 */
export interface OtherSiteBtnProps {
    /** 站点 id（如 "missAvBtn"，按钮 id 与显示名去 "Btn" 后缀）。 */
    id: string;
    /** 是否启用（未启用时 display:none）。 */
    enabled: boolean;
    /** 该站点的累计外站点击次数；0 或省略时不显示徽标。 */
    count?: number;
}

/**
 * 渲染单个第三方站点按钮的 JSX。
 * @returns site-btn JSX，经 jsxToString 转 HTML 字符串后供循环拼接。
 */
export function OtherSiteBtn({ id, enabled, count = 0 }: OtherSiteBtnProps) {
    const siteName = id.replace('Btn', '');
    return (
        <a
            target="_blank"
            className="site-btn"
            style={enabled ? undefined : { display: 'none' }}
            id={id}
            data-site-id={id}
        >
            <span>{siteName}</span>
            <span
                className={SITE_OPEN_COUNT_CLASS}
                data-tip={`点击打开 ${siteName} 的次数`}
                style={count > 0 ? undefined : { display: 'none' }}
            >
                {count}
            </span>
        </a>
    );
}