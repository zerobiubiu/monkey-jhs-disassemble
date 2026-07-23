# doc/149 — BasePlugin.pluginManager 类型化

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

`BasePlugin.pluginManager` 字段声明为 `any`，所有 40 个插件通过
`this.pluginManager` 访问 PluginManager 时无类型检查。
这是 ESLint `no-explicit-any` 警告的来源之一。

## 方案

```typescript
// 之前
pluginManager: any = null;

// 之后
import type { PluginManager } from './plugin-manager';
pluginManager!: PluginManager;
```

使用 definite assignment assertion（`!`）因为该字段在
`PluginManager.register()` 中注入，不在构造函数中初始化。

## 实施

| 文件 | 操作 |
|------|------|
| `src/plugins/base-plugin.ts` | 修改：`pluginManager: any = null` → `pluginManager!: PluginManager` + `import type` |

## 执行验证记录

```
$ bun run build
tsc -b && vite build
✓ 229 modules transformed.
dist/monkey-jhs-disassemble.user.js  2,022.45 kB │ gzip: 466.86 kB
✓ built in 1.21s

$ bun run lint
✖ 805 problems (0 errors, 805 warnings)
```

tsc 零错误。ESLint 警告 806→805（消除 1 个 `no-explicit-any`）。
