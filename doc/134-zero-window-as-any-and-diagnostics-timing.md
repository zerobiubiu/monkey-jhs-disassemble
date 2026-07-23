# doc/134 — (window as any) 完全消除 + 诊断耗时统计

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

doc/133 将 `(window as any)` 从 56 处降至 16 处。剩余 16 处中：
- 10 处为代码（libs.ts 库全局挂载、_jquery-global.ts、layer-wrapper.ts、setting-plugin.tsx）
- 6 处为注释

本轮目标：代码中 `(window as any)` 归零。

## 方案

### 1. Window 接口扩展（globals.d.ts）

新增第三方库全局字段的 Window 接口声明：

```typescript
interface Window {
    jQuery: any;
    $: any;
    layer: any;
    Tabulator: any;
    Toastify: any;
    localforage: any;
    Viewer: any;
    md5: (s: string) => string;
}
```

### 2. 代码替换

| 文件 | 替换 |
|------|------|
| `core/libs.ts` | `const win = window as any; win.X = ...` → `window.X = ...`（6 处） |
| `core/_jquery-global.ts` | `(window as any).jQuery/$ = $` → `window.jQuery/$ = $` |
| `core/layer-wrapper.ts` | `(window as any).utils?.layerIndexStack` → `window.utils?.layerIndexStack`（2 处，CommonUtil 已有 layerIndexStack 字段） |
| `plugins/setting-plugin.tsx` | `(window as any).encryptCredential/decryptCredential/WebDavClient` → `window.*`（7 处，含 2 处多行拆分格式） |

### 3. 诊断耗时统计

- `Plugin` 接口新增 `durationMs?: number` 字段
- `processPlugins()` 用 `performance.now()` 记录每个插件 handle() 耗时
- `renderDiagnosticsHtml` 新增「耗时」列 + 总耗时统计
- `renderDiagnosticsText` 每行附加耗时 + 总耗时
- 新增 `escapeHtml` 防护（插件名含特殊字符时不破坏 DOM）

## 实施（修改文件清单）

| 文件 | 操作 |
|------|------|
| `src/types/globals.d.ts` | 修改：Window 接口扩展 |
| `src/core/libs.ts` | 修改：去 window as any |
| `src/core/_jquery-global.ts` | 修改：去 window as any |
| `src/core/layer-wrapper.ts` | 修改：去 window as any |
| `src/plugins/setting-plugin.tsx` | 修改：去 window as any（7 处） |
| `src/plugins/plugin-manager.ts` | 修改：durationMs + 计时 |
| `src/core/plugin-diagnostics.ts` | 修改：耗时列 + escapeHtml |
| `src/core/webdav-crypto.ts` / `src/main.tsx` | 修改：注释更新 |

## 执行验证记录

```
$ bun run build
tsc -b && vite build
✓ 222 modules transformed.
dist/monkey-jhs-disassemble.user.js  1,998.49 kB │ gzip: 461.00 kB
✓ built in 1.19s
```

tsc 零错误。`(window as any)` 代码中 0 处（grep 验证）。
