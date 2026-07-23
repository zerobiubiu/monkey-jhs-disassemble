/**
 * DetailMenuButtons —— 详情页顶部工具按钮组（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/detail-page-button-plugin.ts 的 createMenuBtn
 * （L147 的 menuHtml 模板，原 archetype/jhs.user.js L5141-5182）：
 * 两行按钮组——
 *   - 左行：屏蔽 / 收藏 / 已观看（三色按钮，颜色与文案由 status 常量驱动）
 *   - 右行：磁力过滤开关 / 字幕(迅雷) / 字幕(SubTitleCat) / 磁力搜索（可选）
 *
 * 保留原 HTML 结构、id（filterBtn / favoriteBtn / hasWatchBtn /
 * enable-magnets-filter / magnets-span / xunLeiSubtitleBtn /
 * search-subtitle-btn / magnetSearchBtn）、class（jhs-toolbar-menu-btn）、内联 style（含
 * linear-gradient 渐变背景、width/padding/text-align 等）。原模板中的
 * 换行缩进由 jsxToString 紧凑输出丢失（DOM/CSS 渲染等价，与示范
 * temporary-image-container.tsx 风格一致）。
 *
 * 动态值仅为六个 status 常量（BLOCK_COLOR/TEXT、FAVORITE_COLOR/TEXT、
 * WATCHED_COLOR/TEXT），通过 props 注入。磁力过滤 span 的初始文案保留
 * 原硬编码「关闭磁力过滤」，运行时由插件按 enableMagnetsFilter 设置
 * 经 `$("#magnets-span").text(...)` 切换，组件不做该动态化。磁力搜索
 * 按钮由 showMagnetSearch prop（featureFlags.magnetHubPlugin）控制是否渲染，
 * 点击事件仍由 createMenuBtn 绑定。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 createMenuBtn 中
 * `$(".tabs").after(menuHtml)` 消费：
 *   `const menuHtml = jsxToString(<DetailMenuButtons {...props} />)`
 *
 * 统一规定（doc/20-detail-page-button-components-tsx.md）：HTML→组件转换
 * 返回 JSX，经轻量 `jsxToString`（src/core/jsx-to-string，仅类型依赖
 * react，零运行时依赖，不引入 react-dom/server）渲染为 HTML 字符串。
 * 属性值不做转义，与原 jQuery `.after(htmlString)` 行为一致。
 */
import type { CSSProperties } from 'react';

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
    /** 是否渲染磁力搜索按钮（featureFlags.magnetHubPlugin 控制）。
     *  开启时在右行末尾追加 #magnetSearchBtn，样式与同行 jhs-toolbar-menu-btn 一致。 */
    showMagnetSearch: boolean;
}

/** 外层容器内联样式：flex 两端对齐 + 自动水平边距 + 换行 + 20px 间距。 */
const wrapperStyle: CSSProperties = {
    margin: '10px auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '20px'
};

/** 按钮行容器内联样式：flex + 10px 间距 + 换行。 */
const rowStyle: CSSProperties = {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap'
};

/**
 * 构造状态按钮（屏蔽/收藏/已观看）内联样式。
 * @param width 按钮宽度字面量（如 "120px"）
 * @param backgroundColor 按钮底色（BLOCK_COLOR/FAVORITE_COLOR/WATCHED_COLOR）
 * @returns CSSProperties：width + backgroundColor + 白字 + 居中 + 8px 0 内边距
 */
function statusBtnStyle(width: string, backgroundColor: string): CSSProperties {
    return {
        width,
        backgroundColor,
        color: 'white',
        textAlign: 'center',
        padding: '8px 0'
    };
}

/**
 * 渲染详情页顶部工具按钮组的 JSX。
 * @param props.filterText  屏蔽按钮文案
 * @param props.filterColor 屏蔽按钮底色
 * @param props.favoriteText  收藏按钮文案
 * @param props.favoriteColor 收藏按钮底色
 * @param props.watchedText  已观看按钮文案
 * @param props.watchedColor 已观看按钮底色
 * @returns 两行按钮组 JSX，经 jsxToString 转 HTML 字符串后供 jQuery
 *          `.after()` / `.before()` 消费。
 */
export function DetailMenuButtons({
    filterText,
    filterColor,
    favoriteText,
    favoriteColor,
    watchedText,
    watchedColor,
    showMagnetSearch
}: DetailMenuButtonsProps) {
    return (
        <div style={wrapperStyle}>
            <div className="jhs-menu-status-row" style={rowStyle}>
                <a id="filterBtn" className="jhs-toolbar-menu-btn" style={statusBtnStyle('120px', filterColor)}>
                    <span>{filterText}</span>
                </a>
                <a
                    id="favoriteBtn"
                    className="jhs-toolbar-menu-btn"
                    style={statusBtnStyle('120px', favoriteColor)}
                >
                    <span>{favoriteText}</span>
                </a>
                <a
                    id="hasWatchBtn"
                    className="jhs-toolbar-menu-btn"
                    style={statusBtnStyle('120px', watchedColor)}
                >
                    <span>{watchedText}</span>
                </a>
            </div>

            <div className="jhs-menu-tools-row" style={rowStyle}>
                <a
                    id="enable-magnets-filter"
                    className="jhs-toolbar-menu-btn"
                    style={{
                        width: '140px',
                        backgroundColor: '#c2bd4c',
                        color: 'white',
                        textAlign: 'center',
                        padding: '8px 0'
                    }}
                >
                    <span id="magnets-span">关闭磁力过滤</span>
                </a>
                <a
                    id="xunLeiSubtitleBtn"
                    className="jhs-toolbar-menu-btn"
                    style={{
                        width: '120px',
                        background: 'linear-gradient(to left, #375f7c, #2196F3)',
                        color: 'white',
                        textAlign: 'center',
                        padding: '8px 0'
                    }}
                >
                    <span>字幕 (迅雷)</span>
                </a>
                <a
                    id="search-subtitle-btn"
                    className="jhs-toolbar-menu-btn"
                    style={{
                        width: '160px',
                        background: 'linear-gradient(to bottom, #8d5656, rgb(196,159,91))',
                        color: 'white',
                        textAlign: 'center',
                        padding: '8px 0'
                    }}
                >
                    <span>字幕 (SubTitleCat)</span>
                </a>
                {showMagnetSearch && (
                    <a
                        id="magnetSearchBtn"
                        className="jhs-toolbar-menu-btn"
                        style={{
                            width: '120px',
                            background: 'linear-gradient(to right, rgb(245,140,1), rgb(84,161,29))',
                            color: 'white',
                            textAlign: 'center',
                            padding: '8px 0'
                        }}
                    >
                        <span>磁力搜索</span>
                    </a>
                )}
            </div>
        </div>
    );
}
