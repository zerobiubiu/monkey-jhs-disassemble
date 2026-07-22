/**
 * MissAV 端本地 IndexedDB 数据层。
 *
 * 来源：archetype/missavStatusTag.user.js L156-273（openLocalDB/upsertLocalCars/queryLocalCars）。
 *
 * 独立于 jhs 的 JAV-JHS/appData，使用独立的数据库 MissAV-CarStatus/cars，
 * 以 carNum 为主键存储最新状态。此数据可通过设置面板的导出功能生成 JSON，
 * 再由 jhs 的 WebDav 备份链路上传（与 vlt-panel 模式一致）。
 */

import {
    MISSAV_DB_META_STORE,
    MISSAV_DB_NAME,
    MISSAV_DB_STORE,
    MISSAV_DB_VERSION,
    MISSAV_SYNC_LOCK_NAME,
    MISSAV_SYNC_META_KEY,
    type CarStatusSyncKind,
    type CarStatusSyncMeta
} from './car-status-config';
import { STATUS_LIST } from './car-status-config';

const JAVDB_BASE_URL = 'https://javdb.com';

export interface LocalCarStatusRecord {
    carNum: string;
    status: string;
    url_path: string;
}

const JAVDB_HOSTNAME = 'javdb.com';

/**
 * 将内部/导入的 URL 统一为安全的 url_path。
 *
 * 旧导出同时存在 vid 短码、相对路径和完整 URL 三种形态；统一入口可以
 * 在写入 IndexedDB 前拒绝 javascript/data/外部主机等危险或无法回放的值，
 * 避免 buildJavdbUrlLocal 静默回退到首页造成数据悄悄损坏。
 */
function normalizeJavdbUrlPath(value: unknown): string {
    if (typeof value !== 'string') throw new Error('车辆记录链接必须是字符串');
    const raw = value.trim();
    if (!raw || /[\u0000-\u001f\u007f]/.test(raw)) {
        throw new Error('车辆记录链接为空或包含控制字符');
    }

    let candidate: URL;
    try {
        if (/^https?:\/\//i.test(raw)) {
            candidate = new URL(raw);
        } else if (raw.startsWith('/')) {
            if (raw.startsWith('//')) throw new Error('不允许协议相对链接');
            candidate = new URL(raw, JAVDB_BASE_URL);
        } else {
            // 仅允许 vid 短码（可带 query/hash）；带协议的其它 scheme 一律拒绝。
            if (/^[a-z][a-z\d+.-]*:/i.test(raw)) {
                throw new Error('不允许非 HTTPS 链接');
            }
            candidate = new URL(`/v/${raw}`, JAVDB_BASE_URL);
            if (!candidate.pathname.startsWith('/v/')) {
                throw new Error('车辆短码路径无效');
            }
        }
    } catch (error) {
        throw new Error(
            `车辆记录链接无效：${error instanceof Error ? error.message : String(error)}`
        );
    }

    if (candidate.protocol !== 'https:' || candidate.hostname !== JAVDB_HOSTNAME) {
        throw new Error('车辆记录链接必须指向 https://javdb.com');
    }
    if (candidate.pathname === '/') throw new Error('车辆记录链接路径为空');
    const suffix = candidate.pathname.startsWith('/v/')
        ? candidate.pathname.slice('/v/'.length)
        : candidate.pathname;
    if (!suffix) throw new Error('车辆记录链接路径为空');
    return `${suffix}${candidate.search}${candidate.hash}`;
}

function normalizeLocalRecord(record: LocalCarStatusRecord): LocalCarStatusRecord {
    if (record === null || typeof record !== 'object') {
        throw new Error('车辆记录格式无效');
    }
    if (typeof record.carNum !== 'string' || record.carNum.trim() === '') {
        throw new Error('车辆记录番号为空');
    }
    if (
        typeof record.status !== 'string' ||
        !STATUS_LIST.includes(record.status.trim() as (typeof STATUS_LIST)[number])
    ) {
        throw new Error(`车辆记录状态无效：${String(record.status)}`);
    }
    return {
        carNum: record.carNum.trim().toUpperCase(),
        status: record.status.trim(),
        url_path: normalizeJavdbUrlPath(record.url_path)
    };
}

