# doc/141 — TaskSupervisor 生命周期迁移

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

doc/139 创建了 `TaskSupervisor`（AbortSignal 统一生命周期管理），
doc/140 完成了 19 个插件的 pageTypes 声明。本轮将 5 个资源密集型插件
从原始 setTimeout/MutationObserver/addEventListener 迁移到 TaskSupervisor，
实现 `destroy()` 时一次性清理全部资源。

## 方案

### 迁移模式

每个插件：
1. `import { TaskSupervisor } from '../core/task-supervisor';`
2. `private supervisor = new TaskSupervisor();`
3. 原生 `setTimeout` → `this.supervisor.setTimeout`
4. 原生 `new MutationObserver` + `.observe()` → `this.supervisor.observe`
5. 原生 `addEventListener` → `this.supervisor.addEventListener`
6. `destroy(): void { this.supervisor.abort(); }`

### 迁移清单

| 插件 | 迁移的资源 | 保留的原有模式 |
|------|-----------|--------------|
| visit-history | setInterval(500ms) + pageshow/mouseenter/mouseleave/scroll/resize | forceRebind 的 removeEventListener（控制流需要） |
| auto-page | scroll/click addEventListener + 3× setTimeout | — |
| status-tag-filter | 2× MutationObserver + 3× setTimeout | clearTimeout 防抖逻辑 |
| page-sort | waitForContainer MutationObserver | sortGuard disconnect/reconnect（不兼容 supervisor 追踪） |
| other-site | 2× MutationObserver + 2× setTimeout | clearTimeout 防抖逻辑 |

### 不迁移的资源

- jQuery `.on()` 事件绑定（由 jQuery 管理）
- `GM_addValueChangeListener`（油猴 API）
- `BroadcastChannel`（跨标签页通信）
- page-sort 的 sortGuard（disconnect/reconnect 模式与 supervisor 追踪不兼容，
  在 destroy() 中手动 disconnect）

### 类型修复

迁移过程中发现并修复 3 个类型问题：
- status-tag-filter：write-only `observer` 字段移除（supervisor 管理生命周期）
- visit-history：`PageTransitionEvent` → `Event` + 内部 `as PageTransitionEvent` 断言
- other-site：write-only `preloadObserver` 字段移除 + debounce 类型 `null` → `0`

## 实施（修改文件清单）

| 文件 | 操作 |
|------|------|
| `src/plugins/visit-history-plugin.ts` | 修改：supervisor 迁移 + destroy |
| `src/plugins/auto-page-plugin.ts` | 修改：supervisor 迁移 + destroy |
| `src/plugins/status-tag-filter-plugin.ts` | 修改：supervisor 迁移 + destroy + 移除 write-only 字段 |
| `src/plugins/page-sort-plugin.ts` | 修改：supervisor 迁移 + destroy |
| `src/plugins/other-site-plugin.tsx` | 修改：supervisor 迁移 + destroy + 移除 write-only 字段 |

## 执行验证记录

```
$ bun run build
tsc -b && vite build
✓ 224 modules transformed.
dist/monkey-jhs-disassemble.user.js  2,013.13 kB │ gzip: 464.55 kB
✓ built in 1.20s
```

tsc 零错误。产物 +2.17 kB（5 个 supervisor 实例 + destroy 方法）。

## 后续迁移路径

剩余 35 个插件中，大部分无原生资源使用（jQuery .on 为主）。
后续按需迁移：
- list-page-plugin（checkDom MutationObserver）
- list-reading-status-plugin（GM_addValueChangeListener 除外）
- modal-list-disabler-plugin（body MutationObserver）
- list-waterfall-plugin（scroll 监听）
