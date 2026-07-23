/**
 * CacheItemHtml —— 缓存管理面板卡片（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/setting-plugin.ts 的 openSettingDialog。每个缓存项产出
 * `<div class="cache-item">` 含标题 + 统计信息（大小/条目数）+ 清理/查看/导出
 * 按钮（data-key），由调用方循环拼接为 cacheItemsHtml 后注入 SettingDialog
 * 的 cache-panel。
 *
 * 保留原 class（cache-item / jhs-setting-menu-btn clean-btn / jhs-setting-menu-btn view-btn）、data-key、
 * 内联 style 原样不动；text / cacheKey / title / size / count 通过 props 注入。
 *
 * 注：原 prop 名 `key` 与 React 保留 prop `key` 冲突（JSX transform 会将
 * `key={...}` 提取到 element.key 而非 props），故重命名为 `cacheKey`。
 * 输出的 `data-key` 属性值不变，DOM 等价。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 openSettingDialog 循环消费时，
 * 需先用 `jsxToString` 转为 HTML 字符串后拼接：
 *   `jsxToString(<CacheItemHtml text={...} cacheKey={...} ... />)`
 */

/** CacheItemHtml 的属性。 */
export interface CacheItemHtmlProps {
    /** 缓存项标题（如 "🎥 预览视频缓存"）。 */
    text: string;
    /** localStorage 键（data-key + data-cache-key）；原 `key` prop 因与 React 保留 prop 冲突而改名。 */
    cacheKey: string;
    /** 清理按钮 title 提示。 */
    title: string;
    /** 已格式化的大小字符串（如 "1.2 KB"）。 */
    size: string;
    /** 已格式化的条目数字符串（如 "42 条"）。 */
    count: string;
}

/**
 * 渲染单个缓存项卡片的 JSX。
 * @returns cache-item JSX，经 jsxToString 转 HTML 字符串后供循环拼接注入 SettingDialog。
 */
export function CacheItemHtml({ text, cacheKey, title, size, count }: CacheItemHtmlProps) {
    return (
        <div
            className="cache-item"
            data-cache-key={cacheKey}
            style={{
                border: '1px solid #eee',
                borderRadius: '8px',
                padding: '12px'
            }}
        >
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{text}</div>
            <div style={{ fontSize: '12px', color: '#999', marginBottom: '8px' }}>
                <span className="cache-size">{size}</span>
                {' · '}
                <span className="cache-count">{count}</span>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
                <a
                    className="jhs-setting-menu-btn clean-btn"
                    data-key={cacheKey}
                    style={{
                        backgroundColor: '#448cc2',
                        flex: 1,
                        textAlign: 'center',
                        fontSize: '13px'
                    }}
                    title={title}
                >
                    <span>清理</span>
                </a>
                <a
                    className="jhs-setting-menu-btn view-btn"
                    data-key={cacheKey}
                    style={{
                        backgroundColor: '#b2bec0',
                        flex: 1,
                        textAlign: 'center',
                        fontSize: '13px'
                    }}
                >
                    <span>查看</span>
                </a>
                <a
                    className="jhs-setting-menu-btn export-btn"
                    data-key={cacheKey}
                    style={{
                        backgroundColor: '#85d0a3',
                        flex: 1,
                        textAlign: 'center',
                        fontSize: '13px'
                    }}
                    title="导出为 JSON 文件"
                >
                    <span>导出</span>
                </a>
            </div>
        </div>
    );
}
