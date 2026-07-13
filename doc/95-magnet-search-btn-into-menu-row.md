# 95 - 磁力搜索按钮移入字幕搜索菜单行（统一 menu-btn 样式）

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行

## 背景

视频详情页顶部工具按钮组 `DetailMenuButtons`（注入在 `.tabs` 后方）右行
`.jhs-menu-tools-row` 原本包含：磁力过滤开关 / 字幕(迅雷) / 字幕(SubTitleCat)，
三个按钮均使用 `menu-btn` class + 渐变背景 + 统一 `width`/`padding:8px 0`/白字居中
风格。

磁力搜索按钮（`#magnetSearchBtn`）却由 `createMenuBtn` 在组件渲染之后**单独**用
jQuery `.after()` 注入到 `.movie-panel-info, .tabs` 之后，样式为
`<a class="button is-small is-warning" style="margin:8px 0">`（Bulma 黄色小按钮），
与同行其他按钮风格割裂，且位置游离在菜单行之外。

用户选择器
`body > section > div > div.video-detail > div:nth-child(4) > div > div:nth-child(2)`
对应的就是 `.jhs-menu-tools-row` 右行（见 doc/72 MCP 确认），要求把磁力搜索按钮
放进该行，并采用同样的风格样式自动匹配。

## 方案

将磁力搜索按钮从「运行时单独 DOM 注入」改为「由 `DetailMenuButtons` 组件在右行
内条件渲染」，样式与同行 `menu-btn` 按钮统一：

1. **`DetailMenuButtons` 组件**新增 prop `showMagnetSearch: boolean`，为 true 时在
   右行末尾（`#search-subtitle-btn` 之后）渲染 `#magnetSearchBtn`，样式复用 archetype
   原始磁力搜索按钮的渐变配色
   `linear-gradient(to right, rgb(245,140,1), rgb(84,161,29))`，结构（`menu-btn` class
   + `width:120px` + `padding:8px 0` + 白字居中 + 内嵌 `<span>磁力搜索</span>`）
   与字幕按钮完全一致。
2. **`createMenuBtn`** 调用组件时传入 `showMagnetSearch={featureFlags.magnetHubPlugin}`，
   删除原来的 `$('.movie-panel-info, .tabs').first().after(...)` 单独注入逻辑，
   保留 `#magnetSearchBtn` 的 click 事件绑定（打开 MagnetHub 弹窗）。

### 渲染等价性

- `featureFlags.magnetHubPlugin` 为 true（默认）：组件渲染按钮 DOM 存在 → 事件绑定生效，
  与原逻辑一致。
- flag 为 false：组件不渲染按钮（`{false && <a/>}` 经 jsxToString 输出空串），
  事件绑定块不执行，与原逻辑一致。

## 实施

| 文件 | 改动 |
|------|------|
| `src/components/detail-menu-buttons.tsx` | `DetailMenuButtonsProps` 新增 `showMagnetSearch: boolean`；函数签名解构该 prop；右行 `.jhs-menu-tools-row` 末尾在 `#search-subtitle-btn` 之后条件渲染 `#magnetSearchBtn`（`menu-btn` + 渐变背景 + 统一尺寸） |
| `src/plugins/detail-page-button-plugin.tsx` | `createMenuBtn` 调用 `<DetailMenuButtons>` 传入 `showMagnetSearch={featureFlags.magnetHubPlugin}`；删除原 `if (flag && !length) { $('.after(html) }` 单独注入块，仅保留 `if (flag) { $('#magnetSearchBtn').on('click', ...) }` 事件绑定 |

## 执行验证

```
$ bun run build
$ tsc -b && vite build
vite v8.1.3 building client environment for production...
✓ 219 modules transformed.
dist/monkey-jhs-disassemble.user.js  1,890.88 kB │ gzip: 435.01 kB
✓ built in 1.40s
```

- `tsc -b` 零错误
- `vite build` 成功（lightningcss 的 `*display:inline` 等 IE hack 容错警告是
  layer.css 既有行为，与本次修改无关）
- 产物含 `id: "magnetSearchBtn"`（组件 JSX 属性，运行时由 jsxToString 渲染为
  `<a id="magnetSearchBtn" class="menu-btn" ...>`）+ click 事件绑定代码
- version `1.12.5` → `1.12.6`（UI 样式统一，patch 递增）

## 后续验证建议

1. 打开 javdb 视频详情页
2. 确认顶部按钮组右行（`.jhs-menu-tools-row`）从左到右为：
   关闭磁力过滤 / 字幕(迅雷) / 字幕(SubTitleCat) / **磁力搜索**
3. 磁力搜索按钮与字幕按钮风格统一：等高、等 padding、渐变背景、白字居中
4. 点击磁力搜索按钮 → 正常弹出「磁力搜索 - 番号」弹窗（MagnetHub 三引擎聚合）
5. 控制台执行
   `localStorage.setItem('jhs_upgrade_flags', JSON.stringify({ magnetHubPlugin: false }))`
   后刷新 → 磁力搜索按钮消失，其余按钮不受影响
