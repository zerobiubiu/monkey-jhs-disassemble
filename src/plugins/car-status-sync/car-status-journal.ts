/**
 * 车辆状态增量日志（journal）共享解析模块。
 *
 * 职责：提供跨站同步增量载荷的读取、排序、校验、压缩等纯函数，
 * 供 javdb 发布端（CarListReaderPlugin）与 missav 消费端
 * （MissavStatusTagPlugin）共用，消除两端重复实现。
 *
 * 所有函数均为纯函数，无 GM/IDB/DOM 依赖，可独立单测。
 * 提取自 missav-status-tag-plugin.ts 与 car-list-reader-plugin.ts（doc/189 协议升级）。
 */

import { normalizeCarNum } from '../../core/domain/car-num';
import {
    CAR_STATUS_DELTA_COMPACT_THRESHOLD,
    STATUS_LIST,
    type CarStatusDeltaJournal,
    type CarStatusDeltaPayload
} from './car-status-config';

/** 兼容旧载荷：新协议使用 revision，旧协议回退到 ts（协议升级）。 */
export function getPayloadRevision(payload: { revision?: number; ts: number }): number {
    const revision = payload.revision ?? payload.ts;
    return Number.isInteger(revision) && revision >= 0 ? revision : -1;
}

/** 校验单个增量载荷是否合法（action/items/ts/revision + items 内 carNum/status/url_path）。 */
export function isDeltaPayload(value: unknown): value is CarStatusDeltaPayload {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const payload = value as Record<string, unknown>;
    if (payload.action !== 'upsert' && payload.action !== 'delete') return false;
    if (!Array.isArray(payload.items) || payload.items.length === 0) return false;
    if (typeof payload.ts !== 'number' || !Number.isInteger(payload.ts) || payload.ts < 0) {
        return false;
    }
    if (
        payload.revision !== undefined &&
        (typeof payload.revision !== 'number' || !Number.isInteger(payload.revision) || payload.revision < 0)
    ) {
        return false;
    }
    return payload.items.every((item) => {
        if (item === null || typeof item !== 'object' || Array.isArray(item)) return false;
        const record = item as Record<string, unknown>;
        if (typeof record.carNum !== 'string' || record.carNum.trim() === '') return false;
        if (payload.action === 'delete') return true;
        return (
            typeof record.status === 'string' &&
            record.status.trim() !== '' &&
            STATUS_LIST.includes(record.status as (typeof STATUS_LIST)[number]) &&
            typeof record.url_path === 'string' &&
            record.url_path.trim() !== ''
        );
    });
}

/** 读取 GM 中的增量日志，兼容新数组与旧单对象形态（协议升级）。 */
export function readDeltaJournal(value: unknown): CarStatusDeltaJournal {
    const values: unknown[] = Array.isArray(value) ? value : value ? [value] : [];
    return values.filter(isDeltaPayload);
}

/** 按修订号升序排列增量日志；相同修订号保持原始插入顺序（稳定排序）。 */
export function sortDeltaJournal(journal: CarStatusDeltaJournal): CarStatusDeltaJournal {
    return journal
        .map((payload, index) => ({ payload, index }))
        .sort((left, right) => {
            const revisionDiff = getPayloadRevision(left.payload) - getPayloadRevision(right.payload);
            return revisionDiff || left.index - right.index;
        })
        .map(({ payload }) => payload);
}

/** 统计增量日志中的变更项总数（所有载荷 items 长度之和）。 */
export function countDeltaItems(journal: CarStatusDeltaJournal): number {
    return journal.reduce((total, payload) => total + payload.items.length, 0);
}

/** 日志较长时按番号保留最终操作，避免中间重复更新占用 GM 配额（协议升级）。 */
export function compactDeltaJournal(journal: CarStatusDeltaJournal): CarStatusDeltaJournal {
    if (countDeltaItems(journal) <= CAR_STATUS_DELTA_COMPACT_THRESHOLD) return journal;
    const latestByCar = new Map<
        string,
        { payload: CarStatusDeltaPayload; item: CarStatusDeltaPayload['items'][number] }
    >();
    for (const payload of sortDeltaJournal(journal)) {
        for (const item of payload.items) {
            latestByCar.set(normalizeCarNum(item.carNum, 'upper'), { payload, item });
        }
    }
    const grouped = new Map<string, CarStatusDeltaPayload>();
    for (const { payload, item } of latestByCar.values()) {
        const key = `${getPayloadRevision(payload)}:${payload.action}:${payload.ts}`;
        const existing = grouped.get(key);
        if (existing) existing.items.push(item);
        else grouped.set(key, { ...payload, items: [item] });
    }
    return sortDeltaJournal(Array.from(grouped.values()));
}
