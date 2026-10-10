/**
 * 外部站点访问统计 —— 每个视频（番号）× 每个第三方站点的**真实外跳**次数。
 *
 * 背景：详情页的第三方站点按钮（`OtherSiteBtn`）是原生 `<a target="_blank">`，
 * 点击即打开 MissAV / SupJav 等站点。用户需要看到「这个视频的外站入口被点开过几次」。
 *
 * 口径（与产品确认）：
 * - 只有**真实外跳**才计 1 次：按钮已解析出可跳转 `href`（非空、非 `#` 占位），
 *   且是左键 / 中键 / Ctrl+点击 这类会真的打开外站的操作；未解析出链接的点击不计。
 * - 计数发生在**点击时**，不在预加载 / 缓存写入时：列表页预加载与详情页探测共用
 *   `otherSite` 缓存键空间，若在缓存写入处计数，每次列表页预加载都会被算成一次访问。
 *
 * 标识：以**番号（carNum，大写归一）**为稳定键，与 car_list / 清单 / 阅读状态同一口径，
 * 不依赖标题或任何展示属性，因此改名、排序、翻页都不会错位；不同视频的记录互相独立。
 *
 * 存储：独立 namespace `externalVisit`，一条记录 = 一个视频：
 * `{ total, bySite, updatedAt }`。
 * - **不复用** `otherSite`：那里的预加载走整表替换（`replacePersistentMap`），
 *   会把本功能的单条记录覆盖掉（丢失更新）。
 * - 写入用单条 `writePersistentEntry`（非整表替换），只动本视频这一条。
 *
 * 读取失败一律降级为「零」并只记日志（统计是增强信息，不能影响按钮与页面）；
 * 读取失败时**不写入**——宁可少计一次，也不把已存计数覆盖成从 1 开始。
 */

import { readPersistentMap, writePersistentEntry } from './persistent-data-store';

/** 一个视频的外站访问统计。 */
export interface ExternalVisitStat {
    /** 该视频的外站访问总次数。 */
    total: number;
    /** 按站点 id（`missAvBtn` / `supJavBtn` …）分列的次数。 */
    bySite: Record<string, number>;
    /** 最近一次计数时间（ms）；无记录为 0。 */
    updatedAt: number;
}

/** 统计读写接口（默认走持久数据存储；测试可注入替身）。 */
export interface ExternalVisitStore {
    read(carNum: string): ExternalVisitStat | undefined;
    write(carNum: string, value: ExternalVisitStat): void;
}

/** 持久化 namespace。 */
export const EXTERNAL_VISIT_NAMESPACE = 'externalVisit' as const;

/** 兼容旧的 localStorage key（仅在持久数据存储未激活时使用，例如非 JavDB Origin）。 */
export const EXTERNAL_VISIT_LEGACY_KEY = 'jhs_external_visit';

/** 空统计（零值：不显示徽标、不显示汇总行）。 */
export function emptyExternalVisitStat(): ExternalVisitStat {
    return { total: 0, bySite: {}, updatedAt: 0 };
}

/**
 * 归一化视频标识：去空白 + 大写。
 * 与 `car-status-journal` 的压缩口径（`carNum.trim().toUpperCase()`）一致，
 * 保证同一番号的不同写法落到同一条记录。
 */
export function normalizeVisitCarNum(carNum: string): string {
    return carNum.trim().toUpperCase();
}

function createDefaultStore(): ExternalVisitStore {
    return {
        read: (carNum) =>
            readPersistentMap<ExternalVisitStat>(EXTERNAL_VISIT_NAMESPACE, EXTERNAL_VISIT_LEGACY_KEY)[
                carNum
            ],
        write: (carNum, value) =>
            writePersistentEntry(
                EXTERNAL_VISIT_NAMESPACE,
                EXTERNAL_VISIT_LEGACY_KEY,
                carNum,
                value
            )
    };
}

let store: ExternalVisitStore = createDefaultStore();

function warn(message: string, error: unknown): void {
    const logger = typeof window !== 'undefined' && window.clog ? window.clog : null;
    if (logger) {
        logger.warn(message, error);
    } else {
        console.warn(message, error);
    }
}

function isStat(value: unknown): value is ExternalVisitStat {
    if (typeof value !== 'object' || value === null) return false;
    const stat = value as Partial<ExternalVisitStat>;
    return typeof stat.total === 'number' && typeof stat.bySite === 'object' && stat.bySite !== null;
}

/**
 * 读取一个视频的访问统计。无记录、番号为空或读取失败时返回零值统计（不抛错）。
 * @param carNum 番号（任意大小写，内部归一化）。
 */
export function readExternalVisitStat(carNum: string): ExternalVisitStat {
    const key = normalizeVisitCarNum(carNum);
    if (!key) return emptyExternalVisitStat();
    try {
        const stored = store.read(key);
        if (!isStat(stored)) return emptyExternalVisitStat();
        return {
            total: stored.total,
            bySite: { ...stored.bySite },
            updatedAt: stored.updatedAt
        };
    } catch (error) {
        warn('[外站访问] 读取统计失败，按零值展示', error);
        return emptyExternalVisitStat();
    }
}

/**
 * 记录一次真实外跳并返回**写入后**的统计（供调用方立即更新展示）。
 *
 * 读取失败时返回零值且不写入（保护已存计数）；番号为空或站点 id 为空时同样不计。
 * @param carNum 番号。
 * @param siteId 站点 id（`siteConfig.id`）。
 */
export function recordExternalSiteVisit(carNum: string, siteId: string): ExternalVisitStat {
    const key = normalizeVisitCarNum(carNum);
    if (!key || !siteId) return emptyExternalVisitStat();
    let current: ExternalVisitStat;
    try {
        const stored = store.read(key);
        current = isStat(stored)
            ? { total: stored.total, bySite: { ...stored.bySite }, updatedAt: stored.updatedAt }
            : emptyExternalVisitStat();
    } catch (error) {
        warn('[外站访问] 读取统计失败，本次不计数以免覆盖已有数据', error);
        return emptyExternalVisitStat();
    }
    const next: ExternalVisitStat = {
        total: current.total + 1,
        bySite: { ...current.bySite, [siteId]: (current.bySite[siteId] ?? 0) + 1 },
        updatedAt: Date.now()
    };
    try {
        store.write(key, next);
    } catch (error) {
        warn('[外站访问] 写入统计失败，本次计数未落库', error);
    }
    return next;
}

/** 测试用：注入统计存储替身；传 `null` 恢复默认实现。 */
export function __setExternalVisitStoreForTest(next: ExternalVisitStore | null): void {
    store = next ?? createDefaultStore();
}