/**
 * 站点识别常量
 *
 * 在模块加载时（userscript run-at document-idle）依据当前 URL/title 求值，
 * 与原始脚本 archetype/jhs.user.js 顶层的 o/r/l/c/T/I/B/P/D/A 一一对应。
 * legacy 通过 `import { ... as 原字母 }` 别名引入，保持内部引用不变。
 */

/** 当前页面 URL（原 o） */
export const currentHref: string = window.location.href;

/** 是否为 JavDb 站点（原 r） */
export const isJavdbSite: boolean = currentHref.includes('javdb');

/** 是否为搜索/用户页（原 c） */
export const isSearchOrUserPage: boolean =
    currentHref.includes('/search?q') ||
    currentHref.includes('/search/') ||
    currentHref.includes('/users/');

// 站点/类别标识
/** 原 T */
export const JAVDB = 'javdb';
/** 原 B */
export const ACTOR = 'actor';
/** 原 P */
export const ACTRESS = 'actress';
/** 原 D */
export const CENSORED = 'censored';
/** 原 A */
export const UNCENSORED = 'uncensored';
