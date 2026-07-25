# doc/198 — 修复 osp-preload doPreloadSite 三处 bug

> **文档类型**：🔧 开发指导
> **文档状态**：✅ 已执行

## 1. 背景

`src/plugins/other-site/osp-preload.tsx` 的 `doPreloadSite` 函数存在三处与
原始脚本 / `probeSite`（osp-probe.tsx）行为不一致的 bug：

1. **`getDetailPageHref` 返回 falsy 时静默跳过**：原代码 `if (!href) return;`
   将解析异常伪装成"未命中"，而原始脚本和 `probeSite` 均为
   `throw new Error('解析href失败')`。
2. **登录页检测过于宽泛**：`bodyText.includes('登录')` 会匹配搜索结果页导航栏
   中的"登录"按钮文本，导致正常搜索结果被误判为登录页。原始脚本 `handleSite`
   完全没有登录页检测；`probeSite` 使用表单选择器 + 正则匹配 title/全文。
3. **catch 块缺少"重定向"错误分类**：只区分 Cloudflare（Just a moment / 403）
   和其他错误，缺少 `probeSite` 中的"重定向"分支（域名失效）。

## 2. 修改方案

### Bug 1：href 解析失败改为 throw

```diff
-            if (!href) return;
+            if (!href) {
+                throw new Error('解析href失败');
+            }
```

对齐 `probeSite` L119-121 的行为，使解析失败进入 catch 块被正确记录。

### Bug 2：登录页检测收窄

移除 `bodyText.includes('登录')` 宽泛检测，改为：
- 检测 `<title>` 文本是否包含登录关键词（`/登录|登陆|登入|sign\s*in|log\s*in/i`）
- 检测页面是否存在登录表单（`form[action*="login"]`、`form[action*="signin"]`、
  `input[type="password"]`）
- 保留 `bodyText.includes('登入你的帳戶')` 和 `bodyText.includes('註冊一個新帳戶')`
  （missav 登录页特征文本，不会出现在搜索结果页）

### Bug 3：catch 块增加"重定向"分支

在 Cloudflare 分支之后、通用错误分支之前，增加
`errorMsg.includes('重定向')` 判断，输出"域名失效（被重定向）"日志，
对齐 `probeSite` 的三段式错误分类。

## 3. 实施

修改文件：`src/plugins/other-site/osp-preload.tsx`（`doPreloadSite` 函数）

## 4. 执行验证记录

```
$ npx tsc -b --noEmit
（零输出，通过）

$ bun run build
vite v8.0.17 building for development...
✓ 9448 modules transformed.
dist/index.user.js  2,073.73 kB
```

## 5. 后续验证建议

- 在 JavDB 列表页打开详情页，观察预加载日志：
  - 搜索结果页不应因导航栏"登录"按钮被误判为登录页
  - 域名失效站点应输出"域名失效（被重定向）"而非通用"失败"
  - href 解析失败应输出"解析href失败"错误而非静默跳过
