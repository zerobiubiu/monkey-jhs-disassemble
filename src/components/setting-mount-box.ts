/**
 * SettingMountBox —— 设置按钮挂载容器 HTML 字符串组件（4 变体）。
 *
 * 提取自 src/plugins/setting-plugin.ts 的 handle（L147-178）四处注入：
 *   - navbar：JavDb 顶部导航 setting-box（has-dropdown is-hoverable）
 *   - mini：窄屏 mini-setting-box（miniHistoryBtnBox 之前）
 *   - topright：JavBus waitCheckBtn 父级后的 #top-right-box
 *   - containerfluid：JavBus 详情页 h3 之前的 .container-fluid 包裹
 * 四处均含 `<a id="setting-btn">设置</a>` + `<div class="simple-setting"></div>`，
 * 由 `.prepend()` / `.before()` / `.append()` 消费。
 *
 * 保留原 id/类名/内联 style/\n 转义原样不动；variant 通过 prop 决定模板。
 *
 * 统一规定（doc/06-component-html-string.md）：返回 HTML 字符串，不用 JSX、
 * 不用 renderToStaticMarkup。属性值不做转义。
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
 * 渲染设置按钮挂载容器的 HTML 字符串。
 * @param props.variant 挂载变体
 * @returns 挂载容器 HTML，供 `.prepend()/.before()/.append()` 消费。
 */
export function SettingMountBox({ variant }: SettingMountBoxProps): string {
    switch (variant) {
        case "navbar":
            return '<div class="navbar-item has-dropdown is-hoverable setting-box" style="position:relative;">\n                    <a id="setting-btn" class="navbar-link nav-btn" style="color: #ff8400 !important;padding-right:15px !important;">\n                        设置\n                    </a>\n                    <div class="simple-setting"></div>\n                </div>';
        case "mini":
            return '\n                    <div class="navbar-item mini-setting-box" style="position:relative;margin-left: auto;">\n                        <a id="mini-setting-btn" class="navbar-link nav-btn" style="color: #ff8400 !important;padding-left:0 !important;padding-right:0 !important;">\n                            设置\n                        </a>\n                        <div class="mini-simple-setting"></div>\n                    </div>\n                ';
        case "topright":
            return '\n                    <div id="top-right-box" style="position: relative; display: flex; flex-grow: 1;justify-content: flex-end;z-index: 12345679 !important;">\n                        <div class="setting-box">\n                            <a id="setting-btn" class="menu-btn main-tab-btn" style="background-color:#6e685e !important;">\n                                <span>设置</span>\n                            </a>\n                            <div class="simple-setting"></div>\n                        </div>\n                    </div>\n               ';
        case "containerfluid":
            return '\n                    <div class="container-fluid" style="margin-top:20px">\n                        <div id="top-right-box" style="position: relative; display: flex; flex-grow: 1;justify-content: flex-end;z-index: 12345679 !important;">\n                            <div class="setting-box">\n                                <a id="setting-btn" class="menu-btn main-tab-btn" style="background-color:#6e685e !important;">\n                                    <span>设置</span>\n                                </a>\n                                <div class="simple-setting"></div>\n                            </div>\n                        </div>\n                    </div>\n               ';
    }
}
