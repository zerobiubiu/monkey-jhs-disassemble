/** 批量评价与清单按视频并发执行的默认数量。 */
export const DEFAULT_BATCH_OPERATION_CONCURRENCY = 2;

/** 设置与执行共用正整数校验；缺省或非法值恢复默认值，不截断小数。 */
export function normalizeBatchOperationConcurrency(value: unknown): number {
    const concurrency = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
    return Number.isSafeInteger(concurrency) && concurrency > 0
        ? concurrency
        : DEFAULT_BATCH_OPERATION_CONCURRENCY;
}
