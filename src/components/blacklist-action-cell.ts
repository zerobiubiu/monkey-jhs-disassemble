/**
 * BlacklistActionCell —— 黑名单表格"操作"列单元格 HTML 字符串组件。
 *
 * 提取自 src/plugins/blacklist-plugin.ts 的 loadTableData（L602，
 * 原 archetype/jhs.user.js L7760 的操作列 formatter 返回值）：
 * 渲染删除按钮 `<a class="a-danger delete-btn">✂️ 删除</a>`，并保留被
 * 注释掉的"提取屏蔽词"按钮（keyword-btn，原脚本注释保留作占位）。
 * 事件绑定（delete-btn click 删除确认 / keyword-btn click 提取屏蔽词
 * 统计）仍由 loadTableData 的 onRendered 回调持有，组件只负责静态 HTML。
 *
 * 保留原 HTML 结构、类名（a-danger delete-btn / a-normal keyword-btn）、
 * 注释片段、emoji（✂️）、`\n` 转义与缩进原样不动，与原模板字符串零偏差。
 *
 * 渲染方式：普通函数返回 HTML 字符串，供 loadTableData 中 Tabulator
 * 操作列 formatter `return BlacklistActionCell()` 消费。
 *
 * 统一规定（doc/06-component-html-string.md）：HTML→组件转换一律返回
 * HTML 字符串，不用 JSX、不用 renderToStaticMarkup。属性值不做转义，
 * 与原始 formatter 返回值行为一致。
 */

/**
 * 渲染黑名单表格"操作"列单元格的 HTML 字符串。
 * @returns 删除按钮（含被注释的提取屏蔽词按钮占位）HTML，供 Tabulator formatter 返回。
 */
export function BlacklistActionCell(): string {
    return '\n                           <!-- <a class="a-normal keyword-btn"> <span>提取屏蔽词</span> </a>-->\n                            <a class="a-danger delete-btn"> <span>✂️ 删除</span> </a>\n                        ';
}
