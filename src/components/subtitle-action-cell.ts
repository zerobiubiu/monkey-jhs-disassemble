/**
 * SubtitleActionCell —— 迅雷字幕表格"操作"列单元格 HTML 字符串组件。
 *
 * 提取自 src/plugins/detail-page-button-plugin.ts 的 searchXunLeiSubtitle
 * （L1294，原 archetype/jhs.user.js 中 Tabulator 操作列 formatter 返回值）：
 * 渲染预览（a-primary）与下载（a-success）两个按钮，供 onRendered 回调
 * 内按 `.a-primary` / `.a-success` 选择器定位并绑定 click 事件
 * （预览 → previewSubtitle(subUrl, subFilename)，下载 → gmHttp.get +
 *   utils.download）。
 *
 * 保留原 HTML 结构、类名（a-primary / a-success）、文案（预览 / 下载）、
 * `\n` 转义与缩进原样不动，与原模板字符串零偏差。无动态值。
 *
 * 渲染方式：普通函数返回 HTML 字符串，供 searchXunLeiSubtitle 中 Tabulator
 * 操作列 formatter `return SubtitleActionCell()` 消费。事件绑定仍由
 * onRendered 回调持有，组件只负责静态 HTML。
 *
 * 统一规定（doc/06-component-html-string.md）：HTML→组件转换一律返回
 * HTML 字符串，不用 JSX、不用 renderToStaticMarkup。属性值不做转义，
 * 与原始 formatter 返回值行为一致。
 */

/**
 * 渲染迅雷字幕表格"操作"列单元格的 HTML 字符串。
 * @returns 预览 + 下载按钮 HTML，供 Tabulator formatter 返回，
 *          onRendered 回调内按 `.a-primary` / `.a-success` 绑定事件。
 */
export function SubtitleActionCell(): string {
    return '\n                                        <a class="a-primary">预览</a>\n                                        <a class="a-success">下载</a>\n                                    ';
}
