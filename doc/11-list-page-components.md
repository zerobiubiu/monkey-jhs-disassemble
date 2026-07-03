# 11 - list-page-button/list-page HTML 转组件

**文档类型**：🔧开发指导
**文档状态**：✅已执行

## 1. 背景

`src/plugins/list-page-button-plugin.ts` 与 `src/plugins/list-page-plugin.ts`
存在多处内联 HTML 字符串模板（模板拼接含 `<div`/`<a`/`<span`/`<input`/
`<table>`/`<li>` 等，经 `.append(html)` / `.prepend(html)` / `.wrap(html)` /
`$(html)` / `clog.log(html)` 消费），违反 doc/06 统一规定「HTML→组件一律返回
HTML 字符串函数」。本次将全部 HTML 模板提取为 `src/components/` 下 5 个函数
组件（返回 HTML 字符串，不用 JSX、不用 renderToStaticMarkup）。

`grep -n "<div\|<span\|<a \|<button\|<input\|<select\|<img\|<br\|<hr\|<p\|<ul\|<li\|<h[1-6]"`
定位的 HTML 位置共 7 处（list-page-button 2 处 + list-page 5 处）：

| # | 文件 | 函数 | 行号（转换前） | HTML 内容 | 消费方式 |
|---|------|------|----------------|----------|----------|
| 1 | list-page-button-plugin.ts | createMenuBtn | L135-137 | JavDb 菜单按钮组（两行：打开待鉴定/已收藏 + 演员页/标签页黑名单 + 新作品检测/演员黑名单/排序切换） | `.append(html)` |
| 2 | list-page-button-plugin.ts | createMenuBtn | L155-157 | JavBus 菜单按钮组（单行：打开待鉴定/已收藏 + 明星页黑名单+一键屏蔽 或 演员黑名单） | `.prepend(html)` |
| 3 | list-page-plugin.ts | fixBusTitleBox | L309 | `<span class="video-title" title=...>` wrap 文本节点 | `.wrap(html)` |
| 4 | list-page-plugin.ts | renderItemStatusTag | L376 | JavDb status-tag `<span>`（render 变体：`position:absolute;\n` 无尾空格，title 与 style 同行） | `.append(html)` |
| 5 | list-page-plugin.ts | filterMovieList | L545-547 | status-tag 双变体（JavDb `<span>` / JavBus `<a>+<span>`，filter 变体：`position:absolute; \n` 有尾空格，title 后换行再 style） | `.append(html)` |
| 6 | list-page-plugin.ts | filterMovieList | L565-568 | countTable 统计表格（4 列：耗时 + 屏蔽/收藏/演员/关键词/已观看/待鉴定/总数） | `clog.log(html)` |
| 7 | list-page-plugin.ts | addJumpPageControl | L1031-1045 | 跳页控件 `<li><input><button>`（原 jQuery `$("<input>",{...})` 链式创建） | `$("<li>",{...}).append()` |

`findCarNumAndHref` / `showCarNumBox` / `replaceHdImg` / `translate` /
`revertTranslation` 经核查无 HTML 字符串模板（纯 DOM 属性操作 / textContent
赋值），不在转换范围；`markDataListHtml` 位于 `hit-show-plugin.ts`，不在
本次两个目标插件内。

## 2. 组件清单（5 个新建）

| 组件文件 | 导出函数 | props | 替换位置 |
|----------|----------|-------|----------|
| `src/components/menu-button-box-html.ts` | `MenuButtonBoxHtml` | site / blacklistLabel / blacklistColor / actorsPage / tagsPage / advancedSearch / searchOrUserPage / sortLabel / newVideoCount / starPage | #1 #2 |
| `src/components/status-tag-html.ts` | `StatusTagHtml` | site / variant / text / color / dataTip / positionStyle | #4 #5 |
| `src/components/video-title-span.ts` | `VideoTitleSpan` | imgTitle | #3 |
| `src/components/jump-page-control.ts` | `JumpPageControl` | controlId / value | #7 |
| `src/components/page-count-table.ts` | `PageCountTable` | readDataTime / assembleDataTime / processPageTime / totalTime / filterCount / favoriteCount / actorFilterCount / keywordFilterCount / hasWatchCount / waitCheckCount / totalCount | #6 |

### 2.1 与示范 .tsx 的关系

`menu-button-box-html.ts` / `status-tag-html.ts` 与既有的
`menu-button-box.tsx` / `status-tag.tsx`（JSX 示范组件，孤立可用，不被
`main.tsx` 引入）内容等价，但本组返回 HTML 字符串，遵循 doc/06 统一规定
（不用 JSX、不用 renderToStaticMarkup）。示范 .tsx 保留不动，作为 React
渲染路径的可选参考。

### 2.2 status-tag 的 render / filter 双变体

`renderItemStatusTag`（L376）与 `filterMovieList`（L545）的 JavDb `<span>`
模板在字符级有差异：

