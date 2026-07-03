/**
 * BlacklistDialog —— 演员黑名单弹窗 React 函数组件（JSX）。
 *
 * 提取自 src/plugins/blacklist-plugin.ts 的 openBlacklistDialog（L213，
 * 原 archetype/jhs.user.js L7446 的 layer.open content）：
 * 顶部筛选区（dataType 性别下拉 + statusType 检测状态下拉 +
 * urlType 屏蔽类型下拉 + searchValue 搜索框 + cleanQueryBtn 重置链接）+
 * 表格容器（table-container，由 Tabulator 渲染）。
 *
 * 保留原 HTML 结构、id（dataType/statusType/urlType/searchValue/
 * cleanQueryBtn/table-container）、类名（a-info）、内联 style 原样不动；
 * urlType 下拉的可见性通过 props 注入（原 `${isJavdbSite ? "" :
 * "display: none;"}`，对应原 archetype 变量 r），以保持组件为纯模板
 * （不在组件内引用站点常量）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 openBlacklistDialog 中
 * layer.open({ content }) 消费时，需先用 `jsxToString`（来自
 * ../core/jsx-to-string，轻量 JSX→HTML 字符串渲染器，不引入
 * react-dom/server）转为 HTML 字符串：
 *   `layer.open({ content: jsxToString(<BlacklistDialog showUrlType={...} />), ... })`
 * 事件绑定（重置/搜索/各下拉变更/外链点击）与 Tabulator 初始化仍由
 * openBlacklistDialog 的 success 回调持有，组件只负责静态结构 + 动态值插值。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，
 * 经轻量 `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时
 * 依赖，不引入 react-dom/server）。属性值不做转义（data-tip/title 等
 * 按本工程约定不转义，与原 jQuery `.append(htmlString)` 行为一致）。
 */
import type { CSSProperties } from "react";

/** BlacklistDialog 的属性。 */
interface BlacklistDialogProps {
    /** 是否显示屏蔽类型下拉（原 isJavdbSite，控制 urlType select 的 display）。 */
    showUrlType: boolean;
}

/**
 * 渲染演员黑名单弹窗的 JSX。
 * @param props.showUrlType 是否显示屏蔽类型下拉（true 对应 JavDb 站点）。
 * @returns 演员黑名单面板 JSX（筛选区 + 表格容器），经 jsxToString 转 HTML 字符串后供
 *          layer.open({ content }) 直接消费。
 */
export function BlacklistDialog({ showUrlType }: BlacklistDialogProps) {
    const urlTypeStyle: CSSProperties = {
        textAlign: "center",
        minWidth: "150px",
        display: showUrlType ? undefined : "none",
    };
    return (
        <div style={{ padding: "10px 20px", height: "100%", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: "5px" }}></div>
                <div style={{ display: "flex", gap: "5px" }}>
                    <select
                        id="dataType"
                        style={{ textAlign: "center", minWidth: "150px" }}
                    >
                        <option value="" selected>
                            所有
                        </option>
                        <option value="actor">男演员</option>
                        <option value="actress">女演员</option>
                    </select>
                    <select
                        id="statusType"
                        style={{ textAlign: "center", minWidth: "150px" }}
                    >
                        <option value="" selected>
                            --检测状态--
                        </option>
                        <option value="normal">正常检测</option>
                        <option value="stop">停止检测</option>
                    </select>
                    <select
                        id="urlType"
                        data-tip="在演员页屏蔽时,是否选择了分类"
                        style={urlTypeStyle}
                    >
                        <option value="" selected>
                            --屏蔽类型--
                        </option>
                        <option value="hasT">按所选分类屏蔽</option>
                        <option value="noT">未筛选分类</option>
                    </select>
                    <input
                        id="searchValue"
                        type="text"
                        placeholder="搜索演员"
                        style={{ padding: "4px 5px" }}
                    />
                    <a
                        id="cleanQueryBtn"
                        className="a-info"
                        style={{ marginLeft: "0" }}
                    >
                        重置
                    </a>
                </div>
            </div>
            <div
                id="table-container"
                style={{ height: "calc(100% - 50px)" }}
            ></div>
        </div>
    );
}
