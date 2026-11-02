/**
 * 操作同步记录 —— 「本地已写入、网站待同步」的**持久化**状态账本。
 *
 * 背景（doc/38）：批量操作与详情页操作写库后，网站推送在**后台队列**里慢慢跑
 * （`list-page/lp-batch-sync.ts`）。该队列只活在内存里：离开页面即消失，
 * 用户既看不到「哪些视频还没同步到网站」，也无法查看失败原因、无法重试。
 *
 * 本模块提供**跨页面/跨会话保留**的逐条记录：
 * - 每条 = 一个（番号 × 操作类型）的同步状态机：
 *   `pending`（已入队待推送）→ `running`（推送中）→ `success` | `failed`（重试耗尽）
 * | `cancelled`（用户在设置里取消）；
 * - 记录同时承载**插件侧状态值**（`kind` + `score`，即写进 car_list 的那个操作行为）
 *   与**网站侧同步结果**（`state` + `attempts` + `error`）—— 设置面板据此展示与操作；
 * - 存储用 GM 存储（`GM_setValue`），单键保存、容量上限内自动淘汰最旧终态记录；
 * - 本模块**只记账、不发请求**：入队/推送由 lp-batch-sync 与详情页推送路径驱动。
 *
 * 数据安全：记录属**可重建的派生状态**（真值仍是 `car_list` 与站点），
 * 因此不进备份、不参与数据迁移；清空记录不会删除任何 car_list 数据。
 */

/** 需要同步到网站的操作类型。 */
export type OpSyncKind = 'favorite' | 'watched' | 'unwatch' | 'filter';

/** 同步状态机取值。 */
export type OpSyncState = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';

/** 记录来源（列表页批量 / 详情页单条），仅用于展示与筛选。 */
export type OpSyncOrigin = 'list' | 'detail';

/** 一条同步记录。 */
export interface OpSyncRecord {
    /** 本次用户意图身份；旧记录可缺省，回执不得覆盖新意图。 */
    revision?: string;
    /** 用户登记时间，与推送状态更新时间分开。 */
    requestedAt?: number;
    /** 组合任务尚未把回执交接到任务日志，暂不允许容量或清理操作淘汰。 */
    retained?: boolean;
    /** 番号。 */
    carNum: string;
    /** 详情页 url（用于提取 videoId 重推）。 */
    url: string;
    /** 操作类型（= 插件侧写入 car_list 的行为）。 */
    kind: OpSyncKind;
    /** 评分（仅 `watched` 有效，0–5）。 */
    score: number;
    /** 网站侧同步状态。 */
    state: OpSyncState;
    /** 已尝试推送次数。 */
    attempts: number;
    /** 最近一次失败原因（成功/待推送时为空串）。 */
    error: string;
    /** 来源。 */
    origin: OpSyncOrigin;
    /** 首次入队时间（ms）。 */
    enqueuedAt: number;
    /** 最近状态变更时间（ms）。 */
    updatedAt: number;
}

/** 软容量上限：仅淘汰已确认成功或用户取消的记录；失败仍需恢复，不可自动丢弃。 */
export const OP_SYNC_CAPACITY = 400;

/** GM 存储键。 */
export const OP_SYNC_GM_KEY = 'jhs:op-sync-records';

/** 终态（不会再自动变化）。 */
const TERMINAL_STATES: readonly OpSyncState[] = ['success', 'failed', 'cancelled'];

/** 仅清单前置补同步临时启用；计数保证嵌套退出不会提前恢复宽松模式。 */
let strictPersistenceDepth = 0;

/** 在同步读写临界区启用严格持久化，不把网络等待期间的无关任务纳入作用域。 */
export function withStrictOpSyncPersistenceSync<T>(task: () => T): T {
    strictPersistenceDepth++;
    cache = null;
    try {
        return task();
    } finally {
        strictPersistenceDepth--;
        cache = null;
    }
}

export async function withStrictOpSyncPersistence<T>(task: () => Promise<T>): Promise<T> {
    strictPersistenceDepth++;
    cache = null;
    try {
        return await task();
    } finally {
        strictPersistenceDepth--;
        cache = null;
    }
}

/** 记录存储读写接口（默认走 GM 存储；测试可注入替身）。 */
export interface OpSyncStorage {
    read(): OpSyncRecord[] | null;
    write(records: OpSyncRecord[]): void;
}