interface NavigatorWithOptionalLocks {
    locks?: {
        request<T>(
            name: string,
            options: { mode: 'exclusive' },
            callback: () => Promise<T>
        ): Promise<T>;
    };
}

/** 在支持 Web Locks 的浏览器中把 MissAV 多标签页写入串行化。 */
export async function withLocalSyncLock<T>(task: () => Promise<T>): Promise<T> {
    const browserNavigator =
        typeof navigator === 'undefined'
            ? undefined
            : (navigator as NavigatorWithOptionalLocks);
    if (!browserNavigator?.locks) return task();
    return browserNavigator.locks.request(
        MISSAV_SYNC_LOCK_NAME,
        { mode: 'exclusive' },
        task
    );
}

/**
 * 打开本地 IndexedDB（不存在则创建）。
 * 来源：missavStatusTag.user.js L156-173。
 * @returns IDBDatabase 实例
 */
export function openLocalDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(MISSAV_DB_NAME, MISSAV_DB_VERSION);
        request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(MISSAV_DB_STORE)) {
                // 以 carNum 为主键，同一番号在多个 status 下的记录只保留最新写入
                db.createObjectStore(MISSAV_DB_STORE, { keyPath: 'carNum' });
            }
            if (!db.objectStoreNames.contains(MISSAV_DB_META_STORE)) {
                db.createObjectStore(MISSAV_DB_META_STORE, { keyPath: 'key' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('数据库被阻塞，请关闭其他标签页后刷新'));
    });
}

function canApplyRevision(
    incomingRevision: number,
    incomingKind: CarStatusSyncKind,
    current: CarStatusSyncMeta | null
): boolean {
    if (!Number.isInteger(incomingRevision) || incomingRevision < 0) return false;
    if (!current) return true;
    if (incomingRevision < current.revision) return false;
    // 同一修订号下增量优先：全量不能把同修订号的增量覆盖回去。
    if (incomingRevision === current.revision && incomingKind === 'full') return false;
    return true;
}

async function readAppliedRevision(): Promise<CarStatusSyncMeta | null> {
    const db = await openLocalDB();
    try {
        return await new Promise<CarStatusSyncMeta | null>((resolve, reject) => {
            const tx = db.transaction(MISSAV_DB_META_STORE, 'readonly');
            const request = tx.objectStore(MISSAV_DB_META_STORE).get(MISSAV_SYNC_META_KEY);
            request.onsuccess = () => {
                const value = request.result as Partial<CarStatusSyncMeta> | undefined;
                if (
                    value &&
                    value.key === MISSAV_SYNC_META_KEY &&
                    typeof value.revision === 'number' &&
                    Number.isInteger(value.revision) &&
                    value.revision >= 0 &&
                    (value.kind === 'full' || value.kind === 'delta')
                ) {
                    resolve(value as CarStatusSyncMeta);
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => reject(request.error || new Error('读取同步修订号失败'));
            tx.onerror = () => reject(tx.error || new Error('读取同步元数据事务失败'));
        });
    } finally {
        db.close();
    }
}

async function writeAppliedRevision(meta: CarStatusSyncMeta): Promise<void> {
    const db = await openLocalDB();
    try {
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(MISSAV_DB_META_STORE, 'readwrite');
            tx.objectStore(MISSAV_DB_META_STORE).put(meta);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error || new Error('写入同步修订号失败'));
            tx.onabort = () => reject(tx.error || new Error('写入同步修订号事务中止'));
        });
    } finally {
        db.close();
    }
}

/**
 * 在跨标签页锁内检查并提交修订号。
 * task 失败时不推进水位线，后续收到同一载荷仍可重试。
 */
