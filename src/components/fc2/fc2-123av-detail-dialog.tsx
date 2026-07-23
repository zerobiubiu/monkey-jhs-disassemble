/**
 * Fc2123avDetailDialog —— 123Av FC2 详情弹窗骨架（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/fc2-by-123av-plugin.tsx 的 open123AvFc2Dialog（L236-253
 * 的 dialogHtml 模板）：movie-detail-container 外壳（纯静态结构，无动态值）——
 *   - movie-info-container（search-loading 加载占位，详情由 loadData 回填）
 *   - movie-panel-info 第三方资源提示条
 *   - 工具栏 5 按钮：屏蔽/收藏/已下载/已观看（各自内联底色）+ 磁力搜索（渐变背景）
 *   - #magnets-content 磁力容器（由 MagnetHubPlugin 回填）
 *   - movie-gallery > image-list 剧照容器（由 loadData 回填）
 *
 * 保留原 id/class/内联 style 原样不动。与 Fc2DetailDialog 不同：本弹窗按钮
 * 颜色/文案为模板硬编码字面量（不复用 constants/status 常量），且无
 * reviews/related/data-actress 容器。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 open123AvFc2Dialog 中
 * layer.open({ content }) 消费：
 *   `const dialogHtml = jsxToString(<Fc2123avDetailDialog />)`
 * 事件绑定（屏蔽/收藏/已下载/已观看/磁力搜索）与详情/磁力数据回填仍由
 * open123AvFc2Dialog 的 success 回调及 loadData 持有，组件只负责静态骨架。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString`（src/core/jsx-to-string，仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）渲染为 HTML 字符串。
 */
import type { CSSProperties } from 'react';

/** 弹窗根容器内联样式：15px 内边距。 */
const containerStyle: CSSProperties = { padding: '15px' };

/** 第三方资源提示条内联样式：顶部 15px 间距。 */
const panelInfoStyle: CSSProperties = { marginTop: '15px' };

/** 工具栏按钮组容器内联样式：上下 20px 间距。 */
const toolbarStyle: CSSProperties = { margin: '20px 0' };

/** 剧照容器内联样式：顶部 10px 间距。 */
const galleryStyle: CSSProperties = { marginTop: '10px' };

/** 工具栏按钮公共内联样式：白字 + 6px 12px 内边距。 */
const btnBaseStyle: CSSProperties = { color: '#fff', padding: '6px 12px' };

/** 屏蔽按钮内联样式（底色 #de3333 + 右间距）。 */
const filterBtnStyle: CSSProperties = {
    ...btnBaseStyle,
    backgroundColor: '#de3333',
    marginRight: '6px'
};

/** 收藏按钮内联样式（底色 #25b1dc + 右间距）。 */
const favoriteBtnStyle: CSSProperties = {
    ...btnBaseStyle,
    backgroundColor: '#25b1dc',
    marginRight: '6px'
};

/** 已下载按钮内联样式（底色 #7bc73b + 右间距）。 */
const hasDownBtnStyle: CSSProperties = {
    ...btnBaseStyle,
    backgroundColor: '#7bc73b',
    marginRight: '6px'
};

/** 已观看按钮内联样式（底色 #d7a80c + 右间距）。 */
const hasWatchBtnStyle: CSSProperties = {
    ...btnBaseStyle,
    backgroundColor: '#d7a80c',
    marginRight: '6px'
};

/** 磁力搜索按钮内联样式（橙绿渐变背景）。 */
const magnetSearchBtnStyle: CSSProperties = {
    ...btnBaseStyle,
    background: 'linear-gradient(to right,#f58c01,#54a11d)'
};

/**
 * 渲染 123Av FC2 详情弹窗骨架的 JSX。
 * @returns movie-detail-container JSX，经 jsxToString 转 HTML 字符串后供
 *          layer.open({ content }) 直接消费。
 */
export function Fc2123avDetailDialog() {
    return (
        <div className="movie-detail-container" style={containerStyle}>
            <div className="movie-info-container">
                <div className="search-loading">加载中...</div>
            </div>
            <div className="movie-panel-info" style={panelInfoStyle}>
                <strong>第三方资源: </strong>
            </div>
            <div style={toolbarStyle}>
                <a id="filterBtn" className="jhs-toolbar-menu-btn" style={filterBtnStyle}>
                    🚫 屏蔽
                </a>
                <a id="favoriteBtn" className="jhs-toolbar-menu-btn" style={favoriteBtnStyle}>
                    ⭐ 收藏
                </a>
                <a id="hasDownBtn" className="jhs-toolbar-menu-btn" style={hasDownBtnStyle}>
                    📥️ 已下载
                </a>
                <a id="hasWatchBtn" className="jhs-toolbar-menu-btn" style={hasWatchBtnStyle}>
                    🔍 已观看
                </a>
                <a id="magnetSearchBtn" className="jhs-toolbar-menu-btn" style={magnetSearchBtnStyle}>
                    磁力搜索
                </a>
            </div>
            <div id="magnets-content" className="magnet-links"></div>
            <div className="movie-gallery" style={galleryStyle}>
                <strong>剧照: </strong>
                <div className="image-list"></div>
            </div>
        </div>
    );
}