/** 内存回退存储（非油猴环境 / 测试默认）。 */
function createMemoryStorage(): OpSyncStorage {
    let data: OpSyncRecord[] | null = null;
    return {
        read: () => data,
        write: (records) => {
            data = records;
        }
    };
}

/** 默认存储：油猴环境用 GM 存储，否则内存。 */
function createDefaultStorage(): OpSyncStorage {
    const hasGM = typeof GM_setValue === 'function' && typeof GM_getValue === 'function';
    if (!hasGM) return createMemoryStorage();
    return {
        read: () => {
            try {
                const raw = GM_getValue(OP_SYNC_GM_KEY, null) as unknown;
                if (typeof raw === 'string') {
                    const parsed: unknown = JSON.parse(raw);
                    if (strictPersistenceDepth && !Array.isArray(parsed)) throw new Error('评价同步账本格式损坏');
                    return parsed as OpSyncRecord[];
                }
                if (Array.isArray(raw)) return raw as OpSyncRecord[];
                if (strictPersistenceDepth && raw != null) throw new Error('评价同步账本格式损坏');
                return null;
            } catch (error: unknown) {
                if (strictPersistenceDepth) throw error;
                return null;
            }
        },
        write: (records) => {
            try {
                GM_setValue(OP_SYNC_GM_KEY, JSON.stringify(records));
            } catch (error: unknown) {
                if (strictPersistenceDepth) throw error;
                /* 存储不可用时保持内存态，不影响主流程 */
            }
        }
    };
}

let storage: OpSyncStorage = createDefaultStorage();

/** 已加载的记录缓存（null = 尚未读盘）。 */
let cache: OpSyncRecord[] | null = null;

/** 读取记录（带缓存）；坏数据按空处理。 */
function load(): OpSyncRecord[] {
    if (cache) return cache;
    const raw = storage.read();
    if (strictPersistenceDepth && raw !== null && (!Array.isArray(raw) || !raw.every(isStrictRecord))) {
        throw new Error('评价同步账本损坏，尚不能确认全部评价已完成');
    }
    cache = Array.isArray(raw) ? raw.filter(isRecord).map((record) => ({ ...record })) : [];
    return cache;
}

/** 重新读取 GM 账本，避免另一标签页的登记、取消被旧缓存覆盖。 */
export function refreshOpSyncRecords(): OpSyncRecord[] {
    cache = null;
    return load();
}

/** 结构校验：忽略损坏条目而不是抛错（记录可重建，不能因脏数据拖垮设置面板）。 */
function isRecord(value: unknown): value is OpSyncRecord {
    if (!value || typeof value !== 'object') return false;
    const rec = value as Partial<OpSyncRecord>;
    return typeof rec.carNum === 'string' && typeof rec.kind === 'string' && typeof rec.state === 'string';
}

/** 严格补同步不能把损坏记录过滤成空账本，否则会误判评价已经全部完成。 */
function isStrictRecord(value: unknown): value is OpSyncRecord {
    if (!isRecord(value)) return false;
    return !!value.carNum.trim() && typeof value.url === 'string' &&
        ['favorite', 'watched', 'unwatch', 'filter'].includes(value.kind) &&
        ['pending', 'running', 'success', 'failed', 'cancelled'].includes(value.state) &&
        (value.origin === 'list' || value.origin === 'detail') && typeof value.error === 'string' &&
        Number.isInteger(value.score) && value.score >= 0 && value.score <= 5 &&
        Number.isInteger(value.attempts) && value.attempts >= 0 &&
        Number.isFinite(value.enqueuedAt) && Number.isFinite(value.updatedAt) &&
        (value.revision === undefined || typeof value.revision === 'string') &&
        (value.requestedAt === undefined || Number.isFinite(value.requestedAt)) &&
        (value.retained === undefined || typeof value.retained === 'boolean');
}

