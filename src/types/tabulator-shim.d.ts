/* eslint-disable @typescript-eslint/no-explicit-any -- tabulator-tables 无完整类型声明，shim 有意使用 any */
/**
 * Tabulator type shim — 屏蔽 tabulator-tables 自带类型，统一走 any。
 *
 * 原因：CDN 全局 `Tabulator`（tabulator.min.js）本身就是含全部模块的完整类
 * （对应 ESM 的 `TabulatorFull`），libs.ts 必须以**默认导入**使用（命名导入
 * `import { TabulatorFull }` 会编译为 `Tabulator.TabulatorFull` 属性访问，
 * 运行时为 undefined）。tsconfig 无 esModuleInterop，故与 jquery/layui-layer
 * 同模式提供默认导出 shim。详见 doc/239-library-cdn-require.md。
 */
declare const Tabulator: any;
export default Tabulator;