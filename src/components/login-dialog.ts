/**
 * LoginDialog —— JavDB 登录弹窗 HTML 字符串组件。
 *
 * 提取自 src/plugins/top250-plugin.ts 的 openLoginDialog（L322-323，
 * 原 archetype/jhs.user.js L4666 的 layer.open content）：
 * 用户名 / 密码输入框 + 登录按钮，用于调用 /v1/sessions 移动端接口
 * 换取 app 令牌（jhs_appAuthorization）后刷新进入 Top250 榜单。
 *
 * 保留原 HTML 结构、id（username/password/loginBtn）、内联 style 与
 * onfocus/onblur/onmouseover/onmouseout 内联 JS 原样不动；前导/尾部
 * 空白（开头换行+16 空格、结尾换行+12 空格）亦原样保留，与原 content
 * 字符串零偏差。
 *
 * 渲染方式：本组件为普通函数，返回 HTML 字符串（模板拼接）。
 * 供 openLoginDialog 中 layer.open({ content }) 直接消费：
 *   `layer.open({ content: LoginDialog(), ... })`
 * 事件绑定（#loginBtn 点击 / 输入校验 / 提交流程）仍由 openLoginDialog
 * 的 success 回调持有，组件只负责静态结构。
 *
 * 统一规定（doc/06-component-html-string.md）：HTML→组件转换一律返回
 * HTML 字符串，不用 JSX、不用 renderToStaticMarkup（避免引入
 * react-dom/server 导致产物膨胀）。本表单无动态值，故无 props。
 */

/**
 * 渲染 JavDB 登录弹窗的 HTML 字符串。
 * @returns 登录表单 HTML（用户名输入框 + 密码输入框 + 登录按钮），
 *          供 layer.open({ content }) 直接消费。
 */
export function LoginDialog(): string {
    return `
                <div style="padding: 30px; font-family: 'Helvetica Neue', Arial, sans-serif;">
                    <div style="margin-bottom: 25px;">
                        <input type="text" id="username" name="username"
                            style="width: 100%; padding: 12px 15px; border: 1px solid #e0e0e0; border-radius: 4px;
                                   box-sizing: border-box; transition: all 0.3s; font-size: 14px;
                                   background: #f9f9f9; color: #333;"
                            placeholder="用户名 | 邮箱"
                            onfocus="this.style.borderColor='#4a8bfc'; this.style.background='#fff'"
                            onblur="this.style.borderColor='#e0e0e0'; this.style.background='#f9f9f9'">
                    </div>

                    <div style="margin-bottom: 15px;">
                        <input type="password" id="password" name="password"
                            style="width: 100%; padding: 12px 15px; border: 1px solid #e0e0e0; border-radius: 4px;
                                   box-sizing: border-box; transition: all 0.3s; font-size: 14px;
                                   background: #f9f9f9; color: #333;"
                            placeholder="密码"
                            onfocus="this.style.borderColor='#4a8bfc'; this.style.background='#fff'"
                            onblur="this.style.borderColor='#e0e0e0'; this.style.background='#f9f9f9'">
                    </div>

                    <button id="loginBtn"
                            style="width: 100%; padding: 12px; background: #4a8bfc; color: white;
                                   border: none; border-radius: 4px; font-size: 15px; cursor: pointer;
                                   transition: background 0.3s;"
                            onmouseover="this.style.background='#3a7be0'"
                            onmouseout="this.style.background='#4a8bfc'">
                        登录
                    </button>
                </div>
            `;
}
