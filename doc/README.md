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
| `18-history-actress-components-tsx.md` | 🔧开发指导 | ✅已执行 | 鉴定记录/演员信息 9 个 HTML 字符串组件转 TSX 原生 React 组件（`history-dialog`/`edit-record-dialog`/`history-nav-button`/`history-action-buttons`/`history-source-cell`/`history-status-cell`/`actress-info-detail-segment`/`actress-info-star-page-html`/`favorite-actress-avatar-column`）；3 个调用点插件 `.ts`→`.tsx`（history/actress-info/favorite-actresses），14 处调用改 `jsxToString(<Comp {...props} />)`；`<option selected>`→`selected={bool}`、`readonly`→`readOnly`（DOM 等价）、`inputStyle`/`textareaStyle` 由 string 改 CSSProperties 对象（React 19 style 不再接受 string）；产物 491.94 kB（gzip 121.16 kB） |
| `19-blacklist-components-tsx.md` | 🔧开发指导 | ✅已执行 | 黑名单 9 个 HTML 字符串组件转 TSX 原生 React 组件（`blacklist-dialog`/`blacklist-confirm-message`/`blacklist-data-type-options`/`blacklist-name-cell`/`blacklist-url-type-cell`/`blacklist-status-cell`/`blacklist-action-cell`/`movie-list-wrapper`/`blacklist-pagination-counter`）；调用点 `blacklist-plugin.ts`→`.tsx`，9 处调用改 `jsxToString(<Comp {...props} />)`；jsxToString 增加 `dangerouslySetInnerHTML` 支持（MovieListWrapper 的 html prop 为原始 HTML 片段）、条件空 `style=""`→CSSProperties undefined（DOM 等价）、`&nbsp;`→U+00A0（DOM 等价）、`{" "}` 保前后空格、HTML 注释→JSX 注释；产物 494.26 kB（gzip 121.41 kB） |
| `20-detail-page-button-components-tsx.md` | 🔧开发指导 | ✅已执行 | 详情页按钮 7 个 HTML 字符串组件转 TSX 原生 React 组件（`detail-menu-buttons`/`rating-bar-html`/`list-panel`/`subtitle-action-cell`/`subtitle-line`/`subtitle-table-dialog`/`subtitle-preview-dialog`），合并删除示范 `rating-bar.tsx`；调用点 `detail-page-button-plugin.ts`→`.tsx`，7 处调用改 `jsxToString(<Comp {...props} />)`；`{" "}` 保按钮间空格、`{"\n"}` 保字幕行尾换行（pre-wrap 渲染）、`dangerouslySetInnerHTML` 原始注入字幕正文、行文本转义（DOM 等价）；产物 495.97 kB（gzip 121.68 kB） |
| `21-setting-components-tsx.md` | 🔧开发指导 | ✅已执行 | 设置弹层 9 个 HTML 字符串组件转 TSX 原生 React 组件（`setting-dialog`/`help-dialog`/`backup-file-dialog`/`setting-mount-box`/`simple-setting-panel`/`cache-item-html`/`video-quality-option`/`keyword-label`/`back-to-top-button`）；调用点 `setting-plugin.ts`→`.tsx`，13 处调用改 `jsxToString(<Comp {...props} />)`；`cacheItemsHtml`/`qualityOptionsHtml` 以 `dangerouslySetInnerHTML` 注入（预拼接 HTML 字符串）、`CacheItemHtml` 的 `key` prop 因 React 保留 prop 冲突重命名为 `cacheKey`（`data-key` 输出不变）、❓ 与文案间 `{" "}` 保空格、条件类名/条件 style/条件块（isJavdbSite）保留、HTML 注释→JSX 注释、SVG 原生 JSX；产物 505.36 kB（gzip 122.35 kB） |

| `22-top250-nav-other-preview-want-tsx.md` | 🔧开发指导 | ✅已执行 | top250/nav/other-site/preview/want-watched 17 个组件转 TSX（26 处调用 jsxToString；LoginDialog on* 内联 JS 丢失 DOM 等价 / OtherSiteCheckbox label for 用 Record 展开注入 / dangerouslySetInnerHTML 注入 yearButtonsHtml/siteButtonsHtml / href & 表达式保留）；产物 517.33 kB（gzip 122.79 kB） |