export async function withSyncRevision<T>(
    revision: number,
    kind: CarStatusSyncKind,
    task: () => Promise<T>,
    rollback?: () => Promise<void>
): Promise<{ applied: boolean; value?: T }> {
    return withLocalSyncLock(async () => {
        const current = await readAppliedRevision();
        if (!canApplyRevision(revision, kind, current)) {
            return { applied: false };
        }

        let metadataWriteStarted = false;
        try {
            const value = await task();
            metadataWriteStarted = true;
            await writeAppliedRevision({
                key: MISSAV_SYNC_META_KEY,
                revision,
                kind
            });
            return { applied: true, value };
        } catch (applyError) {
            const recoveryErrors: string[] = [];
            if (rollback) {
                try {
                    await rollback();
                } catch (rollbackError) {
                    recoveryErrors.push(
                        `数据回滚失败：${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`
                    );
                }
            }
            if (metadataWriteStarted) {
                try {
                    if (current) await writeAppliedRevision(current);
                    else await clearAppliedRevision();
                } catch (metadataRollbackError) {
                    recoveryErrors.push(
                        `修订号回滚失败：${metadataRollbackError instanceof Error ? metadataRollbackError.message : String(metadataRollbackError)}`
                    );
                }
            }

            if (recoveryErrors.length > 0) {
                const applyMessage =
                    applyError instanceof Error ? applyError.message : String(applyError);
                throw new Error(`同步提交失败（${applyMessage}）；${recoveryErrors.join('；')}`);
            }
            throw applyError;
        }
    });
}

/** 导入本地数据库后清除同步水位，避免导入数据被旧修订号挡住。 */
async function clearAppliedRevision(): Promise<void> {
    const db = await openLocalDB();
    try {
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(MISSAV_DB_META_STORE, 'readwrite');
            tx.objectStore(MISSAV_DB_META_STORE).delete(MISSAV_SYNC_META_KEY);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error || new Error('清理同步修订号失败'));
            tx.onabort = () => reject(tx.error || new Error('清理同步修订号事务中止'));
        });
    } finally {
        db.close();
    }
}

/**
 * 将同步到的记录分批写入本地 IndexedDB（每批 3000 条，避免单事务过大被浏览器中止）。
 * 写入时自动将 carNum 转为大写，确保与查询侧 normalizeCarNum 的输出一致。
 *
 * 来源：missavStatusTag.user.js L182-230 upsertLocalCars。
 *
 * @param records 记录数组 [{carNum, status, url_path}]
 * @returns 实际写入条数
 */
export async function upsertLocalCars(
    records: LocalCarStatusRecord[]
): Promise<number> {
    const BATCH_SIZE = 3000;
    const normalizedRecords = records.map(normalizeLocalRecord);
    let totalWritten = 0;
    const db = await openLocalDB();

    try {
        for (let i = 0; i < normalizedRecords.length; i += BATCH_SIZE) {
            const batch = normalizedRecords.slice(i, i + BATCH_SIZE);
            totalWritten += await new Promise<number>((resolveBatch, rejectBatch) => {
                const tx = db.transaction(MISSAV_DB_STORE, 'readwrite');
                const store = tx.objectStore(MISSAV_DB_STORE);
                let count = 0;

                for (const rec of batch) {
                    const req = store.put({
                        carNum: rec.carNum,
                        status: rec.status,
                        url: buildJavdbUrlLocal(rec.url_path),
                        updateDate: ''
                    });
                    req.onsuccess = () => {
                        count++;
                    };
                    req.onerror = () => {
                        console.warn('[MissAV] 写入失败', rec.carNum, req.error);
                    };
                }

                tx.oncomplete = () => resolveBatch(count);
                tx.onerror = () => rejectBatch(tx.error || new Error('事务失败'));
                tx.onabort = () => rejectBatch(tx.error || new Error('事务中止'));
            });
        }
        return totalWritten;
    } finally {
        db.close();
    }
}

export interface StoredCarStatusRecord {
    carNum: string;
    status: string;
    url: string;
    updateDate?: string;
}

/** 读取 cars 仓库原始快照，供分批对账失败时回滚。 */
export async function readLocalCarsSnapshot(): Promise<StoredCarStatusRecord[]> {
    const db = await openLocalDB();
    try {
        return await new Promise<StoredCarStatusRecord[]>((resolve, reject) => {
            const tx = db.transaction(MISSAV_DB_STORE, 'readonly');
            const store = tx.objectStore(MISSAV_DB_STORE);
            const records: StoredCarStatusRecord[] = [];
            const request = store.openCursor();
            request.onsuccess = () => {
                const cursor = request.result;
                if (!cursor) return;
                records.push(cursor.value as StoredCarStatusRecord);
                cursor.continue();
            };
            request.onerror = () => reject(request.error || new Error('读取本地状态快照失败'));
            tx.oncomplete = () => resolve(records);
            tx.onerror = () => reject(tx.error || new Error('读取本地状态快照事务失败'));
            tx.onabort = () => reject(tx.error || new Error('读取本地状态快照事务中止'));
        });
    } finally {
        db.close();
    }
}

