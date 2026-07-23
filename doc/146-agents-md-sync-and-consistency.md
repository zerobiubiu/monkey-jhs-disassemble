# doc/146 — AGENTS.md 架构文档同步 + 代码一致性修复

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

doc/130-145 完成了大量架构变更（Runtime V2 基础设施、版本化迁移、
StorageRevision、无障碍、GM 类型化），但 AGENTS.md 的架构描述仍停留在
旧版本。代码一致性审计发现 15 处不一致，其中 2 处需要修复。

## 方案

### 1. AGENTS.md §3.1 启动序列更新

旧版 14 步 → 新版 17 步：

| 步骤 | 变更 |
|------|------|
| 2 | CSS 注入新增 accessibility.css |
| 9 | 插件数 33 → 40（38 javdb + 2 missav） |
| 10 | **新增**：页面判定先于 processCss（initPageContext） |
| 11 | processCss 按 pageTypes 过滤 |
| 12 | 6 个迁移调用 → `runMigrations()` 单次调用 |
| 13 | **新增**：storageRevision.init() + onRemoteChange() |
| 14 | processPlugins 按 pageTypes 过滤 |
| 16 | **新增**：registerDiagnosticsMenu() |
| 17 | **新增**：beforeunload → destroyAll() |

### 2. AGENTS.md §3.2 插件系统更新

BasePlugin 新增：`get sites()` / `get pageTypes()` / `destroy()`
PluginManager 新增：`matchesPage()` / `destroyAll()` / 诊断含耗时

### 3. 代码一致性修复

| 文件 | 修复 |
|------|------|
| `top250-plugin.tsx` | getName() 返回 `'Top250Plugin'`（对齐 PluginMap 键） |
| `main.tsx` L277 | 插件计数注释 35 → 40（38 javdb + 2 missav） |

### 4. 不修复项（审计误报 / cosmetic）

| 项目 | 原因 |
|------|------|
| list-waterfall-plugin pageTypes | **误报**：该插件运行在 `/users/lists`（pageType='unknown'），声明 `['list']` 会导致插件被跳过。ALLOWED_PATHS 路径守卫是正确的过滤机制 |
| catch 块变量命名混用 | cosmetic，5 种命名风格不影响功能 |
| 私有方法 _ 前缀 vs private | cosmetic，两种风格均合理 |
| constants/site.ts camelCase | 运行时计算值用 camelCase 是合理的（区别于字面量常量） |

## 实施（修改文件清单）

| 文件 | 操作 |
|------|------|
| `AGENTS.md` | 修改：§3.1 启动序列 + §3.2 插件系统 |
| `src/plugins/top250-plugin.tsx` | 修改：getName() 对齐 |
| `src/main.tsx` | 修改：插件计数注释 |

## 执行验证记录

```
$ bun run build
tsc -b && vite build
✓ 228 modules transformed.
dist/monkey-jhs-disassemble.user.js  2,018.33 kB │ gzip: 466.02 kB
✓ built in 1.19s
```

tsc 零错误。产物无变化（纯注释/文档修改）。
