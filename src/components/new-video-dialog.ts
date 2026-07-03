/**
 * NewVideoDialog —— 新作品检测面板 HTML 字符串组件。
 *
 * 提取自 src/plugins/new-video-plugin.ts 的 openDialog（L128-143，
 * 原 archetype/jhs.user.js L11064 的 layer.open content）：顶部工具栏
 * （新作品计数 span + paramActressType 类型下拉 + reLoad 刷新按钮，按钮
 * 内嵌刷新 SVG 图标）+ 女优卡片网格容器（actress-card-container）+
 * 分页容器（actress-pagination），整体 flex 纵向布局。
 *
 * 保留原 HTML 结构、id（checkNewVideoMsg/paramActressType/reLoad/
 * actress-card-container/actress-pagination）、类名（newVideoToolBox/
 * a-normal/jhs-scrollbar）、内联 style 原样不动；\n 转义与缩进、空 select
 * 与 a 标签间的空白行亦原样保留，与原 content 字符串零偏差。刷新按钮内
 * 嵌的 SVG 图标（原 this.refreshSvg，BasePlugin 实例属性）通过 props
 * 注入，以保持组件为纯模板（不在组件内重建 SVG 常量）。
 *
 * 渲染方式：本组件为普通函数，返回 HTML 字符串（模板拼接）。
 * 供 openDialog 中 layer.open({ content }) 直接消费：
 *   `layer.open({ content: NewVideoDialog({ refreshSvg: this.refreshSvg }), ... })`
 * 数据加载（loadData）、按钮/筛选绑定（bindClick）、ESC 关闭仍由 openDialog
 * 的 success 回调持有，组件只负责静态结构 + 动态 SVG 插值。
 *
 * 统一规定（doc/06-component-html-string.md）：HTML→组件转换一律返回
 * HTML 字符串，不用 JSX、不用 renderToStaticMarkup（避免引入
 * react-dom/server 导致产物膨胀）。本面板含动态值（刷新 SVG），故用 props。
 */

/** NewVideoDialog 的属性。 */
interface NewVideoDialogProps {
    /** 刷新按钮内嵌的 SVG 图标字符串（原 this.refreshSvg，BasePlugin 实例属性）。 */
    refreshSvg: string;
}

/**
 * 渲染新作品检测面板的 HTML 字符串。
 * @param props.refreshSvg 刷新按钮内嵌的 SVG 图标字符串。
 * @returns 新作品检测面板 HTML（工具栏 + 卡片容器 + 分页容器），
 *          供 layer.open({ content }) 直接消费。
 */
export function NewVideoDialog({ refreshSvg }: NewVideoDialogProps): string {
    return `\n            <div class="newVideoToolBox" style="display: flex; flex-direction: column; height: 100%; overflow: hidden; padding:10px">\n                <div style="margin-bottom: 15px;display: flex; justify-content: space-between;">\n                    <div>\n                        <span id="checkNewVideoMsg"></span>\n                    </div>\n                    <div style="display: flex; align-items: flex-start;">\n                        <select id="paramActressType" style="text-align: center; height: 100%; min-width: 150px; border: 1px solid #ddd; margin-right: 10px">\n                            <option value="all" selected>所有</option>\n                            <option value="uncensored">无码</option>\n                            <option value="censored">有码</option>\n                            <option value="">未知</option>\n                        </select>\n                        \n                        <a class="a-normal" id="reLoad">${refreshSvg} &nbsp;&nbsp; 刷新</a>\n                    </div>\n\n                </div>\n                <div id="actress-card-container" class="jhs-scrollbar"></div>\n                <div id="actress-pagination"></div>\n            </div>\n        `;
}
