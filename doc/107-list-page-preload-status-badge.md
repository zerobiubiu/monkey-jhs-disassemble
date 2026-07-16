# 107 - 列表页预加载实时状态徽标

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 1. 背景

OtherSitePlugin 在列表页预加载（doc/51 新增、doc/52 优化）missav 等站点缓存
时，对用户完全透明：`preloadListPage` / `preloadSite` 只读写 localStorage
缓存，不在 UI 上反映进度。用户无法知道哪些卡片正在预加载、是否命中、是否
失败，只能等打开详情页看按钮颜色。

用户要求：在视频流（列表页）做外部网站预加载时，于每个 `.item` 的
`.video-title` 下方实时显示状态，状态分四档：

- **排队中** — 已入队 AsyncTaskQueue 但尚未执行（串行限流）
- **请求中** — 正在请求搜索页（gmHttp.get）
- **成功匹配** — 搜索结果命中（单/多结果），已写缓存
- **匹配失败** — 未命中 / Cloudflare 拦截 / 其他错误

要求 CSS 自行设计，合理美观，状态不出错、实时更新 DOM。

## 2. 方案

### 2.1 DOM 结构与注入位置

在 `.item > a.box` 内 `.video-title` 之后插入状态条容器，每站点一个徽标：

```html
<div class="jhs-preload-status-bar">
  <span class="jhs-preload-status" data-site-id="missAvBtn">
    <span class="jhs-ps-name">missAv</span>
    <span class="jhs-ps-badge jhs-ps-queued">排队中</span>
  </span>
</div>
```

注入点 `.video-title` afterend 与现有注入点不冲突：
- RatingDisplay 写 `.cover`（rating-renderer.tsx:48/69）
- ListPagePlugin 写 `.status-tag` 到 `.tags.has-addons`（list-page-plugin.tsx:514）
- VideoListsTag 写 `.custom-tags-display` 到 `.meta` afterend（vlt-tags.ts:273）

### 2.2 实时更新机制（不重建 DOM）

`updatePreloadStatus($item, siteId, status)` 幂等方法：
- 状态条/徽标不存在 → 经 `jsxToString(<PreloadStatusBar/PreloadStatusBadge />)`
  注入初始 HTML（初始状态由 status prop 决定，复用 `PRELOAD_STATUS_MAP`）
- 徽标已存在 → jQuery 直接改 `.jhs-ps-badge` 的 `class`（全量覆盖切换状态色）
  与 `text`，不重建 DOM（避免布局抖动、避免触发 observer 抖动）

### 2.3 状态流转

| 时机 | 位置 | 状态 |
|------|------|------|
| 入队时（cache 未命中、非 initUrl 站点） | preloadListPage 入队前 | 排队中 |
| 任务开始执行 | addTask 回调、preloadSite 前 | 请求中 |
| 命中（detailHrefs.length ≥ 1） | preloadSite 结果分支 | 成功匹配 |
| 未命中（length === 0） | preloadSite else | 匹配失败 |
| Cloudflare 拦截 | preloadSite catch | 匹配失败 |
| 其他错误 | preloadSite catch | 匹配失败 |
| 任务执行时站点已被标记拦截 | addTask 回调二次检查 | 匹配失败 |

### 2.4 Observer 安全性（前置调研结论）

插入 `.video-title` 之后的徽标对全部现有 MutationObserver 安全，无循环：

- `.movie-list` 作用域三 observer（ListPagePlugin `checkDom`、
  OtherSitePlugin `startPreloadObserver`、PageSortPlugin `sortGuard`）
  均为 `{childList:true, subtree:false}`，只响应 `.movie-list` 直接子节点
  （`.item`）增删，不响应 `.item` 内部 DOM 变化 → **不触发**
- `document.body` subtree observer（RatingDisplay / StatusTagFilter /
  VideoListsTag / ListReadingStatus / ModalListDisabler）会 fire，但回调
  均按谓词过滤（`.item` / `.tag.is-success.status-tag` / `.thumbnail.group` /
  `#modal-save-list` 等），`.jhs-preload-status-*` 不匹配任何谓词 → **no-op**
