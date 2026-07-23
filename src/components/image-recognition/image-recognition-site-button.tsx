/**
 * ImageRecognitionSiteButton —— 以图识图搜索站点按钮（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/image-recognition-plugin.tsx 的 renderSiteButtons（原
 * `` $container.append(`<a class="search-img-site-btn" href="${href}" target="_blank"><img src="${site.ico}" alt=""><span>${site.name}</span></a>`) ``
 * 模板字符串）：单个识图站点入口，favicon + 站点名，新窗口打开。
 *
 * 保留原类名/结构/属性原样不动。href/src 经 jsxToString 的 sanitizeUrl
 * 校验（https 协议原样输出）；`&` 等字符经 escapeAttr 转义后 HTML 解析
 * 自动还原，浏览器请求的 URL 与原模板一致；站点名经 escapeText 转义。
 * `<img>` 为 void 标签，jsxToString 输出自闭合 `<img ... />`，与原
 * `<img ...>` DOM 等价。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 renderSiteButtons 中
 * `$container.append()` 消费时，需先用 `jsxToString`（来自
 * ../core/jsx-to-string，轻量 JSX→HTML 字符串渲染器，不引入
 * react-dom/server）转为 HTML 字符串：
 *   `$container.append(jsxToString(<ImageRecognitionSiteButton href={href} icon={site.ico} name={site.name} />))`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。
 */

/** ImageRecognitionSiteButton 的属性。 */
export interface ImageRecognitionSiteButtonProps {
    /** 站点搜索地址（原 site.url 替换 {placeholder} 后的完整 URL）。 */
    href: string;
    /** 站点 favicon 地址（原 site.ico）。 */
    icon: string;
    /** 站点显示名（原 site.name）。 */
    name: string;
}

/**
 * 渲染单个识图站点按钮的 JSX。
 * @param props.href 站点搜索地址
 * @param props.icon 站点 favicon 地址
 * @param props.name 站点显示名
 * @returns 站点按钮 JSX，经 jsxToString 转 HTML 字符串后供 `.append()` 消费。
 */
export function ImageRecognitionSiteButton({ href, icon, name }: ImageRecognitionSiteButtonProps) {
    return (
        <a className="search-img-site-btn" href={href} target="_blank">
            <img src={icon} alt="" />
            <span>{name}</span>
        </a>
    );
}
