/**
 * VideoQualityOption —— 预览视频画质下拉选项（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/setting-plugin.ts 的 openSettingDialog（L296-298）循环：
 * VIDEO_QUALITY_LIST 中 canSelect 的项产出 `<option value="...">text</option>`，
 * 由调用方循环拼接为 qualityOptionsHtml 后注入 SettingDialog 的 videoQuality 下拉。
 *
 * 保留原 HTML 结构（`<option value="quality">text</option>`）、属性值原样不动；
 * quality / text 通过 props 注入。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 openSettingDialog 循环消费时，
 * 需先用 `jsxToString` 转为 HTML 字符串后拼接：
 *   `qualityOptionsHtml += jsxToString(<VideoQualityOption quality={...} text={...} />)`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义，与原始模板拼接行为一致。
 */

/** VideoQualityOption 的属性。 */
export interface VideoQualityOptionProps {
    /** 画质值（option value）。 */
    quality: string;
    /** 画质文案（option 文本）。 */
    text: string;
}

/**
 * 渲染单个画质下拉选项的 JSX。
 * @param props.quality 画质值
 * @param props.text 画质文案
 * @returns option JSX，经 jsxToString 转 HTML 字符串后供循环拼接注入 SettingDialog。
 */
export function VideoQualityOption({ quality, text }: VideoQualityOptionProps) {
    return <option value={quality}>{text}</option>;
}
