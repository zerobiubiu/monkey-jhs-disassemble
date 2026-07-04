# 24 - 外部库 @require → ESM import 迁移

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 1. 背景

### 1.1 现状
原脚本 9 个 `@require` CDN 库，Tampermonkey 运行时注入全局变量：

| 库 | 版本 | npm 包 | 全局名 |
|----|------|--------|--------|
| parallel_GM_xmlhttpRequest | 540597/1613170 | 非 npm（GreasyFork 脚本） | parallel_GM_xmlhttpRequest |
| jquery | 3.7.1 | jquery | $ / jQuery |
| tabulator-tables | 6.3.1 | tabulator-tables | Tabulator |
| layui-layer | 1.0.9 | layui-layer | layer |
| blueimp-md5 | 2.19.0 | blueimp-md5 | md5 |
| toastify-js | 1.12.0 | toastify-js | Toastify |
| localforage | 1.10.0 | localforage | localforage |
| viewerjs | 1.11.1 | viewerjs | Viewer |
| qrcodejs | 1.0.0 | — | QRCode |

`src/types/globals.d.ts` 用 `declare const $: any` 等声明全局，代码直接用全局名。
`src/main.tsx` L262-267 用 `utils.importResource` 动态创建 `<link>` 加载 4 个库 CSS（layer / toastify / viewer / tabulator）。

### 1.2 问题
`@require` 库运行时走 CDN 下载，依赖网络；体积不计入产物但加载有延迟。

### 1.3 目标（用户选 方案 B：逐库 import，彻底模块化）
将可转换的库改为 bun 安装 + ESM import 打包进产物。用户接受产物体积增大——
脚本本地执行无网络开销，ESM 打包后库代码直接在本地，反而更快；即便不打包也
不降低体积（只是由运行时再加载）。

## 2. 方案

### 2.1 库分类与转换决策

| 库 | 转换 | 原因 |
|----|------|------|
| jquery | ✅ ESM import | CJS/UMD，`import $ from 'jquery'` 可行 |
| tabulator-tables | ✅ ESM import | package.json `module: dist/js/tabulator_esm.mjs` 原生 ESM 入口 |
| toastify-js | ✅ ESM import | CJS，`import Toastify from 'toastify-js'` 可行 |
| localforage | ✅ ESM import | CJS，自带 `typings/localforage.d.ts` |
| viewerjs | ✅ ESM import | package.json `module: dist/viewer.esm.js` 原生 ESM 入口 |
| blueimp-md5 | ✅ ESM import | CJS，`import md5 from 'blueimp-md5'` 可行 |
| layui-layer | ✅ ESM import（特殊处理） | CJS 脚本（`layer.js`），尾部 `ready.run(jQuery)` 依赖全局 `window.jQuery`，需先挂全局 |
| qrcodejs | ❌ 直接移除 | 全项目（含 archetype 脚本体）均无 `QRCode` 调用，仅 @require 声明，从未使用 |
| parallel_GM_xmlhttpRequest | ❌ 保留 @require | GreasyFork 脚本，非 npm 包 |

### 2.2 迁移策略：中心 `libs.ts` + 全局挂载
新增 `src/core/libs.ts`，集中 import 7 个可转换库 + 4 个库 CSS，挂载到 `window`
（供历史全局引用：`layer-wrapper`/`plugins`/`main.tsx` 等仍用全局名 `$`/`layer`/
`Tabulator`/`Toastify`/`localforage`/`Viewer`/`md5`）。

- 改动集中在 `libs.ts` + `main.tsx` + `vite.config.ts` + `globals.d.ts`，
  **无需逐个修改 plugins/core 文件**——这些文件仍用全局名，运行时拿到 ESM 实例。
- `libs.ts` 同时 `export` 各库，供未来逐步逐文件迁移到直接 import。
- 版本与原 `@require` 完全一致（jquery@3.7.1 / tabulator@6.3.1 / layer@1.0.9 /
  md5@2.19.0 / toastify@1.12.0 / localforage@1.10.0 / viewer@1.11.1），保证零偏差。

### 2.3 layer + jquery 耦合处理（关键）
`layui-layer` 的 `layer.js` 是 CJS 脚本（非标准 UMD）：
- 顶部 `require('./layer.css')`（CSS 随 JS 一起被引入）。
- 尾部 `ready.run(jQuery)` 直接调用，传入**全局裸变量 `jQuery`**（解析为
  `window.jQuery`）。若 layer 求值时 `window.jQuery` 未设置，`layer.open`/
  `layer.close` 等全部失效（`$(window)` 报错）。
- 尾部 `module.exports = layer`（可被 `import layer from 'layui-layer'` 拿到）。

jquery 的 UMD 在 CJS 分支下 `factory(global, true)`，`noGlobal=true`，**不自动挂
`window.jQuery`**。

ESM 静态 import 的陷阱：模块顶层语句在**所有 import 求值后**才执行，无法在
`import $ from 'jquery'` 与 `import layer from 'layui-layer'` 之间插入
`window.jQuery = $` 副作用。

