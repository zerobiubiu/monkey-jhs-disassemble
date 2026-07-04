/**
 * BlacklistActionCell —— 黑名单表格"操作"列单元格 React 函数组件（JSX）。
 *
 * 提取自 src/plugins/blacklist-plugin.ts 的 loadTableData（L602，
 * 原 archetype/jhs.user.js L7760 的操作列 formatter 返回值）：
 * 渲染删除按钮 `<a class="a-danger delete-btn">✂️ 删除</a>`，并保留被
 * 注释掉的"提取屏蔽词"按钮（keyword-btn，原脚本注释保留作占位）。
 * 事件绑定（delete-btn click 删除确认 / keyword-btn click 提取屏蔽词
 * 统计）仍由 loadTableData 的 onRendered 回调持有，组件只负责静态 HTML。
 *
 * 保留原 HTML 结构、类名（a-danger delete-btn / a-normal keyword-btn）、
 * emoji（✂️）、`<a>` 内 `<span>` 前后空格原样不动。
 * 原注释 `<!-- ... -->` 转为 JSX 注释语法（jsxToString 输出
 * 中注释不渲染，与原 HTML 注释 DOM 等价——注释内 button 本就不参与
 * DOM 查询，`.keyword-btn` 选择器在两种模式下均返回 null）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 loadTableData 中 Tabulator
 * 操作列 formatter 消费时，需先用 `jsxToString` 转为 HTML 字符串：
 *   `return jsxToString(<BlacklistActionCell />)`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，
 * 经轻量 `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时
 * 依赖，不引入 react-dom/server）。属性值不做转义，与原始 formatter 返回值行为一致。
 */

/**
 * 渲染黑名单表格"操作"列单元格的 JSX。
 * @returns 删除按钮（含被注释的提取屏蔽词按钮占位）JSX，经 jsxToString 转 HTML 字符串后供 Tabulator formatter 返回。
 */
export function BlacklistActionCell() {
    return (
        <>
            {/* <a class="a-normal keyword-btn"> <span>提取屏蔽词</span> </a>*/}
            <a className="a-danger delete-btn">
                {' '}
                <span>✂️ 删除</span>{' '}
            </a>
        </>
    );
}
