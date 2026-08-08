# 删除 MissAV 搜索页登录保护性判断

> **文档类型**：🔧 开发指导
> **文档状态**：✅ 已执行
> **版本**：1.45.3 → 1.45.4（patch，行为回退）
> **前置文档**：doc/237（回退 MissAV 请求头为原始脚本方式）

## 1. 背景

当前工程后续新增了 MissAV 搜索页登录检测：当响应 HTML 被识别为登录页时，详情页显示黄色警告，列表页预加载标记失败并输出“搜索页需要登录，跳过预加载”。

用户要求恢复与原始 `archetype/jhs.user.js` 一致的行为。原始脚本没有登录页判断，而是请求后直接按 `.text-secondary` 解析搜索结果；未找到结果时按原有未命中逻辑处理。

## 2. 实施

删除以下新增保护性判断：

- `src/plugins/other-site/osp-probe.tsx`：删除详情页登录表单、密码输入框和登录关键词检测。
- `src/plugins/other-site/osp-preload.tsx`：删除列表页登录页检测、失败徽标更新和“搜索页需要登录，跳过预加载”日志。
- 清理详情页检测残留的 `siteName` 局部变量。

保留：

- 原始 `gmHttp.get(searchUrl, undefined, siteConfig.headers, true)` 请求方式。
- 现有缓存、TTL、列表页预加载队列、并发限制、去重、状态徽标和 Cloudflare 错误分类。
- 搜索结果解析与未命中处理。

## 3. 验证记录

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
dist/monkey-jhs-disassemble.user.js  2,209.63 kB │ gzip: 511.88 kB
✓ built；产物头部 @version 1.45.4 已核对
```

### 实际运行验证

用户安装 `1.45.4` 后实测确认：

- MissAV 列表页预加载恢复正常；
- 原因确认为后续新增逻辑偏离原始脚本请求/解析流程，导致预加载失败；
- 恢复原始 `gmHttp.get(searchUrl, undefined, siteConfig.headers, true)` 请求方式，并删除登录页保护性判断后，预加载可以正常工作。

本次结论：不要在没有实测证据的情况下为 MissAV 额外添加请求头模拟或登录页保护分支；后续应保持原始请求方式，避免再次引入未经验证的行为差异。

### 已知行为

MissAV 返回登录页时，不再单独显示“需要登录”保护提示，而会按照原始脚本流程继续解析；如果解析不到 `.text-secondary`，将按原有“未命中”路径处理。
