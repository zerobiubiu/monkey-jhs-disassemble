/**
 * MissAV 端本地 IndexedDB 数据层。
 *
 * 来源：archetype/missavStatusTag.user.js L156-273（openLocalDB/upsertLocalCars/queryLocalCars）。
 *
 * 独立于 jhs 的 JAV-JHS/appData，使用独立的数据库 MissAV-CarStatus/cars，
 * 以 carNum 为主键存储最新状态。此数据可通过设置面板的导出功能生成 JSON，
 * 再由 jhs 的 WebDav 备份链路上传（与 vlt-panel 模式一致）。
 */

import { MISSAV_DB_NAME, MISSAV_DB_STORE } from './car-status-config';

/**
 * 打开本地 IndexedDB（不存在则创建）。
 * 来源：missavStatusTag.user.js L156-173。
 * @returns IDBDatabase 实例
 */
export function openLocalDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(MISSAV_DB_NAME, 1);
        request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(MISSAV_DB_STORE)) {
                // 以 carNum 为主键，同一番号在多个 status 下的记录只保留最新写入
                db.createObjectStore(MISSAV_DB_STORE, { keyPath: 'carNum' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('数据库被阻塞，请关闭其他标签页后刷新'));
    });
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
    records: Array<{ carNum: string; status: string; url_path: string }>
): Promise<number> {
    const BATCH_SIZE = 3000;
    let totalWritten = 0;
    const db = await openLocalDB();

    try {
        for (let i = 0; i < records.length; i += BATCH_SIZE) {
            const batch = records.slice(i, i + BATCH_SIZE);
            totalWritten += await new Promise<number>((resolveBatch, rejectBatch) => {
                const tx = db.transaction(MISSAV_DB_STORE, 'readwrite');
                const store = tx.objectStore(MISSAV_DB_STORE);
                let count = 0;

                for (const rec of batch) {
                    if (!rec.carNum || !rec.status || rec.url_path === undefined) continue;
                    const req = store.put({
                        carNum: rec.carNum.toUpperCase(),
                        status: rec.status,
                        url: buildJavdbUrlLocal(rec.url_path),
                        updateDate: ''
                    });
                    req.onsuccess = () => {
                        count++;
                    };
                    req.onerror = () => {
                        clog.warn('[MissAV] 写入失败', rec.carNum, req.error);
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
        return await new Promise<Map<string, { status: string; url: string }>>((resolve) => {
            const tx = db.transaction(MISSAV_DB_STORE, 'readonly');
            const store = tx.objectStore(MISSAV_DB_STORE);
            const result = new Map<string, { status: string; url: string }>();
            let pending = carNums.length;

            if (pending === 0) {
                resolve(result);
                return;
            }

            for (const cn of carNums) {
                const req = store.get(cn);
                req.onsuccess = () => {
                    if (req.result) {
                        result.set(cn, {
                            status: req.result.status,
                            url: req.result.url
                        });
                    }
                    pending--;
                    if (pending === 0) resolve(result);
                };
                req.onerror = () => {
                    pending--;
                    if (pending === 0) resolve(result);
                };
            }
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
        await new Promise<void>((resolve) => {
            const tx = db.transaction(MISSAV_DB_STORE, 'readwrite');
            const store = tx.objectStore(MISSAV_DB_STORE);
            for (const cn of carNums) {
                store.delete(cn);
            }
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
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
 * 清空并导入数据到本地 IndexedDB。
 * @param records 行式记录数组
 * @returns 写入条数
 */
export async function importLocalDB(
    records: Array<{ carNum: string; status: string; url: string }>
): Promise<number> {
    const db = await openLocalDB();
    try {
        // 先清空
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(MISSAV_DB_STORE, 'readwrite');
            tx.objectStore(MISSAV_DB_STORE).clear();
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } finally {
        db.close();
    }
    // 再批量写入（复用 upsertLocalCars，需把 url 转为 url_path 格式——但这里直接存 url）
    let written = 0;
    const BATCH_SIZE = 3000;
    const db2 = await openLocalDB();
    try {
        for (let i = 0; i < records.length; i += BATCH_SIZE) {
            const batch = records.slice(i, i + BATCH_SIZE);
            written += await new Promise<number>((resolveBatch, rejectBatch) => {
                const tx = db2.transaction(MISSAV_DB_STORE, 'readwrite');
                const store = tx.objectStore(MISSAV_DB_STORE);
                let count = 0;
                for (const rec of batch) {
                    const req = store.put({
                        carNum: rec.carNum.toUpperCase(),
                        status: rec.status,
                        url: rec.url,
                        updateDate: ''
                    });
                    req.onsuccess = () => count++;
                }
                tx.oncomplete = () => resolveBatch(count);
                tx.onerror = () => rejectBatch(tx.error);
            });
        }
    } finally {
        db2.close();
    }
    return written;
}

/**
 * 将服务端返回的 url_path 还原为完整 javdb URL（本地辅助函数）。
 * 来源：missavStatusTag.user.js L140-146 buildJavdbUrl。
 */
function buildJavdbUrlLocal(urlPath: string): string {
    if (!urlPath) return 'https://javdb.com';
    if (urlPath.startsWith('/')) {
        return 'https://javdb.com' + urlPath;
    }
    return 'https://javdb.com/v/' + urlPath;
}
