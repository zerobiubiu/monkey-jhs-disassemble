# doc/172 — 大文件拆分 + 组件目录重组

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

AGENTS §10/§11 要求单文件 ≤800 行、单目录 ≤20 直接子文件。本轮对 5 个超限文件做职责拆分，
对 src/components/ 120+ 平铺文件做子目录重组。

## 1. 大文件拆分

| 文件 | 前 | 后 | 新增模块 |
|------|-----|-----|----------|
| detail-page-button-plugin.tsx | 2043 | 413 | dpb-want-watched(317) / dpb-rating(505) / dpb-list-panel(658) / dpb-subtitle(187) / dpb-helpers(64) / dpb-types(17) |
| other-site-plugin.tsx | 1178 | 510 | osp-preload(390) / osp-filter-bar(262) / osp-helpers(48) / osp-enabled-sites(27) / osp-types(20) |
| list-reading-status-plugin.ts | 1103 | 275 | lrs-toolbar(421) / lrs-storage(246) / lrs-render(220) / lrs-types(32) |
| common-util.ts | 1094 | 519 | util-dom(157) / util-misc(124) / util-popup(98) / util-sort(92) / util-date(85) / util-download(74) / util-url(59) / util-cookie(50) / util-retry(40) / util-clipboard(16) |
| vlt-sync.tsx | 2425→2259 | 2259 | vlt-broadcast(121) / vlt-remote-sync(64) / vlt-lock-queue(31)（上轮已拆） |

拆分模式：class 保留为 facade/delegate，方法组提取为独立函数（首参 `plugin: PluginType`，
type-only import 避免循环依赖）。公共方法签名不变，getBean 运行时表面完整。

## 2. 组件目录重组

src/components/ 从 120+ 平铺文件重组为 25 个子目录，直接文件数 0：

| 子目录 | 文件数 | 内容 |
|--------|--------|------|
| review/ | 10 | 评论相关组件 |
| related/ | 8 | 相关清单组件 |
| blacklist/ | 8 | 黑名单组件 |
| dialogs/ | 8 | 通用弹窗组件 |
| fc2/ | 6 | FC2 组件（已有） |
| magnet-hub/ | 6 | 磁链聚合组件 |
| actress/ | 5 | 演员相关组件 |
| history/ | 5 | 鉴定记录组件 |
| setting/ | 5 | 设置面板组件 |
| top250/ | 5 | Top250 组件 |
| dpb/ | 5 | 详情页按钮组件 |
| hit-show/ | 3 | 热播组件 |
| image-preview/ | 3 | 图片预览组件 |
| image-recognition/ | 3 | 以图识图组件 |
| nav/ | 4 | 导航栏组件 |
| log/ | 4 | 日志/诊断组件 |
| other-site/ | 4 | 第三方站点组件 |
| preview-video/ | 3 | 预览视频组件 |
| screen/ | 4 | 截图墙组件 |
| subtitle/ | 4 | 字幕组件 |
| movie/ | 3 | 影片通用组件 |
| want-watched/ | 2 | 想看/已看组件 |
| misc/ | 20 | 杂项（≤20 上限） |
| setting-panels/ | 10 | 设置面板子组件（已有） |

导入路径全部更新（131 外部 + 13 内部 = 144 处 import 重写）。

## 3. 机械门禁更新

check-structure.ts：移除 4 个 FILE_CEILINGS 条目（拆分后 ≤800 行）+ 移除 src/components DIR_CEILINGS（0 直接文件）。

## 实施清单

### 新增文件（大文件拆分模块）

- `src/plugins/detail-page-button/dpb-types.ts`
- `src/plugins/detail-page-button/dpb-helpers.ts`
- `src/plugins/detail-page-button/dpb-want-watched.ts`
- `src/plugins/detail-page-button/dpb-rating.tsx`
- `src/plugins/detail-page-button/dpb-list-panel.tsx`
- `src/plugins/detail-page-button/dpb-subtitle.tsx`
- `src/plugins/other-site/osp-types.ts`
- `src/plugins/other-site/osp-helpers.ts`
- `src/plugins/other-site/osp-enabled-sites.ts`
- `src/plugins/other-site/osp-filter-bar.ts`
- `src/plugins/other-site/osp-preload.tsx`
- `src/plugins/list-reading-status/lrs-types.ts`
- `src/plugins/list-reading-status/lrs-storage.ts`
- `src/plugins/list-reading-status/lrs-render.ts`
- `src/plugins/list-reading-status/lrs-toolbar.ts`
- `src/core/util/util-clipboard.ts`
- `src/core/util/util-retry.ts`
- `src/core/util/util-cookie.ts`
- `src/core/util/util-url.ts`
- `src/core/util/util-download.ts`
- `src/core/util/util-date.ts`
- `src/core/util/util-sort.ts`
- `src/core/util/util-popup.ts`
- `src/core/util/util-misc.ts`
- `src/core/util/util-dom.ts`
- `src/plugins/video-lists-tag/vlt-broadcast.ts`
- `src/plugins/video-lists-tag/vlt-remote-sync.ts`
- `src/plugins/video-lists-tag/vlt-lock-queue.ts`

