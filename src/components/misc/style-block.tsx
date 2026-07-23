/**
 * StyleBlock —— 内联 `<style>` 标签（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/setting-plugin.tsx 两处 `<style>` 字符串字面量：
 *   - 帮助弹窗 content（L666）：`'<style>' + helpDialogCssRaw + '</style>'`
 *     前缀拼接 HelpDialog 组件输出；
 *   - applyImageMode（L675）：`$('<style>').attr('id', 'verticalImgStyle')
 *     .text(horizontalImgCssRaw).appendTo('head')` 的横图模式样式注入。
 *
 * CSS 文本经 dangerouslySetInnerHTML 原样注入（jsxToString 对
 * dangerouslySetInnerHTML 取 __html 原始输出，不转义），与原 `.text(css)` /
 * 字符串拼接行为一致（CSS 内 `>` 选择器等字符保持原样）。id 为可选
 * （verticalImgStyle 供 `$('#verticalImgStyle').remove()` 去重覆盖）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。消费时先用 `jsxToString`（来自
 * ../core/jsx-to-string，轻量 JSX→HTML 字符串渲染器，不引入 react-dom/server）
 * 转为 HTML 字符串：
 *   - `content: jsxToString(<StyleBlock css={...} />) + jsxToString(<HelpDialog />)`
 *   - `$(jsxToString(<StyleBlock id="verticalImgStyle" css={...} />)).appendTo('head')`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。
 */

import { jsxToString } from '../../core/jsx-to-string';

/** StyleBlock 的属性。 */
export interface StyleBlockProps {
    /** style 标签 id（可选，供选择器定位去重，如 verticalImgStyle）。 */
    id?: string;
    /** CSS 文本（原样注入，不转义）。 */
    css: string;
}

/**
 * 渲染内联 style 标签的 JSX。
 * @param props.id style 标签 id（可省略）
 * @param props.css CSS 文本，经 dangerouslySetInnerHTML 原样注入
 * @returns `<style id="...">css</style>` 的 React 元素，经 jsxToString 转
 *          HTML 字符串后供 layer.open content 拼接或 jQuery 容器消费。
 */
export function StyleBlock({ id, css }: StyleBlockProps) {
    return <style id={id} dangerouslySetInnerHTML={{ __html: css }} />;
}

/**
 * 便捷辅助：将 CSS 文本包裹为 `<style>` 标签的 HTML 字符串。
 *
 * 供无法书写 JSX 的 `.ts` 模块拼接 layer.open content / head 注入使用，
 * 等价于 `jsxToString(<StyleBlock css={css} />)` 或
 * `jsxToString(<StyleBlock id={id} css={css} />)`。
 * @param css CSS 文本（原样注入，不转义）
 * @param id 可选 style 标签 id
 * @returns `<style id="...">css</style>` 的 HTML 字符串
 */
export function styleBlockHtml(css: string, id?: string): string {
    return jsxToString(<StyleBlock id={id} css={css} />);
}
