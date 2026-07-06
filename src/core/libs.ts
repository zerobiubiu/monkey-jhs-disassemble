/**
 * 第三方库集中入口（ESM import 打包 + 全局挂载）
 *
 * 将原 userscript `@require` 的 7 个 CDN 库改为 ESM import 打包进产物：
 * jquery / tabulator-tables / toastify-js / localforage / viewerjs /
 * blueimp-md5 / layui-layer。
 *
 * 背景与决策见 `doc/24-library-esm-migration.md`。用户选方案 B（逐库 import，
 * 彻底模块化），接受产物体积增大——脚本本地执行无网络开销，ESM 打包后库代码
 * 直接在本地，反而更快。
 *
 * 挂全局的原因：layer-wrapper/plugins/main 等历史代码仍用全局名（$/layer/
 * Tabulator/Toastify/localforage/Viewer/md5，类型见 `src/types/globals.d.ts`
 * 的 `declare const`）。本模块挂载后，这些全局名运行时拿到 ESM 实例，类型仍
 * 由 globals.d.ts 提供（any），无需逐个修改业务文件。各库同时 `export`，
 * 供未来逐步逐文件迁移到直接 import。
 *
 * 求值顺序（关键）：
 * 1. `import './_jquery-global'` → jquery 求值 → window.jQuery/$ 挂载 ✓
 * 2. `import layer from 'layui-layer'` → layer.js `ready.run(jQuery)`
 *    此时 window.jQuery 已就绪，layer 正确初始化 ✓
 * 3. 其余库 import 求值
 * 4. 本模块顶层语句挂载 window.Tabulator/Toastify/localforage/Viewer/md5/layer
 */

// 1. 先挂 window.jQuery（layer 依赖，见 _jquery-global.ts 说明）
import './_jquery-global';
// 2. layui-layer（layer.js 内部 require('./layer.css') 自动带入 layer CSS，
//    且 ready.run(jQuery) 依赖上一步已挂的 window.jQuery）
import layer from 'layui-layer';
// 3. 其余 5 库
// 注：Tabulator 6.x 拆分为基础类 Tabulator（不含模块）与完整类 TabulatorFull
// （含 Format/Sort/ResponsiveLayout/Filter/Page 等全部模块）。原 userscript
// 使用的是含全部模块的完整版，此处必须导入 TabulatorFull，否则 formatter、
// headerSort、responsiveLayout 等列选项均不生效（控制台报 Invalid column
// definition option）。详见 doc/31-tabulator-full-fix.md。
import { TabulatorFull } from 'tabulator-tables';
import Toastify from 'toastify-js';
import localforage from 'localforage';
import Viewer from 'viewerjs';
import md5 from 'blueimp-md5';

// 4. 库 CSS（随 JS 打包进产物，运行时注入 <style>，替代原 main.tsx 的
//    utils.importResource CDN 动态 <link> 加载；layer.css 由 layer.js 的
//    require 自动带入，避免显式重复导入）
import 'toastify-js/src/toastify.css';
import 'viewerjs/dist/viewer.min.css';
import 'tabulator-tables/dist/css/tabulator_semanticui.min.css';

// 5. 挂全局（供历史全局引用；window 在 TS 中需 as any，因 Window 接口未列这些字段）
const win = window as any;
win.layer = layer;
win.Tabulator = TabulatorFull;
win.Toastify = Toastify;
win.localforage = localforage;
win.Viewer = Viewer;
win.md5 = md5;

export { layer, TabulatorFull as Tabulator, Toastify, localforage, Viewer, md5 };
