/**
 * PreviewVideoContainer —— 详情页预览视频封面入口（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/preview-video-plugin.ts 的 initDmm（L572-574）：原
 * `$(".preview-images").prepend(\`<a class="preview-video-container" data-fancybox="gallery" href="#preview-video"><span>預告片</span><img src="${coverSrc}" ...></a>\`)`，
 * 在预览图区首位插入预告片封面入口。coverSrc 通过 prop 注入。
 *
 * 保留原 class/data-fancybox/href/内联 style/alt 原样不动。`<img>` 自闭合（void element）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 initDmm 中 `.prepend()` 消费时，
 * 需先用 `jsxToString`（来自 ../core/jsx-to-string，轻量 JSX→HTML
 * 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `$(".preview-images").prepend(jsxToString(<PreviewVideoContainer coverSrc={...} />))`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义。
 */

/** PreviewVideoContainer 的属性。 */
export interface PreviewVideoContainerProps {
    /** 封面图 src。 */
    coverSrc: string;
}

/**
 * 渲染预览视频封面入口的 JSX。
 * @returns preview-video-container JSX，经 jsxToString 转 HTML 字符串后供 `.prepend()` 消费。
 */
export function PreviewVideoContainer({ coverSrc }: PreviewVideoContainerProps) {
    return (
        <a className="preview-video-container" data-fancybox="gallery" href="#preview-video">
            <span>預告片</span>
            <img
                src={coverSrc}
                className="video-cover"
                style={{ width: '150px', height: 'auto' }}
                alt=""
            />
        </a>
    );
}
