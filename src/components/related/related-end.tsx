/**
 * RelatedEnd —— 相关清单区全部已加载提示（React 函数组件，JSX）。
 *
 * 为 RelatedPlugin.fetchAndDisplayRelateds 提供：`<div>已加载全部清单</div>`
 * （清单数不足一页时）。由 `footer.html(html)` 消费。结构对称 ReviewEnd
 * （doc/13 已提取），文案为原版"已加载全部清单"。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 fetchAndDisplayRelateds 中
 * `footer.html()` 消费时，需先用 `jsxToString`（来自 ../core/jsx-to-string，
 * 轻量 JSX→HTML 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `footer.html(jsxToString(<RelatedEnd />))`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义。
 */

/**
 * 渲染相关清单区全部已加载提示的 JSX。
 * @returns 已加载全部清单 JSX，经 jsxToString 转 HTML 字符串后供 `.html()` 消费。
 */
export function RelatedEnd() {
    return (
        <div
            style={{
                textAlign: 'center',
                padding: '10px',
                color: '#666',
                marginTop: '10px'
            }}
        >
            已加载全部清单
        </div>
    );
}