/** 落盘（仅已成功/用户取消的记录可按最旧优先自动淘汰）。 */
function persist(): void {
    const records = load();
    if (records.length > OP_SYNC_CAPACITY) {
        const overflow = records.length - OP_SYNC_CAPACITY;
        const removable = records
            .filter((r) => !r.retained && (r.state === 'success' || r.state === 'cancelled'))
            .sort((a, b) => a.updatedAt - b.updatedAt)
            .slice(0, overflow);
        const removeKeys = new Set(removable.map(recordKey));
        cache = records.filter((r) => !removeKeys.has(recordKey(r)));
    }
    const expected = JSON.stringify(load());
    storage.write(load());
    if (strictPersistenceDepth) {
        const actual = storage.read();
        if (!Array.isArray(actual) || !actual.every(isStrictRecord) || JSON.stringify(actual) !== expected) {
            cache = null;
            throw new Error('评价同步账本写入后回读不一致，尚不能确认持久化成功');
        }
    }
}

/** 记录唯一键。 */
function recordKey(record: Pick<OpSyncRecord, 'carNum' | 'kind'>): string {
    return `${record.carNum}::${record.kind}`;
}

/**
 * 写入/更新一条记录为「待推送」。
 *
 * 同一（番号 × 操作类型）重复入队时**覆盖**旧记录并重置状态与尝试次数 ——
 * 语义是「这个视频的这一次操作还没落到网站」，旧的成功记录被新操作取代。
 *
 * @param input 记录字段（时间戳自动填充）
 * @returns 写入后的记录
 */
export function upsertOpSync(input: {
    carNum: string;
    url: string;
    kind: OpSyncKind;
    score?: number;
    origin?: OpSyncOrigin;
    now?: number;
    revision?: string;
    requestedAt?: number;
    retained?: boolean;
}): OpSyncRecord {
    const now = input.now ?? Date.now();
    const records = refreshOpSyncRecords();
    const key = recordKey({ carNum: input.carNum, kind: input.kind });
    const index = records.findIndex((r) => recordKey(r) === key);
    const record: OpSyncRecord = {
        revision: input.revision ?? `${now}:${Math.random().toString(36).slice(2)}`,
        requestedAt: input.requestedAt ?? records.reduce((latest, r) => Math.max(latest, r.requestedAt ?? r.enqueuedAt ?? 0), now) + 1,
        ...(input.retained === undefined ? {} : { retained: input.retained }),
        carNum: input.carNum,
        url: input.url,
        kind: input.kind,
        score: input.score ?? 0,
        state: 'pending',
        attempts: 0,
        error: '',
        origin: input.origin ?? 'list',
        enqueuedAt: index >= 0 ? records[index].enqueuedAt : now,
        updatedAt: now
    };
    if (index >= 0) records[index] = record;
    else records.push(record);
    persist();
    return record;
}

/** 已预写组合评价使用稳定身份，恢复时不得重新登记为较新的用户操作。调用方持评价锁。 */
export function ensureOpSync(input: Parameters<typeof upsertOpSync>[0] & {
    revision: string; requestedAt: number
}): OpSyncRecord | null {
    if (!input.revision.trim() || !Number.isSafeInteger(input.requestedAt) || input.requestedAt < 0) {
        throw new Error('组合评价意图身份或登记时间无效');
    }
    const rows = refreshOpSyncRecords();
    const matching = rows.filter((row) => row.carNum.trim().toLowerCase() === input.carNum.trim().toLowerCase());
    if (matching.some((row) => row.revision !== input.revision &&
        (row.requestedAt ?? row.enqueuedAt) >= input.requestedAt)) return null;
    const own = matching.find((row) => row.kind === input.kind && row.revision === input.revision);
    if (own) {
        if (own.score !== (input.score ?? 0) || own.requestedAt !== input.requestedAt || own.url !== input.url) {
            throw new Error('组合评价稳定身份不能复用为不同操作');
        }
        return own;
    }
    return upsertOpSync({ ...input, retained: true });
}

/** 任务日志已保存最终评价状态后释放回执保留；较新修订与其他记录不受影响。 */
export function releaseRetainedOpSync(intent: Pick<OpSyncRecord, 'carNum' | 'kind' | 'revision'>): void {
    const record = refreshOpSyncRecords().find((row) => recordKey(row) === recordKey(intent) && row.revision === intent.revision);
    if (!record?.retained) return;
    delete record.retained;
    persist();
}

/**
 * 更新记录状态。
 *
 * @param carNum 番号
 * @param kind 操作类型
 * @param state 新状态
 * @param patch 可选：失败原因 / 尝试次数 / 时间
 * @returns 更新后的记录；记录不存在时返回 null
 */
