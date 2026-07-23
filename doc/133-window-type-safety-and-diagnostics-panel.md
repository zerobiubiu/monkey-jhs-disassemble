# doc/133 — (window as any) 类型安全清扫 + 诊断模块提取 + 设置面板诊断

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

doc/132 建立了 PluginMap 类型注册表，但项目中仍有 56 处 `(window as any).`
类型断言。其中 40 处是页面标志（isDetailPage/isListPage/isFc2Page）和
全局函数（cleanCache_*/filetreeDb/showImageViewer）的访问——这些属性
已在 main.tsx 的 `declare global { interface Window }` 中声明了精确类型，
`(window as any)` 断言完全多余且绕过了类型检查。

同时 doc/132 的插件诊断 UI 内联在 main.tsx（25 行 layer.open + HTML 模板），
不符合入口文件的职责边界。

## 方案

### 1. (window as any) 类型安全清扫

对 src/plugins/ 和 src/core/ 下所有 .ts/.tsx 文件执行文本替换：

| 模式 | 替换为 | 处数 |
|------|--------|------|
| `(window as any).isDetailPage` | `window.isDetailPage` | ~15 |
| `(window as any).isListPage` | `window.isListPage` | ~10 |
| `(window as any).isFc2Page` | `window.isFc2Page` | ~2 |
| `(window as any).cleanCache_filter_actor_actress_car_list()` | `window.cleanCache_...()` | 2 |
| `(window as any).clean_cacheSettingObj()` | `window.clean_cacheSettingObj()` | 2 |
| `(window as any).filetreeDb` | `window.filetreeDb` | 1 |
| `(window as any).showImageViewer(...)` | `window.showImageViewer(...)` | 1 |

**剩余 16 处**（不在 Window 接口中，需单独评估）：
- `_jquery-global.ts`：`(window as any).jQuery = $` / `.$ = $`（挂载第三方库）
- `layer-wrapper.ts`：`(window as any).utils?.layerIndexStack`（动态属性）
- `setting-plugin.tsx`：`(window as any).imageHoverPreviewObj` / `.encryptCredential` 等
- 注释中的引用（不影响编译）

### 2. 诊断模块提取

**新建 `src/core/plugin-diagnostics.ts`**：

- `renderDiagnosticsHtml(pluginManager)` — 渲染状态表格 HTML
- `renderDiagnosticsText(pluginManager)` — 生成纯文本报告（供剪贴板）
- `registerDiagnosticsMenu(pluginManager)` — 注册 GM_registerMenuCommand

**main.tsx**：25 行内联代码 → 1 行 `registerDiagnosticsMenu(pluginManager)`。

### 3. 设置面板「📊 插件诊断」

按 AGENTS.md §4 设置弹窗架构添加：

- **setting-dialog.tsx**：侧栏新增 `📊 插件诊断` 菜单项（data-panel="diagnostics-panel"）+
  内容面板（`#diagnostics-content` 容器 + `#copy-diagnostics-btn` 复制按钮）
- **setting-plugin.tsx**：
  - bindClick 新增 `diagnostics-panel` 分支（隐藏 saveBtn/clean-all + 调用 refreshDiagnostics）
  - 新增 `refreshDiagnostics()` 方法（渲染诊断表格到面板）
  - 绑定复制按钮（`renderDiagnosticsText` → `navigator.clipboard.writeText`）

## 实施（修改文件清单）

| 文件 | 操作 | 说明 |
|------|------|------|
| 20+ 个 plugins/core 文件 | 修改 | (window as any) → typed window.* |
| `src/core/plugin-diagnostics.ts` | 新建 | 诊断渲染 + 菜单注册 |
| `src/main.tsx` | 修改 | 内联诊断 → 模块调用 |
| `src/components/setting-dialog.tsx` | 修改 | 新增诊断面板 |
| `src/plugins/setting-plugin.tsx` | 修改 | 面板事件绑定 + refreshDiagnostics |

## 执行验证记录

```
$ bun run build
tsc -b && vite build
✓ 222 modules transformed.
dist/monkey-jhs-disassemble.user.js  1,997.80 kB │ gzip: 460.80 kB
✓ built in 1.33s
```

tsc 零错误。产物 +3.50 kB（诊断面板 UI + 复制功能）。
