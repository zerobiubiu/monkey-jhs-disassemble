/**
 * SubtitleActionCell —— 迅雷字幕表格"操作"列单元格（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/detail-page-button-plugin.ts 的 searchXunLeiSubtitle
 * （L1294，原 archetype/jhs.user.js 中 Tabulator 操作列 formatter 返回值）：
 * 渲染预览（a-primary）与下载（a-success）两个按钮，供 onRendered 回调
 * 内按 `.a-primary` / `.a-success` 选择器定位并绑定 click 事件
 * （预览 → previewSubtitle(subUrl, subFilename)，下载 → gmHttp.get +
 *   utils.download）。
 *
 * 保留原 HTML 结构、类名（a-primary / a-success）、文案（预览 / 下载）。
 * 原模板中的前导/尾部 `\n` + 缩进由 jsxToString 紧凑输出丢失（Tabulator
 * 单元格内联元素，DOM 渲染等价）；两按钮间原折叠为单个空格的空白以
 * `{" "}` 显式保留，与原 HTML 折叠语义一致。无动态值。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 searchXunLeiSubtitle 中
 * Tabulator 操作列 formatter 消费时，需先用 `jsxToString` 转为 HTML 字符串：
 *   `return jsxToString(<SubtitleActionCell />)`
 * 事件绑定仍由 onRendered 回调持有，组件只负责静态 HTML。
 *
 * 统一规定（doc/20-detail-page-button-components-tsx.md）：HTML→组件转换
 * 返回 JSX，经轻量 `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，
 * 零运行时依赖，不引入 react-dom/server）。属性值不做转义，与原始
 * formatter 返回值行为一致。
 */

/**
 * 渲染迅雷字幕表格"操作"列单元格的 JSX。
 * @returns 预览 + 下载按钮 JSX（Fragment 包裹，两按钮间保留一个空格），
 *          经 jsxToString 转 HTML 字符串后供 Tabulator formatter 返回，
 *          onRendered 回调内按 `.a-primary` / `.a-success` 绑定事件。
 */
export function SubtitleActionCell() {
    return (
        <>
            <a className="a-primary">预览</a>
            {" "}
            <a className="a-success">下载</a>
        </>
    );
}
