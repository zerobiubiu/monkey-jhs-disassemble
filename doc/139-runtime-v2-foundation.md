# doc/139 — Runtime V2 基础设施

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

用户实施计划批次 3（Runtime V2: v2.0.0）要求：
- 新增 `PageContext`、`RuntimeServices`、`PluginDefinition`、`TaskSupervisor`
- 插件声明站点、页面类型、依赖、样式、启动和销毁函数
- 页面类型在 CSS 和插件初始化前确定；未匹配插件不实例化、不注入 CSS
- 后台 Promise、Observer、定时器和事件统一受 `AbortSignal` 管理

完整的 40 插件迁移是多会话工作。本轮建立核心基础设施，所有变更向后兼容
（空 sites/pageTypes = 匹配所有，destroy() 默认空实现）。

## 方案

### 1. PageContext（src/core/page-context.ts）

将原 main.tsx 启动序列中散落的页面判定逻辑提取为独立模块：

```typescript
export interface PageContextResult {
    site: SiteType;           // 'javdb' | 'missav' | 'unknown'
    pageType: PageType;       // 'detail' | 'list' | 'fc2' | 'unknown'
    isDetailPage: boolean;
    isListPage: boolean;
    isFc2Page: boolean;
    isJavdbSite: boolean;
    isMissavSite: boolean;
}

export function detectPageContext(): PageContextResult;
export let pageContext: PageContextResult;  // 全局单例
export function initPageContext(): PageContextResult;  // main.tsx 调用一次
```

### 2. TaskSupervisor（src/core/task-supervisor.ts）

AbortSignal 统一生命周期管理：

```typescript
class TaskSupervisor {
    get signal(): AbortSignal;
    setTimeout(fn, ms): number;       // abort 时自动 clearTimeout
    setInterval(fn, ms): number;      // abort 时自动 clearInterval
    observe(target, cb, opts): MutationObserver;  // abort 时 disconnect
    addEventListener(target, type, listener, opts): void;  // abort 时 remove
    abort(): void;                    // 幂等，一次性清理所有资源
}
```

插件 opt-in 使用（不强制，向后兼容）：

```typescript
class MyPlugin extends BasePlugin {
    private supervisor = new TaskSupervisor();
    async handle() {
        this.supervisor.setTimeout(() => this.doSomething(), 2000);
        this.supervisor.observe(document.body, this.onMutation, { childList: true });
    }
    destroy() {
        this.supervisor.abort();
    }
}
```

### 3. BasePlugin 增强

```typescript
class BasePlugin {
    get sites(): SiteType[] { return []; }      // 空 = 所有站点
    get pageTypes(): PageType[] { return []; }  // 空 = 所有页面类型
    destroy(): void {}                          // 销毁钩子
}
```

### 4. PluginManager 增强

```typescript
class PluginManager {
    private matchesPage(plugin): boolean;  // 按 pageTypes 过滤
    destroyAll(): void;                    // 调用所有插件的 destroy()
}
```

`processCss()` 和 `processPlugins()` 中，不匹配当前 pageType 的插件
返回 `{ status: 'skipped' }`，不执行 initCss/handle。

### 5. main.tsx 启动序列重排

```
之前：processCss → 页面判定 → 迁移 → processPlugins
之后：页面判定 → processCss → 迁移 → processPlugins → beforeunload(destroyAll)
```

页面判定先于 processCss，使 PluginManager 在 CSS 注入时即可按 pageType 过滤。
window.isDetailPage/isListPage/isFc2Page 保持挂载（向后兼容）。

## 实施（修改文件清单）

| 文件 | 操作 |
|------|------|
| `src/core/page-context.ts` | 新建 |
| `src/core/task-supervisor.ts` | 新建 |
| `src/plugins/base-plugin.ts` | 修改：sites/pageTypes/destroy |
| `src/plugins/plugin-manager.ts` | 修改：matchesPage/destroyAll |
| `src/main.tsx` | 修改：启动序列重排 + beforeunload |
| `AGENTS.md` | 修改：§3.4 核心模块表新增 2 行 |

## 执行验证记录

```
$ bun run build
tsc -b && vite build
✓ 225 modules transformed.
dist/monkey-jhs-disassemble.user.js  2,010.04 kB │ gzip: 463.75 kB
✓ built in 1.17s
```

tsc 零错误。产物 +1.25 kB（2 个新模块 + 过滤逻辑）。

## 后续迁移路径

1. 逐插件添加 `pageTypes` 声明（如 DetailPagePlugin → `['detail']`）
2. 逐插件将 setTimeout/MutationObserver 迁移到 TaskSupervisor
3. 逐插件实现 `destroy()` 清理资源
4. 最终移除 `window.isDetailPage` 等全局标志，统一使用 `pageContext`
