# 239 - 第三方库打包 → CDN @require 外部引入

> 文档类型：🔧开发指导
> 文档状态：✅已执行
> 影响范围：构建配置 + 库加载方式（vite.config.ts / src/core/libs.ts / 类型 shim）
> 前置文档：24-library-esm-migration.md（本文反转其方案 B）
> 替代文档：无
> 生效版本：1.46.0

## 1. 背景

### 1.1 现状

doc/24 将 7 个第三方库（jquery / tabulator-tables / toastify-js / localforage /
viewerjs / blueimp-md5 / layui-layer）从 `@require` CDN 改为 ESM import 打包进产物，
产物膨胀至 **2,209.63 kB**（gzip 511.88 kB，1.45.4 实测）。

### 1.2 目标

用户要求反转打包方式：**脚本库 JS 不打包，改为通过 CDN URL 外部引入**
（userscript 头部 `@require`）。库 CSS 继续打包（实测仅 ~88.9 KB，占产物 ~4%，
见 §2.3）。

## 2. 方案

### 2.1 vite-plugin-monkey `build.externalGlobals`

vite-plugin-monkey v8 内置 `externalGlobals`：

```ts
externalGlobals: {
    '模块名': ['CDN 全局变量名', '@require URL', ...]
}
```

- 模块标记为 bundle external，不打包进产物；
- import 绑定编译为对 CDN 全局的访问（IIFE 参数注入）；
- URL 自动写入 userscript 头部 `@require`（仅当模块被实际 import）。

### 2.2 命名导入陷阱（Tabulator，关键）

最小实验（.scratch-eg 临时工程构建验证）确认 IIFE 全量 interop（`__toESM`）行为：

| 写法 | 编译产物 | 运行时结果 |
|------|----------|-----------|
| `import { TabulatorFull } from 'tabulator-tables'` | `tabulator_tables.TabulatorFull` | **undefined**（CDN 全局 `Tabulator` 无 `TabulatorFull` 静态属性） |
| `import Tabulator from 'tabulator-tables'` | `tabulator_tables.default` | ✓ 完整类本身 |

CDN `tabulator.min.js` 的全局 `Tabulator` 本身就是含全部模块的完整类
（UMD 返回值即 `TabulatorFull`，验证 `node_modules/tabulator-tables/dist/js/tabulator.js`
尾部 `return TabulatorFull$1`）。故 **libs.ts 必须改默认导入**；其余 6 库默认导入
均编译为 `.default` 访问，正常。

### 2.3 CSS 处理

- 库 JS 外部化后，layer.js 不再打包，其 `require('./layer.css')` 自动带入的
  layer.css 会丢失，需在 libs.ts **显式 `import 'layui-layer/layer.css'`**。
- 其余 3 个库 CSS（toastify / viewer / tabulator）继续打包。
- 实测打包产物中 4 段库 CSS 共 **91,015 B（~88.9 KB）**，占产物 ~4%：
  layer.css 45,044 B（其中 35,320 B 为 6 个 base64 内联图片）/ tabulator 37,375 B /
  viewer 7,514 B / toastify 1,082 B。移 CDN 收益极小，且引入样式加载网络依赖与
  闪烁风险，故 CSS 保留打包。

### 2.4 类型 shim

tsconfig 无 `esModuleInterop`，`tabulator-tables` 此前无 paths shim（真实包无 default
导出），默认导入需新增 shim（与 jquery / layui-layer 同模式）。

## 3. 实施

### 3.1 修改文件清单