**解法**：拆 `src/core/_jquery-global.ts`：
```ts
import $ from 'jquery';
(window as any).jQuery = $;
(window as any).$ = $;
```
`libs.ts` 顶部 `import './_jquery-global'`（副作用导入），ESM 求值顺序保证：
1. `libs.ts` → `import './_jquery-global'` → jquery 模块求值 → `_jquery-global.ts`
   顶层语句 `window.jQuery = $` **执行** ✓
2. `libs.ts` → `import layer from 'layui-layer'` → `layer.js` 的 `ready.run(jQuery)`
   此时 `window.jQuery` 已就绪 ✓

### 2.4 CSS 处理

| CSS | 原方式（main.tsx importResource） | 新方式（libs.ts ESM import） |
|-----|-----------------------------------|------------------------------|
| layui-layer layer.css | `<link>` CDN `layer.min.css` | `import 'layui-layer/layer.css'` |
| toastify-js toastify.css | `<link>` CDN `toastify.min.css` | `import 'toastify-js/src/toastify.css'` |
| viewerjs viewer.min.css | `<link>` CDN `viewer.min.css` | `import 'viewerjs/dist/viewer.min.css'` |
| tabulator semanticui | `<link>` CDN `tabulator_semanticui.min.css` | `import 'tabulator-tables/dist/css/tabulator_semanticui.min.css'` |

- ESM import CSS 由 Vite build 时 inline 进 JS 产物，运行时由 vite-plugin-monkey
  注入 `<style>`（同步，模块求值时即就绪），替代原 `importResource` 动态 `<link>`
  异步加载。CSS 更早可用，渲染等价（min 与非 min 仅压缩空白差异）。
- 项目自定义覆盖样式（`src/styles/viewer.css` 等）仍由 `main.tsx` 的 `H()` 注入，不变。

## 3. 修改清单

### 3.1 新增文件
- `src/core/_jquery-global.ts`：`import $ from 'jquery'` + 挂 `window.jQuery/$`
  （副作用模块，供 `libs.ts` 最先引入，确保 layer 求值前 jQuery 全局就绪）。
- `src/core/libs.ts`：集中 `import` 7 库 + 4 CSS，挂 `window` 全局，`export` 各库。

### 3.2 修改文件
- `src/main.tsx`：
  - 顶部加 `import './core/libs'`（最先求值，确保所有库就绪）。
  - 移除 L262-267 的 4 个 `utils.importResource`（CSS 改由 libs.ts ESM import）。
- `vite.config.ts`：`@require` 只保留 `parallel_GM_xmlhttpRequest`，移除其余 8 个。
- `src/types/globals.d.ts`：
  - 加 `declare module 'layui-layer'` / `'tabulator-tables'`（无 @types，允许 import）。
  - 移除 `declare const QRCode`（已删 @require 且从未使用）。
  - 更新头部注释说明库来源改为 ESM 打包。

### 3.3 依赖（package.json）
新增 dependencies：jquery / tabulator-tables / toastify-js / localforage /
viewerjs / blueimp-md5 / layui-layer（均与原 @require 同版本）。
新增 devDependencies：@types/jquery / @types/toastify-js / @types/localforage /
@types/viewerjs / @types/blueimp-md5。

## 4. 验证命令
```sh
bun run build   # tsc -b && vite build
```
预期：`tsc -b` 类型检查通过；`vite build` 成功；产物体积显著增大（jquery/
tabulator/viewer 等打包进 JS）；生成 userscript 头部 `@require` 只剩 1 个
（parallel_GM_xmlhttpRequest）。

## 5. 执行验证记录

### 5.1 安装依赖
```sh
bun install jquery@3.7.1 tabulator-tables@6.3.1 toastify-js@1.12.0 localforage@1.10.0 \
  viewerjs@1.11.1 blueimp-md5@2.19.0 layui-layer@1.0.9 \
  @types/toastify-js @types/localforage @types/viewerjs @types/blueimp-md5
```
@types/jquery 初装后因污染全局 `$` 卸载（见 5.2），改用 `declare module 'jquery'`。

### 5.2 类型检查（tsc -b）
- 首次 `tsc -b --force` 暴露 30+ 错误：根因 `@types/jquery` 的 UMD 全局声明
  `export as namespace jQuery` 把全局 `$` 从 `any` 提升为精确 `JQueryStatic`，
  导致历史按 `any` 写的业务代码（common-util / blacklist / history / nav-bar /
  new-video / list-page / detail-page-button / favorite-actresses / fold-category /
  base-plugin 等十几个文件）暴露隐藏类型问题（contentDocument / on overload /
  text() 返回 string|number|string[]|undefined / sort on JQuery 等）。
- **处理**：卸载 `@types/jquery`（这些类型错误不在本次“库迁移”范围内，让 `$` 回到
  `any` 保持与原 @require 一致）；`globals.d.ts` 加 `declare module 'jquery'`
  供 `import $ from 'jquery'`（类型 any）。
