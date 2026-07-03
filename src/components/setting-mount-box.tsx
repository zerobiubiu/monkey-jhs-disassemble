/**
 * SettingMountBox —— 设置按钮挂载容器（React 函数组件，JSX，4 变体）。
 *
 * 提取自 src/plugins/setting-plugin.ts 的 handle（L147-178）四处注入：
 *   - navbar：JavDb 顶部导航 setting-box（has-dropdown is-hoverable）
 *   - mini：窄屏 mini-setting-box（miniHistoryBtnBox 之前）
 *   - topright：JavBus waitCheckBtn 父级后的 #top-right-box
 *   - containerfluid：JavBus 详情页 h3 之前的 .container-fluid 包裹
 * 四处均含 `<a id="setting-btn">设置</a>` + `<div class="simple-setting"></div>`，
 * 由 `.prepend()` / `.before()` / `.append()` 消费。
 *
 * 保留原 id/类名/内联 style（含 `!important`，以字符串值形式写入
 * CSSProperties，jsxToString 原样输出）/`<a>` 内 `<span>` 文案原样不动；
 * variant 通过 prop 决定模板。原模板中的 `\n` 转义与缩进由 jsxToString
 * 紧凑输出丢失，对 DOM 构建/CSS 渲染无影响。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 handle 中
 * `.prepend()/.before()/.append()` 消费时，需先用 `jsxToString` 转为 HTML
 * 字符串：
 *   `$("#navbar-menu-user .navbar-end").prepend(jsxToString(<SettingMountBox variant="navbar" />))`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义，与原始 jQuery `.prepend(htmlString)`
 * 行为一致。
 */

/** SettingMountBox 的变体（决定包裹结构与样式）。 */
export type SettingMountBoxVariant =
    | "navbar"
    | "mini"
    | "topright"
    | "containerfluid";

/** SettingMountBox 的属性。 */
export interface SettingMountBoxProps {
    /** 挂载变体。 */
    variant: SettingMountBoxVariant;
}

/**
 * 渲染设置按钮挂载容器的 JSX。
 * @param props.variant 挂载变体
 * @returns 挂载容器 JSX，经 jsxToString 转 HTML 字符串后供
 *          `.prepend()/.before()/.append()` 消费。
 */
export function SettingMountBox({ variant }: SettingMountBoxProps) {
    switch (variant) {
        case "navbar":
            return (
                <div
                    className="navbar-item has-dropdown is-hoverable setting-box"
                    style={{ position: "relative" }}
                >
                    <a
                        id="setting-btn"
                        className="navbar-link nav-btn"
                        style={{
                            color: "#ff8400 !important",
                            paddingRight: "15px !important",
                        }}
                    >
                        设置
                    </a>
                    <div className="simple-setting" />
                </div>
            );
        case "mini":
            return (
                <div
                    className="navbar-item mini-setting-box"
                    style={{ position: "relative", marginLeft: "auto" }}
                >
                    <a
                        id="mini-setting-btn"
                        className="navbar-link nav-btn"
                        style={{
                            color: "#ff8400 !important",
                            paddingLeft: "0 !important",
                            paddingRight: "0 !important",
                        }}
                    >
                        设置
                    </a>
                    <div className="mini-simple-setting" />
                </div>
            );
        case "topright":
            return (
                <div
                    id="top-right-box"
                    style={{
                        position: "relative",
                        display: "flex",
                        flexGrow: 1,
                        justifyContent: "flex-end",
                        zIndex: "12345679 !important",
                    }}
                >
                    <div className="setting-box">
                        <a
                            id="setting-btn"
                            className="menu-btn main-tab-btn"
                            style={{
                                backgroundColor: "#6e685e !important",
                            }}
                        >
                            <span>设置</span>
                        </a>
                        <div className="simple-setting" />
                    </div>
                </div>
            );
        case "containerfluid":
            return (
                <div
                    className="container-fluid"
                    style={{ marginTop: "20px" }}
                >
                    <div
                        id="top-right-box"
                        style={{
                            position: "relative",
                            display: "flex",
                            flexGrow: 1,
                            justifyContent: "flex-end",
                            zIndex: "12345679 !important",
                        }}
                    >
                        <div className="setting-box">
                            <a
                                id="setting-btn"
                                className="menu-btn main-tab-btn"
                                style={{
                                    backgroundColor: "#6e685e !important",
                                }}
                            >
                                <span>设置</span>
                            </a>
                            <div className="simple-setting" />
                        </div>
                    </div>
                </div>
            );
    }
}