| 文件 | 改动 |
|------|------|
| `vite.config.ts` | version 1.45.4→1.46.0；新增 `build.externalGlobals`（7 映射 + CDN URL）；更新 @require 注释 |
| `src/core/libs.ts` | `import { TabulatorFull }` → `import Tabulator`（默认导入）；`window.Tabulator = Tabulator`；export 同步；显式 `import 'layui-layer/layer.css'`；注释更新为 CDN 说明 |
| `src/types/tabulator-shim.d.ts` | **新增**：`declare const Tabulator: any; export default Tabulator;`（与 jquery-shim 同模式） |
| `tsconfig.app.json` | paths 新增 `"tabulator-tables": ["./src/types/tabulator-shim.d.ts"]` |
| `src/types/globals.d.ts` | 头部注释更新（库来源改为 CDN @require 注入页面全局） |
| `package.json` | version 1.45.4→1.46.0（与 userscript.version 同步） |
| `AGENTS.md` | §3.1 / §3.4 libs.ts / §6.1 @require 描述同步 |
| `changelog/CHANGELOG.md` | 新增 v1.46.0 条目 |
| `doc/README.md` | 阅读顺序新增 239 + 进度概览计数更新 |

### 3.2 CDN URL（与原始 archetype/jhs.user.js 完全一致，全部实测 200）

```
jquery@3.7.1/dist/jquery.min.js
tabulator-tables@6.3.1/dist/js/tabulator.min.js
layui-layer@1.0.9/dist/layer.min.js
blueimp-md5@2.19.0/js/md5.min.js
toastify-js@1.12.0/src/toastify.min.js  ← jsdelivr 动态 minify src/toastify.js
localforage@1.10.0/dist/localforage.min.js
viewerjs@1.11.1/dist/viewer.min.js
```

qrcodejs（全项目未使用）与 parallel_GM_xmlhttpRequest（GreasyFork URL 410 失效）
不引入。

## 4. 执行验证记录

### 4.1 执行环境

Windows，Bun 1.x，Vite 8.1.3，vite-plugin-monkey 8.x。

### 4.2 验证命令

```sh
bun run build        # tsc -b && vite build
bun run test         # vitest run（12 文件 177 用例）
bun run lint         # eslint src/
bun run check:structure
```

### 4.3 实际输出

- `tsc -b && vite build` 通过，产物 **1,167.82 kB**（gzip 299.67 kB），
  较 1.45.4 基线 2,209.63 kB **-1,041.81 kB（-47%）**。
- 产物头部 `@require` 恢复 7 行 CDN URL（§3.2 清单，顺序与 archetype 一致）。
- 产物 IIFE 尾部 `})($, layer, Tabulator, Toastify, localforage, Viewer, md5);`
  正确接收 7 个 CDN 全局。
- interop 校验：`window.Tabulator = tabulator_tables.default`（**无**
  `Tabulator.TabulatorFull` 访问）；`window.layer/jQuery/Viewer/md5/localforage`
  均 `.default` 访问。
- 4 段库 CSS 仍在产物（`_css(` ×4，layer/toastify/viewer/tabulator）。
- `bun run test`：12 文件 177 用例全绿。
- `bun run lint`：0 errors / 0 warnings。
- `bun run check:structure`：OK（370 files, 63 dirs within limits）。

### 4.4 前端或调用方验证

建议在 Tampermonkey 安装新产物实测：收藏/已看/评分、黑名单/历史/备份 Tabulator
表格、layer 弹窗、toast 通知、图片查看器、md5 相关功能（WebDav 备份加密）逐一
回归。@require 库由 Tampermonkey 在页面上下文先注入，功能路径与原始
archetype/jhs.user.js 一致。

### 4.5 验证结论

✅ 7 库 JS 改 CDN @require 外部引入，产物 -47%；库 CSS 保留打包；Tabulator
命名导入陷阱已规避（默认导入）；类型 shim + paths 映射补齐；全部构建/测试/
lint/结构门禁通过。

### 4.6 已知限制

- 恢复 CDN 网络依赖：jsdelivr 不可用时库加载失败、功能全挂（Tampermonkey
  会缓存 @require，缓解部分风险）。
- 库版本锁定在 URL 中，升级需手动改 vite.config.ts 的 externalGlobals。
- `@types/tabulator-tables` 仍驻留 devDependencies 但不再被模块解析使用
  （shim 接管），属无害冗余，暂不清理。

## 5. 后续验证建议

- 在 GreasyFork/Tampermonkey 实测安装与更新（@require 拉取与缓存）。
- 若未来 jsdelivr 不可用，可将 CDN 域名换为 unpkg/bootcdn 等镜像（externalGlobals
  单点修改）。