| `23-core-components-tsx-and-login-dialog-fix.md` | 🔧开发指导 | ✅已执行 | core 3 个 HTML 字符串组件转 TSX（logger-log-entry/image-preview-img/image-preview-error，调用点 logger.ts/image-preview.ts .ts→.tsx）；LoggerLogEntry message 用 dangerouslySetInnerHTML 原样注入、缩进 \n+空格以字符串字面量保留；修复 doc/22 遗留 LoginDialog onfocus/onblur/onmouseover/onmouseout 内联 JS 丢失（top250-plugin.tsx success 回调用 jQuery .on 等价补回，function 非 arrow + this:HTMLElement 显式标注）；产物 518.40 kB（gzip 122.96 kB） |
| `24-library-esm-migration.md` | 🔧开发指导 | ✅已执行 | 外部库 @require → ESM import 迁移：7 库（jquery/tabulator-tables/toastify-js/localforage/viewerjs/blueimp-md5/layui-layer）改为 bun 安装 + ESM import 打包进产物（src/core/libs.ts 集中 import + 挂全局，版本与原 @require 一致）；qrcodejs 移除（全项目未使用）；parallel_GM_xmlhttpRequest 保留 @require（非 npm）。layer+jquery 耦合通过拆 _jquery-global.ts 副作用模块确保 ESM 求值顺序（window.jQuery 先于 layer ready.run）。卸载 @types/jquery（UMD 全局污染 $）改 declare module 'jquery'；viewer.ts VIEWER_CONFIG 返回 any（viewerjs 全局 Viewer 精确化）；tabulator 命名导入（ESM 无 default）；vite.config 加 css.lightningcss.errorRecovery（layer.css IE hack）；4 个库 CSS 由 utils.importResource CDN 改 ESM import 打包。产物 1202.82 kB（gzip 309.12 kB），@require 仅剩 1 个 |
| `25-rating-display-integration.md` | 🔧开发指导 | ✅已执行 | jhsRatingDisplay 独立脚本集成：拆分 6 模块（config/utils/cache/net/renderer/plugin）到 src/plugins/rating-display/ 子目录，作为 RatingDisplayPlugin 注册到 PluginManager（javdb only）；buildWatchedMap 复用 storageManager.getCarList()（同库同键）；评分缓存寄生 IDB 保留原生 indexedDB API；GM_addStyle 改走 initCss；GM_registerMenuCommand 补 grant + 声明（4 菜单）；Renderer innerHTML 改 jsxToString（TSX 化，DOM 等价）；不复用 gm-http.gmRequest（语义不匹配，直接用全局 GM_xmlhttpRequest）；产物 1221.87 kB（gzip 314.19 kB），+19 kB |
| `26-identifier-rename.md` | 🔧开发指导 | ✅已执行 | 单字母标识符语义化重命名：main.tsx 导入别名/CSS 区段/IIFE 局部/window 全局属性（gt/lt/De/Me/Ne → loadGfriends/filetreeDb/WebDavClient/encryptCredential/decryptCredential）+ webdav-crypto 导出（Le/Me/Ne → WEBDAV_SALT/encryptCredential/decryptCredential）+ hotkey/common-util/image-preview/libs 等 13 文件；修正 main.tsx:13 导入笔误（isJavdbSite as l → isJavbusSite）；产物 1223.66 kB（gzip 314.42 kB） |
| `27-remove-javbus-dead-code.md` | 🔧开发指导 | ✅已执行 | 清理全项目 javbus 站点死代码：删 src/styles/javbus-masonry.css 文件 + constants/site.ts 的 isJavbusSite/JAVBUS 导出 + main.tsx 的 javbus CSS 注入/isJavbusSite import/isDetailPage·isListPage javbus 分支/clog javbus 过滤 + vite.config description 去 JavBus + 7 组件删 javbus variant/site/notFirstPageByJavbus prop + 11 插件删 isJavbusSite 分支/专属方法（fixBusTitleBox/cleanRepeatId/handleBus/JavBus 反查影片 ID 等）+ 调用方 site="javdb"/notFirstPageByJavbus={false} 残留对齐；tsc -b 通过，产物 1206.64 kB（gzip 310.94 kB），-17 kB，javdb 行为不变 |
| `28-cleanup-other-dead-code.md` | 🔧开发指导 | ✅已执行 | 清理其他死代码：删 src/constants/tabulator-zh.ts（TABULATOR_ZH_CN 0 引用）+ rating-net.ts 的 RatingNet 聚合导出 + history-plugin 123av 来源标签分支；去 4 处多余 export（positionTooltip/createToast/parseFiletree/WEBDAV_SALT，模块内部用）；修正设置面板文案 123AV→SupJav；tsc -b 通过，产物 1206.48 kB（gzip 310.91 kB） |

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
17. `17-list-page-components-tsx.md` — 列表页/折叠分类 8 个组件转 TSX（jsxToString 调用点）
18. `18-history-actress-components-tsx.md` — 鉴定记录/演员信息 9 个组件转 TSX（14 处调用 jsxToString；selected 布尔化 / readOnly 大小写等价 / inputStyle 对象化）
19. `19-blacklist-components-tsx.md` — 黑名单 9 个组件转 TSX（9 处调用 jsxToString；dangerouslySetInnerHTML 支持 / 条件空 style 省略 / &nbsp;→U+00A0 / {" "} 保空格 / HTML 注释→JSX 注释）
20. `20-detail-page-button-components-tsx.md` — 详情页按钮 7 个组件转 TSX（7 处调用 jsxToString；合并删除 rating-bar.tsx 示范 / {"\n"} 保字幕行尾换行 / dangerouslySetInnerHTML 注入字幕正文）
21. `21-setting-components-tsx.md` — 设置弹层 9 个组件转 TSX（13 处调用 jsxToString；dangerouslySetInnerHTML 注入 cacheItemsHtml/qualityOptionsHtml / CacheItemHtml key→cacheKey 重命名 / ❓{" "} 保空格 / SVG 原生 JSX）
22. `22-top250-nav-other-preview-want-tsx.md` — top250/nav/other-site/preview/want-watched 17 个组件转 TSX（26 处调用 jsxToString；LoginDialog on* 内联 JS 丢失 / OtherSiteCheckbox label for 用 Record 展开 / dangerouslySetInnerHTML 注入 yearButtonsHtml/siteButtonsHtml）
23. `23-core-components-tsx-and-login-dialog-fix.md` — core 3 个组件转 TSX（logger-log-entry/image-preview-img/image-preview-error，调用点 logger/image-preview .ts→.tsx）；修复 LoginDialog on* 内联 JS 丢失（top250-plugin success 回调 jQuery .on 等价补回）
24. `24-library-esm-migration.md` — 外部库 @require → ESM import 迁移（7 库打包进产物 + layer/jquery 求值顺序 + lightningcss errorRecovery + tabulator 命名导入）
25. `25-rating-display-integration.md` — jhsRatingDisplay 评分显示独立脚本集成（6 模块拆分到 rating-display/ 子目录 + 复用 storageManager 数据源 + initCss + GM_registerMenuCommand + jsxToString）
26. `26-identifier-rename.md` — 单字母标识符语义化重命名（13 文件 + webdav-crypto 导出 + window 全局属性 + 修正 isJavbusSite 导入笔误）
27. `27-remove-javbus-dead-code.md` — 清理全项目 javbus 站点死代码（删 javbus-masonry.css + 20 文件 javbus 分支/方法/variant + constants isJavbusSite/JAVBUS）
28. `28-cleanup-other-dead-code.md` — 清理其他死代码（删 tabulator-zh.ts + RatingNet + 123av 来源标签 + 去多余 export + 文案修正）

