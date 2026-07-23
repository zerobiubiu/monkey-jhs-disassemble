/**
 * QuickBlockConfirmMessage —— 详情页快捷屏蔽确认提示（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/detail-page-button-plugin.tsx 的 quickBlock（L1489）：
 *   `是否拉黑 ${carNum}？<br/><span style='color:#f40'>拉黑后该影片将被屏蔽，
 *   列表页自动隐藏，且设为已读0星。此操作不可在详情页撤销。</span>`
 * 作为 utils.q 确认对话框正文。
 *
 * 保留原文案与标点（含全角问号）、`<br/>` 换行与 `<span style="color:#f40">`
 * 内联色（原单引号 style 值经 style 对象还原为 `color:#f40`，DOM 等价）；
 * carNum 经 jsxToString 文本转义保护（良构番号下输出不变）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 quickBlock 中
 * `utils.q(null, ..., callback)` 消费时，需先用 `jsxToString` 转为 HTML 字符串：
 *   `utils.q(null, jsxToString(<QuickBlockConfirmMessage carNum={...} />), callback)`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。
 */

/** QuickBlockConfirmMessage 的属性。 */
export interface QuickBlockConfirmMessageProps {
    /** 番号（如 "MIDV-700"），插入"是否拉黑 ...？"。 */
    carNum: string;
}

/**
 * 渲染快捷屏蔽确认提示的 JSX。
 * @param props.carNum 番号
 * @returns 确认提示 JSX（含 `<br/>` 与红色警告 `<span>`），经 jsxToString
 *          转 HTML 字符串后供 utils.q 消费。
 */
export function QuickBlockConfirmMessage({ carNum }: QuickBlockConfirmMessageProps) {
    return (
        <>
            是否拉黑 {carNum}？<br />
            <span style={{ color: '#f40' }}>
                拉黑后该影片将被屏蔽，列表页自动隐藏，且设为已读0星。此操作不可在详情页撤销。
            </span>
        </>
    );
}
