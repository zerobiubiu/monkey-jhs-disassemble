# 修复 javdb 瀑布流被 Cloudflare 403 拦截（GM 请求改走页面 fetch）

> **文档类型**：🔧 开发指导
> **文档状态**：✅ 已执行
> **版本**：1.45.1 → 1.45.2（patch，bug 修复）
> **前置文档**：无（独立诊断驱动的修复）

## 1. 背景

用户反馈 javdb 瀑布流加载报错。现场诊断（用户浏览器实测）：

1. 列表页瀑布流 loader 显示「加载失败，点击重试」（`waterfall-error`）。
2. 页面上下文 `fetch('...?page=2', { credentials: 'include' })` 直接请求下一页
   → **200、正常解析出影片条数、非验证页**。
3. Console 捕获脚本报错：`请求失败,状态码: 403` + 响应体为 Cloudflare
   **Managed Challenge**（`<title>Just a moment...</title>`，`cType: 'managed'`）。

**根因**：瀑布流走 `gmHttp.get()`（`GM_xmlhttpRequest`），该请求缺少
`sec-ch-ua` / `sec-fetch-*` 等浏览器指纹头，被 javdb 的 Cloudflare 按
「非浏览器请求」返回 **403 + Managed Challenge**；而页面上下文 fetch 携带
浏览器指纹与 Cookie 可正常通过（用户实测 + 脚本内评分/收藏/清单同步历来走
页面 fetch 均正常佐证）。

## 2. 方案

### 2.1 新增共享工具 `src/core/util/util-fetch-html.ts`

`fetchJavdbPageHtml(url)`：同源页面 fetch（`credentials: 'include'` + `cache:
no-store` + `Accept: text/html`），行为与 vlt-reconcile 原局部 `fetchHtmlDocument`
一致：
- 仅 429/502/503/504 带退避重试（最多 3 次），其余非 2xx 直接抛错
- Cloudflare 验证页 / 登录页兜底检测抛错（`<title>` 含 cloudflare/just a moment、
  无 `<body>`、`form[action*="sign_in"]`）
- 返回原始 HTML 字符串

### 2.2 接入点（同源 javdb 页面抓取统一改走页面 fetch）

| 文件 | 改动 |
|------|------|
| `src/plugins/auto-page/ap-fetch.ts` | `gmHttp.get(plugin.nextUrl)` → `fetchJavdbPageHtml(plugin.nextUrl)`（**已确认故障点**，覆盖列表页/清单详情页 `/lists/{id}` 瀑布流） |
| `src/plugins/list-waterfall/lw-fetch.ts` | 删除裸 `GM_xmlhttpRequest` 的 `gmGet`，改调 `fetchJavdbPageHtml`（同根因：/users/lists 清单瀑布流） |
| `src/plugins/video-lists-tag/vlt-reconcile.ts` | 局部 `fetchHtmlDocument` 重构为共享工具薄包装（去重复实现，行为不变） |

瀑布流其余逻辑（重复番号判定、分页状态机、loader 状态、加载全部）不变。

## 3. 实施（修改文件清单）

| 文件 | 变更 |
|------|------|
| `src/core/util/util-fetch-html.ts` | **新增**：`fetchJavdbPageHtml` 共享工具 |
| `src/plugins/auto-page/ap-fetch.ts` | 瀑布流抓取改走 `fetchJavdbPageHtml` |
| `src/plugins/list-waterfall/lw-fetch.ts` | `gmGet`（GM_xmlhttpRequest）删除，改走 `fetchJavdbPageHtml`；文件头注释同步 |
| `src/plugins/list-waterfall-plugin.ts` | 头部注释同步（GM_xmlhttpRequest → 页面 fetch） |
| `src/plugins/video-lists-tag/vlt-reconcile.ts` | `fetchHtmlDocument` 重构为共享工具薄包装（行为不变） |
| `vite.config.ts` | version 1.45.1 → 1.45.2（patch） |
| `package.json` | version 字段同步 1.45.2（元数据修正） |
| `doc/236-fix-waterfall-cloudflare-403.md` | 本文档 |

## 4. 执行验证记录

### 执行环境

Windows + Bun（构建/静态验证）。

### 验证命令

```text
$ bunx tsc -b
$ bun run lint
$ bun run build
$ bun run test
$ bun run check:structure
```

### 实际输出

```text
$ bunx tsc -b
（零错误）

$ bun run lint
（无输出 = 0 errors / 0 warnings）

$ bun run build
dist/monkey-jhs-disassemble.user.js  2,211.78 kB │ gzip: 512.50 kB
✓ built in ~1.4s

$ bun run test
 Test Files  12 passed (12)
      Tests  177 passed (177)

$ bun run check:structure
check-structure: OK (369 files, 63 dirs within limits; 4 file-ceilings, 3 dir-ceilings in ratchet)
```

### 前端或调用方验证

无独立前端；产物 userscript 头部 `@version 1.45.2` 已核对。

### 验证结论

✅ 通过。构建/lint/177 测试/结构门禁全绿，产物 `@version 1.45.2`。

### 已知限制

- 需用户浏览器实测：更新脚本后重载列表页 / 清单详情页，滚动触发瀑布流翻页，
  应正常追加（不再出现「加载失败，点击重试」）。
- 若页面 fetch 仍被 Cloudflare 挑战（浏览器本身被验证），会显示「加载失败，
  点击重试」，属正常兜底（不会静默伪装成「已经到底了」）。
- 同根因的 `want-and-watched-videos-plugin.tsx`（JavDB→JHS 批量导入）与
  `blacklist-scraper.tsx`（黑名单全量扫描）仍走 `gmHttp.get` 抓 javdb 同源页面，
  可能同样被 403 拦截；本次未改动（不同功能模块），如需一并修复可复用本工具。