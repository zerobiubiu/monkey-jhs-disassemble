# doc/142 — TaskSupervisor 全量迁移完成 + ListDomBus

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

doc/141 完成了 5 个插件的 TaskSupervisor 迁移。本轮完成剩余 4 个
资源密集型插件的迁移（累计 9 个），并创建 ListDomBus 列表页
DOM 变更总线。

## 方案

### 1. TaskSupervisor 全量迁移（4 个插件）

| 插件 | 迁移的资源 |
|------|-----------|
| list-page-plugin | checkDom MutationObserver（保留 disconnect/reconnect 模式） |
| list-reading-status-plugin | MutationObserver + 7 个 addEventListener（svg click/mouseenter、container mouseleave、select change、chip click、sortSelect change、reset click） |
| modal-list-disabler-plugin | body MutationObserver（childList + subtree） |
| list-waterfall-plugin | scroll/click addEventListener + setTimeout |

所有 4 个插件实现 `destroy()` → `supervisor.abort()`。
write-only 的 `this.observer` 字段已移除。

### 2. ListDomBus（src/core/list-dom-bus.ts）

列表页 DOM 变更总线，集中管理 .movie-list 容器的 MutationObserver：

```typescript
class ListDomBus {
    onItemsAdded(handler: (addedItems: Element[]) => void): void;
    offItemsAdded(handler): void;
    start(container: Element): void;
    stop(): void;
}
```

设计特点：
- **单 Observer**：替代各插件各自创建独立 Observer
- **rAF 批量分发**：新增节点累积到 pendingNodes，requestAnimationFrame 内一次性分发
- **片段支持**：瀑布流 append 整页 HTML 时，自动提取片段内所有 .item
- **异常隔离**：一个 handler 失败不影响其他 handler
- **幂等 stop**：多次调用安全

### 3. 迁移总览

| 轮次 | 插件 | 文档 |
|------|------|------|
| doc/141 | visit-history, auto-page, status-tag-filter, page-sort, other-site | 5 个 |
| doc/142 | list-page, list-reading-status, modal-list-disabler, list-waterfall | 4 个 |
| **累计** | **9 个插件** | 所有资源密集型插件 |

未迁移的 31 个插件主要以 jQuery .on() 为主（由 jQuery 管理生命周期），
无原生 Observer/定时器/事件监听器需要迁移。

## 实施（修改文件清单）

| 文件 | 操作 |
|------|------|
| `src/plugins/list-page-plugin.tsx` | 修改：supervisor 迁移 + destroy |
| `src/plugins/list-reading-status-plugin.ts` | 修改：supervisor 迁移 + destroy + 移除 write-only 字段 |
| `src/plugins/modal-list-disabler-plugin.ts` | 修改：supervisor 迁移 + destroy + 移除 write-only 字段 |
| `src/plugins/list-waterfall-plugin.ts` | 修改：supervisor 迁移 + destroy |
| `src/core/list-dom-bus.ts` | 新建 |
| `AGENTS.md` | 修改：§3.4 核心模块表新增 list-dom-bus.ts |

## 执行验证记录

```
$ bun run build
tsc -b && vite build
✓ 225 modules transformed.
dist/monkey-jhs-disassemble.user.js  2,013.52 kB │ gzip: 464.63 kB
✓ built in 1.19s
```

tsc 零错误。产物 +0.39 kB（ListDomBus 模块）。
