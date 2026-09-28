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

/** 记录容量上限：超出时优先淘汰最旧的**终态**记录（success/cancelled/failed）。 */
export const OP_SYNC_CAPACITY = 400;

/** GM 存储键。 */
export const OP_SYNC_GM_KEY = 'jhs:op-sync-records';

/** 终态（不会再自动变化）。 */
const TERMINAL_STATES: readonly OpSyncState[] = ['success', 'failed', 'cancelled'];

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
                if (typeof raw === 'string') return JSON.parse(raw) as OpSyncRecord[];
                if (Array.isArray(raw)) return raw as OpSyncRecord[];
                return null;
            } catch {
                return null;
            }
        },
        write: (records) => {
            try {
                GM_setValue(OP_SYNC_GM_KEY, JSON.stringify(records));
            } catch {
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
    cache = Array.isArray(raw) ? raw.filter(isRecord) : [];
    return cache;
}

/** 结构校验：忽略损坏条目而不是抛错（记录可重建，不能因脏数据拖垮设置面板）。 */
function isRecord(value: unknown): value is OpSyncRecord {
    if (!value || typeof value !== 'object') return false;
    const rec = value as Partial<OpSyncRecord>;
    return typeof rec.carNum === 'string' && typeof rec.kind === 'string' && typeof rec.state === 'string';
}

/** 落盘（容量超限时按「终态最旧优先」淘汰）。 */
function persist(): void {
    const records = load();
    if (records.length > OP_SYNC_CAPACITY) {
        const overflow = records.length - OP_SYNC_CAPACITY;
        const removable = records
            .filter((r) => TERMINAL_STATES.includes(r.state))
            .sort((a, b) => a.updatedAt - b.updatedAt)
            .slice(0, overflow);
        const removeKeys = new Set(removable.map(recordKey));
        cache = records.filter((r) => !removeKeys.has(recordKey(r)));
    }
    storage.write(load());
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
}): OpSyncRecord {
    const now = input.now ?? Date.now();
    const records = load();
    const key = recordKey({ carNum: input.carNum, kind: input.kind });
    const index = records.findIndex((r) => recordKey(r) === key);
    const record: OpSyncRecord = {
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
    patch?: { error?: string; attempts?: number; now?: number }
): OpSyncRecord | null {
    const records = load();
    const key = recordKey({ carNum, kind });
    const record = records.find((r) => recordKey(r) === key);
    if (!record) return null;
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
    return load().find((r) => recordKey(r) === key) ?? null;
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
    let rows = [...load()].sort((a, b) => b.updatedAt - a.updatedAt);
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
    const records = load();
    const key = recordKey({ carNum, kind });
    const next = records.filter((r) => recordKey(r) !== key);
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
    const records = load();
    const next = records.filter((r) => !TERMINAL_STATES.includes(r.state));
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