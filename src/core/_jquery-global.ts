/**
 * jquery 全局挂载（副作用模块）
 *
 * 用途：在 `src/core/libs.ts` 引入 layui-layer 之前，先把 jquery ESM 实例
 * 挂到 `window.jQuery` / `window.$`。
 *
 * 原因：layui-layer 的 `layer.js` 是 CJS 脚本，尾部 `ready.run(jQuery)`
 * 直接读取全局裸变量 `jQuery`（即 `window.jQuery`）；若 layer 求值时该全局
 * 未设置，layer.open/close 等全部失效。而 jquery 的 UMD 在 CJS 分支下
 * `noGlobal=true`，`import $ from 'jquery'` 不会自动挂全局，必须手动挂。
 *
 * ESM 静态 import 无法在两个 import 之间插入顶层副作用语句（所有 import
 * 先求值，模块顶层语句后执行），故拆出本独立副作用模块：`libs.ts` 顶部
 * `import './_jquery-global'` 先求值本模块（jquery 求值 → 挂全局），
 * 随后 `import layer from 'layui-layer'` 求值时 window.jQuery 已就绪。
 */

import $ from 'jquery';

// 挂全局：供 layui-layer（ready.run(jQuery)）及历史全局 $/jQuery 引用使用
window.jQuery = $;
window.$ = $;

export { $ };