### 组件目录重组（移动 120+ 文件到 25 个子目录）

- `src/components/actress/`（5 文件）：actress-card / actress-info-detail-segment / actress-info-star-page-html / actress-pagination / favorite-actress-avatar-column
- `src/components/blacklist/`（8 文件）：blacklist-action-cell / blacklist-confirm-message / blacklist-data-type-options / blacklist-dialog / blacklist-name-cell / blacklist-pagination-counter / blacklist-status-cell / blacklist-url-type-cell
- `src/components/dialogs/`（8 文件）：avatar-select-dialog / backup-file-dialog / cdn-select-dialog / edit-actress-dialog / edit-record-dialog / help-dialog / login-dialog / new-video-dialog
- `src/components/dpb/`（5 文件）：detail-menu-buttons / list-panel / list-panel-skeleton-span / quick-block-confirm-message / rating-bar-html
- `src/components/history/`（5 文件）：history-action-buttons / history-dialog / history-nav-button / history-source-cell / history-status-cell
- `src/components/hit-show/`（3 文件）：hit-show-movie-item / hit-show-score / hit-show-tool-bar
- `src/components/image-preview/`（3 文件）：image-preview-error / image-preview-img / temporary-image-container
- `src/components/image-recognition/`（3 文件）：image-recognition-dialog / image-recognition-hint / image-recognition-site-button
- `src/components/log/`（4 文件）：diagnostics-table / diagnostics-wrapper / log-colored / logger-log-entry
- `src/components/magnet-hub/`（6 文件）：magnet-hub-containers / magnet-hub-mount-box / magnet-hub-status / magnet-hub-tab / magnet-hub-target-link / magnet-result-card
- `src/components/misc/`（20 文件）：back-to-top-button / backup-action-cell / confirm-warn / highlight-button / javdb-icon / jump-page-control / keyword-label / menu-button-box-html / new-video-dialog-title / page-count-table / preload-cache-stats-text / preload-status-badge / scroll-top-icon / status-tag-html / style-block / table-link-param / translated-title / url-auto-link / vlt-create-list-form / vlt-toast-content
- `src/components/movie/`（3 文件）：movie-error / movie-list-wrapper / ranking-containers
- `src/components/nav/`（4 文件）：fold-category-section-button / fold-category-toolbar / nav-other-dropdown / nav-search-box
- `src/components/other-site/`（4 文件）：other-site-box / other-site-btn / other-site-checkbox / site-result-tag
- `src/components/preview-video/`（3 文件）：preview-video-action-btn / preview-video-container / preview-video-quality-btn
- `src/components/related/`（8 文件）：related-containers / related-empty / related-end / related-error / related-header / related-item / related-load-more / related-loading
- `src/components/review/`（10 文件）：review-containers / review-empty / review-end / review-error / review-header / review-item / review-link-content / review-load-more / review-loading / review-star-icon
- `src/components/screen/`（4 文件）：screen-loading-placeholder / screen-reloading / screen-shot-fallback / screen-shot-image
- `src/components/setting/`（5 文件）：cache-item-html / setting-dialog / setting-mount-box / simple-setting-panel / video-quality-option
- `src/components/subtitle/`（4 文件）：subtitle-action-cell / subtitle-line / subtitle-preview-dialog / subtitle-table-dialog
- `src/components/top250/`（5 文件）：top250-error-message / top250-nav-link / top250-pagination / top250-tool-bar / top250-year-button
- `src/components/want-watched/`（2 文件）：want-watched-hint-span / want-watched-import-button
- `src/components/fc2/`（6 文件，已有）
- `src/components/setting-panels/`（10 文件，已有）

### 修改文件（import 路径更新 + 拆分后 facade 改写）

- `src/plugins/detail-page-button-plugin.tsx`（facade 改写，2043→413 行）
- `src/plugins/other-site-plugin.tsx`（facade 改写，1178→510 行）
- `src/plugins/list-reading-status-plugin.ts`（facade 改写，1103→275 行）
- `src/core/common-util.ts`（facade 改写，1094→519 行）
- `src/plugins/video-lists-tag/vlt-sync.tsx`（上轮已拆，2259 行）
- 131 处外部 import 路径更新（plugins/core/main.tsx）
- 13 处组件内部 import 路径更新
- `scripts/check-structure.ts`（移除 4 个 FILE_CEILINGS + 1 个 DIR_CEILINGS 条目）

### 删除文件

- `src/components/video-title-span.tsx`（死组件，已在 doc/130 标记删除）

## 验证记录

- bun run build：✅
- bun run test：✅ 28/28
- bun run lint：✅ 0 errors
- bun run check:structure：✅ OK（261 文件 / 39 目录）
- src/components 直接文件：0
- 所有子目录 ≤20 文件