/**
 * 单事务恢复 cars 仓库：删除原快照之外的键，并把原记录逐条 put 回去。
 * 不调用 clear()，且事务失败时 IndexedDB 会原子回滚本次恢复操作。
 */
export async function restoreLocalCarsSnapshot(
    snapshot: StoredCarStatusRecord[]
): Promise<void> {
    const snapshotKeys = new Set(snapshot.map((record) => String(record.carNum)));
    const db = await openLocalDB();
    try {
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(MISSAV_DB_STORE, 'readwrite');
            const store = tx.objectStore(MISSAV_DB_STORE);
            const request = store.openCursor();
            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    if (!snapshotKeys.has(String(cursor.primaryKey))) cursor.delete();
                    cursor.continue();
                    return;
                }
                for (const record of snapshot) store.put(record);
            };
            request.onerror = () => reject(request.error || new Error('恢复本地状态游标失败'));
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error || new Error('恢复本地状态事务失败'));
            tx.onabort = () => reject(tx.error || new Error('恢复本地状态事务中止'));
        });
    } finally {
        db.close();
    }
}

export interface LocalCarsSelectionSnapshot {
    carNums: string[];
    records: StoredCarStatusRecord[];
}

/** 只读取一次增量会触及的番号，避免每条增量都复制整库。 */
export async function readLocalCarsSelection(
    carNums: string[]
): Promise<LocalCarsSelectionSnapshot> {
    const normalizedCarNums = Array.from(
        new Set(carNums.map((carNum) => carNum.trim().toUpperCase()).filter(Boolean))
    );
    if (normalizedCarNums.length === 0) return { carNums: [], records: [] };

    const db = await openLocalDB();
    try {
        const records = await new Promise<StoredCarStatusRecord[]>((resolve, reject) => {
            const tx = db.transaction(MISSAV_DB_STORE, 'readonly');
            const store = tx.objectStore(MISSAV_DB_STORE);
            const snapshot: StoredCarStatusRecord[] = [];
            let settled = false;

            const rejectOnce = (error: unknown): void => {
                if (settled) return;
                settled = true;
                reject(error);
            };
            for (const carNum of normalizedCarNums) {
                const request = store.get(carNum);
                request.onsuccess = () => {
                    if (request.result) snapshot.push(request.result as StoredCarStatusRecord);
                };
                request.onerror = () =>
                    rejectOnce(request.error || new Error(`读取增量回滚快照失败：${carNum}`));
            }
            tx.oncomplete = () => {
                if (settled) return;
                settled = true;
                resolve(snapshot);
            };
            tx.onerror = () => rejectOnce(tx.error || new Error('读取增量回滚快照事务失败'));
            tx.onabort = () => rejectOnce(tx.error || new Error('读取增量回滚快照事务中止'));
        });
        return { carNums: normalizedCarNums, records };
    } finally {
        db.close();
    }
}

/** 原子恢复一次增量触及的番号，其它番号保持不变。 */
export async function restoreLocalCarsSelection(
    snapshot: LocalCarsSelectionSnapshot
): Promise<void> {
    if (snapshot.carNums.length === 0) return;
    const db = await openLocalDB();
    try {
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(MISSAV_DB_STORE, 'readwrite');
            const store = tx.objectStore(MISSAV_DB_STORE);
            for (const carNum of snapshot.carNums) store.delete(carNum);
            for (const record of snapshot.records) store.put(record);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error || new Error('恢复增量回滚快照事务失败'));
            tx.onabort = () => reject(tx.error || new Error('恢复增量回滚快照事务中止'));
        });
    } finally {
        db.close();
    }
}

/**
 * 用权威全量快照对账本地数据库。
 *
 * 先完成全部 upsert，再删除快照之外的旧记录；这样写入失败时不会先清空现有数据。
 * 空数组是合法快照，会清除全部旧记录。
 *
 * @param records 全量快照中的记录
 * @param previousSnapshot 可复用的写前快照，避免上层补偿流程重复读取整库
 * @returns 写入与删除数量
 */