- render 变体：`data-tip="${reasonType}" title="" style="...position:absolute;\n..."`（title 与 style 同行，`position:absolute;` 后直接换行）
- filter 变体：`data-tip="${reasonText}" title=""\n...style="...position:absolute; \n..."`（title 后换行+缩进再 style，`position:absolute; ` 后有一尾随空格再换行）

`StatusTagHtml` 以 `variant: "render" | "filter"` prop 区分两套模板，保
字符级零偏差；JavBus `<a>+<span>` 变体仅 filterMovieList 一处，无 render
对应。

## 3. 修改方案

### 3.1 `src/plugins/list-page-button-plugin.ts`

- 新增 `import { MenuButtonBoxHtml } from "../components/menu-button-box-html";`。
- L135-137 的 JavDb `.append(\`...\`)` 改为
  `.append(MenuButtonBoxHtml({ site:"javdb", blacklistLabel, blacklistColor, actorsPage: isActorsPage, tagsPage: currentHref.includes("/tags"), advancedSearch: isAdvancedSearch, searchOrUserPage: isSearchOrUserPage, sortLabel }))`。
- L155-157 的 JavBus `.prepend(\`...\`)` 改为
  `.prepend(MenuButtonBoxHtml({ site:"javbus", blacklistLabel, blacklistColor, starPage: isStarPage }))`。
- 删除不再使用的 `let flexGrowStyle = ""` 与其 else 赋值分支（flex-grow
  计算移入组件内部 `advancedSearch ? "" : "flex-grow:1;"`），避免
  `noUnusedLocals` 报错。

### 3.2 `src/plugins/list-page-plugin.ts`

- 新增 4 个组件 import（VideoTitleSpan / StatusTagHtml / JumpPageControl /
  PageCountTable）。
- `fixBusTitleBox`：`.wrap(\`<span class="video-title" ...>\`)` 改为
  `.wrap(VideoTitleSpan({ imgTitle }))`。
- `renderItemStatusTag`：`tagHtml` 模板改为
  `StatusTagHtml({ site:"javdb", variant:"render", text, color, dataTip: tagConfig.reasonType, positionStyle })`。
- `filterMovieList`：`tagHtml` 三元模板改为
  `StatusTagHtml({ site: isJavdbSite ? "javdb" : "javbus", variant:"filter", text, color, dataTip: reasonText as string, positionStyle })`
  （`reasonText` 经 `||=` 后必非空，`as string` 断言）；`clog.log(\`<table...>\`)`
  改为 `clog.log(PageCountTable({ readDataTime, assembleDataTime, processPageTime, totalTime, filterCount: this.currentPageFilterCount, ... totalCount: this.currentPageTotalCount }))`。
- `addJumpPageControl`：原 `$("<input>",{...})` + `$("<button>",{...})` +
  `$("<li>",{id}).append()` 链式创建改为 `$(JumpPageControl({ controlId, value: currentPage + 1 }))`
  一次创建，再 `$li.find("#jumpPageInput")` / `$li.find("button")` 取回
  jQuery 对象绑定 click/keypress（后续 jumpToPage 与绑定逻辑不变）。

## 4. 执行验证记录

### 4.1 构建

```
$ pnpm run build
$ tsc -b && vite build
✓ 93 modules transformed.
dist/monkey-jhs-disassemble.user.js  463.84 kB │ gzip: 116.15 kB
✓ built in 266ms
```

`tsc -b` 通过 strict + noUnusedLocals + noUnusedParameters；
`vite build` 成功出包。修复过程中曾因 `fixBusTitleBox` 的 `.wrap` edit
错位（`$item` 行重复）触发 TS1128 语法错误，已修正后通过。

### 4.2 产物体积

- 转换前基线（doc/README 进度概览）：460.16 kB（gzip 115.13 kB）
- 转换后：**463.84 kB**（gzip 116.15 kB）
- 增量：+3.68 kB（+0.80%），来自 5 个新组件文件的注释与函数体（无新依赖），
  无 react-dom/server 引入，符合 doc/06 规定。

### 4.3 残留 HTML 核查

```
$ grep -n "<div\|<span\|<a \|<button\|<input\|<select\|<img\|<table\|<tr\|<td\|<li\|<strong" \
  src/plugins/list-page-button-plugin.ts src/plugins/list-page-plugin.ts
（无匹配）
```

两插件已无任何内联 HTML 字符串模板，全部由组件函数返回。✓

### 4.4 提交

- 主题：`list-page-button/list-page HTML 转组件`
- 文件：`src/components/menu-button-box-html.ts`、
  `src/components/status-tag-html.ts`、`src/components/video-title-span.ts`、
  `src/components/jump-page-control.ts`、`src/components/page-count-table.ts`、
  `src/plugins/list-page-button-plugin.ts`、`src/plugins/list-page-plugin.ts`、
  `doc/11-list-page-components.md`、`doc/README.md`
- hash：见 `git log -1`
