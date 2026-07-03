/**
 * BackupFileDialog —— 备份文件列表弹窗（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/setting-plugin.ts 的 openFileListDialog（L1115，
 * 原 archetype/jhs.user.js L10353 的 layer.open content）：表格容器
 * （table-container，由 Tabulator 渲染）。
 *
 * 保留原 HTML 结构、id（table-container）、内联 style 值（`height:100%;
 * overflow:hidden` 外层、`margin:auto auto !important` 内层）原样不动。
 * 原模板中的 `\n` 转义与缩进由 jsxToString 紧凑输出丢失，对 DOM 构建/CSS
 * 渲染无影响（与示范风格一致）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 openFileListDialog 中
 * `layer.open({ content })` 消费时，需先用 `jsxToString` 转为 HTML 字符串：
 *   `layer.open({ content: jsxToString(<BackupFileDialog />), ... })`
 * Tabulator 初始化、删除/下载/导入操作列仍由 openFileListDialog 的 success
 * 回调持有。本组件无动态值，故无 props。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义，与原始 layer.open content 行为一致。
 */

/**
 * 渲染备份文件列表弹窗的 JSX。
 * @returns 表格容器 JSX（table-container），经 jsxToString 转 HTML 字符串后供
 *          layer.open 消费，由 Tabulator 渲染表格。
 */
export function BackupFileDialog() {
    return (
        <div style={{ height: "100%", overflow: "hidden" }}>
            <div
                id="table-container"
                style={{ margin: "auto auto !important" }}
            />
        </div>
    );
}
