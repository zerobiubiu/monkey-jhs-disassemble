/**
 * 状态动作与展示文本/颜色常量
 *
 * 对应原脚本 archetype/jhs.user.js 顶层的 d/h/p/m/u/f/v/b/w/k/S/C/_。
 * legacy 通过别名引入，保持内部引用不变。
 */

// 动作类型
/** 原 d */
export const FILTER_ACTION = 'filter';
/** 原 h */
export const FAVORITE_ACTION = 'favorite';
/** 原 p */
export const HAS_WATCH_ACTION = 'hasWatch';

// 屏蔽
/** 原 m */
export const BLOCK_TEXT = '🚫 屏蔽';
/** 原 u */
export const BLOCKED_TEXT = '🚫 已屏蔽';
/** 原 f */
export const BLOCK_COLOR = '#de3333';

// 收藏
/** 原 v */
export const FAVORITE_TEXT = '⭐ 收藏';
/** 原 b */
export const FAVORITED_TEXT = '⭐ 已收藏';
/** 原 w */
export const FAVORITE_COLOR = '#25b1dc';

// 已观看
/** 原 k */
export const WATCHED_TEXT = '🔍 已观看';
/** 原 S */
export const WATCHED_COLOR = '#d7a80c';

// 布尔标识
/** 原 C */
export const NO = 'no';
/** 原 _ */
export const YES = 'yes';
