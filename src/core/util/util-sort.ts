/**
 * 通用排序工具（提取自 CommonUtil）。
 * 纯函数，无外部依赖。
 */

/** genericSort 单条排序配置（原 genericSort 内 config s） */
export interface SortConfig<T = unknown> {
    key: string | ((item: T) => unknown) | null;
    order?: string;
}

/**
 * 通用多键排序（原 genericSort）：支持函数/字符串 key、升降序、日期识别。
 * @param data        待排序数组
 * @param sortConfigs 排序配置数组（key + order）
 * @param nullsFirst  空值处理开关，默认 true（保留原控制流）
 * @returns 排序后的新数组（不修改原数组）
 */
export function genericSort<T>(data: T[], sortConfigs: SortConfig<T>[], nullsFirst: boolean = true): T[] {
    if (!Array.isArray(data) || data.length === 0) {
        return [];
    }
    if (!Array.isArray(sortConfigs) || sortConfigs.length === 0) {
        return [...data];
    }
    const items = [...data];
    const coerceDate = (value: unknown): unknown => {
        if (value instanceof Date) {
            return value;
        }
        if (typeof value === 'string') {
            const parsed = new Date(value);
            if (!isNaN(parsed.getTime())) {
                return parsed;
            }
        }
        return value;
    };
    return items.sort((itemA: unknown, itemB: unknown) => {
        for (const config of sortConfigs) {
            const { key, order = 'asc' } = config;
            let valA: unknown = itemA;
            let valB: unknown = itemB;
            if (key != null) {
                if (typeof key === 'function') {
                    valA = key(itemA as T);
                    valB = key(itemB as T);
                } else {
                    valA = itemA && typeof itemA === 'object' ? (itemA as Record<string, unknown>)[key] : undefined;
                    valB = itemB && typeof itemB === 'object' ? (itemB as Record<string, unknown>)[key] : undefined;
                }
            }
            const coercedA = coerceDate(valA);
            const coercedB = coerceDate(valB);
            let cmp = 0;
            const aIsNull = valA == null;
            const bIsNull = valB == null;
            if (aIsNull && bIsNull) {
                return 0;
            }
            if (aIsNull) {
                if (nullsFirst) {
                    return 1;
                } else {
                    return -1;
                }
            }
            if (bIsNull) {
                if (nullsFirst) {
                    return 1;
                } else {
                    return -1;
                }
            }
            cmp =
                coercedA instanceof Date && coercedB instanceof Date
                    ? coercedA.getTime() - coercedB.getTime()
                    : typeof valA === 'number' && typeof valB === 'number'
                      ? valA - valB
                      : typeof valA === 'string' && typeof valB === 'string'
                        ? valA.localeCompare(valB)
                        : String(valA).localeCompare(String(valB));
            if (order === 'desc') {
                cmp *= -1;
            }
            if (cmp !== 0) {
                return cmp;
            }
        }
        return 0;
    });
}
