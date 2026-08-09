/**
 * 第三方库集中入口（CDN @require 外部引入 + 全局引用收敛）
 *
 * 7 个库（jquery / tabulator-tables / layui-layer / blueimp-md5 /
 * toastify-js / localforage / viewerjs）的 JS 不再打包进产物，改由
 * vite-plugin-monkey `build.externalGlobals` 映射为 CDN `@require` 运行时注入
 * （URL 见 vite.config.ts，与原始 archetype 完全一致）。本模块保留 import 语句
 * 仅为：(a) 让 externalGlobals 感知模块被使用并自动生成 `@require`；(b) 把
 * CDN 全局值挂到 window，供历史全局引用（layer-wrapper/plugins/main 等仍用
 * 全局名 $/layer/Tabulator/Toastify/localforage/Viewer/md5，类型见
 * `src/types/globals.d.ts` 的 `declare const`）。@require 脚本由 Tampermonkey
 * 在页面上下文先于本脚本注入，全局名已就绪，业务代码零改动。
 *
 * 背景与决策见 `doc/239-library-cdn-require.md`（反转 doc/24 的 ESM 打包方案，
 * 产物从 ~2.2MB 降回纯业务代码 + 库 CSS）。
 *
 * 注意（Tabulator）：CDN 全局 `Tabulator` 本身就是含全部模块的完整类
 * （TabulatorFull），因此必须用**默认导入**（编译为 `Tabulator.default` 访问）；
 * 命名导入 `import { TabulatorFull }` 会编译为 `Tabulator.TabulatorFull`
 * 属性访问（undefined）。类型 shim 见 `src/types/tabulator-shim.d.ts`。
 */

// 1. 先挂 window.jQuery/$（@require 的 jquery 全局已存在，此处为沙箱 window 显式赋值）
import './_jquery-global';
// 2. 7 库 JS（externalGlobals 外部化，运行时取 CDN 全局值）
import layer from 'layui-layer';
import Tabulator from 'tabulator-tables';
import Toastify from 'toastify-js';
import localforage from 'localforage';
import Viewer from 'viewerjs';
import md5 from 'blueimp-md5';

// 3. 库 CSS（仍打包进产物，运行时注入 <style>）。layer.css 原先由 layer.js 的
//    require('./layer.css') 自动带入，外部化后 layer.js 不再打包，需显式引入。
import 'layui-layer/layer.css';
import 'toastify-js/src/toastify.css';
import 'viewerjs/dist/viewer.min.css';
import 'tabulator-tables/dist/css/tabulator_semanticui.min.css';

// 4. 挂全局（供历史全局引用；Window 接口已在 globals.d.ts 声明这些字段）
window.layer = layer;
window.Tabulator = Tabulator;
window.Toastify = Toastify;
window.localforage = localforage;
window.Viewer = Viewer;
window.md5 = md5;

export { layer, Tabulator, Toastify, localforage, Viewer, md5 };
