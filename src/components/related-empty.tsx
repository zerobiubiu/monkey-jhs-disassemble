/**
 * RelatedEmpty —— 相关清单区无清单提示（React 函数组件，JSX）。
 *
 * 为 RelatedPlugin.fetchAndDisplayRelateds 提供：`<div>无清单</div>`，
 * 由 `container.append(html)` 消费。结构对称 ReviewEmpty（doc/13 已提取），
 * 文案为原版"无清单"。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 fetchAndDisplayRelateds 中
 * `container.append()` 消费时，需先用 `jsxToString`（来自 ../core/jsx-to-string，
 * 轻量 JSX→HTML 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `container.append(jsxToString(<RelatedEmpty />))`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义。
 */

/**
 * 渲染相关清单区无清单提示的 JSX。
 * @returns 无清单 JSX，经 jsxToString 转 HTML 字符串后供 `.append()` 消费。
 */
export function RelatedEmpty() {
    return (
        <div
            style={{
                marginTop: "15px",
                backgroundColor: "#ffffff",
                padding: "10px",
                marginLeft: "-10px",
            }}
        >
            无清单
        </div>
    );
}
