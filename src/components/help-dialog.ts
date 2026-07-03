/**
 * HelpDialog —— 帮助说明弹窗 HTML 字符串组件。
 *
 * 提取自 src/plugins/setting-plugin.ts 的 initSimpleSettingForm（L751，
 * 原 archetype/jhs.user.js L10033 的 layer.open content）：使用说明标题
 * + 四个 details 折叠区块（无法查看预览视频/屏蔽番号/屏蔽演员/多浏览器
 * 登录115），含图文说明与外链。
 *
 * 保留原 HTML 结构、类名（help-container/help-section/help-content）、
 * 内联 style 原样不动；换行转义与缩进亦原样保留。原 content 内的
 * style CSS 已提取为 src/styles/help-dialog.css，由插件 initCss 注入
 * （content 不含 style 标签）。
 *
 * 渲染方式：普通函数返回 HTML 字符串，供 layer.open 直接消费：
 * layer.open({ content: HelpDialog() })。本组件无动态值，故无 props。
 *
 * 统一规定（doc/06-component-html-string.md）：HTML→组件转换一律返回
 * HTML 字符串，不用 JSX、不用 renderToStaticMarkup。
 */

/**
 * 渲染帮助说明弹窗的 HTML 字符串。
 * @returns 帮助说明面板 HTML（标题 + 四个折叠区块），供 layer.open 消费。
 *          CSS 由插件 initCss 注入（src/styles/help-dialog.css）。
 */
export function HelpDialog(): string {
    return `\n\n<div class="help-container">\n    <h1 style="font-size: 22px; margin-bottom: 20px; color: #2c3e50; border-bottom: 1px solid #eee; padding-bottom: 10px;">使用说明</h1>\n    \n    <details class="help-section">\n        <summary>1. 无法查看预览视频，提示分流?</summary>\n        <div class="help-content">\n            <p>JavDB限制日本IP的访问，而预览视频来自DMM，需要日本IP才能访问。</p>\n            <p>这样会导致二者无法同时使用，需要对其一进行代理转发。</p>\n            <p>将 cc3001.dmm.co.jp 及 dmm.co 分流到日本ip。</p>\n            <p><a href="https://youtu.be/wQUK8z_YeU4?t=121" target="_blank">Clash Verge分流规则设置 </a> (如果你是别的代理软件，自行搜索如何分流)</p>\n        </div>\n    </details>\n    \n    <details class="help-section">\n        <summary>2. 如何屏蔽某一系列的番号?</summary>\n        <div class="help-content">\n            <p>方法一：设置中-添加视频标题关键词，如: VENX-</p>\n            <p>方法二：进入详情页，选中标题文字，右键可加入</p>\n            <img src="https://i.imgur.com/lVnhK5A.png" alt="进入详情页，选中标题，进行右键"/>\n        </div>\n    </details>\n\n    <details class="help-section">\n        <summary>3. 屏蔽某演员，如何只屏蔽单体影片?</summary>\n        <div class="help-content">\n            <p>屏蔽演员前，先筛选分类，再点屏蔽</p>\n            <img src="https://imgur.com/Ue7eCAi.png" alt="屏蔽演员前，先筛选分类，再点屏蔽"/>\n        </div>\n    </details>\n    \n    <details class="help-section">\n        <summary>4. 如何多浏览器同时登录115网盘?</summary>\n        <div class="help-content">\n            <p>① 访问115登录页, 选择JHS-扫码面板, 并扫码登录</p>\n            <img src="https://imgur.com/XbaisWD.png" alt=""/>\n        </div>\n        <div class="help-content">\n            <p>② 进入网盘后, 右下角悬浮按钮, 复制Cookie</p>\n            <img src="https://imgur.com/GvzJ2Gy.png" alt=""/>\n        </div>\n        <div class="help-content">\n            <p>③ 打开另一个浏览器(需装JHS脚本), 进入登录页面, 选择JHS-扫码面板, 输入Cookie并回车</p>\n            <img src="https://imgur.com/FX08qdO.png" alt=""/>\n        </div>\n    </details>\n</div>\n`;
}
