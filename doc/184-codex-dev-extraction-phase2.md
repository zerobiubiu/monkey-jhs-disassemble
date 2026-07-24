# doc/184 — codex-dev 提取 Phase 2：XSS / URL / 沙箱加固

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

基于 codex-dev 分支交叉审计，按优先级提取 P1/P2 安全加固项。

## 已提取

### E1 日志 XSS 中和
- `logger.tsx` 的 `addLog` 不再内嵌链接化 HTML，`entry.message` 始终保存原始文本；URL 链接化推迟到渲染期。
- `logger-log-entry.tsx` 以 `linkifySafe` 将消息切分为文本段与 URL 段：文本段作为普通 JSX 子节点（`jsxToString` 自动转义 `&`/`<`/`>`，XSS 在此被中和），URL 段经 `sanitizeUrl` 净化后渲染为 `<a target="_blank" rel="noopener noreferrer">`。彻底消除 `dangerouslySetInnerHTML`。
- 公共 API（`log`/`warn`/`error`/`debug`/`addLog`）签名不变（仍接收 `string`，60+ 调用点零改动）；localStorage 持久化格式不变；§9.2 console 分层不变（仅 `error` 转发 `console.error`，`log`/`warn`/`debug` 仅面板，无 `.info`）。
- `logger-panel.tsx` 经 `jsxToString(<LoggerLogEntry/>)` 渲染（path a），无需改动。

### E2 tooltip innerHTML → textContent
- 全量 grep 确认所有 `data-tip` 来源均为纯文本（静态串 / 数字插值 / 关键词 / 演员名），故 `tooltip.ts` 的 `innerHTML` 改为 `textContent`。

### F 出站链接 / URL 加固
- 消灭 `javascript:` 注入：`missav-renderer.ts` 用 `sanitizeUrl` 校验，缺失/非法时 `removeAttribute('href')` 使其不可导航；`section-error-message.tsx` 删除硬编码 `href='javascript:;'`（重试由外部 jQuery 按 id 绑定，href 仅装饰）。
- `encodeURIComponent`：`api.ts` 的 movieId 路径与查询、`fc2`/`history`/`nav-bar`/`screenshot` 的查询值。
- `noopener,noreferrer`：`fc2`/`history`/`nav-bar`/`screenshot`/`list-page-button`/`lp-dom` 的 `window.open`。

### K unsafeWindow 收敛
- `main.tsx` 将 `utils`/`loadGfriends`/`filetreeDb`/`loading`/`show`/`clog` 的 `unsafeWindow` 写入收敛到沙箱 `window`（其中 `utils`/`loadGfriends`/`filetreeDb` 原为冗余赋值，直接删除该行；`loading`/`show`/`clog` 改链式赋值目标）。grep 确认 `src` 无 `unsafeWindow.<name>` 读取；保留 `unsafeWindow.parent.clog` 的父框架读取。`grant` 列表保留 `unsafeWindow`。

## 延后项（需 good 模型 / 人工复核；非回归）

- `review-item.tsx` 评论正文（来自 JavDB API 的非可信 HTML）的 `dangerouslySetInnerHTML` 消除：正确实现需 `DOMParser` 遍历（保留 text/`<a>`/`<br>`、剥离其余标签）。直接复用 logger 的 `linkifySafe` 不适用——它会把 `<br>`/`<b>` 等转义为字面文本，导致评论排版错乱（可见回归）。该 XSS 面为**既有**状态（非本次引入），故延后至 good 模型配额恢复或人工复核实现，避免用 fast 模型编写 DOM 遍历引入渲染 bug。`stars` 为调用方生成的可信 `<i>` 标记，保留 `dangerouslySetInnerHTML` 安全。

## 实施清单

| 文件 | 操作 |
|------|------|
| src/core/logger.tsx | addLog 存原始文本，移除链接化 |
| src/components/log/logger-log-entry.tsx | linkifySafe 渲染，去 dangerouslySetInnerHTML |
| src/core/tooltip.ts | innerHTML → textContent |
| src/plugins/car-status-sync/missav-renderer.ts | sanitizeUrl + 不可导航回退 |
| src/components/shared/section-error-message.tsx | 删 javascript:; href |
| src/constants/api.ts | movieId encodeURIComponent |
| src/plugins/fc2-plugin.tsx | encodeURIComponent + noopener |
| src/plugins/history-plugin.tsx | encodeURIComponent + noopener |
| src/plugins/nav-bar-plugin.tsx | encodeURIComponent + noopener |
| src/plugins/screenshot-plugin.tsx | encodeURIComponent + noopener |
| src/plugins/list-page-button-plugin.tsx | noopener |
| src/plugins/list-page/lp-dom.ts | noopener |
| src/main.tsx | unsafeWindow → window 收敛 |
| src/types/globals.d.ts | 注释更新 |

## 验证

tsc 0 错 / vitest 28/28 / eslint 0 错 / stylelint 干净 / check:structure OK。
