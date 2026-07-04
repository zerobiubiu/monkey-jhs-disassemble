/**
 * RelatedLoading —— 相关清单区加载中提示（React 函数组件，JSX）。
 *
 * 为 RelatedPlugin.fetchAndDisplayRelateds 提供：`<div id="relatedLoading">获取清单中...</div>`，
 * 由 `container.append(html)` 消费。结构对称 ReviewLoading（doc/13 已提取），
 * DOM ID 沿用原版单数 related 命名，文案为原版"获取清单中..."。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 fetchAndDisplayRelateds 中
 * `container.append()` 消费时，需先用 `jsxToString`（来自 ../core/jsx-to-string，
 * 轻量 JSX→HTML 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `container.append(jsxToString(<RelatedLoading />))`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义。
 */

/**
 * 渲染相关清单区加载中提示的 JSX。
 * @returns relatedLoading JSX，经 jsxToString 转 HTML 字符串后供 `.append()` 消费。
 */
export function RelatedLoading() {
    return (
        <div
            id="relatedLoading"
            style={{
                marginTop: '15px',
                backgroundColor: '#ffffff',
                padding: '10px',
                marginLeft: '-10px'
            }}
        >
            获取清单中...
        </div>
    );
}
