---
文档类型: 🔧开发指导
文档状态: ✅已执行
---

# 13 - 剩余注入用 HTML 字符串全面转组件 + CSS 提取

## 1. 背景

doc/06–12 已将 main.tsx / 各弹窗 / list-page / blacklist 的注入用 HTML 字符串
提取为返回 HTML 字符串的函数组件（doc/06 统一规定：不用 JSX、不用
renderToStaticMarkup）。本次全面扫描 `src/` 剩余的 `$(html)` / `.html(html)` /
`.append(html)` / `.prepend(html)` / `.before(html)` / `.after(html)` /
`innerHTML = html` / `layer.open({ content: html })` / Tabulator formatter 返回
HTML / 模板拼接注入 DOM 的站点，统一转为组件；并将内联 `<style>` 提取为
`src/styles/*.css` + `?raw`。

## 2. 剩余 HTML 清单（转换前）与转换

### 2.1 plugins

| 文件 | 行（转换前） | 原 HTML | 转换后组件 |
|------|------|------|------|
| `hit-show-plugin.ts` | L61-66 | tool-box + movie-list 两个空容器 | `RankingContainers`（与 top250 共享） |
| `hit-show-plugin.ts` | L115-118 | toolBar 日/周/月榜工具栏 | `HitShowToolBar` |
| `hit-show-plugin.ts` | L126-136 + L178 | getStarRating + scoreHtml | `HitShowScore`（合并星级逻辑到组件内） |
| `hit-show-plugin.ts` | L219-221 | markDataListHtml 影片卡片 | `HitShowMovieItem` |
| `top250-plugin.ts` | L71-73 | "猜你喜歡"→Top250 链接 | `Top250NavLink` |
| `top250-plugin.ts` | L90-95 | tool-box + movie-list 容器 | `RankingContainers` |
| `top250-plugin.ts` | L107-116 | renderPagination 分页栏 | `Top250Pagination` |
| `top250-plugin.ts` | L191 / L213 | 失败 `<h3>` 提示 | `Top250ErrorMessage` / `Top250LoadError` |
| `top250-plugin.ts` | L241-246 | toolBar 分类/年份/中字 | `Top250ToolBar` + `Top250YearButton` |
| `nav-bar-plugin.ts` | L91-93 | hookSearch 检索框 | `NavSearchBox` |
| `nav-bar-plugin.ts` | L151-153 | mergeNav "其它"下拉 | `NavOtherDropdown` |
| `new-video-plugin.ts` | L143 | openDialog 标题 span | `NewVideoDialogTitle` |
| `new-video-plugin.ts` | L253 | renderActressCards 卡片 | `ActressCard` |
| `new-video-plugin.ts` | L469-500 | renderPagination 分页 | `ActressPagination` |
| `other-site-plugin.ts` | L132-143 | loadOtherSite boxHtml | `OtherSiteBox` + `OtherSiteBtn` |
| `other-site-plugin.ts` | L196/223/280 | "多结果"角标 | `SiteResultTag`（与 preview-video 共享） |
| `other-site-plugin.ts` | L400-403 | renderSettingsArea 复选框 | `OtherSiteCheckbox` |
| `preview-video-plugin.ts` | L250-252 | "多结果"角标 | `SiteResultTag` |
| `preview-video-plugin.ts` | L572-574 | 预告片封面入口 | `PreviewVideoContainer` |
| `preview-video-plugin.ts` | L644-646 | 画质切换按钮 | `PreviewVideoQualityBtn` |
| `preview-video-plugin.ts` | L658-668 | 屏蔽/收藏/快进按钮 | `PreviewVideoActionBtn` |
| `review-plugin.ts` | L110-112 | 评论区头部 | `ReviewHeader` |
| `review-plugin.ts` | L135-136 | reviewsContainer/Footer | `ReviewContainers` |
| `review-plugin.ts` | L151-153 | 加载中 | `ReviewLoading` |
| `review-plugin.ts` | L171-173 | 获取失败+重试 | `ReviewError` |
| `review-plugin.ts` | L181-183 | 无评论 | `ReviewEmpty` |
| `review-plugin.ts` | L189-191 | 加载更多+End | `ReviewLoadMore` |
| `review-plugin.ts` | L218-220 | 已加载全部 | `ReviewEnd` |
| `review-plugin.ts` | L249-259 | 链接转换 + 评论卡片 | `ReviewLinkContent` + `ReviewItem` |
| `setting-plugin.ts` | L147/153/167/176 | 4 处设置挂载容器 | `SettingMountBox`（variant） |
| `setting-plugin.ts` | L212-260 | 回到顶部 CSS + SVG 按钮 | `back-to-top-button.css` + `BackToTopButton` |
| `setting-plugin.ts` | L289-298 | cacheItems + qualityOptions | `CacheItemHtml` + `VideoQualityOption` |
| `setting-plugin.ts` | L330-332 | simpleSetting 巨型面板 | `SimpleSettingPanel` |
| `setting-plugin.ts` | L778-799 | applyImageMode 竖/横图 CSS | `setting-image-mode-vertical.css` / `-horizontal.css` |
| `setting-plugin.ts` | L966-972 | addLabelTag 关键词标签 | `KeywordLabel`（link/div 变体） |
| `history-plugin.ts` | L575-583 | 来源列 formatter | `HistorySourceCell` |
| `history-plugin.ts` | L618-621 | 状态列 formatter | `HistoryStatusCell` |
| `want-and-watched-videos-plugin.ts` | L42/57 | "导入至 JHS"按钮 | `WantWatchedImportButton` |
| `want-and-watched-videos-plugin.ts` | L44/59 | 标题提示 span | `WantWatchedHintSpan` |

