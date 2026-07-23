/**
 * BackupActionCell —— WebDav 云备份表格"操作"列单元格（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/setting-plugin.tsx 的云备份列表 Tabulator 操作列 formatter
 * （L1522）：渲染删除（a-danger）/下载（a-primary）/导入（a-success）三个按钮，
 * 供 onRendered 回调内按 `.a-danger` / `.a-primary` / `.a-success` 选择器定位
 * 并绑定 click 事件（删除 → webdavClient.deleteFile，下载 → getFileContent +
 *   utils.download，导入 → 解密 + storageManager.importData）。
 *
 * 保留原类名（a-danger / a-primary / a-success）与文案（删除 / 下载 / 导入）。
 * 原模板中的前导/尾部 `\n` + 缩进由 jsxToString 紧凑输出丢失（Tabulator
 * 单元格内联元素，DOM 渲染等价）；按钮间原折叠为空格的空白以 `{" "}` 显式
 * 保留，与原 HTML 折叠语义一致（同 SubtitleActionCell 先例）。无动态值。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供云备份列表 Tabulator 操作列
 * formatter 消费时，需先用 `jsxToString`（来自 ../core/jsx-to-string，轻量
 * JSX→HTML 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `return jsxToString(<BackupActionCell />)`
 * 事件绑定仍由 onRendered 回调持有，组件只负责静态 HTML。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。
 */

/**
 * 渲染云备份表格"操作"列单元格的 JSX。
 * @returns 删除/下载/导入按钮 JSX（Fragment 包裹，按钮间保留一个空格），
 *          经 jsxToString 转 HTML 字符串后供 Tabulator formatter 返回，
 *          onRendered 回调内按 `.a-danger` / `.a-primary` / `.a-success` 绑定事件。
 */
export function BackupActionCell() {
    return (
        <>
            <a className="a-danger">删除</a> <a className="a-primary">下载</a>{' '}
            <a className="a-success">导入</a>
        </>
    );
}
