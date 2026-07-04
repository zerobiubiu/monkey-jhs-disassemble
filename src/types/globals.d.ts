/**
 * 全局类型声明
 *
 * 第三方库（jquery/tabulator-tables/toastify-js/localforage/viewerjs/
 * blueimp-md5/layui-layer）现由 src/core/libs.ts 以 ESM import 打包进产物，
 * 并在运行时挂载到 window（供历史全局引用：layer-wrapper/plugins/main 等仍用
 * 全局名 $/layer/Tabulator/Toastify/localforage/Viewer/md5）。此处 declare const
 * 仅为这些全局名提供 any 类型，运行时值来自 libs.ts。
 *
 * Tampermonkey Grant API 与应用运行时挂载到 window 的全局对象亦在此声明。
 */

// 第三方库（由 src/core/libs.ts ESM import 打包后挂全局，此处仅声明全局名类型）
declare const $: any;
declare const jQuery: any;
declare const layer: any;
declare const Tabulator: any;
declare const Toastify: any;
declare const localforage: any;
declare const Viewer: any;
declare const md5: (s: string) => string;

// 无 @types 的 npm 包，声明模块以允许 import（类型为 any）
declare module 'layui-layer';
declare module 'tabulator-tables';
declare module 'jquery';

// Tampermonkey Grant API
declare const GM_xmlhttpRequest: any;
declare const GM_openInTab: any;
declare const GM_setValue: any;
declare const GM_addValueChangeListener: any;
declare const unsafeWindow: any;

// 应用运行时全局（由 legacy 启动时挂载到 window/unsafeWindow）
declare const show: any;
declare const utils: any;
declare const storageManager: any;
declare const clog: any;
declare const loading: () => { close: () => void };
declare const gmHttp: any;
declare const pluginManager: any;
declare const refresh: () => void;
