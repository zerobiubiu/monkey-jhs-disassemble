/**
 * ImageRecognitionHint —— 以图识图公网 URL 缺失提示（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/image-recognition-plugin.tsx 的 renderSiteButtons（原
 * `$container.append('<p style="color:#c00">图片尚未获得公网 URL，请重试搜索</p>')`）：
 * 图片尚无公网 URL（data: base64 上传失败等）时的红色提示。
 *
 * 保留原内联样式/文案原样不动。内联 style 经 jsxToString 的 styleToCss
 * 输出 `color:#c00`，与原文一致。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 renderSiteButtons 中
 * `$container.append()` 消费时，需先用 `jsxToString`（来自
 * ../core/jsx-to-string，轻量 JSX→HTML 字符串渲染器，不引入
 * react-dom/server）转为 HTML 字符串：
 *   `$container.append(jsxToString(<ImageRecognitionHint />))`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。
 */

/**
 * 渲染公网 URL 缺失提示的 JSX。
 * @returns 红色提示 `<p>` JSX，经 jsxToString 转 HTML 字符串后供 `.append()` 消费。
 */
export function ImageRecognitionHint() {
    return <p style={{ color: '#c00' }}>图片尚未获得公网 URL，请重试搜索</p>;
}