### 2.2 core

| 文件 | 行（转换前） | 原 HTML/CSS | 转换后 |
|------|------|------|------|
| `image-preview.ts` | L65-68 | injectStyles `<style>`（4 处运行时插值） | `image-preview.css` + `?raw`（`/*__Z_INDEX__*/` 等占位 replace） |
| `image-preview.ts` | L109 | onload innerHTML `<img>` | `ImagePreviewImg` |
| `image-preview.ts` | L121-122 | onerror innerHTML 失败提示 | `ImagePreviewError` |
| `tooltip.ts` | L30 | TOOLTIP_CSS `<style>` | `tooltip.css` + `?raw` |
| `logger.ts` | L449 | _createLogElement innerHTML | `LoggerLogEntry` |

### 2.3 main.tsx

无剩余注入（`H()` 为 CSS 注入 helper；`a.includes("<span>1005</span>")` 为字符串
比较，非注入）。

## 3. CSS 提取

| CSS | 来源 | 文件 | 模式 |
|-----|------|------|------|
| 悬浮大图预览样式 | image-preview injectStyles | `src/styles/image-preview.css` | 占位 replace（doc/02 模式 2.2） |
| tooltip 样式 | tooltip TOOLTIP_CSS | `src/styles/tooltip.css` | 纯静态（2.1） |
| 回到顶部按钮样式 | setting addBackToTopBtn | `src/styles/back-to-top-button.css` | 纯静态（2.1），经 `utils.insertStyle` 注入 |
| 竖图模式样式 | setting applyImageMode | `src/styles/setting-image-mode-vertical.css` | 占位 replace（`/*__OBJECT_POSITION__*/`） |
| 横图模式样式 | setting applyImageMode | `src/styles/setting-image-mode-horizontal.css` | 纯静态（2.1） |

## 4. 未转换项（说明原因）

以下含 HTML 字符串但**不属"注入用结构化 HTML 模板"**，按 doc/06 精神保留：

1. **`preview-video-plugin.ts` `$("<div></div>")`**（L622/630/665）：jQuery 空元素
   创建（等价 `document.createElement("div")`），无内容/结构，随后 `.css()` 设置
   样式。非模板注入，保留。
2. **`storage-manager.ts` `clog.log('<span style="color:#f40">...</span>')`**
   （L484/558/566/574/593）：日志消息内的**内联着色格式片段**，经 logger
   `el.innerHTML` 渲染。属消息内容格式化（非结构化 UI 模板），保留。
3. **`logger.ts` `<br/>` + `<a href>` 链接化**（L291/315）：日志消息内 URL 链接化
   与对象 JSON 换行，属消息内容变换，保留。
4. **`want-and-watched-videos-plugin.ts` `utils.q` 确认对话框消息**
   `${confirmMessage} <br/> <span style='color:#f40'>...</span>`（L82）：对话框
   正文内的内联格式片段，属消息内容，保留。
5. **`common-util.ts` `insertStyle`**（L83-90）：CSS 注入 helper 本身（包裹
   `<style>`），等价 `main.tsx` 的 `H()`，非转换目标，保留。
6. **doc-comment 中的 HTML 字面量**（detail-page-button / fold-category 等）：
   注释说明，非注入，保留。

## 5. 执行验证记录

### 5.1 构建

```
$ pnpm run build
$ tsc -b && vite build
✓ 153 modules transformed.
dist/monkey-jhs-disassemble.user.js  468.96 kB │ gzip: 117.99 kB
✓ built in 278ms
```

`tsc -b` 通过 strict + noUnusedLocals + noUnusedParameters +
noFallthroughCasesInSwitch + noUncheckedSideEffectImports；`vite build` 成功出包。
产物体积 468.96 kB（gzip 117.99 kB），较 doc/06 基线 458.24 kB 增长约 10 kB
（新增 26 组件 + 5 CSS 文件的模板字符串与 ?raw 内联，符合预期）。

### 5.2 残留核查

`grep '<(div|span|a |button|svg|select|option|input|table|hr|br|h[1-3]|p|li|ul|form|textarea|label|i )[ >]' src/plugins/`
仅余：doc-comment 字面量（detail-page-button / fold-category）与
`$("<div></div>")` 空元素创建（preview-video）。`grep '<style' src/` 仅余
`common-util.insertStyle` helper 与已提取的 `?raw` 注入点。运行时无裸 HTML 模板
注入。✓

### 5.3 提交

- 主题：`转换剩余 HTML 字符串`
- 文件：`src/components/*.ts`（26 个新增）、`src/styles/*.css`（5 个新增）、
  `src/plugins/*.ts`（10 个修改）、`src/core/*.ts`（3 个修改）、
  `doc/13-*.md`、`doc/README.md`
- hash：见 `git log -1`
