# monkey-jhs-disassemble 文档

本项目将单文件混淆用户脚本 `archetype/jhs.user.js`（11605 行）拆分重构为
基于 `vite-plugin-monkey` + React + TypeScript + SWC 的工程化项目，
要求打包产物在功能逻辑与执行效果上与原始脚本零偏差。

## 文档清单

| 文件 | 类型 | 状态 | 说明 |
|------|------|------|------|
| `01-refactor-plan.md` | 🔧开发指导 | 🔧待执行 | 重构总计划：架构分析、渐进策略、提取模式、进度追踪（core/插件/CSS/常量/资源已完成，legacy 废弃、启动序列移 `main.tsx`、全量去 `@ts-nocheck` 完成，余 HTML→React 组件化） |
| `02-css-extraction.md` | 🔧开发指导 | 🔧待执行 | CSS 提取模式（`?raw` + `H()`/`insertAdjacentHTML` + 占位 `replace`）；顶层 5 + 插件 `initCss` 9 共 14 个 CSS 提取模式与清单 |
| `03-plugin-integration.md` | 🔧开发指导 | ✅已执行 | 首批 4 插件（DetailPage/FilterTitleKeyword/HighlightMagnet/FoldCategory）外置集成记录 |
| `04-plugin-integration-final-batch.md` | 🔧开发指导 | ✅已执行 | 最终批次 3 插件（Setting/DetailPageButton/ListPage）外置集成记录 |
| `05-legacy-helpers-extraction.md` | 🔧开发指导 | ✅已执行 | legacy 残留辅助（layer 包装/tooltip/webdav 加密）提取到 core |
| `06-component-html-string.md` | 🔧开发指导 | ✅已执行 | 组件返回 HTML 字符串，移除 react-dom/server（避免 react-dom/server 打包致 911 kB 膨胀）；确立 HTML→组件统一规定 |
| `07-login-dialog-component.md` | 🔧开发指导 | ✅已执行 | Top250 登录表单（openLoginDialog 的 layer.open content）提取为 LoginDialog 组件（返回 HTML 字符串） |
| `08-subtitle-dialogs-component.md` | 🔧开发指导 | ✅已执行 | DetailPageButton 字幕弹窗（searchXunLeiSubtitle 表格容器 / previewSubtitle 预览容器）提取为 SubtitleTableDialog / SubtitlePreviewDialog 组件（返回 HTML 字符串） |
| `09-history-dialogs-component.md` | 🔧开发指导 | ✅已执行 | HistoryPlugin 鉴定记录弹窗（openHistory 筛选/批量/表格容器 / editRecord 编辑表单）提取为 HistoryDialog / EditRecordDialog 组件（返回 HTML 字符串） |
| `10-new-video-dialogs-component.md` | 🔧开发指导 | ✅已执行 | NewVideoPlugin 四处弹窗（openDialog 新作品面板 / editActress 编辑表单 / CDN 源选择 / searchAvatar 头像网格）提取为 NewVideoDialog / EditActressDialog / CdnSelectDialog / AvatarSelectDialog 组件 + avatar-select-dialog.css（返回 HTML 字符串） |
| `11-list-page-components.md` | 🔧开发指导 | ✅已执行 | list-page-button/list-page HTML 转组件：createMenuBtn 两套菜单按钮 / fixBusTitleBox wrap / renderItemStatusTag+filterMovieList status-tag（render/filter 双变体）/ addJumpPageControl 跳页控件 / filterMovieList countTable 统计表格，提取为 MenuButtonBoxHtml / StatusTagHtml / VideoTitleSpan / JumpPageControl / PageCountTable 5 个组件（返回 HTML 字符串） |
| `12-blacklist-remaining-components.md` | 🔧开发指导 | ✅已执行 | blacklist-plugin 剩余零散 HTML 转组件：addBlacklist confirmMessage / getTableData dataType 下拉 options / loadTableData 4 个 Tabulator formatter 单元格（演员/屏蔽类型/状态/操作）+ paginationCounter / filterActorVideo movie-list 包装，提取为 BlacklistConfirmMessage / BlacklistDataTypeOptions / BlacklistNameCell / BlacklistUrlTypeCell / BlacklistStatusCell / BlacklistActionCell / MovieListWrapper / BlacklistPaginationCounter 8 个组件（返回 HTML 字符串） |
| `13-remaining-html-components.md` | 🔧开发指导 | ✅已执行 | 全面扫描 src/ 剩余注入用 HTML 字符串并转组件：hit-show（ToolBar/MovieItem/Score/RankingContainers）/ top250（ToolBar/YearButton/Pagination/NavLink/ErrorMessage）/ nav-bar（SearchBox/OtherDropdown）/ new-video（ActressCard/Pagination/DialogTitle）/ other-site（Box/Btn/Checkbox/SiteResultTag）/ preview-video（QualityBtn/ActionBtn/Container/SiteResultTag）/ review（Header/Containers/Loading/Error/Empty/LoadMore/End/Item/LinkContent）/ setting（MountBox/BackToTopButton/KeywordLabel/SimpleSettingPanel/CacheItemHtml/VideoQualityOption）/ history（SourceCell/StatusCell）/ want-watched（ImportButton/HintSpan）/ core（LoggerLogEntry/ImagePreviewImg/ImagePreviewError）26 个组件 + image-preview/tooltip/back-to-top/setting-image-mode-vertical/horizontal 5 个 CSS 提取（?raw） |
| `14-css-charlevel-fix.md` | 🔧开发指导 | ✅已执行 | CSS 与原版字符级对齐修复：24 个 `.css`（主 7 + 插件 initCss 9 + 弹窗 2 + 非 initCss 6）逐字符重写为原版运行时注入值（LF、保留 `<style>` 包裹/首尾空白/行尾空格/中文注释，占位 `replace` 位置对齐 `${...}`）；NewVideo/Setting `initCss` 移除弹窗 CSS 拼接（修复 avatar/help CSS 因 `insertStyle` 不再包裹而失效的 bug），改由 `layer.open content` 拼接复刻原版 `r`/帮助 content；tooltip/image-preview 改为直接注入含 `<style>` 的 `.css` |
| `15-related-plugin-archetype-calibration.md` | 🔧开发指导 | ✅已执行 | RelatedPlugin 对照 archetype L10585-10708（commit 66b2fdf）校准：头部去 📁 emoji、折叠/重试链接色 #1890ff→#1897ff、条目补创建时间/名称链接/段落内联 style（color:#2e8abb 等）、enableLoadRelated 默认改 NO（与 archetype 折叠一致）；DOM ID/其余文案/字段已一致无需改 |
| `16-jsx-to-string.md` | 🔧开发指导 | ✅已执行 | 轻量 jsxToString 替代 react-dom/server：新增 `src/core/jsx-to-string.ts`（函数组件/DOM 元素/Fragment/自闭合/属性映射 className→class/style camelToKebab/布尔属性/事件忽略/文本转义），`temporary-image-container.tsx` 反转 doc/06 改回 JSX，`main.tsx` 移除 react-dom/server import 改用 jsxToString；产物 485.12 kB（gzip 119.73 kB），较 481.35 kB 基线 +3.77 kB，远低于 +452 kB 膨胀 |
| `17-list-page-components-tsx.md` | 🔧开发指导 | ✅已执行 | 列表页/折叠分类 8 个 HTML 字符串组件转 TSX 原生 React 组件（`status-tag-html`/`menu-button-box-html`/`video-title-span`/`jump-page-control`/`page-count-table`/`fold-category-toolbar`/`fold-category-section-button`/`highlight-button`），合并删除 `status-tag.tsx`/`menu-button-box.tsx` 两个孤立示范；3 个调用点插件 `.ts`→`.tsx`，调用改 `jsxToString(<Comp {...props} />)`；DOM/CSS 渲染等价（属性间/子节点 \n 缩进紧凑化，status-tag variant 语义失效但 DOM 等价）；产物 488.25 kB（gzip 120.28 kB） |

