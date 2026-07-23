/**
 * DiagnosticsTable —— 插件诊断表格（React 函数组件，JSX）。
 *
 * 提取自 src/core/plugin-diagnostics.ts renderDiagnosticsHtml 的两段模板拼接
 * （逐行 `<tr>` + 外层 `<div>`/`<p>` 汇总/`<table>` 骨架）：外层
 * `<div style="font-size:13px">` + 汇总 `<p>`（共 N 个插件，M 个失败，
 * 总耗时 Xms，由 data 内部统计）+ `<table>`（thead 四列：状态/插件名/结果/
 * 耗时，tbody 遍历 data 逐行渲染）。状态图标内联三元映射
 * （fulfilled→✅ / rejected→❌ / 其他→⏭️）；耗时缺失（null/undefined）
 * 显示 `-`。插件名经 jsxToString 文本转义输出，等价原 escapeHtml 的
 * DOM 保护（良构数据下 DOM 等价）。
 *
 * 内联 style 以 CSSProperties 对象书写（camelCase 键、带单位字符串值），
 * 经 jsxToString 的 styleToCss 输出紧凑 CSS（冒号后无空格、无尾分号），
 * CSS 解析等价。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 layer.open content /
 * 设置面板消费时，需先用 `jsxToString`（来自 ../core/jsx-to-string，轻量
 * JSX→HTML 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `jsxToString(<DiagnosticsTable data={pluginManager.getDiagnostics().handle} />)`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。
 */

/** 诊断表格单行数据（对应 PluginManager.getDiagnostics().handle 元素）。 */
export interface DiagnosticsRow {
    /** 插件名。 */
    name: string;
    /** 执行状态（fulfilled / rejected / skipped 等）。 */
    status: string;
    /** handle() 执行耗时（毫秒），缺失时显示 `-`。 */
    durationMs?: number | null;
}

/** DiagnosticsTable 的属性。 */
export interface DiagnosticsTableProps {
    /** 插件诊断结果数组（PluginManager.getDiagnostics().handle）。 */
    data: DiagnosticsRow[];
}

/**
 * 渲染插件诊断表格的 JSX。
 * @param props.data 插件诊断结果数组
 * @returns 诊断表格 JSX，经 jsxToString 转 HTML 字符串后供
 *          `layer.open content` / 设置面板消费。
 */
export function DiagnosticsTable({ data }: DiagnosticsTableProps) {
    const failed = data.filter((p) => p.status === 'rejected').length;
    const totalMs = data.reduce((sum, p) => sum + (p.durationMs ?? 0), 0);
    return (
        <div style={{ fontSize: '13px' }}>
            <p style={{ margin: '0 0 10px', fontWeight: 'bold' }}>
                共 {data.length} 个插件，{failed} 个失败，总耗时 {totalMs}ms
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}>
                        <th style={{ padding: '6px 8px' }}>状态</th>
                        <th style={{ padding: '6px 8px' }}>插件名</th>
                        <th style={{ padding: '6px 8px' }}>结果</th>
                        <th style={{ padding: '6px 8px' }}>耗时</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((p) => (
                        <tr key={p.name}>
                            <td style={{ padding: '4px 8px' }}>
                                {p.status === 'fulfilled' ? '✅' : p.status === 'rejected' ? '❌' : '⏭️'}
                            </td>
                            <td style={{ padding: '4px 8px' }}>{p.name}</td>
                            <td style={{ padding: '4px 8px' }}>{p.status}</td>
                            <td style={{ padding: '4px 8px', color: '#888' }}>
                                {p.durationMs != null ? `${p.durationMs}ms` : '-'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
