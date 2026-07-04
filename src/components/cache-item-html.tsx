/**
 * CacheItemHtml —— 设置弹层缓存项卡片（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/setting-plugin.ts 的 openSettingDialog（L289-292）map 回调：
 * 每个缓存项产出 `<div class="cache-item">` 含标题 + 清理/查看按钮（data-key），
 * 由调用方循环拼接为 cacheItemsHtml 后注入 SettingDialog 的 cache-panel。
 *
 * 保留原 class（cache-item / menu-btn clean-btn / menu-btn view-btn）、data-key、
 * 内联 style、`<span>` 文案原样不动；text / cacheKey / title 通过 props 注入。
 *
 * 注：原 prop 名 `key` 与 React 保留 prop `key` 冲突（JSX transform 会将
 * `key={...}` 提取到 element.key 而非 props），故重命名为 `cacheKey`。
 * 输出的 `data-key` 属性值不变，DOM 等价。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 openSettingDialog 循环消费时，
 * 需先用 `jsxToString` 转为 HTML 字符串后拼接：
 *   `jsxToString(<CacheItemHtml text={...} cacheKey={...} title={...} />)`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义，与原始模板拼接行为一致。
 */

/** CacheItemHtml 的属性。 */
export interface CacheItemHtmlProps {
    /** 缓存项标题（如 "🎥 预览视频缓存"）。 */
    text: string;
    /** localStorage 键（data-key）；原 `key` prop 因与 React 保留 prop 冲突而改名。 */
    cacheKey: string;
    /** 清理按钮 title 提示。 */
    title: string;
}

/**
 * 渲染单个缓存项卡片的 JSX。
 * @param props.text 缓存项标题
 * @param props.cacheKey localStorage 键（渲染为 data-key）
 * @param props.title 清理按钮 title 提示
 * @returns cache-item JSX，经 jsxToString 转 HTML 字符串后供循环拼接注入 SettingDialog。
 */
export function CacheItemHtml({ text, cacheKey, title }: CacheItemHtmlProps) {
    return (
        <div
            className="cache-item"
            style={{
                border: '1px solid #eee',
                borderRadius: '8px',
                padding: '12px'
            }}
        >
            <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>{text}</div>
            <div style={{ display: 'flex', gap: '8px' }}>
                <a
                    className="menu-btn clean-btn"
                    data-key={cacheKey}
                    style={{
                        backgroundColor: '#448cc2',
                        flex: 1,
                        textAlign: 'center'
                    }}
                    title={title}
                >
                    <span>清理</span>
                </a>
                <a
                    className="menu-btn view-btn"
                    data-key={cacheKey}
                    style={{
                        backgroundColor: '#b2bec0',
                        flex: 1,
                        textAlign: 'center'
                    }}
                >
                    <span>查看</span>
                </a>
            </div>
        </div>
    );
}
