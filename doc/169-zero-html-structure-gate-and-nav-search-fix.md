# doc/169 — 零硬编码 HTML + 机械结构门禁 + 检索按钮修复 + 目录重组

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

用户提出三项强制要求：① 全部 HTML 必须基于 React 组件生成，零硬编码 HTML 字符串；
② 大文件拆分 + 代码复用 + 原子化 + 目录规划规则写死在 AGENTS.md 中；③ 标题栏检索
按钮点击无响应的 bug 修复。同时使用 superpowers skill 框架指导执行纪律。

## 1. 零硬编码 HTML（15 文件 LOW 全清）

将 15 个文件中残留的全部内联 HTML 字符串字面量（单元素 badge/mount/log/Tabulator
formatter/SVG/CSS style 块）提取为 React 组件或经 jsxToString 渲染：

### 新增组件（~25 个直接子文件 + 9 面板子组件 + 1 CSS 辅助）

| 来源文件 | 新增组件 |
|----------|----------|
| fc2-plugin.tsx / fc2-by-123av-plugin.tsx | MovieError, ScreenLoadingPlaceholder |
| screenshot-plugin.tsx | ScreenShotImage, ScreenShotFallback, ScreenReloading |
| translate-plugin.tsx | TranslatedTitle |
| missav-quick-copy-plugin.tsx | JavDBIcon (含 JAVDB_ICON_SVG 常量，dangerouslySetInnerHTML) |
| magnet-hub-plugin.tsx | MagnetHubContainer/Tabs/Results/Tab/TargetLink/Loading/Error |
| image-recognition-plugin.tsx | ImageRecognitionSiteButton, ImageRecognitionHint |
| vlt-toast.tsx | VltToastContent (含 TOAST_SVG_ICONS 常量，dangerouslySetInnerHTML) |
| detail-page-button-plugin.tsx | ListPanelSkeletonSpan, QuickBlockConfirmMessage, MagnetHubMountBox |
| history-plugin.tsx | TableLinkParam |
| setting-plugin.tsx | PreloadCacheStatsText, BackupActionCell, StyleBlock |
| want-and-watched-videos-plugin.tsx | ConfirmWarn |
| logger.tsx | UrlAutoLink |
| storage-manager.ts | LogColored + logColoredHtml 辅助函数 |
| plugin-diagnostics.tsx | DiagnosticsWrapper |

### CSS 提取（3 个 `<style>` 块 → 独立 .css 文件）

- magnet-hub-plugin.tsx initCss `<style>` → src/styles/magnet-hub-plugin.css
- image-recognition-plugin.tsx initCss `<style>` → src/styles/image-recognition-plugin.css
- translate-plugin.tsx initCss `<style>` → src/styles/translate-plugin.css

### SVG 处理（kebab-only 属性无法以 JSX 属性表达）

- vlt-toast 4 个 SVG 图标 → TOAST_SVG_ICONS 命名常量 + dangerouslySetInnerHTML
- missav-quick-copy JavDB 图标 → JAVDB_ICON_SVG 命名常量 + dangerouslySetInnerHTML

### 文件重命名（.ts → .tsx，因引入 JSX）

- screenshot-plugin.ts → .tsx
- translate-plugin.ts → .tsx
- missav-quick-copy-plugin.ts → .tsx
- vlt-toast.ts → .tsx

### 结果

src/ 全树零内联 HTML 字符串字面量（仅 2 个 sanctioned dangerouslySetInnerHTML 常量
保留 SVG 路径数据，元素本身由组件生成）。

## 2. setting-dialog.tsx 拆分（940 → 171 行）

拆分为 9 个面板子组件（setting-panels/ 子目录）+ 1 个 CSS 辅助（hr-style.ts）。
选择器保留表全 YES（bindClick/loadForm 的全部 jQuery 选择器目标均保留）。

## 3. constants/api.ts any 收窄（14 → 0）

MovieDetail / RelatedCollection 接口的 any 字段全部收窄为具体类型；新增 6 个辅助接口
（MovieActor / PreviewImage / MovieReview / RankingMovie / TopMoviesResponse /
RawRelatedCollectionItem）；3 个函数返回类型 + 2 个回调参数类型收窄。
eslint warnings −19（783 → 764）。

## 4. 机械结构门禁（scripts/check-structure.ts）

