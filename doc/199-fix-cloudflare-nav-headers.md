# 199 — 外站探测请求伪装浏览器导航头（绕过 Cloudflare 跨域 403）

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行

## 背景

列表页预加载（`doPreloadSite`）和详情页探测（`probeSite`）通过 `GM_xmlhttpRequest`
向 missav.ws 等站点发起搜索请求时，Cloudflare 返回 403。

根因：`GM_xmlhttpRequest` 从 javdb.com 跨域请求 missav.ws 时，默认不携带
`Sec-Fetch-*`、`Referer`、`Accept-Language` 等浏览器导航头。Cloudflare 的
Bot Management 将这类"裸"请求判定为机器人并返回 403。用户在浏览器地址栏
直接打开同一 URL 能正常访问，因为浏览器自动携带了完整的导航头。

此外 Cloudflare 的 `cf_clearance` Cookie 通常为 `SameSite=Lax`，跨域请求
（javdb.com → missav.ws）不会携带该 Cookie，进一步加剧了拦截。

## 方案

新增 `buildBrowserNavHeaders(baseUrl)` 共享纯函数（`osp-helpers.ts`），
生成与浏览器地址栏直接访问一致的请求头：

| 请求头 | 值 | 作用 |
|--------|-----|------|
| `Accept` | `text/html,application/xhtml+xml,...` | 标准 HTML 文档 Accept |
| `Accept-Language` | `zh-CN,zh;q=0.9,en;q=0.8` | 中文语言偏好 |
| `Referer` | `<origin>/` | 模拟站点内部导航来源 |
| `Sec-Fetch-Dest` | `document` | 请求目标为文档 |
| `Sec-Fetch-Mode` | `navigate` | 导航模式 |
| `Sec-Fetch-Site` | `same-origin` | **关键**：声称同站请求 |
| `Sec-Fetch-User` | `?1` | 用户触发导航 |
| `Upgrade-Insecure-Requests` | `1` | HTTPS 升级 |

`doPreloadSite` 和 `probeSite` 的 `gmHttp.get` 调用改为合并
`buildBrowserNavHeaders(baseUrl)` + `siteConfig.headers`（后者优先覆盖）。

## 实施

- `src/plugins/other-site/osp-helpers.ts`：新增 `buildBrowserNavHeaders` 函数
- `src/plugins/other-site/osp-preload.tsx`：`doPreloadSite` 的 `gmHttp.get`
  调用合并浏览器导航头
- `src/plugins/other-site/osp-probe.tsx`：`probeSite` 的 `gmHttp.get`
  调用合并浏览器导航头
- `vite.config.ts`：version 1.30.3 → 1.30.4

## 局限性

- 若 Cloudflare 校验 TLS 指纹 / JS Challenge / `cf_clearance` Cookie
  `SameSite` 限制，仅靠请求头无法完全绕过
- 此方案为"最佳努力"优化，不保证对所有 Cloudflare 防护等级有效
- 若仍被拦截，建议用户在设置中将 MissAv 域名切换为 Cloudflare 策略
  更宽松的镜像站（如 missav.live）

## 验证

- `tsc -b`：0 errors
- IDE 诊断：0 errors / 0 warnings（src/ 范围）
- 浏览器实测：待用户确认
