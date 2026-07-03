/**
 * DetailMenuButtons —— 详情页顶部工具按钮组 HTML 字符串组件。
 *
 * 提取自 src/plugins/detail-page-button-plugin.ts 的 createMenuBtn
 * （L147 的 menuHtml 模板，原 archetype/jhs.user.js L5141-5182）：
 * 两行按钮组——
 *   - 左行：屏蔽 / 收藏 / 已观看（三色按钮，颜色与文案由 status 常量驱动）
 *   - 右行：磁力过滤开关 / 字幕(迅雷) / 字幕(SubTitleCat)
 *
 * 保留原 HTML 结构、id（filterBtn / favoriteBtn / hasWatchBtn /
 * enable-magnets-filter / magnets-span / xunLeiSubtitleBtn /
 * search-subtitle-btn）、class（menu-btn）、内联 style（含
 * linear-gradient 渐变背景、width/padding/text-align 等）与模板换行缩进。
 *
 * 动态值仅为六个 status 常量（BLOCK_COLOR/TEXT、FAVORITE_COLOR/TEXT、
 * WATCHED_COLOR/TEXT），通过 props 注入。磁力过滤 span 的初始文案保留
 * 原硬编码「关闭磁力过滤」，运行时由插件按 enableMagnetsFilter 设置
 * 经 `$("#magnets-span").text(...)` 切换，组件不做该动态化。
 *
 * 渲染方式：本组件为普通函数，返回 HTML 字符串（模板拼接）。
 * 供 createMenuBtn 中 `$(".tabs").after(menuHtml)` / `$("#mag-submit-show").before(menuHtml)`
 * 直接消费。
 *
 * 统一规定（doc/06-component-html-string.md）：HTML→组件转换一律返回
 * HTML 字符串，不用 JSX、不用 renderToStaticMarkup。
 */

/** DetailMenuButtons 的属性。 */
export interface DetailMenuButtonsProps {
    /** 屏蔽按钮文案（BLOCK_TEXT）。 */
    filterText: string;
    /** 屏蔽按钮底色（BLOCK_COLOR）。 */
    filterColor: string;
    /** 收藏按钮文案（FAVORITE_TEXT）。 */
    favoriteText: string;
    /** 收藏按钮底色（FAVORITE_COLOR）。 */
    favoriteColor: string;
    /** 已观看按钮文案（WATCHED_TEXT）。 */
    watchedText: string;
    /** 已观看按钮底色（WATCHED_COLOR）。 */
    watchedColor: string;
}

/**
 * 渲染详情页顶部工具按钮组的 HTML 字符串。
 * @param props.filterText  屏蔽按钮文案
 * @param props.filterColor 屏蔽按钮底色
 * @param props.favoriteText  收藏按钮文案
 * @param props.favoriteColor 收藏按钮底色
 * @param props.watchedText  已观看按钮文案
 * @param props.watchedColor 已观看按钮底色
 * @returns 两行按钮组 HTML，供 jQuery `.after()` / `.before()` 消费。
 */
export function DetailMenuButtons({
    filterText,
    filterColor,
    favoriteText,
    favoriteColor,
    watchedText,
    watchedColor,
}: DetailMenuButtonsProps): string {
    return `
            <div style="margin: 10px auto; display: flex; justify-content: space-between; align-items: center; flex-wrap:wrap;gap: 20px;">
                <div style="display: flex; gap: 10px; flex-wrap:wrap;">
                    <a id="filterBtn" class="menu-btn" style="width: 120px; background-color:${filterColor}; color: white; text-align: center; padding: 8px 0;">
                        <span>${filterText}</span>
                    </a>
                    <a id="favoriteBtn" class="menu-btn" style="width: 120px; background-color:${favoriteColor}; color: white; text-align: center; padding: 8px 0;">
                        <span>${favoriteText}</span>
                    </a>
                    <a id="hasWatchBtn" class="menu-btn" style="width: 120px; background-color:${watchedColor}; color: white; text-align: center; padding: 8px 0;">
                        <span>${watchedText}</span>
                    </a>
                </div>

                <div style="display: flex; gap: 10px; flex-wrap:wrap;">
                    <a id="enable-magnets-filter" class="menu-btn" style="width: 140px; background-color: #c2bd4c; color: white; text-align: center; padding: 8px 0;">
                        <span id="magnets-span">关闭磁力过滤</span>
                    </a>
                    <a id="xunLeiSubtitleBtn" class="menu-btn" style="width: 120px; background: linear-gradient(to left, #375f7c, #2196F3); color: white; text-align: center; padding: 8px 0;">
                        <span>字幕 (迅雷)</span>
                    </a>
                    <a id="search-subtitle-btn" class="menu-btn" style="width: 160px; background: linear-gradient(to bottom, #8d5656, rgb(196,159,91)); color: white; text-align: center; padding: 8px 0;">
                        <span>字幕 (SubTitleCat)</span>
                    </a>
                </div>
            </div>
        `;
}
