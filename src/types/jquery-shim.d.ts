/**
 * jQuery type shim — overrides @types/jquery auto-inclusion.
 * The project declares $ as `any` in globals.d.ts and relies on
 * untyped jQuery throughout. This shim prevents @types/jquery's
 * strict JQueryStatic from overriding that declaration.
 */
declare const $: any;
declare const jQuery: any;
export default $;
export { $, jQuery };