export async function replaceLocalCars(
    records: LocalCarStatusRecord[],
    previousSnapshot?: StoredCarStatusRecord[]
): Promise<{ written: number; deleted: number }> {
    const recordsByCarNum = new Map<string, LocalCarStatusRecord>();
    for (const record of records) {
        const normalized = normalizeLocalRecord(record);
        if (recordsByCarNum.has(normalized.carNum)) {
            throw new Error(`快照包含重复番号：${normalized.carNum}`);
        }
        recordsByCarNum.set(normalized.carNum, normalized);
    }

    const validRecords = Array.from(recordsByCarNum.values());
    const rollbackSnapshot = previousSnapshot ?? (await readLocalCarsSnapshot());
    try {
        const written = await upsertLocalCars(validRecords);
        if (written !== validRecords.length) {
            throw new Error(
                `快照写入条数不一致：声明 ${validRecords.length}，实际 ${written}，已停止删除旧数据`
            );
        }
        const snapshotKeys = new Set(recordsByCarNum.keys());
        const db = await openLocalDB();
        let deleted = 0;
        try {
            deleted = await new Promise<number>((resolve, reject) => {
                const tx = db.transaction(MISSAV_DB_STORE, 'readwrite');
                const store = tx.objectStore(MISSAV_DB_STORE);
                const request = store.openCursor();
                let deletedCount = 0;

                request.onsuccess = () => {
                    const cursor = request.result;
                    if (!cursor) return;

                    const rawCarNum = String(cursor.primaryKey);
                    const carNum = rawCarNum.toUpperCase();
                    // 清理旧版本可能留下的大小写键；规范键已在前面的 upsert 中写入。
                    if (!snapshotKeys.has(carNum) || rawCarNum !== carNum) {
                        cursor.delete();
                        deletedCount++;
                    }
                    cursor.continue();
                };
                request.onerror = () => reject(request.error || new Error('快照对账游标读取失败'));
                tx.oncomplete = () => resolve(deletedCount);
                tx.onerror = () => reject(tx.error || new Error('快照对账事务失败'));
                tx.onabort = () => reject(tx.error || new Error('快照对账事务中止'));
            });
        } finally {
            db.close();
        }

        return { written, deleted };
    } catch (replaceError) {
        try {
            await restoreLocalCarsSnapshot(rollbackSnapshot);
        } catch (rollbackError) {
            const replaceMessage =
                replaceError instanceof Error ? replaceError.message : String(replaceError);
            const rollbackMessage =
                rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
            throw new Error(
                `状态快照对账失败且回滚失败（对账错误：${replaceMessage}；回滚错误：${rollbackMessage}）`
            );
        }
        throw replaceError;
    }
}

/**
 * 从本地 IndexedDB 批量查询番号对应的记录。
 * 来源：missavStatusTag.user.js L237-273 queryLocalCars。
 * @param carNums 番号数组
 * @returns carNum → {status, url} 映射
 */
export async function queryLocalCars(
    carNums: string[]
): Promise<Map<string, { status: string; url: string }>> {
    if (!carNums || carNums.length === 0) return new Map();
    const db = await openLocalDB();
    try {
        return await new Promise<Map<string, { status: string; url: string }>>((resolve, reject) => {
            const tx = db.transaction(MISSAV_DB_STORE, 'readonly');
            const store = tx.objectStore(MISSAV_DB_STORE);
            const result = new Map<string, { status: string; url: string }>();
            let pending = carNums.length;
            let settled = false;

            const rejectOnce = (error: unknown): void => {
                if (settled) return;
                settled = true;
                reject(error);
            };

            const resolveWhenDone = (): void => {
                if (settled || pending !== 0) return;
                settled = true;
                resolve(result);
            };

            if (pending === 0) {
                resolveWhenDone();
                return;
            }

            for (const rawCarNum of carNums) {
                const cn = rawCarNum.toUpperCase();
                const req = store.get(cn);
                req.onsuccess = () => {
                    if (req.result) {
                        result.set(cn, {
                            status: req.result.status,
                            url: req.result.url
                        });
                    }
                    pending--;
                    resolveWhenDone();
                };
                req.onerror = () => {
                    rejectOnce(req.error || new Error(`查询番号状态失败：${cn}`));
                };
            }
            tx.onerror = () => rejectOnce(tx.error || new Error('查询番号状态事务失败'));
            tx.onabort = () => rejectOnce(tx.error || new Error('查询番号状态事务中止'));
        });
    } finally {
        db.close();
    }
}

