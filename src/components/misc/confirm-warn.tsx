/**
 * ConfirmWarn —— 确认对话框红色警告行（React 函数组件，JSX，薄门面）。
 *
 * 红色警告 span 复用共享组件 ColoredTextCell（{text, color} 参数化）；
 * 本组件仅在其前追加 `<br /> ` 换行（`<br />` 后的空格为原模板字面文本，
 * 经 jsxToString 逐字保留，输出字节级不变）。
 *
 * 提取自两处确认对话框正文的 `<br/> + 红色 span` 片段：
 *   - src/plugins/want-and-watched-videos-plugin.tsx importWantWatchVideos：
 *     `${confirmMessage} <br/> <span style='color: #f40'>执行此功能前请记得备份数据</span>`
 *   - src/plugins/detail-page-button-plugin.tsx quickBlock 的等价结构
 *     由 QuickBlockConfirmMessage 承载（文案不同，不共用）。
 *
 * 保留 `<br/>` 换行与 `color: #f40` 内联色（原单引号 style 值经 style 对象
 * 还原为 `color:#f40`，DOM 等价）；text 经 jsxToString 文本转义保护。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 utils.q 确认正文拼接消费时，
 * 需先用 `jsxToString`（来自 ../core/jsx-to-string，轻量 JSX→HTML 字符串
 * 渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `` `${confirmMessage} ` + jsxToString(<ConfirmWarn text="..." />) ``
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。
 */

import { ColoredTextCell } from '../shared/colored-text-cell';

/** ConfirmWarn 的属性。 */
export interface ConfirmWarnProps {
    /** 警告文本（红色显示）。 */
    text: string;
}

/**
 * 渲染换行 + 红色警告 span 的 JSX。
 * @param props.text 警告文本
 * @returns `<br /> <span style="color:#f40">text</span>` 的 React 元素，
 *          经 jsxToString 转 HTML 字符串后供确认对话框正文拼接。
 */
export function ConfirmWarn({ text }: ConfirmWarnProps) {
    return (
        <>
            <br /> <ColoredTextCell text={text} color="#f40" />
        </>
    );
}