## 类型图例

- 📋 接口契约：前后端对接的 API 规格
- 🔧 开发指导：待执行/已执行的技术修改方案
- 📄 参考说明：调试记录、设计规格、备忘信息
- 🚀 部署运维：部署步骤、环境配置、密钥管理

## 状态图例

- ✅ 已执行：历史定稿，永不可改
- 🔧 待执行：尚未实施或进行中
- 📄 参考：仅供参考
- ⚠️ 已过期：不再适用

## 阅读顺序

1. `01-refactor-plan.md` — 理解整体重构策略与当前进度
2. `02-css-extraction.md` — CSS 提取的具体模式与清单
3. `03-plugin-integration.md` — 插件外置集成模式与首批执行记录
4. `04-plugin-integration-final-batch.md` — 最终批次插件外置集成记录
5. `05-legacy-helpers-extraction.md` — legacy 残留辅助代码提取到 core
6. `06-component-html-string.md` — 组件返回 HTML 字符串，移除 react-dom/server
7. `07-login-dialog-component.md` — Top250 登录表单提取为 LoginDialog 组件
8. `08-subtitle-dialogs-component.md` — DetailPageButton 字幕弹窗提取为 SubtitleTableDialog / SubtitlePreviewDialog 组件
9. `09-history-dialogs-component.md` — HistoryPlugin 鉴定记录弹窗提取为 HistoryDialog / EditRecordDialog 组件
10. `10-new-video-dialogs-component.md` — NewVideoPlugin 四处弹窗提取为 NewVideoDialog / EditActressDialog / CdnSelectDialog / AvatarSelectDialog 组件 + avatar-select-dialog.css
11. `11-list-page-components.md` — list-page-button/list-page HTML 转组件（MenuButtonBoxHtml / StatusTagHtml / VideoTitleSpan / JumpPageControl / PageCountTable）
12. `12-blacklist-remaining-components.md` — blacklist-plugin 剩余零散 HTML 转组件（BlacklistConfirmMessage / BlacklistDataTypeOptions / BlacklistNameCell / BlacklistUrlTypeCell / BlacklistStatusCell / BlacklistActionCell / MovieListWrapper / BlacklistPaginationCounter）
13. `13-remaining-html-components.md` — 全面扫描剩余注入用 HTML 字符串转 26 个组件 + 5 个 CSS 提取（hit-show/top250/nav-bar/new-video/other-site/preview-video/review/setting/history/want-watched + core image-preview/tooltip/logger）
14. `14-css-charlevel-fix.md` — CSS 与原版字符级对齐修复（24 个 `.css` 零偏差 + NewVideo/Setting 弹窗 CSS 拼接 bug 修复 + tooltip/image-preview 注入对齐）
15. `15-related-plugin-archetype-calibration.md` — RelatedPlugin 对照 archetype L10585-10708 校准（头部去 emoji / 链接色 #1897ff / 条目内联 style / enableLoadRelated 默认 NO）
16. `16-jsx-to-string.md` — 轻量 jsxToString 替代 react-dom/server（仅类型依赖 react，零运行时；产物 +3.77 kB）

