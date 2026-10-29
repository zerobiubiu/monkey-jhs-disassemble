/** 备份主数据全量写入、持久化回读与失败补偿；不依赖 iterate 的提前退出语义。 */
import type { BackupRestoreStore } from '../../types/backup-restore';

/** 比较 JSON 备份值：对象键顺序无关，数组顺序、数值与类型必须一致。 */
export function backupValuesEqual(left: unknown, right: unknown): boolean {
    if (Object.is(left, right)) return true;
    if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return false;
    if (Array.isArray(left) || Array.isArray(right)) {
        return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
            left.every((value, index) => backupValuesEqual(value, right[index]));
    }
    const a = left as Record<string, unknown>;
    const b = right as Record<string, unknown>;
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((key) =>
        Object.prototype.hasOwnProperty.call(b, key) && backupValuesEqual(a[key], b[key]));
}

/** 保留备份未涉及的现有键；写入或回读失败时，尽力还原本次涉及的键并明确报告失败。 */
export async function restoreBackupEntries(
    store: BackupRestoreStore,
    data: Record<string, unknown>
): Promise<number> {
    const entries = Object.entries(data);
    if (!entries.length) throw new Error('备份主数据为空，未执行恢复');
    const existed = new Set(await store.keys());
    const previous = new Map<string, unknown>();
    for (const [key] of entries) previous.set(key, await store.getItem(key));
    const attempted: string[] = [];
    try {
        for (const [key, value] of entries) {
            // 写入可能已落盘后才拒绝，因此失败的当前键也纳入补偿。
            attempted.push(key);
            await store.setItem(key, value);
        }
        for (const [key, value] of entries) {
            if (!backupValuesEqual(await store.getItem(key), value)) {
                throw new Error(`备份恢复校验失败：${key} 写入后内容不一致`);
            }
        }
    } catch (error) {
        const failed: string[] = [];
        for (const key of attempted.reverse()) {
            try {
                if (existed.has(key)) await store.setItem(key, previous.get(key));
                else await store.removeItem(key);
                if (!backupValuesEqual(await store.getItem(key), existed.has(key) ? previous.get(key) : null)) {
                    failed.push(key);
                }
            } catch {
                failed.push(key);
            }
        }
        if (failed.length) {
            throw Object.assign(new Error(`备份恢复失败，且以下键回滚未完成：${failed.join('、')}；请保留原备份，不要执行云端备份`), { cause: error });
        }
        throw error;
    }
    return entries.length;
}
