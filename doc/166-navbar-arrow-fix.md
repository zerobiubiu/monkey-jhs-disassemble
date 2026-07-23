# doc/166 — 修复导航栏「设置」「鉴定记录」按钮的多余下拉箭头

> 文档类型：🐛Bug修复
> 文档状态：✅已执行

## 背景

用户反馈 javdb.com 顶部导航栏右侧插件注入的「设置」按钮显示多余的下拉箭头
（「设▼」），红框区域中「设置」与「鉴定记录」两个注入按钮均带有不应出现的
Bulma 下拉箭头。

排查确认：箭头并非 HTML 字符，也不是插件 CSS 的 `content` 注入，而是站点
Bulma 框架的 `.navbar-link:not(.is-arrowless)::after` 边框三角（chevron）。
插件注入的四个导航按钮锚点均携带 `navbar-link` 类：

- `src/components/setting-mount-box.tsx`：`a#setting-btn`（navbar 变体，L49-58）
  与 `a#mini-setting-btn`（mini 变体，L68-78），className 均为 `navbar-link nav-btn`
- `src/components/history-nav-button.tsx`：`a#historyBtn`（desktop 变体，L47-56）
  与 `a#miniHistoryBtn`（mini 变体，L62-72），className 均为 `navbar-link nav-btn`

原始 userscript（`archetype/jhs.user.js` L9708、`archetype/jhs.3.3.6.027.user.js`
L6888）中，设置插件的样式模板含独立规则
`.nav-btn::after { content:none !important; }`，正是用于压制该站点继承箭头，
原版运行正常。

## 根因

CSS 提取重构（doc/02）时，设置插件样式表首行被提取为：

```css
__css_text__ .nav-btn::after {
    content: none !important;
}
```

两处缺陷叠加导致规则失效：

1. **占位符大小写不匹配**：CSS 文件中的占位符为小写 `__css_text__`，而
   `src/plugins/setting-plugin.tsx` L212 的运行时替换调用为
   `settingCssRaw.replace('__CSS_TEXT__', cssText)`（大写）——`String.replace`
   匹配不到，动态容器宽度 CSS 未落地，小写占位符原文注入页面。
2. **占位符融合进选择器**：占位符与选择器粘在同一行，即便大小写匹配，替换后
   也会破坏选择器结构。

结果：注入的样式表含无效选择器 `__css_text__ .nav-btn::after`，浏览器按 CSS
错误恢复规则丢弃整条规则，`.nav-btn::after { content: none !important; }` 不
再生效，Bulma 的 `.navbar-link::after` 三角箭头在四个注入按钮上全部显现。

佐证：`src/styles/javdb-site.css` L8-10 的
`.navbar-link:not(.is-arrowless) { padding-right: 33px; }` 正是为 Bulma
`.navbar-link::after` 箭头预留的空间；全 src 内 `.nav-btn::after` 仅此一处
（即失效规则），无其它存活压制规则。

## 修复

将 `src/styles/setting-plugin.css` 首行占位符改为**独立行的大写 `__CSS_TEXT__`**，
使 `.nav-btn::after` 成为有效独立规则：

```css
/* stylelint-disable-next-line selector-type-case -- 运行时占位符（须保持大写），由 setting-plugin.tsx initCss() 的 replace 调用替换为动态容器宽度 CSS */
__CSS_TEXT__

.nav-btn::after {
    content: none !important;
}
```

- 大写占位符与 `setting-plugin.tsx` L212 的 `.replace('__CSS_TEXT__', cssText)`
  精确匹配，动态容器宽度 CSS 正常落地占位符位置。
- `.nav-btn::after { content: none !important; }` 恢复为有效独立规则，压制全部
  四个携带 `nav-btn` 类的注入按钮（setting-btn / mini-setting-btn / historyBtn /
  miniHistoryBtn，桌面与 mini 变体）的 Bulma 箭头。
- 占位符行附加 `stylelint-disable-next-line selector-type-case` 注释（占位符须
  保持大写，stylelint-config-standard 的 `selector-type-case` 规则会误报）。
  **注意**：注释文案刻意不含 `__CSS_TEXT__` 字面量——`String.replace` 仅替换
  首次出现，若注释含该字面量会抢占匹配、使真正的占位符残留并再次破坏规则。

## 实施清单

|文件|变更|
|---|---|
|`src/styles/setting-plugin.css`|L1-3：`__css_text__ .nav-btn::after {` 改为独立行大写 `__CSS_TEXT__` 占位符 + 空行 + 独立 `.nav-btn::after { content: none !important; }` 规则；占位符行上方新增 `stylelint-disable-next-line selector-type-case` 注释（注释内不含占位符字面量）|
|`vite.config.ts`|version `1.28.6` → `1.28.7`（patch：bug 修复）|
|`package.json`|version `1.28.6` → `1.28.7`|

未改动 `setting-plugin.tsx`（其 L212 的 `__CSS_TEXT__` 替换调用本就是正确的大写
形式）及任何组件文件（四个按钮的 `nav-btn` 类与原始 userscript 字符级一致）。

## 验证记录

- `bun run build`（`tsc -b && vite build`）：✅ 通过，产物
  `dist/monkey-jhs-disassemble.user.js` 2,024.95 kB（gzip 467.45 kB）；
  lightningcss 关于 layui 遗留 `*display`/`*zoom` IE hack 的警告为既有现象，
  与本次变更无关。
- `bun run test`：✅ 28/28 全绿（3 个测试文件）。
- `bun run lint`（ESLint）：✅ 0 errors（786 warnings 均为既有
  `no-explicit-any` 等基线警告，无新增）。
- `bun run lint:css`（Stylelint）：✅ 0 errors（新增 disable 注释后基线恢复）。
- 占位符核验：`grep -c '__css_text__' src/styles/setting-plugin.css` → 0（旧小写
  占位符已消失）；`grep -c '__CSS_TEXT__' src/styles/setting-plugin.css` → 1
  （新大写占位符独立成行）；`grep -c '__css_text__' dist/monkey-jhs-disassemble.user.js`
  → 0（旧占位符亦不存在于构建产物）。产物中保留 `__CSS_TEXT__` 字符串字面量属
  预期——CSS 以 `?raw` 导入，替换发生在运行时 `initCss()`。
