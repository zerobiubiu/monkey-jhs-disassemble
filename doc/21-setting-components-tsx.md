# 21 - 设置弹层组件 .ts→.tsx 转换（jsxToString 模式）

**文档类型**：🔧开发指导
**文档状态**：✅已执行

## 1. 背景

`doc/16` 落地轻量 `jsxToString`（`src/core/jsx-to-string.ts`），仅依赖 react
的**类型**（`import type`），运行时零依赖。`doc/17`/`18`/`19`/`20` 先后将
列表页 / 鉴定记录 / 黑名单 / 详情页按钮共 31 个 HTML 字符串组件转为 TSX 原生
React 组件，调用点改 `jsxToString(<Comp {...props} />)`，并合并删除孤立示范。

`doc/13` 扫描剩余 HTML 时 SettingPlugin 的设置挂载容器 / 回到顶部按钮 / 关键词
标签 / 简化设置面板 / 缓存项 / 画质选项提取为返回 HTML 字符串的 `.ts` 组件
（`SettingMountBox` / `BackToTopButton` / `KeywordLabel` / `SimpleSettingPanel` /
`CacheItemHtml` / `VideoQualityOption`）；`doc/06` 将 SettingPlugin 的三处
layer.open content 提取为 `SettingDialog` / `HelpDialog` / `BackupFileDialog`
（返回 HTML 字符串）。

本次将上述 9 个组件统一转为 TSX 原生 React 组件（JSX），调用点 `setting-plugin.ts`
→ `.tsx`，调用改 `jsxToString(<Comp {...props} />)`。

## 2. 转换清单

### 2.1 组件（.ts → .tsx，删原 .ts）

| 旧文件 | 新文件 | 说明 |
|--------|--------|------|
| `setting-dialog.ts` | `setting-dialog.tsx` | 7 props（panelName/cacheItemsHtml/qualityOptionsHtml/isJavdbSite/blockText/favoriteText/watchedText）；侧栏 6 菜单项 + 6 面板 + 底部按钮；cacheItemsHtml/qualityOptionsHtml 以 `dangerouslySetInnerHTML` 注入；hr 渐变背景 |
| `help-dialog.ts` | `help-dialog.tsx` | 无 props；4 个 details 折叠区块 + img/a/p/h1 |
| `backup-file-dialog.ts` | `backup-file-dialog.tsx` | 无 props；overflow 外层 + #table-container（`margin:auto auto !important`） |
| `setting-mount-box.ts` | `setting-mount-box.tsx` | 1 prop（variant: navbar/mini/topright/containerfluid）；switch 4 分支；含 `!important` style |
| `simple-setting-panel.ts` | `simple-setting-panel.tsx` | 1 prop（isJavdbSite）；条件渲染"加载女优信息"块；❓ 与文案间 `{" "}` 保空格 |
| `cache-item-html.ts` | `cache-item-html.tsx` | 3 props（text/cacheKey/title）；**`key` prop 重命名为 `cacheKey`**（React 保留 prop 冲突） |
| `video-quality-option.ts` | `video-quality-option.tsx` | 2 props（quality/text）；单 `<option>` |
| `keyword-label.ts` | `keyword-label.tsx` | 5 props（keyword/bgColor/textColor/variant/href?）；link/div 双变体 |
| `back-to-top-button.ts` | `back-to-top-button.tsx` | 无 props；div + 内嵌 SVG（viewBox/path） |

### 2.2 调用点（.ts → .tsx，调用改 jsxToString）

| 文件 | 改动 |
|------|------|
| `src/plugins/setting-plugin.ts` → `.tsx` | 加 `import { jsxToString }`；改 13 处调用：`SettingMountBox`(handle 4 处 prepend/before/append) / `BackToTopButton`(addBackToTopBtn) / `CacheItemHtml`(openSettingDialog map) / `VideoQualityOption`(openSettingDialog forEach) / `SettingDialog`(openSettingDialog content) / `SimpleSettingPanel`(simpleSetting) / `HelpDialog`(initSimpleSettingForm helpBtn content) / `BackupFileDialog`(openFileListDialog content) / `KeywordLabel`(addLabelTag link/div 2 处) |

> 调用点文件原为 `.ts`，因需写 JSX 语法，重命名为 `.tsx`。`main.tsx` 以
> 无扩展名 `import` 引入该插件，TS bundler 解析自动定位到 `.tsx`。

## 3. 转换规则

