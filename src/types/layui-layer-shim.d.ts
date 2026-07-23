/**
 * layui-layer type shim — prevents @types/layui-layer from being resolved.
 * @types/layui-layer carries `/// <reference types="jquery" />` which pulls
 * in @types/jquery's strict JQueryStatic, overriding the project's `any`
 * global $. This shim keeps `layer` as `any` (matching globals.d.ts).
 */
declare const layer: any;
export default layer;
