/**
 * BlacklistDialog —— 演员黑名单弹窗 HTML 字符串组件。
 *
 * 提取自 src/plugins/blacklist-plugin.ts 的 openBlacklistDialog（L213，
 * 原 archetype/jhs.user.js L7446 的 layer.open content）：
 * 顶部筛选区（dataType 性别下拉 + statusType 检测状态下拉 +
 * urlType 屏蔽类型下拉 + searchValue 搜索框 + cleanQueryBtn 重置链接）+
 * 表格容器（table-container，由 Tabulator 渲染）。
 *
 * 保留原 HTML 结构、id（dataType/statusType/urlType/searchValue/
 * cleanQueryBtn/table-container）、类名（a-info）、内联 style 原样不动；
 * \n 转义与缩进、闭合标签缺漏亦原样保留，与原 content 字符串零偏差。
 * urlType 下拉的可见性通过 props 注入（原 `${isJavdbSite ? "" :
 * "display: none;"}`，对应原 archetype 变量 r），以保持组件为纯模板
 * （不在组件内引用站点常量）。
 *
 * 渲染方式：本组件为普通函数，返回 HTML 字符串（模板拼接）。
 * 供 openBlacklistDialog 中 layer.open({ content }) 直接消费：
 *   `layer.open({ content: BlacklistDialog({ ... }), ... })`
 * 事件绑定（重置/搜索/各下拉变更/外链点击）与 Tabulator 初始化仍由
 * openBlacklistDialog 的 success 回调持有，组件只负责静态结构 + 动态值插值。
 *
 * 统一规定（doc/06-component-html-string.md）：HTML→组件转换一律返回
 * HTML 字符串，不用 JSX、不用 renderToStaticMarkup（避免引入
 * react-dom/server 导致产物膨胀）。本面板含动态值（urlType 可见性），故用 props。
 */

/** BlacklistDialog 的属性。 */
interface BlacklistDialogProps {
    /** 是否显示屏蔽类型下拉（原 isJavdbSite，控制 urlType select 的 display）。 */
    showUrlType: boolean;
}

/**
 * 渲染演员黑名单弹窗的 HTML 字符串。
 * @param props.showUrlType 是否显示屏蔽类型下拉（true 对应 JavDb 站点）。
 * @returns 演员黑名单面板 HTML（筛选区 + 表格容器），供
 *          layer.open({ content }) 直接消费。
 */
export function BlacklistDialog({ showUrlType }: BlacklistDialogProps): string {
    return `\n            <div style="padding: 10px 20px; height: 100%;overflow:hidden;"> \n                 <div style="display: flex;justify-content: space-between;">\n                    <div style="display: flex; gap:5px">\n                    </div>\n                    <div style="display: flex; gap:5px">\n                        <select id="dataType" style="text-align: center;min-width: 150px;">\n                            <option value="" selected>所有</option>\n                            <option value="actor">男演员</option>\n                            <option value="actress">女演员</option>\n                        </select>\n                        <select id="statusType" style="text-align: center;min-width: 150px;">\n                            <option value="" selected>--检测状态--</option>\n                            <option value="normal">正常检测</option>\n                            <option value="stop">停止检测</option>\n                        </select>\n                        <select id="urlType" data-tip="在演员页屏蔽时,是否选择了分类" style="text-align: center;min-width: 150px; ${showUrlType ? "" : "display: none;"}">\n                            <option value="" selected>--屏蔽类型--</option>\n                            <option value="hasT">按所选分类屏蔽</option>\n                            <option value="noT">未筛选分类</option>\n                        </select>\n                        <input id="searchValue" type="text" placeholder="搜索演员" style="padding: 4px 5px;">\n                        <a id="cleanQueryBtn" class="a-info" style="margin-left: 0">重置</a>\n                    </div>\n\n                </div>\n                <div id="table-container" style="height: calc(100% - 50px);"></div>\n            </div>\n        `;
}