- viewerjs 自带 `types/index.d.ts` 使全局 `Viewer` 精确化，`main.tsx` L184
  `new Viewer(el, config)` 检查 config 类型（`ViewerOptions.toolbar.flipHorizontal:
  number` 不匹配 `ToolbarOption`）。**处理**：`viewer.ts` 的 `VIEWER_CONFIG` 返回
  类型 `ViewerOptions` → `any`（与原 @require 全局 Viewer 为 any 时不检查 config
  一致），并 `export interface ViewerOptions`（避免 `noUnusedLocals` 告警）。
- `@types/blueimp-md5` 有 `export as namespace md5` 但与 `declare const md5:
  (s:string)=>string` 兼容（单参 string 调用兼容），不报错，保留。`@types/toastify-js` /
  localforage 自带 types 不污染全局，保留。
- 最终 `tsc -b --force` 通过（exit 0）。

### 5.3 打包（vite build）
- **问题 1**：`layui-layer/layer.css` 含 IE hack（`*display: inline` / `*zoom: 1`），
  Vite 8 默认 LightningCSS 严格模式中断 build（`Unexpected token Semicolon`）。
  **处理**：`vite.config.ts` 加 `css.lightningcss.errorRecovery: true`，容错 strip
  （modern 浏览器无需 IE hack，渲染等价）。注：曾测试 `build.cssMinify:
  'esbuild'` 试图消除警告，但 esbuild 同样报 `Expected identifier but
  found "*"` [css-syntax-error] 警告，且产物更大（1211.60 kB vs 1202.82 kB）
  + 需额外安装 esbuild 包（Vite 8 不再默认捆绑），不采用。IE hack 是
  layui-layer 库本身的问题，无法通过换 minifier 根除；errorRecovery 警告
  无害（build 成功，IE hack 被 strip，渲染零影响）。
- **问题 2**：`tabulator-tables` 的 ESM 入口 `tabulator_esm.mjs` 为命名导出
  `export { Tabulator$1 as Tabulator }`，无 default。libs.ts `import Tabulator from
  'tabulator-tables'` 报 `"default" is not exported`。**处理**：改为
  `import { Tabulator } from 'tabulator-tables'`。
- 其余库导出确认：viewerjs `export { Viewer as default }`（default ✓）；
  toastify / localforage / md5 / layer 均 CJS `module.exports = X`（default 互操作 ✓）；
  layer.js 额外 `window.layer = layer`（L716）+ `module.exports = layer`（L1219）。
- build 成功，184 modules，产物 **1202.82 kB（gzip 309.12 kB）**，较基线
  518.40 kB（gzip 122.96 kB）增 +684.42 kB（gzip +186.16 kB）——7 库打包进来的
  体积，用户接受（本地执行无网络开销）。

### 5.4 产物校验
```
=== userscript header @require ===
12:// @require  https://update.greasyfork.org/scripts/540597/1613170/parallel_GM_xmlhttpRequest.js
=== ready.run vs window.jQuery 顺序 ===
4648:  window.jQuery = import_jquery.default;   // _jquery-global.ts 挂载
4649:  window.$ = import_jquery.default;
5519:  ready.run = function(_$) { ... }
5527:  ready.run(jQuery);                        // layer.js，此时 window.jQuery 已就绪 ✓
=== 库特征存在性（产物内匹配数）===
Tabulator:17  localforage:13  Toastify:37  Viewer:30  md5(:4
（jquery/layer 注释被 minify 删除，但代码已打包：L4638 jquery noConflict / L5519 ready.run）
```
- userscript 头部 `@require` 只剩 `parallel_GM_xmlhttpRequest`（1 个），原 9 个中的
  jquery / tabulator / layer / md5 / toastify / localforage / viewer / qrcode 全移除
  （qrcode 全项目未使用，含 archetype 脚本体亦无 `QRCode` 调用）。
- 求值顺序：产物中 `window.jQuery = import_jquery.default`（L4648，`_jquery-global.ts`
  挂载）在 `ready.run(jQuery)`（L5527，layer.js）之前，确保 layer 求值时
  `window.jQuery` 已就绪，layer.open/close 正常初始化。
- vite-plugin-monkey 自动追加 `@grant GM_addStyle`（CSS inline 注入 `<style>` 所需）
  与 `@grant window.close`，与库迁移无关。

### 5.5 结论
✅ 7 库（jquery / tabulator-tables / toastify-js / localforage / viewerjs /
blueimp-md5 / layui-layer）从 `@require` CDN 注入改为 ESM `import` 打包进产物；
qrcodejs 移除（全项目未使用）；parallel_GM_xmlhttpRequest 保留 `@require`
（GreasyFork 脚本，非 npm）。产物 1202.82 kB（gzip 309.12 kB），`@require` 仅剩
1 个。layer + jquery 耦合通过拆 `_jquery-global.ts` 副作用模块确保 ESM 求值顺序
（jquery 挂 window.jQuery → layer 求值 ready.run(jQuery)）。运行时库代码本地执行，
无 CDN 网络开销，符合用户“方案 B 逐库 import 彻底模块化”目标。
