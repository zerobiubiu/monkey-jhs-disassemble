# 27 - 清理全项目 JavBus 站点死代码

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 1. 背景

### 1.1 问题
该 userscript 的 `@match`/`@include` 只匹配 `javdb.com`（`vite.config.ts`），
脚本从不在 javbus 站点运行；运行期 `isJavdbSite` 恒为真、`isJavbusSite` 恒为假。
插件又仅在 `isJavdbSite` 时注册（`main.tsx` 的 `if (isJavdbSite)` 包裹）。
因此全项目所有 `isJavbusSite`/`JAVBUS` 分支、javbus 专属方法/选择器/CSS、
组件 javbus variant 均为永不执行的死代码，徒增产物体积与阅读噪声。

### 1.2 目标
一次性彻底删除全项目所有与 javbus 站点相关的代码，不留残留，不改变 javdb
功能行为，TypeScript 零报错。用户确认：本插件仅在 javdb 使用，无需保留任何
javbus 支持（含历史数据来源标签）。

## 2. 修改范围

### 2.1 常量与配置

| 文件 | 改动 |
|------|------|
| `src/constants/site.ts` | 删除 `isJavbusSite` 常量（及其 javbus/seejav/javsee/title 判定）、`JAVBUS` 常量导出 |
| `vite.config.ts` | `description` 末尾 `JavDb|JavBus` → `JavDb` |
| `src/styles/javbus-masonry.css` | **删除整个文件**（javdb 列表用 `.movie-list`，不含 `.masonry`，此 CSS 对 javdb 无用） |

### 2.2 入口 `src/main.tsx`

- 删除 `isJavbusSite` import、`javbusMasonryCssRaw` import
- 删除 CSS replace 区段的 javbus 块（`javbusHideNavCss`/`javbusMasonryCss` 变量与 `__HIDENAV__` 替换）
- 删除 `if (isJavbusSite) injectCss(javbusMasonryCss)` 注入分支
- `isDetailPage`：删除 javbus 的 `#magnet-table` 分支，简化为 `return href.split('?')[0].includes('/v/')`
- `isListPage`：删除 javbus 的 `.masonry > div .item` 分支，简化为 `return $('.movie-list').length > 0 || href.includes('advanced_search')`
- clog error 过滤：`!filename.includes('javdb') && !filename.includes('javbus')` → `!filename.includes('javdb')`

### 2.3 组件（7 个）

| 文件 | 改动 |
|------|------|
| `blacklist-confirm-message.tsx` | 删除 `notFirstPageByJavbus` prop（接口字段+参数+渲染分支），仅留 `notFirstPageByQuery` |
| `history-nav-button.tsx` | `HistoryNavButtonVariant` 删 `'javbus'`，删 `case 'javbus'` 渲染分支 |
| `history-source-cell.tsx` | 清理注释（"JavBus" 来源标签分支已在 history-plugin 调用方删除） |
| `menu-button-box-html.tsx` | 删除 `MenuButtonSite` 类型、`site`/`starPage` prop、`if (site==='javbus')` 整个 javbus 单行布局分支 |
| `setting-mount-box.tsx` | `SettingMountBoxVariant` 删 `'topright'`/`'containerfluid'`，删两个 JavBus 挂载点渲染分支 |
| `status-tag-html.tsx` | 删除 `StatusTagSite` 类型、`site` prop、`if (site==='javbus')` 的 `<a>` 变体分支 |
| `video-title-span.tsx` | 清理注释（JavBus 标题 wrap 描述） |

### 2.4 简单插件（5 个）

| 文件 | 改动 |
|------|------|
| `filter-title-keyword-plugin.ts` | 删 `isJavbusSite` import；`handle` 删 `else if (isJavbusSite)` 分支 |
| `detail-page-button-plugin.tsx` | 删 `isJavbusSite` import；`createMenuBtn` 删 `if (isJavbusSite) $('#mag-submit-show').before(...)` 分支 |
| `review-plugin.tsx` | 删 `isJavbusSite` import；`handle` 删除整段 JavBus `/v2/search` 反查影片 ID 分支（约 35 行），保留 javdb 直接用 URL 末段；连带清理仅 javbus 用的 `API_BASE`/`reBuildSignature` import |
| `auto-page-plugin.ts` | 删 `isJavbusSite` import；`getInitialPageNumber` 删 `/page/N`·`/star/xxx/N` 解析分支；`loadNextPage` 删 `.avatar-box` 分支；`updatePageUrl`/`updatePageUrl_old` 删「第N頁」标题替换，仅保留 `replaceState`/`pushState` |
| `base-plugin.ts` | 删 `isJavbusSite` import；`getPageInfo` 删 javbus DOM 读取分支；`getActressPageInfo` 删 `/star/` 黑名单 URL 拼接分支、`nameEl` 三元简化 |

