# 129 - 安全边界与运行时健壮性加固

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行
> **执行日期**：2026-07-22

## 1. 背景

本轮综合审查覆盖了 HTML 字符串渲染、远程接口回填、动态链接、用户脚本权限、
跨站匹配范围、日志控制台和详情页异步等待。目标是先处理“输入异常时可能执行脚本、
跳转到非预期站点或永久卡住”的高风险问题，不改变 JavDB 的业务写入协议，也不触碰
用户现有数据。

重点风险包括：

- `jsxToString` 的属性值、评论/日志/第三方接口字段曾可直接进入 HTML 属性或
  `innerHTML`；
- 外部站点缓存、演员缓存、黑名单 URL 和磁链结果可能被篡改，单纯转义 HTML 不能
  阻止 `javascript:` 或外站跳转；
- `unsafeWindow` 把 GM 高权限对象暴露给页面脚本，站点匹配规则也覆盖了不必要的
  镜像/iframe；
- 可选插件缺失或接口长期不响应时，详情页清单初始化可能无限等待；
- 设置面板缓存统计切换回调使用了 DOM 的 `this`，进入面板时会调用不到插件方法。

## 2. 方案

### 2.1 HTML 与 DOM 边界

- `jsxToString` 统一转义文本和属性（`&`、尖括号、单双引号），保留
  `dangerouslySetInnerHTML` 作为明确的受控原始 HTML 边界；
- 评论正文改为文本节点 + 受限链接节点，日志改为文本/协议白名单链接，tooltip
  改用 `textContent`；
- 热播、FC2、截图墙、磁链中心、翻译错误等远程字段不再直接拼接未转义 HTML；
- 动态影片/演员/黑名单属性使用编码和安全 URL 校验，非法值降级为不可点击文本。

### 2.2 URL、权限与页面范围

- 对 JavDB、Wikipedia、JavStore、123AV 及第三方站点分别执行 HTTPS、主机、端口、
  凭证字段校验；磁链只接受标准 `magnet:?xt=urn:btih:` SHA-1/SHA-256 形式；
- `target="_blank"` 链接补 `rel="noopener noreferrer"`；URL 路径参数统一编码；
- 高权限服务只挂在 userscript 沙箱 `window`，不再复制到 `unsafeWindow`；保留的
  `unsafeWindow.$` 仅用于既有详情页 Fancybox/跨 frame 兼容边界；
- `vite.config.ts` 改为 JavDB、MissAV 官方精确域名匹配并启用 `noframes`。WebDAV
  仍需任意 HTTPS 连接，因此 `@connect *` 暂保留并在设置输入上明确 URL 类型。

### 2.3 异步与交互容错

- 详情页可选的 OtherSite 插件不再作为永久阻塞条件；列表初始化等待增加 15 秒上限，
  超时后进入可用的回退导航路径；
- 设置面板事件捕获插件实例，缓存/预加载统计在切换面板时稳定执行；
- 翻译、第三方缓存和截图对损坏 JSON 做容错，错误只影响对应功能，不阻塞主页面；
  演员/Wikipedia 缓存链接即使被篡改也只会降级为不可点击文本。

## 3. 实施文件

| 文件 | 改动 |
|------|------|
| `src/core/jsx-to-string.ts` | 统一文本/属性转义，并保留受控 raw HTML 边界 |
| `src/constants/api.ts`、`src/components/hit-show-movie-item.tsx` | 热播数据字段转义、影片 ID 编码、封面 HTTPS 校验 |
| `src/core/logger.tsx`、`src/components/logger-log-entry.tsx` | 日志文本化与链接协议白名单 |
| `src/components/review-item.tsx`、`review-link-content.tsx`、`src/plugins/review-plugin.tsx` | 评论内容安全拆分与星级范围限制 |
| `src/core/tooltip.ts`、`src/plugins/translate-plugin.ts` | 消除 tooltip/raw 错误 HTML，容错翻译缓存 |
| `src/plugins/fc2-plugin.ts`、`fc2-by-123av-plugin.ts`、`magnet-hub-plugin.ts` | 外链、图片、磁链和错误信息安全构造 |
| `src/plugins/screenshot-plugin.ts`、`src/plugins/new-video-plugin.tsx` | 截图/头像/演员链接主机校验 |
| `src/plugins/other-site-plugin.tsx` | 配置、缓存、搜索、详情 URL 的 HTTPS/同源验证 |
| `src/components/blacklist-name-cell.tsx`、`actress-info-*.tsx` | 黑名单/Wikipedia 缓存链接安全降级 |
| `src/components/setting-dialog.tsx`、`src/plugins/setting-plugin.tsx` | WebDAV 输入语义与面板回调修复 |
| `src/plugins/detail-page-button-plugin.tsx` | 可选依赖和列表初始化超时回退 |
| `src/main.tsx`、`src/types/globals.d.ts` | 沙箱全局挂载、异常处理和类型注释更新 |
| `vite.config.ts` | 精确 match、`noframes` 与权限边界说明 |
| `AGENTS.md` | 同步启动序列、插件计数和构建范围说明 |

本次未新增插件、未改变存储键，也未向 JavDB/MissAV 发起写入请求。

## 4. 执行验证记录

```text
$ bunx tsc -b --pretty false
通过（无 TypeScript 错误）

$ bun run build
✓ 220 modules transformed
dist/monkey-jhs-disassemble.user.js  2,045.04 kB │ gzip: 472.06 kB
✓ built in 1.22s

$ git diff --check
通过（仅提示既有 CRLF 文件将转换为 LF，无空白错误）

$ security-storage-sync-regressions（内联回归脚本）
通过：文本/属性转义、远程字段注入、备份元字段剥离、非法列存拒绝、
HTTPS/主机校验、显式空快照校验

$ storage-import-conditional-rollback（内联故障注入）
通过：并发新值未被覆盖，失败前已部分写入的键可恢复，未触及键保持不变
```

## 5. 后续验证建议

1. 部署后在 JavDB、MissAV 官方域名分别打开详情页、列表页、设置页和 iframe 场景，
   确认页面脚本未依赖被移除的 `unsafeWindow` 全局。
2. 使用真实第三方站点配置、损坏缓存和带引号/尖括号的评论字段做只读回归；确认
   非法 URL 显示为普通文本而不是跳转链接。
3. 后续可把剩余受控 `dangerouslySetInnerHTML` 边界整理成 `TrustedHtml` 类型；字幕
   预览应继续明确显示为“用户选择的原始文本”边界。
4. 若未来 WebDAV 只支持固定服务商，应把 `@connect *` 收紧为配置域名白名单；当前
   任意 HTTPS WebDAV 是既有功能兼容要求。
