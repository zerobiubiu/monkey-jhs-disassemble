# doc/186 — 回退 @noframes（视频流 iframe 详情页回归修复）

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

v1.28.23 的 P0-J 依 codex-dev 安全加固在 vite.config.ts 的 userscript 元数据中加入 `noframes: true`（即 `@noframes`，禁止脚本在任何 iframe 内运行）。

但本项目的「视频流」功能会在 iframe 内打开视频详情页，且该 iframe 内的详情页**需要本脚本运行**（注入增强功能）。`@noframes` 使脚本在该 iframe 内完全不加载，导致视频流打开的 iframe 视频详情页失效（回归）。

## 修复

删除 vite.config.ts 中的 `noframes: true`，恢复脚本在匹配 iframe 内的执行。

## 安全权衡说明

codex-dev 加 `@noframes` 的意图是缩小攻击面（避免脚本在页面内任意 iframe 中执行）。但本脚本的 `@match` 已把执行范围限定在 javdb.com / missav.ws / missav.live 等源，页面内匹配这些源的第三方 iframe 极少；`@noframes` 带来的边际安全收益不足以抵消破坏视频流功能。故回退。

附注：v1.28.24 的 K（unsafeWindow→window 收敛）保留了 iframe 内继承父窗口 `clog` 的逻辑（`window.clog = unsafeWindow.parent.clog`）；该逻辑在 `@noframes` 下为死代码，回退 `@noframes` 后重新按预期生效——iframe 内复用父页日志面板。

## 实施清单

| 文件 | 操作 |
|------|------|
| vite.config.ts | 删除 `noframes: true` |

## 验证

tsc 0 错 / vitest 28/28 / eslint 0 错 / check:structure OK；构建产物 userscript 头部不含 `@noframes`。