### 2.5 复杂插件（6 个）

| 文件 | 改动 |
|------|------|
| `highlight-magnet-plugin.ts` | 删 `isJavbusSite` import；删除 `handleBus()` 方法（`#magnet-table` 高亮）及调用；`showAll()` 删 javbus `#magnet-table tr` 分支 |
| `list-page-button-plugin.tsx` | 删 `isJavbusSite` import；`createMenuBtn` 删 `if (isJavbusSite)` 按钮组分支（`site="javbus"` 的 `MenuButtonBoxHtml`）；`bindEvent` 的 `nameEl` 三元简化 |
| `list-page-plugin.tsx` | 删 `isJavbusSite` import；删 `fixBusTitleBox()`/`cleanRepeatId()` 两方法及调用点；删 `VideoTitleSpan` import；`filterMovieList` 删 `.avatar-box` 跳过分支、`site` 三元→直接 javdb、`.item-tag` 注入分支；`bindClick`/`parseActressName`/`replaceHdImg`/`translate`/`revertTranslation` 各删 javbus 分支或三元 |
| `blacklist-plugin.tsx` | 删 `isJavbusSite`/`JAVBUS` import；`addBlacklist` 删 `notFirstPageByJavbus` 变量及分页段判定；`filterAllVideo` 删 `.avatar-box` 移除分支；`parseAndSaveFilterInfo` 删 `isJavbusDom`/`JAVBUS` 重赋值（`siteType` 恒 `JAVDB`） |
| `history-plugin.tsx` | 删 `isJavbusSite` import；`handle` 删 `#top-right-box` 注入分支（`variant="javbus"`）；来源列 formatter 删 `url.includes('javbus')` 标签分支；`handleClickDetail` 删 javbus 分支 |
| `setting-plugin.tsx` | 删 `isJavbusSite` import；`initCss` 删 `.container-fluid/.masonry` CSS 覆盖分支、三元简化为 javdb 常量；`handle` 删顶部菜单/详情页 h3 前 `.container-fluid` 注入分支；`initSimpleSettingForm` 两处删 `.masonry`/`.container-fluid .row` 预览分支 |

### 2.6 残留修复（组件 prop 删除后调用方对齐）
组件 `site`/`notFirstPageByJavbus` prop 删除后，调用方遗留的 prop 传递引发
TS 报错，逐一清理：
- `blacklist-plugin.tsx`：删除 `notFirstPageByJavbus={false}` 字面量传递
- `list-page-plugin.tsx`：删除两处 `site="javdb"` prop（`StatusTagHtml` render/filter 两处）
- `list-page-button-plugin.tsx`：删除 `site="javdb"` prop（`MenuButtonBoxHtml`）

## 3. 验证记录

- `grep -rni "javbus|seejav|javsee|isJavbusSite|JAVBUS|notFirstPageByJavbus|isJavbusDom|javbusMasonry" src/`：**零匹配**，全项目无 javbus 残留
- `grep -i javbus vite.config.ts`：零匹配
- `src/styles/javbus-masonry.css`：文件已删除
- `tsc -b`：退出码 0，全项目类型检查通过（`noUnusedLocals`/`noUnusedParameters` 开启）
- `vite build`：成功，191 modules，产物 `dist/monkey-jhs-disassemble.user.js` **1206.64 kB（gzip 310.94 kB）**
  - 较 doc/26 重命名后基线 1223.66 kB（gzip 314.42 kB）**-17.02 kB（gzip -3.48 kB）**
  - 增量来自删除 `javbus-masonry.css` + 十余处 javbus 死代码分支
- lightningcss 的 `Unexpected token Semicolon` 警告为已知 layer.css IE hack（doc/24），无害
- javdb 分支与 `if (isJavdbSite)` 守卫原样保留，运行期行为不变

## 4. 关于 doc/26 导入笔误修正

doc/26 曾修正 `main.tsx:13` 的 `isJavdbSite as l`（笔误）→ `isJavbusSite`。本次
清理将 `isJavbusSite` 整个删除，该修正随之消解（`main.tsx` 不再导入 `isJavbusSite`）。
doc/26 作为历史定稿保留原样，笔误的来龙去脉见 doc/26 §3。
