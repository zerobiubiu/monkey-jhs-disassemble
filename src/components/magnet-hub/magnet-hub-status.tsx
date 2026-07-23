/**
 * MagnetHubStatus —— 磁链聚合加载/错误状态提示（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/magnet-hub-plugin.tsx 的 searchEngine / displayResults
 * 中 5 处状态模板字符串：
 * - 加载中：`<div class="magnet-loading">正在从 ${engine.name} 搜索 "${keyword}"...</div>`
 * - 解析失败：`<div class="magnet-error">解析 ${engine.name} 结果失败: ${e.message}</div>`
 * - 获取失败：`<div class="magnet-error">从 ${engine.name} 获取数据失败: ${error.statusText || '网络错误'}</div>`
 * - 获取超时：`<div class="magnet-error">从 ${engine.name} 获取数据超时</div>`
 * - 无结果：`<div class="magnet-error">没有找到相关结果</div>`
 *
 * 保留原类名/文案原样不动。文本经 escapeText 转义 `&<>`——原模板直插
 * 未转义（引擎名/关键词/错误信息含特殊字符时会产生畸形 HTML），组件化
 * 后为合法转义输出，DOM 文本与原意一致且更安全。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 searchEngine /
 * displayResults 中 `$container.html()` / `.append()` 消费时，需先用
 * `jsxToString`（来自 ../core/jsx-to-string，轻量 JSX→HTML 字符串渲染器，
 * 不引入 react-dom/server）转为 HTML 字符串：
 *   `$container.html(jsxToString(<MagnetHubLoading engineName={engine.name} keyword={keyword} />))`
 *   `$container.html(jsxToString(<MagnetHubError message={`解析 ${engine.name} 结果失败: ${e.message}`} />))`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。
 */

/** MagnetHubLoading 的属性。 */
export interface MagnetHubLoadingProps {
    /** 引擎显示名（原 engine.name）。 */
    engineName: string;
    /** 搜索关键词（原 keyword）。 */
    keyword: string;
}

/** MagnetHubError 的属性。 */
export interface MagnetHubErrorProps {
    /** 完整错误文案（调用方按原模板拼装，如「解析 U9A9 结果失败: xxx」）。 */
    message: string;
}

/**
 * 渲染加载中提示的 JSX。
 * @param props.engineName 引擎显示名
 * @param props.keyword 搜索关键词
 * @returns `.magnet-loading` JSX，经 jsxToString 转 HTML 字符串后供 `.html()` 消费。
 */
export function MagnetHubLoading({ engineName, keyword }: MagnetHubLoadingProps) {
    return (
        <div className="magnet-loading">
            正在从 {engineName} 搜索 "{keyword}"...
        </div>
    );
}

/**
 * 渲染错误提示的 JSX。
 * @param props.message 完整错误文案
 * @returns `.magnet-error` JSX，经 jsxToString 转 HTML 字符串后供 `.html()` / `.append()` 消费。
 */
export function MagnetHubError({ message }: MagnetHubErrorProps) {
    return <div className="magnet-error">{message}</div>;
}