1. `class="xxx"` → `className="xxx"`；`id`/`data-*`/`data-tip`/`data-panel`/
   `data-default-hotkey`/`data-keyword`/`title`/`type`/`min`/`max`/`step`/
   `placeholder`/`href`/`target`/`value`/`alt`/`src` 原样。
2. `style="padding:10px;color:red"` → `style={{ padding: '10px', color: 'red' }}`
   （camelCase；`background-color` → `backgroundColor`、`text-align` → `textAlign`、
   `flex-shrink` → `flexShrink`、`flex-direction` → `flexDirection`、
   `flex-grow` → `flexGrow`、`flex-wrap` → `flexWrap`、`padding-bottom` →
   `paddingBottom`、`padding-right` → `paddingRight`、`padding-left` → `paddingLeft`、
   `margin-bottom` → `marginBottom`、`margin-top` → `marginTop`、`margin-left` →
   `marginLeft`、`border-right` → `borderRight`、`border-bottom` → `borderBottom`、
   `border-radius` → `borderRadius`、`font-size` → `fontSize`、`font-weight` →
   `fontWeight`、`text-align` → `textAlign`、`overflow-y` → `overflowY`、
   `overflow` → `overflow`、`background-image` → `backgroundImage`、
   `background` → `background`、`grid-template-columns` → `gridTemplateColumns`、
   `justify-content` → `justifyContent`、`z-index` → `zIndex`、`max-height` →
   `maxHeight`、`max-width` → `maxWidth`）。
3. `!important` 以字符串值形式写入 CSSProperties（如
   `{ color: "#ff8400 !important", paddingRight: "15px !important" }`），
   jsxToString 原样输出 `color:#ff8400 !important;padding-right:15px !important`。
4. `on*` 事件：原 HTML 由 jQuery 绑定，JSX 不写。
5. 自闭合 `<div class="simple-setting"></div>` → `<div className="simple-setting" />`
   （jsxToString 输出 `<div class="simple-setting"></div>`，DOM 等价）；
   `<input>` / `<br/>` / `<hr/>` / `<img/>` → 自闭合 void/non-void。
6. 动态 `${var}` → `{props.var}`；条件类名 `class="x ${cond ? "active" : ""}"` →
   `` className={`x ${cond ? "active" : ""}`} ``（模板字面量，保留尾空格语义）；
   条件 style `style="display: ${cond ? "block" : "none"}"` →
   `style={{ display: cond ? "block" : "none" }}`。
7. HTML 注释 `\x3c!-- ... --\x3e` → JSX 注释 `{/* ... */}`（jsxToString 不渲染
   注释，与原 HTML 注释 DOM 等价——注释内无功能性内容）。
8. 条件块 `${isJavdbSite ? '<div>...</div>' : ""}` →
   `{isJavdbSite && (<div>...</div>)}`（jsxToString 渲染 `false` 为 `""`）。
9. 预拼接 HTML 字符串注入（`cacheItemsHtml` / `qualityOptionsHtml`）→
   `dangerouslySetInnerHTML={{ __html: prop }}`（jsxToString 取 __html 作原始
   inner HTML 不转义，跳过 children，与原模板 `${prop}` 插值一致；doc/19 已为
   此扩展 jsxToString）。
10. ❓ emoji 与文案间空格：原 `<span>❓ </span>文案` 或 `文案 <span>❓</span>`
    → `<span>❓</span>{" "}文案` 或 `文案{" "}<span>❓</span>`（`{" "}` 显式
    保留单空格，与原 HTML 折叠后的单空格 DOM 等价）。
11. `<span>屏蔽单番号: </span>` 等含尾空格文案 → `{"屏蔽单番号: "}` 显式字符串
    表达式（避免 JSX 紧凑输出丢失尾空格）。
12. SVG（BackToTopButton）：`<svg viewBox="0 0 24 24"><path d="..." /></svg>`；
    `viewBox` 已是 camelCase（JSX 合法），`path` 自闭合由 jsxToString 还原为
    `<path ...></path>`（与原 `</path>` 闭合一致）。

## 4. 零偏差说明（行为变化）

- **属性间 / 子节点间 `\n` 与缩进丢失**：jsxToString 紧凑输出。原模板中的
  `\n` + 空格缩进（侧栏菜单项换行、面板内容缩进、setting-item 间换行）丢失。
  对 DOM 构建（`.prepend`/`.before`/`.append`/`layer.open content`/`.html()`）
  与 CSS 解析无影响，与示范 `temporary-image-container.tsx` 风格一致。
