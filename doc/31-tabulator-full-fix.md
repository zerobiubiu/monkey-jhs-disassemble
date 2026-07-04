# 31 - 修复 Tabulator 模块缺失导致迅雷字幕下载/预览按钮不渲染

- **文档类型**: 🔧开发指导
- **文档状态**: ✅已执行
- **关联文件**: `src/core/libs.ts`

## 1. 问题描述

### 现象
在 javdb 详情页点击"字幕 (迅雷)"按钮，弹出迅雷字幕列表弹窗后，
表格的"操作"列（第三列）为空，正常应显示"预览"+"下载"两个按钮。

用户原话："操作下边没内容了，正常应该有两个按钮的一个下载一个预览"。

复现选择器：
```
#xunlei-table-container > div.tabulator-tableholder > div > div:nth-child(1) > div:nth-child(3)
```
该单元格 `innerHTML` 为空字符串。

### 根因
Tabulator 6.x ESM 模块导出两个类：
- `Tabulator` — 基础类，`static defaultModules = false`，**不注册任何模块**
  （Format / Sort / ResponsiveLayout / Filter / Page 等均未注册）
- `TabulatorFull` — 完整类，构造函数传入 `allModules`，注册全部模块

`src/core/libs.ts` 原先写的是：
```ts
import { Tabulator } from 'tabulator-tables';
```
导入了**基础类 `Tabulator`**，导致 Tabulator 实例不含 Format 模块。

控制台报错（每次打开 Tabulator 表格时）：
```
Invalid column definition option: formatter
Invalid column definition option: headerSort
Invalid column definition option: responsive
Tabulator Module Not Installed: responsiveLayout
```

因为 Format 模块未注册，`formatter` 列选项被 Tabulator 忽略，
`SubtitleActionCell`（预览+下载按钮）的 `jsxToString` 渲染结果永远不会
被写入单元格 DOM → 操作列为空。

### 影响范围
所有使用 Tabulator 表格 + `formatter` 列选项的插件均受影响：
- `detail-page-button-plugin.tsx` — 迅雷字幕列表（预览/下载按钮缺失）
- `setting-plugin.tsx` — 备份文件列表（删除/下载/导入按钮缺失）
- `blacklist-plugin.ts` — 演员黑名单列表（删除/状态/演员/屏蔽类型单元格缺失）
- `history-plugin.ts` — 鉴定记录列表（操作按钮/来源标签缺失）

### 对比 archetype 为何正常
archetype `@require` 加载的是 UMD 版本：
```
https://cdn.jsdelivr.net/npm/tabulator-tables@6.3.1/dist/js/tabulator.min.js
```
UMD 版本 `tabulator.js` 末尾 `return TabulatorFull$1`，即 UMD 的
`window.Tabulator` 实际是 `TabulatorFull`（含全部模块），所以 archetype
的 formatter 一直正常工作。

项目改用 ESM `import` 后，`import { Tabulator }` 取到的是基础类，
丢失了全部模块 → formatter 失效。

## 2. 修改方案

仅改 `src/core/libs.ts` 一个文件，三处：

```diff
-// 3. 其余 5 库
-import { Tabulator } from 'tabulator-tables';
+// 3. 其余 5 库
+// 注：Tabulator 6.x 拆分为基础类 Tabulator（不含模块）与完整类 TabulatorFull
+// （含 Format/Sort/ResponsiveLayout/Filter/Page 等全部模块）。原 userscript
+// 使用的是含全部模块的完整版，此处必须导入 TabulatorFull，否则 formatter、
+// headerSort、responsiveLayout 等列选项均不生效（控制台报 Invalid column
+// definition option）。详见 doc/31-tabulator-full-fix.md。
+import { TabulatorFull } from 'tabulator-tables';
```

```diff
-win.Tabulator = Tabulator;
+win.Tabulator = TabulatorFull;
```

```diff
-export { layer, Tabulator, Toastify, localforage, Viewer, md5 };
+export { layer, TabulatorFull as Tabulator, Toastify, localforage, Viewer, md5 };
```

要点：
- 全局挂载名保持 `window.Tabulator` 不变（业务代码 `new Tabulator(...)`
  无需改动）
- export 名保持 `Tabulator` 不变（`import { Tabulator } from '../core/libs'`
  的调用处无需改动）
- `src/types/globals.d.ts` 中 `declare const Tabulator: any` + 
  `declare module 'tabulator-tables'` 均为 any，无类型问题

## 3. 验证

### 构建验证
```
node_modules/.bin/tsc -b        # exit 0
node_modules/.bin/vite build   # built in 1.13s
```

### 产物验证
```
node -e "..." # dist 中 win.Tabulator = TabulatorFull$1
```
dist 产物中 `TabulatorFull` 出现 4 次，`win.Tabulator = TabulatorFull$1`
赋值正确。

### 运行时验证（CDN 对照实验）
在 javdb 详情页用 CDN 的 UMD 版本（即 TabulatorFull）创建测试表格，
操作列 formatter 正确输出：
```html
<a class="a-primary">预览</a> <a class="a-success">下载</a>
```
证明 TabulatorFull 修复 formatter 后按钮正常渲染。

### 产物体积
| 阶段 | product (kB) | gzip (kB) | delta |
|------|-------------|-----------|-------|
| doc/30 基线 | 1222.54 | 315.09 | — |
| doc/31 修复后 | 1704.80 | 406.03 | +482.26 / +91.94 |

体积增大原因：`TabulatorFull` 打包了全部模块
（Format/Sort/Filter/Page/ResponsiveLayout/Export/Download/Clipboard/...），
而基础 `Tabulator` 不含任何模块。这与 archetype 通过 `@require` 加载
完整 UMD 版本的行为一致，属于正确成本。

## 4. 注意事项

用户需在 Tampermonkey 中手动更新脚本到最新 dist 产物
（`dist/monkey-jhs-disassemble.user.js`），否则仍会运行旧版（控制台
持续报 `Invalid column definition option: formatter`）。

`vite.config.ts` 中 `version: '1.0.0'` 固定不变，Tampermonkey 不会
自动检测更新，需手动覆盖安装。
