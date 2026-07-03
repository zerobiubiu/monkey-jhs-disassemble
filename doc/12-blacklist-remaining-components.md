# 12 - Blacklist 插件剩余零散 HTML 转组件

**文档类型**：🔧开发指导
**文档状态**：✅已执行

## 1. 背景

`src/plugins/blacklist-plugin.ts` 在 9ac1138（Blacklist 弹窗转组件）已将
`openBlacklistDialog` 的 layer.open content 提取为 `BlacklistDialog`
组件。但插件内仍有 8 处零散 HTML 字符串（confirmMessage 拼接 / dataType
下拉 options / 4 个 Tabulator formatter 单元格 / paginationCounter /
filterActorVideo 的 movie-list 包装）内联在插件逻辑中，未组件化。

本次按 doc/06 统一规定（组件为普通函数返回 HTML 字符串，不用 JSX、不用
renderToStaticMarkup）将这 8 处 HTML 提取为独立组件，插件改为
`import { X } from "../components/x"` 后调用 `X(props)`，保留原 HTML
结构/类名/内联 style/\n 转义与缩进，动态值用 props 注入，与原脚本零偏差。

## 2. 修改方案

### 2.1 新增组件（8 个，均返回 HTML 字符串）

| 组件文件 | 来源（blacklist-plugin.ts） | props |
|---|---|---|
| `src/components/blacklist-confirm-message.ts` | addBlacklist confirmMessage 拼接（L96-134） | tagName/name/isAlreadyBlacklisted/isActress/notFirstPageByQuery/notFirstPageByJavbus |
| `src/components/blacklist-data-type-options.ts` | getTableData `$dataTypeSelect.html(...)`（L339-341） | totalCount/actorCount/actressCount |
| `src/components/blacklist-name-cell.ts` | loadTableData 演员 formatter 返回值（L414） | url/name |
| `src/components/blacklist-url-type-cell.ts` | loadTableData 屏蔽类型 formatter 返回值（L472） | hasTag |
| `src/components/blacklist-status-cell.ts` | loadTableData 状态 formatter 返回值（L513） | tipText/statusText |
| `src/components/blacklist-action-cell.ts` | loadTableData 操作 formatter 返回值（L602） | （无） |
| `src/components/movie-list-wrapper.ts` | filterActorVideo wrapperHtml（L758） | html/nextUrl |
| `src/components/blacklist-pagination-counter.ts` | loadTableData paginationCounter 返回值（L392） | actorCount/currentCarCount |

### 2.2 插件调用点改造（`src/plugins/blacklist-plugin.ts`）

- 顶部新增 8 个 `import { X } from "../components/x";`。
- `addBlacklist`：原 `let confirmMessage: string;` + 4 条模板赋值 + 2 个
  `if` 追加 `<br/>` 注意，改为先算 `isActress`/`tagName`/`notFirstPageByQuery`/
  `notFirstPageByJavbus` 4 个布尔/值，再 `const confirmMessage =
  BlacklistConfirmMessage({...})`。原两个独立"非第一页"`if` 的判定逻辑
  （currentHref/isJavbusSite 解析）保留在插件，结果以布尔 prop 传入，
  组件内仍以两个独立 `if` 各自追加（保零偏差：两者皆成立时追加两次相同
  br 注意，与原脚本一致）。`tagName` 由原 if 块内 `const` 提为外层
  `let tagName: string = ""`（演员分支保持空串，组件 isActress=true 时不读）。
- `getTableData`：`$dataTypeSelect.html(\`...<option>...\`)` 改为
  `$dataTypeSelect.html(BlacklistDataTypeOptions({...}))`。
- `loadTableData`：
  - 演员 formatter `return \`<a class="open-url">...\`` → `return BlacklistNameCell({ url, name })`
  - 屏蔽类型 formatter `return \`<span style=...>\`` → `return BlacklistUrlTypeCell({ hasTag })`
  - 状态 formatter `return \`<span data-tip=...>\`` → `return BlacklistStatusCell({ tipText, statusText })`（tipText/statusText 计算仍由调用方完成）
  - 操作 formatter `return '\n...delete-btn...'` → `return BlacklistActionCell()`（事件绑定仍由 onRendered 持有）
  - paginationCounter `return \`演员:...<span>\`` → `return BlacklistPaginationCounter({ actorCount, currentCarCount: this.currentCarCount })`
- `filterActorVideo`：`const wrapperHtml = \`<div class='movie-list'>...\`` →
  `const wrapperHtml = MovieListWrapper({ html, nextUrl })`，`nextDom =
  utils.htmlTo$dom(wrapperHtml)` 不变。

### 2.3 头部注释同步

`blacklist-plugin.ts` 顶部 JS→TS 改造要点的 addBlacklist 局部变量列表
由 `confirmMessage/tagUrl/tagName/...` 更新为
`isActress/tagName/confirmMessage/.../notFirstPageByQuery/notFirstPageByJavbus/...`，
反映新变量名（tagUrl 仍在 if 块内 const，未列出）。

## 3. 执行验证记录

### 3.1 类型检查与构建

```
$ pnpm run build
$ tsc -b && vite build
✓ 102 modules transformed.
dist/monkey-jhs-disassemble.user.js  465.42 kB │ gzip: 116.61 kB
✓ built in 281ms
```

`tsc -b` 通过 strict + noUnusedLocals + noUnusedParameters +
noFallthroughCasesInSwitch + noUncheckedSideEffectImports；`vite build` 成功出包。
初次构建报 `tagName: string | undefined` 不可赋给 `ActressInfo.movieType:
string`，已将 `let tagName: string | undefined` 改为 `let tagName: string = ""`
（演员分支保持空串，组件 isActress=true 时不读）后通过。

### 3.2 产物体积

- 修改前基线（doc 11 / 2dd92b3）：~463 kB
- 修改后：**465.42 kB**（gzip 116.61 kB）
- 增量：+1.58 kB（8 个组件函数 + 调用点改造，符合预期，无 react-dom/server 引入）
- 结论：产物体积稳定在 ~465 kB 基线，未引入新依赖。✓

### 3.3 残留 HTML 核查

`blacklist-plugin.ts` 内剩余的字符串字面量均为：
- 纯文本返回（性别角色 roleText / 影视类别 movieTypeText，非 HTML，不转换）
- show.ok/show.error/show.info 的提示文案（非 HTML 模板，属 toast 文本）
- Tabulator langs 中文文案（非 HTML）

均符合"非 HTML 字符串不转换"的规则。✓

## 4. 提交

- 主题：`blacklist 剩余 HTML 转组件`
- 文件：`src/components/blacklist-confirm-message.ts`、
  `src/components/blacklist-data-type-options.ts`、
  `src/components/blacklist-name-cell.ts`、
  `src/components/blacklist-url-type-cell.ts`、
  `src/components/blacklist-status-cell.ts`、
  `src/components/blacklist-action-cell.ts`、
  `src/components/movie-list-wrapper.ts`、
  `src/components/blacklist-pagination-counter.ts`、
  `src/plugins/blacklist-plugin.ts`、`doc/12-blacklist-remaining-components.md`、
  `doc/README.md`
