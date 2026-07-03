/**
 * SubtitleTableDialog —— 迅雷字幕列表弹窗 HTML 字符串组件。
 *
 * 提取自 src/plugins/detail-page-button-plugin.ts 的 searchXunLeiSubtitle
 * （L1230-1234，原 archetype/jhs.user.js L6151 的 layer.open content）：
 * 一个外层 `height:100%;overflow:hidden;` 容器 + 内层
 * `#xunlei-table-container` 占位 div，供 success 回调内
 * `new Tabulator("#xunlei-table-container", {...})` 挂载迅雷字幕表格。
 *
 * 保留原 HTML 结构、id（xunlei-table-container）、内联 style 原样不动；
 * 前导/尾部空白（开头换行+20 空格、结尾换行+16 空格，及首行 `<div>` 后
 * 的一个尾随空格）亦原样保留，与原 content 字符串零偏差（原字符串以
 * 单引号 + `\n` 转义书写，本组件改为模板字符串 + 字面换行/空格，求值
 * 结果一致）。
 *
 * 渲染方式：本组件为普通函数，返回 HTML 字符串（模板拼接）。
 * 供 searchXunLeiSubtitle 中 layer.open({ content }) 直接消费：
 *   `layer.open({ content: SubtitleTableDialog(), ... })`
 * 表格初始化（Tabulator 实例化、列配置、预览/下载按钮事件绑定、ESC 关闭）
 * 仍由 searchXunLeiSubtitle 的 success 回调持有，组件只负责静态结构。
 *
 * 统一规定（doc/06-component-html-string.md）：HTML→组件转换一律返回
 * HTML 字符串，不用 JSX、不用 renderToStaticMarkup（避免引入
 * react-dom/server 导致产物膨胀）。本容器无动态值，故无 props。
 */

/**
 * 渲染迅雷字幕列表弹窗的 HTML 字符串。
 * @returns 字幕表格容器 HTML（外层 overflow 容器 + #xunlei-table-container
 *          占位 div），供 layer.open({ content }) 直接消费，Tabulator 在
 *          success 回调内挂载到 #xunlei-table-container。
 */
export function SubtitleTableDialog(): string {
    return `
                    <div style="height: 100%;overflow:hidden;">
                        <div id="xunlei-table-container" style="height: 100%;padding-bottom: 20px"></div>
                    </div>
                `;
}
