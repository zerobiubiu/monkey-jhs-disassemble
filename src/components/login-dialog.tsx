/**
 * LoginDialog —— JavDB 登录弹窗（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/top250-plugin.ts 的 openLoginDialog（L322-323，
 * 原 archetype/jhs.user.js L4666 的 layer.open content）：
 * 用户名 / 密码输入框 + 登录按钮，用于调用 /v1/sessions 移动端接口
 * 换取 app 令牌（jhs_appAuthorization）后刷新进入 Top250 榜单。
 *
 * 保留原 HTML 结构、id（username/password/loginBtn）、内联 style（对象化，
 * 值原样保留）。jsxToString 忽略 on* 事件属性，故原 onfocus/onblur/
 * onmouseover/onmouseout 内联 JS 不迁移（视觉装饰丢失，DOM 结构与
 * id/类名/style 零偏差）。事件绑定（#loginBtn 点击 / 输入校验 / 提交流程）
 * 仍由 openLoginDialog 的 success 回调持有，组件只负责静态结构。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 openLoginDialog 中
 * layer.open({ content }) 消费时，需先用 `jsxToString`（来自
 * ../core/jsx-to-string，轻量 JSX→HTML 字符串渲染器，不引入
 * react-dom/server）转为 HTML 字符串：
 *   `layer.open({ content: jsxToString(<LoginDialog />), ... })`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义。本表单无动态值，故无 props。
 */

/**
 * 渲染 JavDB 登录弹窗的 JSX。
 * @returns 登录表单 JSX（用户名输入框 + 密码输入框 + 登录按钮），
 *          经 jsxToString 转 HTML 字符串后供 layer.open({ content }) 消费。
 */
export function LoginDialog() {
    return (
        <div
            style={{
                padding: "30px",
                fontFamily: "'Helvetica Neue', Arial, sans-serif",
            }}
        >
            <div style={{ marginBottom: "25px" }}>
                <input
                    type="text"
                    id="username"
                    name="username"
                    style={{
                        width: "100%",
                        padding: "12px 15px",
                        border: "1px solid #e0e0e0",
                        borderRadius: "4px",
                        boxSizing: "border-box",
                        transition: "all 0.3s",
                        fontSize: "14px",
                        background: "#f9f9f9",
                        color: "#333",
                    }}
                    placeholder="用户名 | 邮箱"
                />
            </div>

            <div style={{ marginBottom: "15px" }}>
                <input
                    type="password"
                    id="password"
                    name="password"
                    style={{
                        width: "100%",
                        padding: "12px 15px",
                        border: "1px solid #e0e0e0",
                        borderRadius: "4px",
                        boxSizing: "border-box",
                        transition: "all 0.3s",
                        fontSize: "14px",
                        background: "#f9f9f9",
                        color: "#333",
                    }}
                    placeholder="密码"
                />
            </div>

            <button
                id="loginBtn"
                style={{
                    width: "100%",
                    padding: "12px",
                    background: "#4a8bfc",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    fontSize: "15px",
                    cursor: "pointer",
                    transition: "background 0.3s",
                }}
            >
                登录
            </button>
        </div>
    );
}
