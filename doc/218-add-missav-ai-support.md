# 新增 MissAV 站点支持 missav.ai

> **文档类型**：🔧 开发指导
> **文档状态**：✅ 已执行
> **版本**：1.40.0 → 1.40.1

## 1. 背景

用户提出 MissAV 站点新增 `missav.ai` 域名支持，要求与 `missav.ws` 完全一致
（即脚本在 missav.ai 上正常运行 missav 专属插件：状态标签 + 快速复制）。

## 2. 方案

MissAV 站点识别与执行范围由两处控制，两处同步新增 `ai`：

1. **站点判定**（`src/constants/site.ts`）：`isMissavSite` 正则
   `/missav\.(ws|live|com)/` → `/missav\.(ws|live|com|ai)/`，控制
   `main.tsx` 的 `if (isMissavSite)` 块注册 MissavStatusTagPlugin /
   MissavQuickCopyPlugin，以及 `page-context.ts` 的 site 判定。
2. **脚本执行范围**（`vite.config.ts`）：`userscript.match` 增加
   `https://missav.ai/*`，否则 Tampermonkey 不会在 missav.ai 注入脚本。

无需其他改动，理由：

- missav 两个插件（`missav-quick-copy-plugin.tsx` / `car-status-sync/`）均
  无对该站域名的网络请求（跨站同步走 GM 存储，零网络请求），`@connect`
  无需新增（且 connect 已含 `'*'` 通配）；
- 插件内无硬编码 missav 域名，handle() 内按 pathname/DOM 选择器守卫，
  与域名无关。

## 3. 实施（修改文件清单）

| 文件 | 变更 |
|------|------|
| `src/constants/site.ts` | `isMissavSite` 正则新增 `ai` |
| `vite.config.ts` | `match` 增加 `https://missav.ai/*`；version 1.40.0→1.40.1（小改动，patch） |
| `README.md` | 「支持站点」表 MissAV 行增加 `missav.ai` |
| `doc/218-add-missav-ai-support.md` | 本文档 |

## 4. 执行验证记录

### 执行环境

Windows + Bun，本项目构建链。

### 验证命令

```text
$ bun run build
```

### 实际输出

```text
dist/monkey-jhs-disassemble.user.js  2,179.57 kB │ gzip: 504.75 kB
✓ built in 1.42s
（lightningcss IE hack 警告为 layer.css 已知无害项，vite.config.ts 有注释说明）
```

产物头部确认：

```text
// @version      1.40.1
// @match        https://missav.ai/*
```

### 前端或调用方验证

无独立前端；产物 userscript 头部的 `@match` 与 `@version` 已核对。

### 验证结论

✅ 通过。`tsc -b` 与 `vite build` 均通过，产物含 `@match https://missav.ai/*`
与 `@version 1.40.1`。

### 已知限制

- 需用户在 Tampermonkey 重新安装/更新脚本后，在 missav.ai 页面实测
  状态标签与快速复制功能（本环境无法打开真实站点验证）。