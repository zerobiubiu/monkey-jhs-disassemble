/**
 * 车辆状态同步配置模块 —— javdb 与 missav 跨域数据传递的共享常量。
 *
 * 来源：archetype/jhsCarListReader.user.js + archetype/missavStatusTag.user.js。
 * 原架构通过后端服务器（Cloudflare Workers + D1）中转，现改为油猴原生
 * GM_setValue/GM_getValue/GM_addValueChangeListener 跨域传递。
 *
 * 核心原理：集成后 javdb 和 missav 运行的是同一个 userscript（同一打包产物），
 * GM 存储在同一脚本的所有实例间共享，GM_addValueChangeListener 的 remote=true
 * 表示变更来自其他标签页/域名实例，因此可实现零网络请求的实时跨域同步。
 *
 * WebDav 仅用于 missav 端本地 IndexedDB 的备份/恢复（随 jhs 主数据库一起备份）。
 */

/** 影片状态枚举（与 jhs.user.js / 后端 cars 表 status 一致）。 */
export const STATUS_LIST = ['filter', 'favorite', 'hasDown', 'hasWatch'] as const;
export type CarStatus = (typeof STATUS_LIST)[number];

/**
 * 状态 → 标签映射（missav 端渲染用）。
 * 值与 jhs.user.js / cars 表的 status 枚举一致。
 * 来源：missavStatusTag.user.js L53-58。
 */
export const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    favorite: { label: '⭐ 已收藏', color: '#25b1dc' },
    hasWatch: { label: '🔍 已观看', color: '#d7a80c' },
    filter: { label: '🚫 已屏蔽', color: '#de3333' },
    hasDown: { label: '💾 已下载', color: '#1f7a3d' }
};

/** GM 存储键：跨域传递的车辆状态数据（全量，列存 + gzip + base64）。 */
export const GM_KEY_CAR_STATUS_DATA = 'jhs_car_status_data';

/** GM 存储键：跨域传递的车辆状态增量变更（单条/批量，不压缩）。 */
export const GM_KEY_CAR_STATUS_DELTA = 'jhs_car_status_delta';

/** GM 存储键：上次全量同步完成的时间戳（毫秒）。 */
export const GM_KEY_LAST_SYNC_TS = 'jhs_car_status_last_sync_ts';

/**
 * 全量载荷结构。
 * javdb 端写入 GM 存储，missav 端读取。
 */
export interface CarStatusPayload {
    /** 列存数据经 gzip 压缩后的 base64 字符串（解压后为 CarStatusColumnar JSON）。 */
    data: string;
    /** 水位线：本次数据生成时刻的 ISO8601 字符串。 */
    hwm: string;
    /** 总记录数（所有 status 分组的 carNums 长度之和）。 */
    count: number;
    /** 数据生成时间戳（毫秒）。 */
    ts: number;
}

/**
 * 增量变更载荷结构（不压缩，几条记录几十字节）。
 * javdb 端每次 saveCar/removeCar 时写入，missav 端实时消费。
 */
export interface CarStatusDeltaPayload {
    /** 变更类型：upsert（新增/更新）或 delete（删除） */
    action: 'upsert' | 'delete';
    /** 变更项列表 */
    items: Array<{
        carNum: string;
        status?: string;
        url_path?: string;
    }>;
    /** 变更时间戳（毫秒） */
    ts: number;
}

/**
 * 单个 status 下的列存数据（三个并列数组，下标一一对应）。
 * 与后端 ColumnarStore 结构一致（来源：后端 types.ts StatusColumn）。
 */
export interface StatusColumn {
    carNums: string[];
    urls: string[];
    update_date: string[];
}

/**
 * 全量列存结构：4 个 status 各一个 StatusColumn。
 * 存储在 GM 存储中（gzip + base64 压缩后）。
 */
export type ColumnarStore = Record<CarStatus, StatusColumn>;

/** javdb 视频详情页路由前缀（剥离后节省传输体积）。 */
export const VIDEO_ROUTE_PREFIX = '/v/';

/** missav 端本地 IndexedDB 配置（来源：missavStatusTag.user.js L38-40）。 */
export const MISSAV_DB_NAME = 'MissAV-CarStatus';
export const MISSAV_DB_STORE = 'cars';

/** 日志前缀。 */
export const LOG_PREFIX_JHS = '[JHS CarSync]';
export const LOG_PREFIX_MISSAV = '[MissAV]';
