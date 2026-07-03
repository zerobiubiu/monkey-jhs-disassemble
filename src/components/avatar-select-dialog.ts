/**
 * AvatarSelectDialog —— 头像选择网格弹窗 HTML 字符串组件。
 *
 * 提取自 src/plugins/new-video-plugin.ts 的 searchAvatar（L548-554，
 * 原 archetype/jhs.user.js L11404 的 layer.open content）：标题提示
 * （gfriends-prompt，显示初始头像张数）+ 滚动容器内的头像网格
 * （gfriends-image-list，每项为 gfriends-image-item-wrapper，含可选图片
 * 与尺寸标签 gfriends-size-tag）。
 *
 * 保留原 HTML 结构、id（gfriends-image-list-container/gfriends-prompt/
 * gfriends-image-list/wrapper-${index}）、类名（gfriends-image-item-wrapper/
 * gfriends-selectable-img/gfriends-size-tag）、data-* 属性
 * （data-url/data-wrapper-id/data-size-for）、内联 style 原样不动；
 * \n 转义与缩进、闭合标签缺漏亦原样保留，与原 content 字符串零偏差。
 * 原 content 内的 <style> 块（gfriends-* 选择器样式）已提取为
 * src/styles/avatar-select-dialog.css，由插件 initCss 注入（content 不含
 * style 标签）。头像 URL 列表（原 avatarUrls）通过 props 注入，组件内
 * map 生成 imagesHtml 并在标题提示中插入张数。
 *
 * 渲染方式：本组件为普通函数，返回 HTML 字符串（模板拼接）。
 * 供 searchAvatar 中 layer.open({ content }) 直接消费：
 *   `layer.open({ content: AvatarSelectDialog({ avatarUrls }), ... })`
 * 图片 load/error 处理（尺寸标签回填、错误图片移除、剩余计数、全失效关闭）、
 * 点击选中回填编辑弹窗头像仍由 searchAvatar 的 success 回调持有，
 * 组件只负责静态结构 + 动态头像列表插值。
 *
 * 统一规定（doc/06-component-html-string.md）：HTML→组件转换一律返回
 * HTML 字符串，不用 JSX、不用 renderToStaticMarkup（避免引入
 * react-dom/server 导致产物膨胀）。本弹窗含动态值（头像 URL 列表），故用 props。
 */

/** AvatarSelectDialog 的属性。 */
interface AvatarSelectDialogProps {
    /** 头像 URL 列表（原 avatarUrls，由 loadGfriends 返回）。 */
    avatarUrls: string[];
}

/**
 * 渲染头像选择网格弹窗的 HTML 字符串。
 * @param props.avatarUrls 头像 URL 列表。
 * @returns 头像选择网格弹窗 HTML（标题提示 + 滚动容器 + 头像网格），
 *          供 layer.open({ content }) 直接消费。CSS 由插件 initCss 注入
 *          （src/styles/avatar-select-dialog.css）。
 */
export function AvatarSelectDialog({
    avatarUrls,
}: AvatarSelectDialogProps): string {
    const imagesHtml: string = avatarUrls
        .map(
            (url, index) =>
                `\n        <div id="wrapper-${index}" class="gfriends-image-item-wrapper">\n            <img alt="" src="${url}" data-url="${url}" class="gfriends-selectable-img" data-wrapper-id="wrapper-${index}" >\n            <div class="gfriends-size-tag" data-size-for="wrapper-${index}">...</div> \n        </div>\n    `,
        )
        .join("");
    return `\n        \n        <div id="gfriends-image-list-container">\n            <p id="gfriends-prompt" style="text-align: center; font-size: 15px; margin-bottom: 15px;">\n                点击图片即可选择（初始共 ${avatarUrls.length} 张）\n            </p>\n            <div style="overflow-y: auto; height: calc(100% - 40px);">\n                <div id="gfriends-image-list">\n                    ${imagesHtml}\n                </div>\n            </div>\n        </div>\n    `;
}