/**
 * 从本地 IndexedDB 批量删除番号记录。
 * @param carNums 待删除的番号数组
 */
export async function deleteLocalCars(carNums: string[]): Promise<void> {
    if (!carNums || carNums.length === 0) return;
    const db = await openLocalDB();
    try {
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(MISSAV_DB_STORE, 'readwrite');
            const store = tx.objectStore(MISSAV_DB_STORE);
            for (const cn of carNums) {
                store.delete(cn.toUpperCase());
            }
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error || new Error('删除车辆状态事务失败'));
            tx.onabort = () => reject(tx.error || new Error('删除车辆状态事务中止'));
        });
    } finally {
        db.close();
    }
}

/**
 * 导出本地 IndexedDB 全量数据为 JSON（供 WebDav 备份用）。
 * @returns 行式记录数组 [{carNum, status, url}]
 */
export async function exportLocalDB(): Promise<
    Array<{ carNum: string; status: string; url: string }>
> {
    const db = await openLocalDB();
    try {
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(MISSAV_DB_STORE, 'readonly');
            const store = tx.objectStore(MISSAV_DB_STORE);
            const result: Array<{ carNum: string; status: string; url: string }> = [];
            const req = store.openCursor();
            req.onsuccess = (event: Event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor) {
                    result.push({
                        carNum: cursor.value.carNum,
                        status: cursor.value.status,
                        url: cursor.value.url
                    });
                    cursor.continue();
                } else {
                    resolve(result);
                }
            };
            req.onerror = () => reject(req.error);
        });
    } finally {
        db.close();
    }
}

/**
 * 经完整校验后全量替换本地 IndexedDB；空清单必须由调用方显式确认。
 * @param records 行式记录数组
 * @param options.allowEmpty 是否允许导入结构合法的空清单
 * @returns 写入条数
 */
export async function importLocalDB(
    records: Array<{ carNum: string; status: string; url: string }>,
    options: { allowEmpty?: boolean } = {}
): Promise<number> {
    return withLocalSyncLock(async () => {
        if (!Array.isArray(records)) throw new Error('导入记录必须是数组');
        if (records.length === 0 && options.allowEmpty !== true) {
            throw new Error('拒绝未确认的空清单导入');
        }
        const normalizedRecords = records.map((record) =>
            normalizeLocalRecord({
                carNum: record?.carNum,
                status: record?.status,
                url_path: record?.url
            })
        );

        // 复用带严格校验的快照对账：先写入完整新集，再删除旧集之外的记录；
        // 任一记录格式不对会在写入前失败，避免把外部 JSON 静默改写成首页 URL。
        const [previousCars, previousRevision] = await Promise.all([
            readLocalCarsSnapshot(),
            readAppliedRevision()
        ]);
        let replaced = false;
        try {
            const { written } = await replaceLocalCars(normalizedRecords, previousCars);
            replaced = true;
            await clearAppliedRevision();
            return written;
        } catch (importError) {
            if (!replaced) throw importError;

            const recoveryErrors: string[] = [];
            try {
                await restoreLocalCarsSnapshot(previousCars);
            } catch (rollbackError) {
                recoveryErrors.push(
                    `状态数据回滚失败：${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`
                );
            }
            try {
                if (previousRevision) await writeAppliedRevision(previousRevision);
                else await clearAppliedRevision();
            } catch (metadataRollbackError) {
                recoveryErrors.push(
                    `修订号回滚失败：${metadataRollbackError instanceof Error ? metadataRollbackError.message : String(metadataRollbackError)}`
                );
            }
            if (recoveryErrors.length > 0) {
                const importMessage =
                    importError instanceof Error ? importError.message : String(importError);
                throw new Error(`导入失败（${importMessage}）；${recoveryErrors.join('；')}`);
            }
            throw importError;
        }
    });
}

/**
 * 将服务端返回的 url_path 还原为完整 javdb URL（本地辅助函数）。
 * 来源：missavStatusTag.user.js L140-146 buildJavdbUrl。
 */
function buildJavdbUrlLocal(urlPath: unknown): string {
    const normalizedPath = normalizeJavdbUrlPath(urlPath);
    return new URL(
        normalizedPath.startsWith('/') ? normalizedPath : `/v/${normalizedPath}`,
        JAVDB_BASE_URL
    ).href;
}
