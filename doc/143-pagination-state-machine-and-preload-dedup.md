# doc/143 — 瀑布流分页状态机 + 外站预加载去重/LRU

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

批次 3（Runtime V2）的最后两个项目：
1. 瀑布流自动与手动加载共用分页状态机，保证有下一页时按钮持续存在
2. 外站预加载增加 keyed 去重、负缓存、LRU 和容量限制

## 方案

### 1. PaginationStateMachine（src/core/pagination-state.ts）

将 auto-page-plugin 中散落的 `hasMore`/`isLoading` 布尔标志
替换为正式的状态机：

```
idle ──startLoading()──→ loading ──loadSuccess(hasMore)──→ idle/exhausted
  ↑                         │
  │                    loadError()
  │                         ↓
  └──────retry()─────── error
```

| 状态 | 含义 | CSS 类 |
|------|------|--------|
| idle + hasMore + auto | 等待触底自动加载 | （无） |
| idle + hasMore + click | 等待用户点击 | waterfall-click |
| loading | 正在加载 | waterfall-loading |
| error | 加载失败，可重试 | waterfall-error |
| exhausted | 无更多页面 | waterfall-no-more |

API：
- `init(hasMore)` — 初始化
- `startLoading(): boolean` — idle → loading（返回 false 表示不可加载）
- `loadSuccess(hasMore)` — loading → idle/exhausted
- `loadError()` — loading → error
- `retry()` — error → idle
- `canLoad` / `hasMore` / `isLoading` — 只读属性

### 2. auto-page-plugin 重构

- 移除 `hasMore`/`isLoading` 字段
- 添加 `private pagination = new PaginationStateMachine()`
- 14 处引用替换为状态机调用
- click handler 中添加 `retry()` 支持错误恢复
- catch block 中使用 `loadError()` 替代 `hasMore = false`

### 3. 外站预加载 keyed 去重

`other-site-plugin` 新增 `inflightPreloads: Map<string, Promise<void>>`：

```typescript
const dedupeKey = `${carNum}_${siteConfig.id}`;
const existing = this.inflightPreloads.get(dedupeKey);
if (existing) return existing;  // 复用 in-flight Promise
const promise = this.doPreloadSite(carNum, siteConfig, $item);
this.inflightPreloads.set(dedupeKey, promise);
try { await promise; } finally { this.inflightPreloads.delete(dedupeKey); }
```

原 `preloadSite` 方法体重命名为 `doPreloadSite`，
新的 `preloadSite` 作为去重包装。

### 4. LRU 缓存淘汰

`PRELOAD_CACHE_MAX = 5000`：写入缓存前检查条目数，
超出时按 `ts` 排序淘汰最旧条目（无 `ts` 旧格式优先淘汰）。

## 实施（修改文件清单）

| 文件 | 操作 |
|------|------|
| `src/core/pagination-state.ts` | 新建 |
| `src/plugins/auto-page-plugin.ts` | 修改：状态机替代布尔标志 |
| `src/plugins/other-site-plugin.tsx` | 修改：keyed 去重 + LRU 淘汰 |
| `AGENTS.md` | 修改：§3.4 核心模块表新增 pagination-state.ts |

## 执行验证记录

```
$ bun run build
tsc -b && vite build
✓ 225 modules transformed.
dist/monkey-jhs-disassemble.user.js  2,015.53 kB │ gzip: 465.16 kB
✓ built in 1.19s
```

tsc 零错误。产物 +2.01 kB（状态机 + 去重/LRU 逻辑）。

## 批次 3 完成总览

| 文档 | 内容 |
|------|------|
| doc/139 | PageContext + TaskSupervisor + 页面过滤 + destroy |
| doc/140 | 19 个插件 pageTypes 声明 |
| doc/141 | 5 个插件 TaskSupervisor 迁移 |
| doc/142 | TaskSupervisor 全量完成（9 插件）+ ListDomBus |
| doc/143 | PaginationStateMachine + 预加载去重/LRU |
