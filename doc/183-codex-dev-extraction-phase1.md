# doc/183 — codex-dev 提取 Phase 1：P0 修复 + P1 前置

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

基于 codex-dev 分支交叉审计（详见对话记录），按优先级提取 P0 + P1 前置改动。

## 提取内容

### P0-C：详情页清单面板超时保护
- **问题**：`ensureListPanel` 以 400ms 间隔无限递归等待 `#otherSiteBox`，OtherSite 插件未启用时永久卡住
- **修复**：添加 `DETAIL_DOM_WAIT_TIMEOUT_MS = 15_000` 常量；超时后回退挂载到 nav 末尾 + `clog.warn` 日志
- **文件**：`src/plugins/detail-page-button/dpb-list-panel.tsx`

### P0-J：@noframes 用户脚本头
- **问题**：脚本可在 iframe 内执行，扩大攻击面
- **修复**：vite.config.ts 添加 `noframes: true`
- **文件**：`vite.config.ts`

### P1 前置：导出安全函数
- **问题**：`escapeText`/`escapeAttr`/`sanitizeUrl` 为 jsx-to-string 内部函数，插件无法调用
- **修复**：添加 `export` 关键字，使插件可直接使用这些安全函数进行 URL 校验和 HTML 转义
- **文件**：`src/core/jsx-to-string.ts`

## 实施清单

| 文件 | 操作 |
|------|------|
| src/plugins/detail-page-button/dpb-list-panel.tsx | 添加 15s 超时 + nav 回退挂载 |
| vite.config.ts | 添加 noframes: true |
| src/core/jsx-to-string.ts | export escapeText + escapeAttr + sanitizeUrl |

## 验证

tsc 0 错 / vitest 28/28 / eslint 0 错 / stylelint 干净 / check:structure OK。
