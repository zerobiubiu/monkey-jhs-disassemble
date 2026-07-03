/**
 * PreviewVideoQualityBtn —— 预览视频画质切换按钮（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/preview-video-plugin.ts 的 handleVideo（L644-646）：原
 * `$(\`<button class="video-control-btn...">` + .css 链式创建，含 id/data-quality/
 * data-video-src/内联 style（active 态蓝底白字），由 `$qualityGroup.append($btn)`
 * 消费。opt / src / isActive 通过 prop 注入。
 *
 * 保留原 class（video-control-btn + active）/id/data-* /内联 style 原样不动。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 handleVideo 中 `$(html)` 创建后
 * `.append()` 消费时，需先用 `jsxToString`（来自 ../core/jsx-to-string，轻量
 * JSX→HTML 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `$(jsxToString(<PreviewVideoQualityBtn opt={...} src={...} isActive={...} />))`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义。
 */

/** PreviewVideoQualityBtn 的属性（opt 为画质选项常量，字段为 any）。 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface PreviewVideoQualityBtnProps {
    /** 画质选项（含 id/quality/text 字段）。 */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    opt: any;
    /** 该画质对应的视频源 URL。 */
    src: string;
    /** 是否当前选中（active 态蓝底白字）。 */
    isActive: boolean;
}

/**
 * 渲染画质切换按钮的 JSX。
 * @returns video-control-btn JSX，经 jsxToString 转 HTML 字符串后供 `$(html)` 创建后 `.append()` 消费。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function PreviewVideoQualityBtn({
    opt,
    src,
    isActive,
}: PreviewVideoQualityBtnProps) {
    return (
        <button
            className={`video-control-btn${isActive ? " active" : ""}`}
            id={opt.id}
            data-quality={opt.quality}
            data-video-src={src}
            style={{
                minWidth: "40px",
                border: "1px solid #ccc",
                backgroundColor: isActive ? "#007bff" : "#fff",
                color: isActive ? "white" : "black",
            }}
        >
            {opt.text}
        </button>
    );
}