按 superpowers:writing-skills 原则（机械约束必须自动化），新增独立命令
`bun run check:structure`：
- 800 行文件硬上限 + 20 直接子文件目录硬上限
- 棘轮机制：当前超限文件/目录以精确现状值 seeded，只许下调不许抬高
- 不接入 build/lint/test（独立命令，不干扰现有门禁）
- AGENTS §10.4 第 6 条 + §11.1 机械执行条目交叉引用

## 5. AGENTS.md §10/§11 规则写死

- §10 大文件拆分与代码复用规则（800 硬上限 / 500 软上限 / 单一职责 / 禁止重复 / 验证门禁）
- §11 目录规划规则（≤20 直接子文件 / 按插件域/功能层/页面类型划分子目录 / 变更同步）

## 6. .tsx → .ts 重命名（2 文件无 JSX）

- vlt-plugin.tsx → vlt-plugin.ts
- rating-display-plugin.tsx → rating-display-plugin.ts

## 7. fc2 组件子目录重组

6 个 fc2 专属组件移入 src/components/fc2/（满足 §11.2 按插件域划分子目录规则，
同时将 src/components 直接文件数从 126 降至 ~120，清除 check:structure 门禁）。

## 8. 检索按钮修复

nav-bar-plugin.tsx toggleOtherNavItem：原按宽度在自定义检索框与站点检索栏间切换显隐，
1024-1599px 显示未绑定的站点检索栏致检索按钮无响应。修复为桌面宽度（>1023）统一显示
已绑定的自定义检索框。

## 实施清单

### 新增文件

- src/components/backup-action-cell.tsx
- src/components/confirm-warn.tsx
- src/components/diagnostics-wrapper.tsx
- src/components/image-recognition-hint.tsx
- src/components/image-recognition-site-button.tsx
- src/components/javdb-icon.tsx
- src/components/list-panel-skeleton-span.tsx
- src/components/log-colored.tsx
- src/components/magnet-hub-containers.tsx
- src/components/magnet-hub-mount-box.tsx
- src/components/magnet-hub-status.tsx
- src/components/magnet-hub-tab.tsx
- src/components/magnet-hub-target-link.tsx
- src/components/movie-error.tsx
- src/components/preload-cache-stats-text.tsx
- src/components/quick-block-confirm-message.tsx
- src/components/screen-loading-placeholder.tsx
- src/components/screen-reloading.tsx
- src/components/screen-shot-fallback.tsx
- src/components/screen-shot-image.tsx
- src/components/style-block.tsx
- src/components/table-link-param.tsx
- src/components/translated-title.tsx
- src/components/url-auto-link.tsx
- src/components/vlt-toast-content.tsx
- src/components/fc2/（6 个 fc2 专属组件）
- src/components/setting-panels/（9 面板 + hr-style.ts）
- src/styles/magnet-hub-plugin.css
- src/styles/image-recognition-plugin.css
- src/styles/translate-plugin.css
- scripts/check-structure.ts

### 重命名文件

- src/plugins/screenshot-plugin.ts → .tsx
- src/plugins/translate-plugin.ts → .tsx
- src/plugins/missav-quick-copy-plugin.ts → .tsx
- src/plugins/video-lists-tag/vlt-toast.ts → .tsx
- src/plugins/video-lists-tag/vlt-plugin.tsx → .ts
- src/plugins/rating-display/rating-display-plugin.tsx → .ts

### 移动文件（→ src/components/fc2/）

- fc2-123av-detail-dialog.tsx
- fc2-123av-movie-info.tsx
- fc2-browse-page.tsx
- fc2-detail-dialog.tsx
- fc2-magnet-item.tsx
- fc2-movie-detail.tsx

### 修改文件

- src/components/setting-dialog.tsx（940 → 171 行）
- src/constants/api.ts（14 any → 0）
- src/plugins/nav-bar-plugin.tsx（检索按钮修复）
- src/plugins/detail-page-button-plugin.tsx
- src/plugins/history-plugin.tsx
- src/plugins/setting-plugin.tsx
- src/plugins/image-recognition-plugin.tsx
- src/plugins/magnet-hub-plugin.tsx
- src/plugins/fc2-plugin.tsx
- src/plugins/fc2-by-123av-plugin.tsx
- src/plugins/video-lists-tag/vlt-sync.tsx
- src/core/logger.tsx
- src/core/storage-manager.ts
- src/core/plugin-diagnostics.tsx
- AGENTS.md（§10/§11 规则写死）

## 验证记录

- bun run build：✅
- bun run test：✅ 28/28
- bun run lint：✅ 0 errors
- bun run lint:css：✅ 0 errors
- bun run check:structure：✅ OK
- 残留内联 HTML：0