- **cacheItemsHtml / qualityOptionsHtml 注入**：原 `${cacheItemsHtml}` /
  `${qualityOptionsHtml}` 在模板中直接插值（含周围 `\n` 缩进空白）；JSX 模式下
  以 `dangerouslySetInnerHTML` 注入到 grid div / select，周围空白丢失。
  grid div / select 内的空白对 CSS grid 布局 / select 选项渲染无影响，DOM 等价。
- **`key` prop 重命名**：`CacheItemHtml` 的 `key` prop 与 React 保留 prop `key`
  冲突（JSX transform 将 `key={...}` 提取到 `element.key` 而非 `props`，组件内
  无法访问）。重命名为 `cacheKey`，输出的 `data-key` 属性值不变，DOM 等价。
  调用点 `key: item.key` → `cacheKey={item.key}`。
- **❓ 与文案间空格**：原模板 `<span>❓ </span>文案`（span 内尾空格 + 文案）
  或 `文案 <span>❓</span>`（文案尾空格 + span）经 HTML 折叠为单空格。JSX 以
  `{" "}` 显式保留单空格，DOM 等价。
- **style 尾分号丢失**：原 `color:#AAA;` → jsxToString 输出 `color:#AAA`
  （无尾分号），CSS 等价。
- **HelpDialog `<a>` 内尾空格**：原 `Clash Verge分流规则设置 </a> (如果你...)`
  → `{"Clash Verge分流规则设置 "}` + `{" "}` + `(如果你...)`，空格保留，DOM 等价。
- **KeywordLabel keyword 与 `<span>` 间空白**：原 `keyword\n<空格><span>` 折叠
  为无空白（inline 元素间），jsxToString 紧凑输出亦无空白，DOM 等价。
- **条件空 className 保留**：`side-menu-item ${cond ? "active" : ""}` 在非 active
  时为 `side-menu-item `（尾空格），jsxToString 输出 `class="side-menu-item "`
  （非空字符串不省略），与原模板一致。

## 5. 执行验证记录

### 5.1 类型检查 + 构建

```
$ pnpm run build
$ tsc -b && vite build
✓ 166 modules transformed.
dist/monkey-jhs-disassemble.user.js  505.36 kB │ gzip: 122.35 kB
✓ built in 359ms
```

`tsc -b`（strict + noUnusedLocals + noUnusedParameters +
noFallthroughCasesInSwitch + noUncheckedSideEffectImports）通过，无类型错误。
`vite build` 成功，产物 505.36 kB（gzip 122.35 kB），较 doc/20 基线 495.97 kB
（gzip 121.68 kB）+9.39 kB（+0.67 kB gzip，9 组件 JSX runtime 增量，可接受）。

### 5.2 残留引用核查

- `react-dom/server` / `renderToStaticMarkup`：`src/` 内运行时零引用。
- 9 个旧 `.ts` 组件文件已删除，`src/` 内零残留（grep 各 ComponentName 仅命中
  `.tsx` 组件 + `setting-plugin.tsx` 调用点）。
- `setting-plugin.ts` → `.tsx`，`main.tsx` 无扩展名 import 自动解析到 `.tsx`。

### 5.3 提交

- 主题：`设置弹层 9 组件转 TSX 原生组件`
- 文件：
  - 删除：9 个 `.ts` 组件 + `setting-plugin.ts`
  - 新增：9 个 `.tsx` 组件 + `setting-plugin.tsx`
  - 文档：`doc/21-setting-components-tsx.md`、`doc/README.md`
- hash：见 `git log -1`

## 6. 相关文件链接

- `src/core/jsx-to-string.ts`（轻量渲染器，doc/16）
- `src/components/temporary-image-container.tsx`（首个试点，doc/16）
- `doc/06-component-html-string.md`（SettingDialog/HelpDialog/BackupFileDialog 提取定稿，✅已执行，不改）
- `doc/13-remaining-html-components.md`（SettingMountBox/BackToTopButton/KeywordLabel/SimpleSettingPanel/CacheItemHtml/VideoQualityOption 提取定稿，✅已执行，不改）
- `doc/16-jsx-to-string.md`（jsxToString 方案，✅已执行）
- `doc/17-list-page-components-tsx.md` / `doc/18-history-actress-components-tsx.md` /
  `doc/19-blacklist-components-tsx.md` / `doc/20-detail-page-button-components-tsx.md`
  （前四批 .ts→.tsx 转换先例）
