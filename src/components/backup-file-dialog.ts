/**
 * BackupFileDialog —— 备份文件列表弹窗 HTML 字符串组件。
 *
 * 提取自 src/plugins/setting-plugin.ts 的 openFileListDialog（L1115，
 * 原 archetype/jhs.user.js L10353 的 layer.open content）：表格容器
 * （table-container，由 Tabulator 渲染）。
 *
 * 保留原 HTML 结构、id（table-container）、内联 style 原样不动；
 * 换行转义与缩进亦原样保留，与原 content 字符串零偏差。
 *
 * 渲染方式：普通函数返回 HTML 字符串，供 layer.open 直接消费：
 * layer.open({ content: BackupFileDialog() })。Tabulator 初始化、
 * 删除/下载/导入操作列仍由 openFileListDialog 的 success 回调持有。
 * 本组件无动态值，故无 props。
 *
 * 统一规定（doc/06-component-html-string.md）：HTML→组件转换一律返回
 * HTML 字符串，不用 JSX、不用 renderToStaticMarkup。
 */

/**
 * 渲染备份文件列表弹窗的 HTML 字符串。
 * @returns 表格容器 HTML（table-container），供 layer.open 消费，
 *          由 Tabulator 渲染表格。
 */
export function BackupFileDialog(): string {
    return `\n                <div style="height: 100%;overflow:hidden;"> \n                    <div id="table-container" style="margin:auto auto !important;"></div>\n                </div>\n            `;
}
