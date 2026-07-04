/**
 * RelatedError —— 相关清单区获取失败 + 重试（React 函数组件，JSX）。
 *
 * 为 RelatedPlugin.fetchAndDisplayRelateds 提供：失败提示 + `<a id="retryFetchRelateds">重试</a>`，
 * 由 `container.append(html)` 消费。结构对称 ReviewError（doc/13 已提取），
 * 文案为原版"获取清单失败"，重试按钮 ID 沿用原版 retryFetchRelateds。
 * 重试链接色 #1897ff 与 archetype L10651 一致。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 fetchAndDisplayRelateds 中
 * `container.append()` 消费时，需先用 `jsxToString`（来自 ../core/jsx-to-string，
 * 轻量 JSX→HTML 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `container.append(jsxToString(<RelatedError />))`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义。
 */

/**
 * 渲染相关清单区获取失败 + 重试的 JSX。
 * @returns 失败提示 JSX，经 jsxToString 转 HTML 字符串后供 `.append()` 消费。
 */
export function RelatedError() {
    return (
        <div
            style={{
                marginTop: '15px',
                backgroundColor: '#ffffff',
                padding: '10px',
                marginLeft: '-10px'
            }}
        >
            获取清单失败
            <a
                id="retryFetchRelateds"
                href="javascript:;"
                style={{
                    marginLeft: '10px',
                    color: '#1897ff',
                    textDecoration: 'none'
                }}
            >
                重试
            </a>
        </div>
    );
}
