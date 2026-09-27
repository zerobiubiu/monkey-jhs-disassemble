/**
 * 已读星级筛选 + car_list 状态索引 —— 按**本脚本自己的记录**做筛选/补渲染。
 *
 * 背景（需求：doc/24）：
 * - 状态标签筛选原本只能按标签文本筛选，已读无法按星级细分；
 * - 评分来源是 `car_list`（IndexedDB `appData`）里的 `CarRecord.score`，**不是站点评分**；
 * - 刻度为整数 0–5，`0` 表示未评分（`dpb-review-sync.tsx`：「已看评分 0-5（0 表示未评分）」）。
 *
 * 数据流：插件在初始化与存储变更时把 `car_list` 灌入 {@link setCarRecords}，
 * 之后的**同步**筛选/计数/补渲染直接读模块级索引（`applyFilter` 是同步函数，不能 await）。
 *
 * **纯读取**：本模块不写 car_list、不触发任何迁移。
 */

import { HAS_WATCH_ACTION } from '../../constants/status';
import type { CarRecord } from '../../core/storage-manager';
import { siteSelector } from '../../core/util/site/selectors';

import { JHS_HIDE_ATTR } from './stf-collect';

/** 星级芯片值前缀（与普通标签芯片的 `dataset.value` 区分）。 */
export const SCORE_VALUE_PREFIX = 'score:';

/** 可选星级（0–5；0 表示未评分）。 */
export const SCORE_RANGE: readonly number[] = [0, 1, 2, 3, 4, 5];

/** 星级芯片文案（如 `4星`）。 */
export function formatScoreLabel(score: number): string {
    return `${score}星`;
}

/** 索引条目：一条 car_list 记录在本页需要用到的最小信息。 */
interface CarIndexEntry {
    /** 记录状态（`FAVORITE_ACTION` / `HAS_WATCH_ACTION` / `FILTER_ACTION` / 其他原值）。 */
    status: string;
    /** 已读评分（0–5；仅已读记录有意义，非已读固定 0）。 */
    score: number;
}

/** carNum → 索引条目；由 {@link setCarRecords} 重建。 */
let carIndex = new Map<string, CarIndexEntry>();

/**
 * 用当前 `car_list` 重建索引（插件初始化 / 存储变更时调用）。
 *
 * 评分归一化为 0–5 整数（缺失/非法 → 0，越界截断），防历史脏数据；
 * 空番号记录被忽略。
 *
 * @param records car_list 全量记录
 */
export function setCarRecords(records: CarRecord[]): void {
    const next = new Map<string, CarIndexEntry>();
    for (const record of records) {
        if (!record) continue;
        const carNum = typeof record.carNum === 'string' ? record.carNum.trim() : '';
        if (!carNum) continue;
        const status = typeof record.status === 'string' ? record.status : '';
        const raw = typeof record.score === 'number' && Number.isFinite(record.score) ? record.score : 0;
        next.set(carNum, {
            status,
            score: Math.min(5, Math.max(0, Math.round(raw)))
        });
    }
    carIndex = next;
}

/** 索引中是否存在已读记录（无已读时不应生成星级芯片）。 */
export function hasScoreIndex(): boolean {
    for (const entry of carIndex.values()) {
        if (entry.status === HAS_WATCH_ACTION) return true;
    }
    return false;
}

/**
 * 取某条 car_list 记录的状态。
 *
 * @param carNum 番号
 * @returns 状态原值；无记录返回 null
 */
export function getStatus(carNum: string): string | null {
    return carIndex.get(carNum)?.status ?? null;
}

/**
 * 取某番号的**本脚本评分**（仅已读记录）。
 *
 * @param carNum 番号
 * @returns 0–5 评分；非已读或无记录返回 null
 */
export function getScore(carNum: string): number | null {
    const entry = carIndex.get(carNum);
    return entry && entry.status === HAS_WATCH_ACTION ? entry.score : null;
}

/**
 * 解析星级芯片值。
 *
 * @param value 芯片 `dataset.value`
 * @returns 0–5 的分数；非星级芯片返回 null
 */
export function parseScoreChipValue(value: string): number | null {
    if (!value.startsWith(SCORE_VALUE_PREFIX)) return null;
    const raw = Number(value.slice(SCORE_VALUE_PREFIX.length));
    return Number.isInteger(raw) && raw >= 0 && raw <= 5 ? raw : null;
}

/**
 * 取卡片上的番号（站点列表卡片标题 `strong` 的文本）。
 *
 * @param item `.item` 元素
 * @returns 番号文本；取不到返回空串
 */
export function getItemCarNum(item: Element): string {
    return item.querySelector(siteSelector('listTitleStrong'))?.textContent?.trim() ?? '';
}

/** 遍历当前页未被其他脚本隐藏的卡片番号。 */
function eachVisibleItemCarNum(visit: (carNum: string, item: Element) => void): void {
    for (const item of Array.from(document.querySelectorAll('.item'))) {
        if (item.hasAttribute(JHS_HIDE_ATTR)) continue;
        visit(getItemCarNum(item), item);
    }
}

/**
 * 统计当前页面上「已读」卡片按评分的分布（供星级芯片计数）。
 *
 * **不依赖 DOM 里是否已渲染「已读」标签** —— 判定依据是 car_list 里存在该番号的
 * 已读记录（`getScore` 非 null）。这样「有记录但标签未渲染」的卡片也会被正确计入
 * 与筛选。跳过被其他脚本隐藏（`data-hide`）的卡片，与筛选口径一致。
 *
 * @returns 分数 → 卡片数
 */
export function countWatchedByScore(): Record<number, number> {
    const counts: Record<number, number> = {};
    eachVisibleItemCarNum((carNum: string) => {
        const score = getScore(carNum);
        if (score === null) return;
        counts[score] = (counts[score] ?? 0) + 1;
    });
    return counts;
}

/**
 * 找出当前页「有 car_list 记录、但页面未渲染对应状态标签」的卡片。
 *
 * 用于**从缓存补渲染**（需求 doc/24 Q2a）：这些卡片的记录真实存在，
 * 只是渲染路径（`.tags` 容器缺失、番号解析失败、渲染时序）没落地。
 *
 * @param hasTag 判断该卡片当前是否已有某个状态标签文本
 * @returns 待补渲染的 `{ item, carNum, status }` 列表
 */
export function collectMissingStatusTags(
    hasTag: (item: Element, status: string) => boolean
): Array<{ item: Element; carNum: string; status: string }> {
    const missing: Array<{ item: Element; carNum: string; status: string }> = [];
    eachVisibleItemCarNum((carNum: string, item: Element) => {
        const status = getStatus(carNum);
        if (!status) return;
        if (hasTag(item, status)) return;
        missing.push({ item, carNum, status });
    });
    return missing;
}