export function setOpSyncState(
    carNum: string,
    kind: OpSyncKind,
    state: OpSyncState,
    patch?: { error?: string; attempts?: number; now?: number; expectedRevision?: string }
): OpSyncRecord | null {
    const records = refreshOpSyncRecords();
    const key = recordKey({ carNum, kind });
    const record = records.find((r) => recordKey(r) === key);
    if (!record) return null;
    if (patch?.expectedRevision !== undefined && record.revision !== patch.expectedRevision) return null;
    record.state = state;
    if (patch?.error !== undefined) record.error = patch.error;
    if (patch?.attempts !== undefined) record.attempts = patch.attempts;
    record.updatedAt = patch?.now ?? Date.now();
    persist();
    return record;
}

/** 取一条记录（无则 null）。 */
export function getOpSyncRecord(carNum: string, kind: OpSyncKind): OpSyncRecord | null {
    const key = recordKey({ carNum, kind });
    return refreshOpSyncRecords().find((r) => recordKey(r) === key) ?? null;
}

/** 网站请求与回执共用意图校验；较新的其他评价类型也会替代旧意图。 */
export function isCurrentOpSyncIntent(intent: Pick<OpSyncRecord, 'carNum' | 'kind' | 'revision'>): boolean {
    const record = getOpSyncRecord(intent.carNum, intent.kind);
    if (!record || record.revision !== intent.revision || record.state === 'cancelled' || record.state === 'success') return false;
    const newer = listOpSyncRecords().some((other) =>
        other.carNum.trim().toLowerCase() === record.carNum.trim().toLowerCase() &&
        (other.requestedAt ?? other.enqueuedAt) > (record.requestedAt ?? record.enqueuedAt)
    );
    if (!newer) return true;
    setOpSyncState(record.carNum, record.kind, 'cancelled', {
        error: '已被较新的评价操作替代', expectedRevision: record.revision
    });
    return false;
}

/**
 * 列出记录（按最近更新倒序）。
 *
 * @param filter.states 只看这些状态
 * @param filter.limit 最多返回条数
 */
export function listOpSyncRecords(filter?: {
    states?: readonly OpSyncState[];
    limit?: number;
}): OpSyncRecord[] {
    let rows = [...refreshOpSyncRecords()].sort((a, b) => b.updatedAt - a.updatedAt);
    const states = filter?.states;
    if (states && states.length > 0) {
        rows = rows.filter((r) => states.includes(r.state));
    }
    if (filter?.limit !== undefined) rows = rows.slice(0, filter.limit);
    return rows;
}

/** 各状态计数（供面板摘要与侧栏徽标）。 */
export function summarizeOpSync(): Record<OpSyncState, number> {
    const summary: Record<OpSyncState, number> = {
        pending: 0,
        running: 0,
        success: 0,
        failed: 0,
        cancelled: 0
    };
    for (const record of load()) summary[record.state]++;
    return summary;
}

/** 删除一条记录。 */
export function removeOpSyncRecord(carNum: string, kind: OpSyncKind): boolean {
    const records = refreshOpSyncRecords();
    const key = recordKey({ carNum, kind });
    const next = records.filter((r) => r.retained || recordKey(r) !== key);
    if (next.length === records.length) return false;
    cache = next;
    persist();
    return true;
}

/**
 * 清空**终态**记录（success/failed/cancelled），保留 pending/running。
 * 用于面板的「清理已完成」。
 *
 * @returns 清除条数
 */
export function clearOpSyncTerminal(): number {
    const records = refreshOpSyncRecords();
    const next = records.filter((r) => r.retained || !TERMINAL_STATES.includes(r.state));
    const removed = records.length - next.length;
    if (removed > 0) {
        cache = next;
        persist();
    }
    return removed;
}

/** 标记「用户取消」：终态置 cancelled（不再自动重推）。 */
export function cancelOpSyncRecord(carNum: string, kind: OpSyncKind): boolean {
    return setOpSyncState(carNum, kind, 'cancelled', { error: '' }) !== null;
}

/** 测试用：注入存储替身并清缓存。 */
export function setOpSyncStorageForTest(next: OpSyncStorage | null): void {
    storage = next ?? createDefaultStorage();
    cache = null;
}

/** 测试用：重置模块状态（重新读注入的存储）。 */
export function resetOpSyncForTest(): void {
    cache = null;
}