- 类名前缀刻意避开 `tag`/`status-tag`/`custom-tag`/`item`/`video-title` 等
  谓词前缀，确保不误匹配

### 2.5 SupJav 不显示徽标

SupJav 有 `initUrl`（doc/52 + doc/106 修复后读取 `supJavUrl` 设置），
`preloadListPage` 第 414 行 `if (siteConfig.initUrl) continue;` 跳过，不入队
→ 无徽标（其状态在详情页直接黄色按钮体现）。故列表页徽标实际仅 missAv。

### 2.6 重试与幂等

- 成功项已写缓存 → 下次 `preloadListPage` 命中缓存跳过（第 418 行），
  徽标保持「成功匹配」
- 失败项未写缓存 → 下次重试，徽标 排队中→请求中→终态，实时刷新
- `updatePreloadStatus` 按 `data-site-id` 定位徽标，重复调用同状态不产生
  多余 DOM；observer 回调重入也安全

## 3. 实施

### 3.1 新增文件

| 文件 | 说明 |
|------|------|
| `src/components/preload-status-badge.tsx` | `PreloadStatusBar`（容器）/ `PreloadStatusBadge`（单站点徽标）组件 + `PreloadStatus` 类型 + `PRELOAD_STATUS_MAP` 状态→class/文案 映射 |
| `src/styles/preload-status-badge.css` | 徽标样式：chip 布局、四档配色、请求中脉冲点动画 |

### 3.2 修改文件

| 文件 | 改动 |
|------|------|
| `src/plugins/other-site-plugin.tsx` | import 组件/CSS；`initCss` 追加 `preloadStatusCssRaw` 拼接；`preloadListPage` 入队前标记「排队中」+ addTask 回调标记「请求中」/拦截「匹配失败」；`preloadSite` 增 `$item` 参数，结果/异常处标记「成功匹配」/「匹配失败」；新增 `updatePreloadStatus` 幂等方法（find-or-create 状态条/徽标，jQuery 改 class/text 实时更新） |
| `vite.config.ts` | version 1.13.7→1.14.0 |
| `doc/README.md` | 文档清单新增 doc/107；CSS 计数 20→21；组件枚举新增 PreloadStatusBar/PreloadStatusBadge |
| `changelog/CHANGELOG.md` | 新增 v1.14.0 条目 |

## 4. 执行验证记录

### 4.1 类型检查

```bash
$ npx tsc -b
（无输出，退出码 0）
```

### 4.2 构建

```bash
$ npx vite build
dist/monkey-jhs-disassemble.user.js  1,882.25 kB │ gzip: 433.63 kB
✓ built in 1.46s
```

### 4.3 userscript metadata 验证

```
// @version      1.14.0
```

## 5. 后续验证建议

1. **排队中→请求中→成功匹配**：打开有 `.movie-list` 的列表页（首页/分类/
   搜索页），观察 missav 未缓存卡片的 `.video-title` 下方依次出现：
   灰色「排队中」→ 琥珀色脉冲「请求中」→ 绿色「成功匹配」
2. **匹配失败**：构造一个 missav 搜不到的番号（或断网），徽标应终态红色
   「匹配失败」
3. **串行可视化**：多卡片时同一时刻仅一个为「请求中」，其余「排队中」
4. **SupJav 无徽标**：列表页卡片不应出现 supJav 徽标（initUrl 跳过预加载）
5. **已缓存卡片**：再次刷新列表页，已成功卡片无徽标（命中缓存跳过），
   或保留上次「成功匹配」徽标
6. **瀑布流联动**：开启 autoPage 瀑布流加载新页，新 item 应自动出现徽标
   并走完状态流转
7. **不影响详情页**：打开详情页，missav 按钮颜色/缓存命中行为不变
