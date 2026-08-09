# 242 - jquery 3.7.1 → 4.0.0 升级

> 文档类型：🔧开发指导
> 文档状态：✅已执行
> 影响范围：运行时 CDN 库（jquery）+ vite.config.ts externalGlobals + 回归测试
> 前置文档：239-library-cdn-require.md（CDN 架构）、241-tabulator-viewerjs-upgrade.md（库升级先例）
> 替代文档：无
> 生效版本：1.46.2

## 1. 背景

doc/241 升级 tabulator/viewerjs 时，jquery 4.0.0 因大版本变更暂缓，用户要求先验证
可行性再决定。可行性验证结论（jsdom 实测 + 全量代码扫描）：**可行、低风险**。
用户确认执行，并同时要求新增 jquery×layer 兼容回归测试（Step 5）。

## 2. 前置可行性验证（摘要）

- CDN `jquery@4.0.0/dist/jquery.min.js` 返回 200。
- jsdom 冒烟：layui-layer 1.0.9 + jquery 4.0.0 全兼容（`ready.run(jQuery)` 初始化、
  `layer.open/msg/close/load/tips` 正常、`$(window).width()/.height()/.scrollTop()` 无异常）。
- src/ 全量扫描：jQuery 4 移除的 13 个静态方法（`$.trim/isArray/parseJSON/type/now/
  isNumeric/isFunction/isWindow/camelCase/nodeName/cssNumber/cssProps/fx.interval`）、
  `toggleClass(布尔)` 签名、原型 `push/sort/splice`、`.size()`、`:even/:odd`、
  `.attr(name,false)` —— **全部零命中**。
- 先例：archetype/pageSort.user.js 本即 `@require jquery@4.0.0`；@types/jquery 已是 ^4.0.1。

## 3. 方案

| 项 | 内容 |
|----|------|
| npm 包 | `jquery` 3.7.1 → **4.0.0**（exact 锁定，与 CDN 同步） |
| CDN URL | `externalGlobals.jquery` → `jquery@4.0.0/dist/jquery.min.js` |
| 版本号 | 1.46.1 → **1.46.2**（patch，运行时库变更） |
| 回归测试 | 新增 `tests/jquery4-layer-compat.test.ts`（6 用例，jsdom） |
| 文档 | doc/242 + README + changelog + AGENTS.md §6.3 |

不改任何 src/ 业务代码（libs.ts / _jquery-global.ts / types shim 对外部化与 any
声明不敏感）。

## 4. 实施

### 4.1 修改文件清单

| 文件 | 改动 |
|------|------|
| `package.json` | jquery 3.7.1→4.0.0；version 1.46.1→1.46.2 |
| `bun.lock` | bun add 更新 |
| `vite.config.ts` | externalGlobals jquery URL → 4.0.0；注释更新；userscript.version 1.46.2 |
| `tests/jquery4-layer-compat.test.ts` | **新增**：jquery×layer 兼容回归（见 §4.2） |
| `AGENTS.md` | §6.3 测试清单追加新套件 |
| `doc/README.md` / `changelog/CHANGELOG.md` | 阅读顺序 + 计数 + v1.46.2 条目 |

### 4.2 回归测试设计要点

- `// @vitest-environment jsdom`；`window.eval` 按 @require 顺序注入
  `node_modules/jquery/dist/jquery.min.js` → `layui-layer/dist/layer.js`（与 CDN 同源同版）。
- **坑 1**：vitest jsdom 下动态 `<script>` 注入不执行（实测），改用 `window.eval`。
- **坑 2**：layer.js 的 `ready.getPath` 读 `document.scripts[last].src`，eval 环境无
  script 元素抛 `Cannot read ... 'src'`——先插入占位 `<script src=...>` 解决。
- 断言：jquery 版本 4.0.0、layer 初始化、`$(window)` 尺寸 API 不抛错、
  `layer.open` 产出 `.layui-layer` DOM / close / closeAll / msg / load / tips、
  项目常用 jQuery API 冒烟。

## 5. 执行验证记录

### 5.1 执行环境

Windows，Bun 1.x，Vite 8.2.1，TypeScript 6.0.3，vitest 4.1.10。

### 5.2 验证命令与实际输出

| 命令 | 结果 |
|------|------|
| `bun run build`（tsc -b && vite build） | ✅ 通过，产物 1,168.21 kB（gzip 299.24 kB），@require 含 `jquery@4.0.0`，@version 1.46.2，`window.jQuery = jquery.default` interop 不变 |
| `bun run test` | ✅ 13 文件 **183 用例**全绿（177 + 新增 6） |
| `bun run lint` | ✅ 0 errors |
| `bun run check:structure` | ✅ OK |

### 5.3 前端或调用方验证

真机 Tampermonkey 回归清单：
- 所有 layer 弹窗（设置/黑名单/历史/备份/FC2/清单）打开/关闭/拖拽
- Tabulator 表格排序/分页/formatter
- 焦点相关交互（搜索框聚焦、输入、focusin/focusout 顺序变化）
- 跨标签页同步、toast、图片查看器

### 5.4 验证结论

✅ jquery 4.0.0 升级完成（npm + CDN 同步），全部门禁通过，回归测试锁定
layer 兼容性。

### 5.5 已知限制

- **focus/blur 事件顺序改为 W3C 标准**（blur→focusout→focus→focusin），若发现
  依赖旧顺序的交互需单独处理。
- `.attr(name, false)` 现在删除属性（src/ 零命中，无影响）。
- 移除 IE<11/旧浏览器支持（现代浏览器运行无影响）。

## 6. 后续验证建议

- 真机回归确认 focus 相关交互与全部 layer/Tabulator 功能。
- 若 jquery 后续出 4.0.x patch，按 doc/241 同模式升级（npm + CDN URL 同步）。