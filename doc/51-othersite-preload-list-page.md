# 51 - OtherSitePlugin 列表页预加载缓存

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 1. 背景

### 1.1 问题

OtherSitePlugin 的 missav/supjav 跳转按钮只在**详情页打开后**才开始请求
解析搜索结果（`handle()` 仅 `isDetailPage` 时触发 `loadOtherSite()`）。
用户在列表页浏览时，每个 item 的番号都是已知的，但预加载缓存为空——
用户点进详情页后还要等请求完成才能看到按钮变绿，体验不够流畅。

### 1.2 目标

在列表页（有 `.movie-list .item` 的页面）就提前预加载 missav/supjav 的
搜索结果缓存，用户后续打开详情页时直接命中缓存、零延迟显示结果。

## 2. 方案

### 2.1 核心设计

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 触发时机 | `handle()` 中 `isListPage` 分支 + MutationObserver 监听新 item | 列表页初始加载 + autoPage 瀑布流新页都覆盖 |
| 番号提取 | 复用 `ListPagePlugin.findCarNumAndHref()` | 不重复造轮子，保证番号提取逻辑一致 |
| 限流策略 | `AsyncTaskQueue` 串行执行 | 避免洪水请求触发 Cloudflare 封禁（列表页 20-40 item × 2 站点 = 40-80 请求） |
| 缓存复用 | `jhs_other_site` localStorage 同键同值 | 详情页 `handleSite` 查缓存命中直接回填，零修改 |
| 跳过策略 | 跳过已缓存 + 跳过 data-hide 屏蔽 item | 避免重复请求 + 减少不必要请求（屏蔽的 item 用户不可见） |
| 未命中不缓存 | 与 `handleSite` 一致 | 避免缓存"未找到"结果导致后续永远不重试 |
| 渲染 | 不渲染按钮（纯缓存预热） | 按钮在详情页渲染，列表页只写缓存 |
| autoPage | MutationObserver 监听 `.movie-list` childList + 500ms 防抖 | 新页 append 后自动预加载新 item |

### 2.2 预加载流程

```
列表页加载
  → OtherSitePlugin.handle() 检测 isListPage
    → preloadListPage()
      → 遍历 .movie-list .item
        → ListPagePlugin.findCarNumAndHref($item).carNum 提取番号
        → 跳过 data-hide 屏蔽的 item
        → 对每个启用站点：检查 jhs_other_site 缓存
          → 已缓存 → 跳过
          → 无缓存 → 入队 AsyncTaskQueue
    → startPreloadObserver()
      → MutationObserver 监听 .movie-list childList
      → autoPage append 新页 → 500ms 防抖 → preloadListPage()（跳过已缓存）

AsyncTaskQueue 串行执行预加载任务
  → preloadSite(carNum, siteConfig)
    → gmHttp.get(搜索页) → 解析 DOM → 提取详情链接
    → 写入 jhs_other_site 缓存（单结果/多结果）
    → 失败静默处理（下次打开详情页会重试）

用户打开详情页
  → OtherSitePlugin.handle() 检测 isDetailPage
    → loadOtherSite() → handleSite()
      → 查 jhs_other_site 缓存 → 命中 → 直接回填按钮（零延迟、零请求）
```

### 2.3 冲突排查

| 冲突类型 | 表现 | 协调策略 |
|----------|------|----------|
| MutationObserver 互相触发 | 本插件 preloadObserver 监听 `.movie-list` childList，ListPagePlugin.checkDom 也监听同一容器 | 本插件 preloadObserver **只读不写 DOM**（preloadListPage 只读 item 番号 + 写 localStorage，不改 DOM），不会触发 checkDom observer；checkDom 的 doFilter/sortItems 改 DOM 会触发 preloadObserver，但 500ms 防抖后 preloadListPage 跳过已缓存的，无副作用 |
| 请求洪水 | 列表页 20-40 item × 2 站点 = 40-80 请求 | AsyncTaskQueue 串行限流，一个接一个 |
| 与详情页逻辑重复 | preloadSite 与 handleSite 都请求搜索页+解析+写缓存 | preloadSite 不操作按钮 DOM，只写缓存；handleSite 查缓存命中后不请求。两者互补不冲突 |

## 3. 实施

### 3.1 修改文件

| 文件 | 改动 |
|------|------|
| `src/plugins/other-site-plugin.tsx` | 新增 4 个类字段（preloadQueue/preloadObserver/preloadDebounce/PRELOAD_LOG）；`handle()` 增加 isListPage 分支；新增 `preloadListPage()`/`preloadSite()`/`startPreloadObserver()` 三个方法 |

### 3.2 新增方法

| 方法 | 职责 |
|------|------|
| `preloadListPage()` | 遍历 .item 提取番号，检查缓存，无缓存的入队限流预加载 |
| `preloadSite(carNum, siteConfig)` | 纯缓存预热：请求搜索页 → 解析 → 写缓存（不操作按钮 DOM） |
| `startPreloadObserver()` | MutationObserver 监听 .movie-list 新 item（autoPage），500ms 防抖后 preloadListPage |

## 4. 执行验证记录

### 4.1 类型检查

```bash
$ npx tsc -b
（无输出，退出码 0）
```

### 4.2 构建

```bash
$ npx vite build
dist/monkey-jhs-disassemble.user.js  1,818.98 kB │ gzip: 415.90 kB
✓ built in 1.18s
```

构建成功。产物 1818.98 kB（gzip 415.90 kB），较 doc/50 基线 1815.46 kB
（gzip 415.25 kB）+3.52 kB（gzip +0.65 kB），为预加载逻辑的合理增量。

## 5. 后续

### 运行时验证建议

1. **列表页预加载**：打开 javdb 列表页 → 控制台应显示 `[OtherSite 预加载] 列表页 N 个 item，入队 M 个预加载任务` → 检查 localStorage `jhs_other_site` 逐渐填充
2. **详情页缓存命中**：预加载完成后打开详情页 → missav/supjav 按钮应立即变绿（零延迟、零请求）
3. **autoPage 新页**：开启 autoPage 瀑布流 → 滚动加载新页 → 控制台应再次显示预加载日志（仅新 item）
4. **限流**：观察网络面板，预加载请求应串行执行（一个接一个），不并发
5. **屏蔽 item 跳过**：屏蔽某些卡片 → 预加载任务数应减少（跳过 data-hide 的 item）
6. **已缓存跳过**：刷新列表页 → 预加载任务数应为 0（全部已缓存）
