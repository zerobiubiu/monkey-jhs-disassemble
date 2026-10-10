/**
 * javdb 发布侧跨站状态发布用例（doc/47）—— 全量/增量载荷的**唯一权威构造点**。
 *
 * 背景：此前有两个构造点 —— 本插件（`car-list-reader-plugin`）的全量同步，与
 * 设置面板「同步到 missav」按钮（`setting/data-import-export.handleMissavSync`）。
 * 后者自建载荷 `{data, hwm: now, count, ts: now}`，**缺 `revision`/`mode`/`ready`**，
 * 且不写修订号指针、不裁剪增量日志。消费端按「缺 revision 回退 ts」兼容，于是把
 * 墙钟时间当作修订号写进水位线 —— 协议上「修订号 = 由分配器分配的单调值」这一不变量
 * 被绕过。现统一到本用例：两处调用点都拿到完整协议载荷与同一套指针/日志副作用。
 *
 * 归属：跨站同步域的应用层（编排 GM 存储 + 列存压缩 + 修订号分配），
 * 数据源由调用方以取数函数注入（不在本模块直接读 storageManager）。
 */

import type { CarRecord } from '../../core/storage-manager';
import { withExclusiveLock } from '../../core/sync';
import {
    CAR_STATUS_DELTA_COMPACT_THRESHOLD,
    GM_KEY_CAR_STATUS_DATA,
    GM_KEY_CAR_STATUS_DELTA,
    GM_KEY_CAR_STATUS_REVISION,
    type CarStatusDeltaPayload,
    type CarStatusPayload
} from './car-status-config';
import {
    compactDeltaJournal,
    countDeltaItems,
    getPayloadRevision,
    readDeltaJournal,
    sortDeltaJournal
} from './car-status-journal';
import { countColumnar, gzipToBase64, toColumnar } from './car-status-columnar';

/** javdb 发布侧跨标签页读改写互斥的 Web Lock 名称。 */
const JAVDB_SYNC_LOCK_NAME = 'jhs-javdb-car-status-publisher';

/** car_list 变更代号（每次增量推送时递增）。 */
const GM_KEY_CAR_LIST_REV = 'jhs_car_list_rev';
/** 上次全量同步时的变更代号。 */
const GM_KEY_SYNCED_REV = 'jhs_car_status_synced_rev';
/** 上次全量同步时间戳。 */
const GM_KEY_LAST_SYNC_TIME = 'jhs_car_status_last_sync';

/** 当前 javdb 标签页内的单调修订号逻辑时钟。 */
let lastIssuedRevision = 0;

/** 全量发布未成功的原因（供调用方给出准确提示）。 */
export type PublishFailureReason = 'empty' | 'no-valid' | 'compress-failed' | 'superseded';

/** 全量发布结果。 */
export interface PublishFullResult {
    ok: boolean;
    /** 失败原因（ok=true 时缺省）。 */
    reason?: PublishFailureReason;
    /** 列存后的有效记录数（ok=true 时为实际写入条数）。 */
    count: number;
    /** 本次分配的修订号；未分配（空输入等早返回）为 null。 */
    revision: number | null;
}

/** 分配下一个单调修订号（跨标签页以 GM 持久值 + 本地逻辑时钟取大）。 */
export async function allocateRevision(): Promise<number> {
    return withExclusiveLock(JAVDB_SYNC_LOCK_NAME, async () => {
        const now = Date.now();
        let persisted = 0;
        try {
            const value = GM_getValue(GM_KEY_CAR_STATUS_REVISION, 0);
            if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
                persisted = value;
            }
        } catch {
            /* 读取失败时仍用当前标签页的逻辑时钟，后续全量同步会校正状态。 */
        }
        lastIssuedRevision = Math.max(now, persisted + 1, lastIssuedRevision + 1);
        GM_setValue(GM_KEY_CAR_STATUS_REVISION, lastIssuedRevision);
        return lastIssuedRevision;
    });
}

/** 追加一条增量到 journal；超过压缩阈值时返回 true 提示调用方发布全量。 */
export async function appendDeltaJournal(payload: CarStatusDeltaPayload): Promise<boolean> {
    return withExclusiveLock(JAVDB_SYNC_LOCK_NAME, async () => {
        const journal = readDeltaJournal(GM_getValue(GM_KEY_CAR_STATUS_DELTA));
        journal.push(payload);
        const compacted = compactDeltaJournal(sortDeltaJournal(journal));
        GM_setValue(GM_KEY_CAR_STATUS_DELTA, compacted);
        return countDeltaItems(compacted) > CAR_STATUS_DELTA_COMPACT_THRESHOLD;
    });
}

/**
 * 发布全量快照并保护 GM 中的「最后快照」指针。
 * 较早开始、较晚压缩完成的旧全量不能覆盖已发布的新全量；同修订号增量保留由消费端兜底。
 */
export async function publishSnapshot(payload: CarStatusPayload): Promise<boolean> {
    return withExclusiveLock(JAVDB_SYNC_LOCK_NAME, async () => {
        const current = GM_getValue(GM_KEY_CAR_STATUS_DATA) as CarStatusPayload | undefined;
        const currentRevision = current ? getPayloadRevision(current) : -1;
        if (currentRevision >= getPayloadRevision(payload)) {
            return false;
        }
        GM_setValue(GM_KEY_CAR_STATUS_DATA, payload);
        const journal = readDeltaJournal(GM_getValue(GM_KEY_CAR_STATUS_DELTA));
        const retained = journal.filter((delta) => getPayloadRevision(delta) >= getPayloadRevision(payload));
        if (retained.length !== journal.length) {
            GM_setValue(GM_KEY_CAR_STATUS_DELTA, sortDeltaJournal(retained));
        }
        return true;
    });
}

/**
 * 全量发布用例：取数 → 列存 → gzip → 分配修订号 → 协议完整载荷 → 指针保护写入 → 日志裁剪。
 *
 * 调用方（自动全量同步、设置面板手动同步）只需给出取数函数；副作用（修订号指针
 * `SYNCED_REV`/`LAST_SYNC_TIME`）在此统一完成，避免出现「发布了但指针没动」的分支。
 *
 * @param getCarList car_list 取数函数（由调用方注入，便于测试与解耦）
 * @returns 发布结果（含失败原因与条数）
 */
export async function publishFullSnapshot(getCarList: () => Promise<CarRecord[]>): Promise<PublishFullResult> {
    const carList = await getCarList();
    if (carList.length === 0) {
        return { ok: false, reason: 'empty', count: 0, revision: null };
    }
    const columnar = toColumnar(carList);
    const count = countColumnar(columnar.byStatus);
    if (count === 0) {
        return { ok: false, reason: 'no-valid', count: 0, revision: null };
    }
    const revision = await allocateRevision();
    const base64 = await gzipToBase64(columnar.byStatus);
    if (!base64) {
        return { ok: false, reason: 'compress-failed', count, revision };
    }
    const payload: CarStatusPayload = {
        data: base64,
        hwm: new Date(revision).toISOString(),
        count,
        ts: revision,
        revision,
        mode: 'snapshot',
        ready: true
    };
    const published = await publishSnapshot(payload);
    if (!published) {
        return { ok: false, reason: 'superseded', count, revision };
    }
    GM_setValue(GM_KEY_SYNCED_REV, GM_getValue(GM_KEY_CAR_LIST_REV, 0));
    GM_setValue(GM_KEY_LAST_SYNC_TIME, Date.now());
    return { ok: true, count, revision };
}

/** 重置发布侧模块态（仅限测试）。 */
export function __resetPublisherForTest(): void {
    lastIssuedRevision = 0;
}