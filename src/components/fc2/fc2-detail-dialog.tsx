/**
 * Fc2DetailDialog —— FC2 番号详情弹窗骨架（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/fc2-plugin.ts 的 openFc2Dialog（L98-138 的 dialogHtml
 * 模板）：movie-detail-container 外壳——
 *   - movie-info-container（加载占位，详情由 handleMovieDetail 回填）
 *   - movie-panel-info 第三方资源提示条
 *   - 工具栏 7 按钮：屏蔽/收藏/已下载/已观看（底色与文案由 status 常量驱动）
 *     + 字幕(SubTitleCat) / 字幕(迅雷) / 磁力搜索（渐变背景）
 *   - message video-panel 磁力容器（#magnets-content，由 handleMagnets 回填）
 *   - #reviews-content / #related-content 空容器（由 ReviewPlugin / RelatedPlugin 回填）
 *   - #data-actress 隐藏数据 span（saveCar 时读取演员名）
 *
 * 保留原 id/class/内联 style 原样不动。原模板中注释掉的 movie-poster-container
 * iframe 与 right-box 包裹层转为 JSX 注释（jsxToString 输出中注释不渲染，与原
 * HTML 注释 DOM 等价——注释内容本就不参与 DOM 查询与渲染）。原模板中的换行
 * 缩进由 jsxToString 紧凑输出丢失，对 DOM 构建/CSS 渲染无影响。
 *
 * 动态值仅为八个 status 常量（BLOCK_COLOR/TEXT、FAVORITE_COLOR/TEXT、
 * HAS_DOWN_COLOR/TEXT、WATCHED_COLOR/TEXT），与插件同源，直接从
 * ../constants/status 导入（插件亦从该模块导入，无重复定义）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 openFc2Dialog 中
 * layer.open({ content }) 消费：
 *   `const dialogHtml = jsxToString(<Fc2DetailDialog />)`
 * 事件绑定（收藏/屏蔽/已下载/已观看/字幕/磁力搜索）与详情/磁力/评论/相关
 * 数据回填仍由 openFc2Dialog 的 success 回调及 loadData 持有，组件只负责静态骨架。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString`（src/core/jsx-to-string，仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）渲染为 HTML 字符串。style 对象经 styleToCss 还原为 CSS
 * 声明（冒号后无空格、无尾分号，与原模板 CSS 等价），与原 layer.open content
 * 行为一致。
 */
import type { CSSProperties } from 'react';

import {
    BLOCK_COLOR,
    BLOCK_TEXT,
    FAVORITE_COLOR,
    FAVORITE_TEXT,
    HAS_DOWN_COLOR,
    HAS_DOWN_TEXT,
    WATCHED_COLOR,
    WATCHED_TEXT
} from '../../constants/status';

/** 第三方资源提示条内联样式：顶部 20px 间距。 */
const panelInfoStyle: CSSProperties = { marginTop: '20px' };

/** 工具栏按钮组容器内联样式：上下 30px 间距。 */
const toolbarStyle: CSSProperties = { margin: '30px 0' };

/** 磁力面板内联样式：顶部 20px 间距。 */
const videoPanelStyle: CSSProperties = { marginTop: '20px' };

/** 磁力列表容器内联样式：水平 0.75rem 内边距。 */
const magnetsStyle: CSSProperties = { margin: '0 0.75rem' };

/** 隐藏数据 span 内联样式。 */
const hiddenStyle: CSSProperties = { display: 'none' };

/**
 * 渲染 FC2 详情弹窗骨架的 JSX。
 * @returns movie-detail-container JSX，经 jsxToString 转 HTML 字符串后供
 *          layer.open({ content }) 直接消费。CSS 由插件 initCss 注入
 *          （src/styles/fc2-plugin.css）。
 */
export function Fc2DetailDialog() {
    return (
        <div className="movie-detail-container">
            {/* 原模板注释掉的 movie-poster-container iframe 与 right-box 包裹层（不参与 DOM） */}
            <div className="movie-info-container">
                <div className="search-loading">加载中...</div>
            </div>

            <div className="movie-panel-info fc2-movie-panel-info" style={panelInfoStyle}>
                <strong>第三方资源: </strong>
            </div>

            <div style={toolbarStyle}>
                <a
                    id="filterBtn"
                    className="jhs-toolbar-menu-btn"
                    style={{ backgroundColor: BLOCK_COLOR }}
                >
                    <span>{BLOCK_TEXT}</span>
                </a>
                <a
                    id="favoriteBtn"
                    className="jhs-toolbar-menu-btn"
                    style={{ backgroundColor: FAVORITE_COLOR }}
                >
                    <span>{FAVORITE_TEXT}</span>
                </a>
                <a
                    id="hasDownBtn"
                    className="jhs-toolbar-menu-btn"
                    style={{ backgroundColor: HAS_DOWN_COLOR }}
                >
                    <span>{HAS_DOWN_TEXT}</span>
                </a>
                <a
                    id="hasWatchBtn"
                    className="jhs-toolbar-menu-btn"
                    style={{ backgroundColor: WATCHED_COLOR }}
                >
                    <span>{WATCHED_TEXT}</span>
                </a>

                <a
                    id="search-subtitle-btn"
                    className="jhs-toolbar-menu-btn fr-btn"
                    style={{ background: 'linear-gradient(to bottom, #8d5656, rgb(196,159,91))' }}
                >
                    <span>字幕 (SubTitleCat)</span>
                </a>
                <a
                    id="xunLeiSubtitleBtn"
                    className="jhs-toolbar-menu-btn fr-btn"
                    style={{ background: 'linear-gradient(to left, #375f7c, #2196F3)' }}
                >
                    <span>字幕 (迅雷)</span>
                </a>
                <a
                    id="magnetSearchBtn"
                    className="jhs-toolbar-menu-btn fr-btn"
                    style={{
                        width: '120px',
                        background:
                            'linear-gradient(to right, rgb(245,140,1), rgb(84,161,29))',
                        color: 'white',
                        textAlign: 'center',
                        padding: '8px 0'
                    }}
                >
                    <span>磁力搜索</span>
                </a>
            </div>
            <div className="message video-panel" style={videoPanelStyle}>
                <div id="magnets-content" className="magnet-links" style={magnetsStyle}>
                    <div className="search-loading">加载中...</div>
                </div>
            </div>
            <div id="reviews-content"></div>
            <div id="related-content"></div>
            <span id="data-actress" style={hiddenStyle}></span>
        </div>
    );
}
