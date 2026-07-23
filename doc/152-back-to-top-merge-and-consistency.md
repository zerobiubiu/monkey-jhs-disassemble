# doc/152 — 合并两套返回顶部控件 + 一致性修复

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

批次 5（UI/UX V2）项「合并两套返回顶部控件，建立统一 overlay 层级」。

项目中存在两套返回顶部按钮：
1. `#jhs-back-to-top`（SettingPlugin，所有 javdb 页面）
2. `#jdb-wf-back-to-top`（ListWaterfallPlugin，/users/lists 页面）

SettingPlugin 在所有 javdb 页面（包括 /users/lists）注入返回顶部按钮，
ListWaterfallPlugin 的按钮始终是重复的。

## 方案

ListWaterfallPlugin.createBackToTopBtn() 开头添加检查：

```typescript
if (document.getElementById('jhs-back-to-top')) return;
```

SettingPlugin 的按钮已存在时跳过创建，避免重复。

## 实施

| 文件 | 操作 |
|------|------|
| `src/plugins/list-waterfall-plugin.ts` | 修改：createBackToTopBtn 添加 #jhs-back-to-top 存在检查 |
| `package.json` | 修改：version 1.27.5 → 1.27.8（与 vite.config.ts 同步） |

## 执行验证记录

```
$ bun run build
tsc -b && vite build
✓ 229 modules transformed.
dist/monkey-jhs-disassemble.user.js  2,023.41 kB │ gzip: 467.07 kB
✓ built in 1.20s
```

tsc 零错误。产物 +0.05 kB。
