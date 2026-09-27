/**
 * 已读星级筛选 —— 按**本脚本自己的评分**（`CarRecord.score`，0–5）分级过滤已读卡片。
 *
 * 背景（需求：doc/24）：
 * - 状态标签筛选原本只能按标签文本筛选（收藏 / 已读 / 无标签…），已读无法按星级细分；
 * - 评分来源是 `car_list`（IndexedDB `appData`）里的 `score` 字段，**不是站点评分**；
 * - 刻度为整数 0–5，`0` 表示未评分（`dpb-review-sync.tsx` 注释：「已看评分 0-5（0 表示未评分）」）。
 *
 * 数据流：插件在初始化与存储变更时把 `car_list` 灌入 {@link setCarRecords}，
 * 之后的**同步**筛选/计数直接读模块级索引（`applyFilter` 是同步函数，不能 await）。
 *
 * **纯读取**：本模块不写 car_list、不触发任何迁移。
 */

import { HAS_WATCH_ACTION } from '../../constants/status';
import type { CarRecord } from '../../core/storage-manager';
import { JHS_HIDE_ATTR } from './stf-collect';
import { siteSelector } from '../../core/util/site/selectors';

/** 星级芯片值前缀（与普通标签芯片的 `dataset.value` 区分）。 */
export const SCORE_VALUE_PREFIX = 'score:';

/** 可选星级（0–5；0 表示未评分）。 */
export const SCORE_RANGE: readonly number[] = [0, 1, 2, 3, 4, 5];

/** 星级芯片文案（如 `4星`）。 */
export function formatScoreLabel(score: number): string {
    return `${score}星`;
}

/** carNum → 本脚本评分（仅已读记录）；由 {@link setCarRecords} 重建。 */
let scoreByCarNum = new Map<string, number>();

/**
 * 用当前 `car_list` 重建评分索引（插件初始化 / 存储变更时调用）。
 *
 * @param records car_list 全量记录
 */
export function setCarRecords(records: CarRecord[]): void {
    const next = new Map<string, number>();
    for (const record of records) {
        if (!record || record.status !== HAS_WATCH_ACTION) continue;
        const carNum = typeof record.carNum === 'string' ? record.carNum.trim() : '';
        if (!carNum) continue;
        const raw = typeof record.score === 'number' && Number.isFinite(record.score) ? record.score : 0;
        // 归一化到 0–5 整数，防脏数据（历史记录可能越界或非整数）
        next.set(carNum, Math.min(5, Math.max(0, Math.round(raw))));
    }
    scoreByCarNum = next;
}

/** 评分索引是否已就绪（未灌入时星级芯片不应生成）。 */
export function hasScoreIndex(): boolean {
    return scoreByCarNum.size > 0;
}

/**
 * 取某番号的本脚本评分（仅已读记录）。
 *
 * @param carNum 番号
 * @returns 0–5 评分；非已读或无记录返回 null
 */
export function getScore(carNum: string): number | null {
    return scoreByCarNum.get(carNum) ?? null;
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

/**
 * 统计当前页面上「已读」卡片按评分的分布（供星级芯片计数）。
 *
 * **不依赖 DOM 里是否已渲染「已读」标签** —— 判定依据是 car_list 里存在该番号的
 * 已读记录（`getScore` 非 null）。这样「有记录但标签未渲染」的卡片也会被正确计入
 * 与筛选（对应需求 Q2a：从缓存补足）。
 *
 * 跳过被其他脚本隐藏（`data-hide`）的卡片，与筛选口径一致。
 *
 * @returns 分数 → 卡片数
 */
export function countWatchedByScore(): Record<number, number> {
    const counts: Record<number, number> = {};
    for (const item of Array.from(document.querySelectorAll('.item'))) {
        if (item.hasAttribute(JHS_HIDE_ATTR)) continue;
        const score = getScore(getItemCarNum(item));
        if (score === null) continue;
        counts[score] = (counts[score] ?? 0) + 1;
    }
    return counts;
}
