/**
 * 全局类型声明
 *
 * 声明通过 userscript @require 引入的第三方库全局（非 npm 打包），
 * 以及 Tampermonkey Grant API 和应用运行时挂载到 window 的全局对象。
 * 正式 TS 模块引用这些全局时由此获得类型（暂为最小 any 声明，
 * 后续可替换为 @types/tampermonkey / @types/jquery 等更精确类型）。
 */

// 第三方库（@require 引入，运行时为全局变量）
declare const $: any;
declare const jQuery: any;
declare const layer: any;
declare const Tabulator: any;
declare const Toastify: any;
declare const localforage: any;
declare const Viewer: any;
declare const QRCode: any;
declare const md5: (s: string) => string;

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
