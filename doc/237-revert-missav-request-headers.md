# 回退 MissAV 请求头为原始脚本方式

> **文档类型**：🔧 开发指导
> **文档状态**：✅ 已执行
> **版本**：1.45.2 → 1.45.3（patch，测试性回退）
> **前置文档**：doc/234、doc/236

## 1. 背景

用户要求先复刻原始 `archetype/jhs.user.js` 的 MissAV 详情页请求方式进行对比测试。
原始脚本在 `OtherSitePlugin.handleSite()` 中使用：

```ts
gmHttp.get(searchUrl, null, siteConfig.headers, true)
```

原始 MissAV 配置没有额外请求头。当前工程此前额外注入了
`buildBrowserNavHeaders(baseUrl)`，包含 `Referer`、`Sec-Fetch-*`、`Accept-Language`
等浏览器导航头。用户希望暂时移除这层差异，只验证原始请求方式。

## 2. 实施范围

仅修改 MissAV 请求调用：

- `src/plugins/other-site/osp-probe.tsx`：详情页即时探测改为传递 `siteConfig.headers`
- `src/plugins/other-site/osp-preload.tsx`：列表页预加载改为传递 `siteConfig.headers`
- 移除上述两个文件中未再使用的 `buildBrowserNavHeaders` 导入

以下内容保持不变：

- `jhs_other_site` 缓存结构
- `preloadCacheTTL` 有效期
- 列表页预加载队列、并发数、去重、徽标和 `blockedSiteIds`
- 登录页检测
- MissAV 解析选择器与结果分类
- `followRedirect: true`
- 失败提示与缓存写入逻辑

## 3. 验证记录

### 验证命令

```text
$ bunx tsc -b
$ bun run lint
$ bun run test
$ bun run check:structure
$ bun run build
```

### 实际结果

```text
$ bunx tsc -b
（零错误）

$ bun run lint
（0 errors / 0 warnings）

$ bun run test
 Test Files  12 passed (12)
      Tests  177 passed (177)

$ bun run check:structure
check-structure: OK (369 files, 63 dirs within limits; 4 file-ceilings, 3 dir-ceilings in ratchet)

$ bun run build
dist/monkey-jhs-disassemble.user.js  2,211.14 kB │ gzip: 512.23 kB
✓ built in 1.36s
```

### 运行时验证

待用户更新脚本后，在 JavDB 视频详情页和视频流列表页清除旧缓存并测试 MissAV 查询结果。
本次改动的目标是对比原始请求方式的实际成功率，不声称已解决 MissAV 的 CORS 或
Cloudflare 限制。

### 已知限制

MissAV 请求仍从 JavDB 页面通过 `GM_xmlhttpRequest` 发起，浏览器页面 `fetch` 的
CORS 限制仍然存在；本次没有引入 iframe、`postMessage` 或跨页面桥接。
