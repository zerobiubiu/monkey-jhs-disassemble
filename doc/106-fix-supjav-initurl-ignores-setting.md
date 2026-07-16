# 106 - 修复 SupJav 跳转地址未遵守外部网站设置

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 1. 背景

用户反馈：详情页中 SupJav 按钮的跳转地址始终为 `https://supjav.com/?s=<番号>`，
没有遵守设置弹窗「外部网站」面板中 `supJavUrl` 配置项。

### 根因

`src/plugins/other-site-plugin.tsx` 的 `supJavBtn` siteConfig 在 doc/52 加了
`initUrl` 以跳过 SupJav 全站 Cloudflare 拦截（直接显示黄色 + 搜索页链接，
不发请求）。但该 `initUrl` **硬编码**了 `https://supjav.com`：

```typescript
initUrl: (carNum: string) => `https://supjav.com/?s=${carNum}`
```

`handleSite` 的执行路径：

1. 第 213-215 行：检测到 `initUrl` → `buttonEl.attr('href', siteConfig.initUrl(carNum))`
   + 黄色背景（此时 href 已被硬编码值设置）
2. `noHandle` 未设 → 进入 `else` 分支（第 234 行）
3. 第 234 行：`if (buttonEl.attr('href')) { return; }` → **直接 return**

因此读取设置项的 `getSupJavUrl()`（第 570-572 行，经 `getBaseUrl` 调用）
**永远不会被调用**，`supJavUrl` 设置形同虚设。

对比 MissAv：MissAv 没有 `initUrl`，走完整 `handleSite` 流程，
第 257 行 `const baseUrl = await siteConfig.getBaseUrl()` 会调用 `getMissAvUrl()`
读取设置，所以 MissAv 的设置生效。

## 2. 方案

让 `initUrl` 改为异步读取 `getSupJavUrl()`，与 `getBaseUrl` 一致地尊重设置项。

| 改动点 | 修改前 | 修改后 |
|--------|--------|--------|
| `SiteConfig.initUrl` 类型 | `(carNum: string) => string` | `(carNum: string) => Promise<string> \| string`（兼容同步/异步） |
| supJav `initUrl` 实现 | 硬编码 `https://supjav.com` | `async (carNum) => \`${await this.getSupJavUrl()}/?s=${carNum}\`` |
| `handleSite` 调用处 | `siteConfig.initUrl(carNum)` | `await siteConfig.initUrl(carNum)`（`handleSite` 本已是 async） |

`preloadListPage` 第 406 行 `if (siteConfig.initUrl) continue;` 只检测存在性，
不调用 `initUrl`，无需改动。

## 3. 实施

### 修改文件

| 文件 | 改动 |
|------|------|
| `src/plugins/other-site-plugin.tsx` | `SiteConfig.initUrl` 类型放宽为 `Promise<string> \| string`；supJav `initUrl` 改 `async` + `await this.getSupJavUrl()`；`handleSite` 第 214 行加 `await` |
| `vite.config.ts` | version 1.13.6→1.13.7 |
| `doc/README.md` | 文档清单新增 doc/106 |
| `changelog/CHANGELOG.md` | 新增 v1.13.7 条目 |

## 4. 执行验证记录

### 4.1 类型检查

```bash
$ npx tsc -b
（无输出，退出码 0）
```

### 4.2 构建

```bash
$ npx vite build
dist/monkey-jhs-disassemble.user.js  1,878.94 kB │ gzip: 432.78 kB
✓ built in 1.36s
```

### 4.3 userscript metadata 验证

```
// @version      1.13.7
```

## 5. 后续验证建议

1. **默认值**：不修改设置时，SupJav 按钮跳转地址仍为 `https://supjav.com/?s=<番号>`（与修改前一致，因缺省值相同）
2. **自定义地址生效**：在设置弹窗「外部网站」面板将 `supJavUrl` 改为自定义域名（如镜像站），保存后打开详情页，SupJav 按钮跳转地址应使用自定义域名 + `/?s=<番号>`
3. **黄色状态不变**：SupJav 按钮仍为黄色（warn 状态），不发请求
