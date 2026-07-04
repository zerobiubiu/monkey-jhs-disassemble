/**
 * 评分显示配置常量 —— 对应 archetype/jhsRatingDisplay.user.js L24-45 `CONFIG`。
 *
 * 原 IIFE 闭包内的常量集合，模块化后改为独立导出，供 rating-utils /
 * rating-cache / rating-net / rating-renderer / rating-display-plugin 复用。
 * 各字段含义与原脚本一致，值未做任何调整。
 */

/** 评分显示功能运行配置 */
export interface RatingConfig {
    /** 调试日志开关（开启后控制台输出 [JHS-Rating][...] 标记日志） */
    DEBUG_MODE: boolean;

    /** jhs IndexedDB 库名（与 storageManager 的 localforage 实例一致：JAV-JHS） */
    IDB_NAME: string;
    /** jhs IndexedDB 仓库名（与 storageManager 一致：appData） */
    IDB_STORE: string;
    /** jhs car_list 在 IDB 中的键名 */
    CAR_LIST_KEY: string;

    /** 评分缓存 localStorage 键名（永久不过期） */
    RATING_CACHE_KEY: string;
    /** 评分缓存寄生写入 jhs IDB 的键名 */
    IDB_RATING_KEY: string;

    /** 列表页卡片选择器（javdb 列表 + 用户页列） */
    ITEM_SELECTOR: string;

    /** 悬停延迟 ms（悬停卡片超过该时长才触发懒加载） */
    HOVER_DELAY: number;
    /** 评分抓取并发上限 */
    FETCH_CONCURRENCY: number;
    /** 评分抓取请求超时 ms */
    FETCH_TIMEOUT: number;
    /** 评分抓取重试次数（不含首次） */
    FETCH_RETRY: number;
}

/** 评分显示功能运行配置（与原脚本 CONFIG 字段值逐字一致） */
export const RATING_CONFIG: RatingConfig = {
    DEBUG_MODE: false,

    // jhs IndexedDB（与 storageManager 的 localforage 实例同库同仓库）
    IDB_NAME: 'JAV-JHS',
    IDB_STORE: 'appData',
    CAR_LIST_KEY: 'car_list',

    // 评分缓存（localStorage + 寄生 jhs IndexedDB，永久不过期）
    RATING_CACHE_KEY: 'jdb:rating_cache_v2',
    IDB_RATING_KEY: 'jhsRatingDisplay_data',

    // 卡片选择器
    ITEM_SELECTOR: '.movie-list .item, .is-user-page .column.is-one-quarter',

    // 请求控制
    HOVER_DELAY: 500, // 悬停延迟 ms
    FETCH_CONCURRENCY: 3, // 并发上限
    FETCH_TIMEOUT: 8000, // 请求超时 ms
    FETCH_RETRY: 1 // 重试次数
};