## 当前进度概览

- core：15 个模块全部提取（`common-util`/`storage-manager`/`gm-http`/`toast`/
  `loading`/`logger`/`hotkey`/`image-preview`/`viewer`/`webdav`/`gfriends`/
  `async-task-queue`/`layer-wrapper`/`tooltip`/`webdav-crypto`）
- plugins：`base-plugin` + `plugin-manager` + 22 个插件模块全部外置（含 doc/25 集成的 RatingDisplayPlugin）
- constants：`site`/`status`/`video-quality`/`api`
- resources：`gfriends`
- styles：19 个 CSS（4 顶层 + 9 插件 `initCss` + 1 弹窗内 `<style>` 提取 + doc/13 新增 5 个：`image-preview`/`tooltip`/`back-to-top-button`/`setting-image-mode-vertical`/`setting-image-mode-horizontal`）全部提取
- components：`temporary-image-container`/`login-dialog`/`subtitle-table-dialog`/`subtitle-preview-dialog`/`history-dialog`/`edit-record-dialog`/`new-video-dialog`/`edit-actress-dialog`/`cdn-select-dialog`/`avatar-select-dialog`/`menu-button-box-html`/`status-tag-html`/`video-title-span`/`jump-page-control`/`page-count-table`/`blacklist-dialog`/`blacklist-confirm-message`/`blacklist-data-type-options`/`blacklist-name-cell`/`blacklist-url-type-cell`/`blacklist-status-cell`/`blacklist-action-cell`/`movie-list-wrapper`/`blacklist-pagination-counter` + doc/13 新增 26 个（`ranking-containers`/`hit-show-tool-bar`/`hit-show-movie-item`/`hit-show-score`/`top250-tool-bar`/`top250-year-button`/`top250-pagination`/`top250-error-message`/`top250-nav-link`/`nav-search-box`/`nav-other-dropdown`/`actress-card`/`actress-pagination`/`new-video-dialog-title`/`other-site-box`/`other-site-btn`/`other-site-checkbox`/`site-result-tag`/`preview-video-quality-btn`/`preview-video-action-btn`/`preview-video-container`/`review-header`/`review-containers`/`review-loading`/`review-error`/`review-empty`/`review-load-more`/`review-end`/`review-link-content`/`review-item`/`setting-mount-box`/`back-to-top-button`/`keyword-label`/`simple-setting-panel`/`cache-item-html`/`video-quality-option`/`history-source-cell`/`history-status-cell`/`want-watched-hint-span`/`want-watched-import-button`/`logger-log-entry`/`image-preview-img`/`image-preview-error`）+ doc/20 转换 `detail-menu-buttons`/`rating-bar-html`/`list-panel`/`subtitle-action-cell`/`subtitle-line`/`subtitle-table-dialog`/`subtitle-preview-dialog` 7 个为 TSX + doc/21 转换 `setting-dialog`/`help-dialog`/`backup-file-dialog`/`setting-mount-box`/`simple-setting-panel`/`cache-item-html`/`video-quality-option`/`keyword-label`/`back-to-top-button` 9 个为 TSX + doc/22 转换 top250/nav/other-site/preview/want-watched 17 个为 TSX + doc/23 转换 logger-log-entry/image-preview-img/image-preview-error 3 个为 TSX（JSX 函数组件，经 jsxToString 转 HTML 字符串）；原 3 个 React 示范（`menu-button-box`/`rating-bar`/`status-tag`）已全部合并删除（doc/17 删 menu-button-box/status-tag，doc/20 删 rating-bar）
- 入口：`src/main.tsx`（367 行，完整启动序列，强类型）；legacy 已废弃删除
- 类型：全量去 `@ts-nocheck` 完成，工程内无任何 `@ts-nocheck`
- build：`tsc -b && vite build` 通过，191 modules，产物 1206.48 kB（gzip 310.91 kB）；jsxToString 轻量渲染器（doc/16）已落地，`temporary-image-container` + 列表页 8（doc/17）+ 鉴定记录/演员 9（doc/18）+ 黑名单 9（doc/19）+ 详情页按钮 7（doc/20）+ 设置弹层 9（doc/21）+ top250/nav/other-site/preview/want-watched 17（doc/22）+ core 3（doc/23）共 63 个组件已转 TSX（返回 JSX，经 jsxToString 转 HTML 字符串）；原 3 个 React 示范（menu-button-box/rating-bar/status-tag）已全部合并删除；LoginDialog on* 内联 JS 丢失已由 top250-plugin success 回调 jQuery .on 补回（doc/23）；doc/25 集成 jhsRatingDisplay 评分显示独立脚本为 RatingDisplayPlugin（6 模块 + rating-display.css）；doc/26 单字母标识符语义化重命名（13 文件 + webdav-crypto 导出 Le/Me/Ne + window 全局属性 gt/lt/De/Me/Ne + 修正 main.tsx:13 isJavbusSite 导入笔误）；doc/27 清理全项目 javbus 死代码（删 javbus-masonry.css + 20 文件 javbus 分支/方法/variant + constants isJavbusSite/JAVBUS + vite description）；doc/28 清理其他死代码（删 tabulator-zh.ts + RatingNet + 123av 来源标签 + 去 4 处多余 export + 文案修正）

- 外部库：7 库（jquery/tabulator-tables/toastify-js/localforage/viewerjs/blueimp-md5/layui-layer）已 ESM import 打包进产物（src/core/libs.ts 集中 import + 挂全局，版本与原 @require 一致），qrcodejs 移除（全项目未使用），parallel_GM_xmlhttpRequest 保留 @require（非 npm）；layer+jquery 耦合由 _jquery-global.ts 副作用模块保证 ESM 求值顺序（window.jQuery 先于 layer ready.run）；卸载 @types/jquery（污染全局 $）改 declare module，viewer.ts 返回 any，tabulator 命名导入，vite.config 加 lightningcss errorRecovery；userscript `@require` 仅剩 1 个（doc/24）

## 相关文件

- 原始脚本：`archetype/jhs.user.js`
- 原脚本历史文档：`archetype/doc/`（已执行的历史定稿，仅作参考）
- 工程入口：`src/main.tsx`（完整启动序列）
- 构建配置：`vite.config.ts`
