/**
 * SubtitleTableDialog —— 迅雷字幕列表弹窗（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/detail-page-button-plugin.ts 的 searchXunLeiSubtitle
 * （L1230-1234，原 archetype/jhs.user.js L6151 的 layer.open content）：
 * 一个外层 `height:100%;overflow:hidden;` 容器 + 内层
 * `#xunlei-table-container` 占位 div，供 success 回调内
 * `new Tabulator("#xunlei-table-container", {...})` 挂载迅雷字幕表格。
 *
 * 保留原 HTML 结构、id（xunlei-table-container）、内联 style；前导/尾部
 * 空白（原 `\n` + 缩进）由 jsxToString 紧凑输出丢失（DOM 渲染等价，容器
 * 结构仅作 Tabulator 挂载点）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 searchXunLeiSubtitle 中
 * layer.open({ content }) 消费：
 *   `content: jsxToString(<SubtitleTableDialog />)`
 * 表格初始化（Tabulator 实例化、列配置、预览/下载按钮事件绑定、ESC 关闭）
 * 仍由 searchXunLeiSubtitle 的 success 回调持有，组件只负责静态结构。
 * 无动态值，故无 props。
 *
 * 统一规定（doc/20-detail-page-button-components-tsx.md）：HTML→组件转换
 * 返回 JSX，经轻量 `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，
 * 零运行时依赖，不引入 react-dom/server）。
 */

/**
 * 渲染迅雷字幕列表弹窗的 JSX。
 * @returns 字幕表格容器 JSX（外层 overflow 容器 + #xunlei-table-container
 *          占位 div），经 jsxToString 转 HTML 字符串后供 layer.open({ content })
 *          直接消费，Tabulator 在 success 回调内挂载到 #xunlei-table-container。
 */
export function SubtitleTableDialog() {
    return (
        <div style={{ height: "100%", overflow: "hidden" }}>
            <div
                id="xunlei-table-container"
                style={{ height: "100%", paddingBottom: "20px" }}
            />
        </div>
    );
}
