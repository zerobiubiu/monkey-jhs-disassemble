/**
 * PreloadCacheStatsText —— 预加载缓存统计文案（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/setting-plugin.tsx 的 refreshPreloadCacheStats（L985）：
 *   `共 <b>${stats.count}</b> 条（MissAv ${missAv} / SupJav ${supJav}）｜占用
 *   ${formatSize(stats.size)}`
 * 写入 `#preload-cache-stats` 的 html。
 *
 * 保留原文案、全角括号/竖线与 `<b>` 加粗结构原样不动；各计数经 jsxToString
 * 数字/文本输出（与原模板插值一致）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 refreshPreloadCacheStats 中
 * `$('#preload-cache-stats').html(...)` 消费时，需先用 `jsxToString`（来自
 * ../core/jsx-to-string，轻量 JSX→HTML 字符串渲染器，不引入 react-dom/server）
 * 转为 HTML 字符串：
 *   `$('#preload-cache-stats').html(jsxToString(<PreloadCacheStatsText {...} />))`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。
 */

/** PreloadCacheStatsText 的属性。 */
export interface PreloadCacheStatsTextProps {
    /** 缓存总条数（`<b>` 加粗显示）。 */
    count: number;
    /** MissAv 来源条数。 */
    missAv: number;
    /** SupJav 来源条数。 */
    supJav: number;
    /** 占用空间（formatSize 格式化后的字符串，如 "1.2MB"）。 */
    size: string;
}

/**
 * 渲染预加载缓存统计文案的 JSX。
 * @param props.count 缓存总条数
 * @param props.missAv MissAv 条数
 * @param props.supJav SupJav 条数
 * @param props.size 占用空间字符串
 * @returns 统计文案 JSX（含 `<b>` 加粗计数），经 jsxToString 转 HTML 字符串
 *          后供 `.html()` 消费。
 */
export function PreloadCacheStatsText({ count, missAv, supJav, size }: PreloadCacheStatsTextProps) {
    return (
        <>
            共 <b>{count}</b> 条（MissAv {missAv} / SupJav {supJav}）｜占用 {size}
        </>
    );
}
