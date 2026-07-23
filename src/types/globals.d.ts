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

// JQuery 类型别名（@types/jquery 已被 shim 屏蔽，此处提供宽松类型供类型注解使用）
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- project-wide jQuery is intentionally untyped
type JQuery<T = HTMLElement> = any;

// Window 接口扩展：第三方库全局挂载（由 src/core/libs.ts 运行时挂载）
interface Window {
    jQuery: any;
    $: any;
    layer: any;
    Tabulator: any;
    Toastify: any;
    localforage: any;
    Viewer: any;
    md5: (s: string) => string;
}

// 无 @types 的 npm 包，声明模块以允许 import（类型为 any）
declare module 'layui-layer';
declare module 'tabulator-tables';
declare module 'jquery';

// Tampermonkey Grant API（类型化声明，替代原 any）
interface GMXmlHttpRequestDetails {
    method?: string;
    url: string;
    headers?: Record<string, string>;
    data?: string | Record<string, unknown> | FormData | Blob | ArrayBuffer;
    timeout?: number;
    responseType?: string;
    anonymous?: boolean;
    fetch?: boolean;
    nocache?: boolean;
    onload?: (response: any) => void;
    onerror?: (response: any) => void;
    ontimeout?: (response: any) => void;
    onprogress?: (response: any) => void;
    onabort?: (response: any) => void;
    onloadstart?: (response: any) => void;
}
declare const GM_xmlhttpRequest: (details: GMXmlHttpRequestDetails) => { abort: () => void };
declare const GM_openInTab: (url: string, options?: boolean | { active?: boolean; insert?: boolean; setParent?: boolean }) => { close: () => void };
declare const GM_setValue: (key: string, value: string | number | boolean | object) => void;
declare const GM_getValue: <T = any>(key: string, defaultValue?: T) => T;
declare const GM_addValueChangeListener: (key: string, callback: (name: string, oldValue: any, newValue: any, remote: boolean) => void) => number;
declare const GM_registerMenuCommand: (name: string, callback: () => void, accessKey?: string) => number;
declare const unsafeWindow: any;

// 应用运行时全局（由 main.tsx 启动时挂载到 window/unsafeWindow）
declare const show: typeof import('../core/toast').show;
declare const utils: import('../core/common-util').CommonUtil;
declare const storageManager: import('../core/storage-manager').StorageManager;
declare const clog: import('../core/logger').Logger;
declare const loading: () => { close: () => void };
declare const gmHttp: import('../core/gm-http').GmHttp;
declare const pluginManager: import('../plugins/plugin-manager').PluginManager;
declare const refresh: () => void;
