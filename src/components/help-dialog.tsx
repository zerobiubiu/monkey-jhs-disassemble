/**
 * HelpDialog —— 帮助说明弹窗（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/setting-plugin.ts 的 initSimpleSettingForm（L751，
 * 原 archetype/jhs.user.js L10033 的 layer.open content）：使用说明标题
 * + 四个 details 折叠区块（无法查看预览视频/屏蔽番号/屏蔽演员/多浏览器
 * 登录115），含图文说明与外链。
 *
 * 保留原 HTML 结构、类名（help-container/help-section/help-content）、
 * 内联 style 值（h1 的 font-size/margin-bottom/color/border-bottom/padding-bottom
 * 原样写入 CSSProperties）、`<img>` 自闭合、`<a target="_blank">`、`<details>`/`<summary>`
 * 原样不动。原 content 内的 style CSS 已提取为 src/styles/help-dialog.css，由
 * 插件 initCss 注入（content 不含 style 标签）。原模板中的 `\n` 转义与缩进由
 * jsxToString 紧凑输出丢失，对 DOM 构建/CSS 渲染无影响。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 initSimpleSettingForm 中
 * `layer.open({ content })` 消费时，需先用 `jsxToString` 转为 HTML 字符串：
 *   `"<style>" + helpDialogCssRaw + "</style>" + jsxToString(<HelpDialog />)`
 * 本组件无动态值，故无 props。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义，与原始 layer.open content 行为一致。
 */

/**
 * 渲染帮助说明弹窗的 JSX。
 * @returns 帮助说明面板 JSX（标题 + 四个折叠区块），经 jsxToString 转 HTML
 *          字符串后供 layer.open 消费。CSS 由插件 initCss 注入
 *          （src/styles/help-dialog.css）。
 */
export function HelpDialog() {
    return (
        <div className="help-container">
            <h1
                style={{
                    fontSize: '22px',
                    marginBottom: '20px',
                    color: '#2c3e50',
                    borderBottom: '1px solid #eee',
                    paddingBottom: '10px'
                }}
            >
                使用说明
            </h1>

            <details className="help-section">
                <summary>1. 无法查看预览视频，提示分流?</summary>
                <div className="help-content">
                    <p>JavDB限制日本IP的访问，而预览视频来自DMM，需要日本IP才能访问。</p>
                    <p>这样会导致二者无法同时使用，需要对其一进行代理转发。</p>
                    <p>将 cc3001.dmm.co.jp 及 dmm.co 分流到日本ip。</p>
                    <p>
                        <a href="https://youtu.be/wQUK8z_YeU4?t=121" target="_blank">
                            Clash Verge分流规则设置{' '}
                        </a>{' '}
                        (如果你是别的代理软件，自行搜索如何分流)
                    </p>
                </div>
            </details>

            <details className="help-section">
                <summary>2. 如何屏蔽某一系列的番号?</summary>
                <div className="help-content">
                    <p>设置中-屏蔽配置-添加视频标题关键词，如: VENX-</p>
                </div>
            </details>

            <details className="help-section">
                <summary>3. 屏蔽某演员，如何只屏蔽单体影片?</summary>
                <div className="help-content">
                    <p>屏蔽演员前，先筛选分类，再点屏蔽</p>
                    <img
                        src="https://imgur.com/Ue7eCAi.png"
                        alt="屏蔽演员前，先筛选分类，再点屏蔽"
                    />
                </div>
            </details>

            <details className="help-section">
                <summary>4. 如何多浏览器同时登录115网盘?</summary>
                <div className="help-content">
                    <p>① 访问115登录页, 选择JHS-扫码面板, 并扫码登录</p>
                    <img src="https://imgur.com/XbaisWD.png" alt="" />
                </div>
                <div className="help-content">
                    <p>② 进入网盘后, 右下角悬浮按钮, 复制Cookie</p>
                    <img src="https://imgur.com/GvzJ2Gy.png" alt="" />
                </div>
                <div className="help-content">
                    <p>
                        ③ 打开另一个浏览器(需装JHS脚本), 进入登录页面, 选择JHS-扫码面板,
                        输入Cookie并回车
                    </p>
                    <img src="https://imgur.com/FX08qdO.png" alt="" />
                </div>
            </details>
        </div>
    );
}