## 当前进度概览

- core：15 个模块全部提取（`common-util`/`storage-manager`/`gm-http`/`toast`/
  `loading`/`logger`/`hotkey`/`image-preview`/`viewer`/`webdav`/`gfriends`/
  `async-task-queue`/`layer-wrapper`/`tooltip`/`webdav-crypto`）
- plugins：`base-plugin` + `plugin-manager` + 21 个插件模块全部外置
- constants：`site`/`status`/`video-quality`/`api`/`tabulator-zh`
- resources：`gfriends`
- styles：20 个 CSS（5 顶层 + 9 插件 `initCss` + 1 弹窗内 `<style>` 提取 + doc/13 新增 5 个：`image-preview`/`tooltip`/`back-to-top-button`/`setting-image-mode-vertical`/`setting-image-mode-horizontal`）全部提取
- components：3 个 React 组件示范（`menu-button-box`/`rating-bar`/`status-tag`）+ `temporary-image-container`/`login-dialog`/`subtitle-table-dialog`/`subtitle-preview-dialog`/`history-dialog`/`edit-record-dialog`/`new-video-dialog`/`edit-actress-dialog`/`cdn-select-dialog`/`avatar-select-dialog`/`menu-button-box-html`/`status-tag-html`/`video-title-span`/`jump-page-control`/`page-count-table`/`blacklist-dialog`/`blacklist-confirm-message`/`blacklist-data-type-options`/`blacklist-name-cell`/`blacklist-url-type-cell`/`blacklist-status-cell`/`blacklist-action-cell`/`movie-list-wrapper`/`blacklist-pagination-counter` + doc/13 新增 26 个（`ranking-containers`/`hit-show-tool-bar`/`hit-show-movie-item`/`hit-show-score`/`top250-tool-bar`/`top250-year-button`/`top250-pagination`/`top250-error-message`/`top250-nav-link`/`nav-search-box`/`nav-other-dropdown`/`actress-card`/`actress-pagination`/`new-video-dialog-title`/`other-site-box`/`other-site-btn`/`other-site-checkbox`/`site-result-tag`/`preview-video-quality-btn`/`preview-video-action-btn`/`preview-video-container`/`review-header`/`review-containers`/`review-loading`/`review-error`/`review-empty`/`review-load-more`/`review-end`/`review-link-content`/`review-item`/`setting-mount-box`/`back-to-top-button`/`keyword-label`/`simple-setting-panel`/`cache-item-html`/`video-quality-option`/`history-source-cell`/`history-status-cell`/`want-watched-hint-span`/`want-watched-import-button`/`logger-log-entry`/`image-preview-img`/`image-preview-error`）（返回 HTML 字符串的函数组件，非 JSX）
- 入口：`src/main.tsx`（367 行，完整启动序列，强类型）；legacy 已废弃删除
- 类型：全量去 `@ts-nocheck` 完成，工程内无任何 `@ts-nocheck`
- build：`tsc -b && vite build` 通过，166 modules，产物 485.12 kB（gzip 119.73 kB）；jsxToString 轻量渲染器（doc/16）已落地，`temporary-image-container` 反转 doc/06 改回 JSX，`main.tsx` 不再引入 react-dom/server；其余组件仍遵循 doc/06「返回 HTML 字符串」统一规定

## 相关文件

- 原始脚本：`archetype/jhs.user.js`
- 原脚本历史文档：`archetype/doc/`（已执行的历史定稿，仅作参考）
- 工程入口：`src/main.tsx`（完整启动序列）
- 构建配置：`vite.config.ts`
