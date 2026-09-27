/**
 * 预加载任务注册表 —— 「批量预加载请求列表面板」的数据源（doc/26）。
 *
 * 队列本身（`AsyncTaskQueue`）只持有「业务键 + 状态」，面板需要的展示信息
 * （番号 / 站点名）与失败任务的**留存**由本注册表负责：
 *
 * - 队列执行成功 → 记录移除（页面上徽标已显示「成功匹配」，无需留存）；
 * - 队列执行失败 / 被手动取消 → 记录留存，供面板展示与「重试」；
 * - 容量上限防止长列表页无限累积（超限时按最旧的**终态**记录淘汰）。
 *
 * **纯数据结构**：不读写 DOM / 不发起请求，可独立单测。
 */

/** 任务状态（与队列状态区分：这里额外含终态 failed / cancelled）。 */
export type PreloadTaskStatus = 'queued' | 'requesting' | 'failed' | 'cancelled';

/** 状态 → 面板文案。 */
export const PRELOAD_TASK_STATUS_TEXT: Record<PreloadTaskStatus, string> = {
    queued: '排队中',
    requesting: '执行中',
    failed: '失败',
    cancelled: '已取消'
};

/** 单条预加载任务记录。 */
export interface PreloadTaskRecord {
    /** 业务键，与队列键一致（`${carNum}_${siteId}`）。 */
    readonly key: string;
    /** 番号。 */
    readonly carNum: string;
    /** 站点 id（如 `missAvBtn`）。 */
    readonly siteId: string;
    /** 站点显示名（id 去 `Btn` 后缀）。 */
    readonly siteLabel: string;
    /** 当前状态。 */
    status: PreloadTaskStatus;
    /** 最近一次状态变更时间戳（毫秒）。 */
    updatedAt: number;
}

/** 各状态计数。 */
export interface PreloadTaskCounts {
    queued: number;
    requesting: number;
    failed: number;
    cancelled: number;
}

/** 判定是否为终态（不再占用队列）。 */
export function isTerminalStatus(status: PreloadTaskStatus): boolean {
    return status === 'failed' || status === 'cancelled';
}

/** 预加载任务注册表。 */
export class PreloadTaskRegistry {
    private readonly tasks = new Map<string, PreloadTaskRecord>();
    private readonly capacity: number;

    /**
     * @param capacity 最大留存记录数（超限按最旧终态记录淘汰），默认 400
     */
    constructor(capacity = 400) {
        this.capacity = Math.max(1, Math.floor(capacity) || 1);
    }

    /**
     * 新增或重置一条任务记录（同键重复入队时回到 `queued` 并刷新时间戳）。
     *
     * @returns 写入后的记录
     */
    upsert(key: string, carNum: string, siteId: string, siteLabel: string, now = Date.now()): PreloadTaskRecord {
        const record: PreloadTaskRecord = {
            key,
            carNum,
            siteId,
            siteLabel,
            status: 'queued',
            updatedAt: now
        };
        this.tasks.set(key, record);
        this.prune();
        return record;
    }

    /**
     * 更新任务状态。
     *
     * @returns 记录是否存在（不存在则不创建 —— 只对已知任务改状态）
     */
    setStatus(key: string, status: PreloadTaskStatus, now = Date.now()): boolean {
        const record = this.tasks.get(key);
        if (!record) {
            return false;
        }
        record.status = status;
        record.updatedAt = now;
        return true;
    }

    /** 取一条记录。 */
    get(key: string): PreloadTaskRecord | undefined {
        return this.tasks.get(key);
    }

    /** 移除一条记录。@returns 是否移除成功。 */
    remove(key: string): boolean {
        return this.tasks.delete(key);
    }

    /** 清空全部记录。 */
    clear(): void {
        this.tasks.clear();
    }

    /** 记录数。 */
    get size(): number {
        return this.tasks.size;
    }

    /** 全部记录（等待中/执行中按时间戳升序在前，终态在后）。 */
    list(): PreloadTaskRecord[] {
        const active: PreloadTaskRecord[] = [];
        const terminal: PreloadTaskRecord[] = [];
        for (const record of this.tasks.values()) {
            (isTerminalStatus(record.status) ? terminal : active).push(record);
        }
        active.sort((a, b) => a.updatedAt - b.updatedAt);
        terminal.sort((a, b) => a.updatedAt - b.updatedAt);
        return [...active, ...terminal];
    }

    /** 终态记录（失败 / 已取消），按最旧优先。 */
    listTerminal(): PreloadTaskRecord[] {
        return this.list().filter((r) => isTerminalStatus(r.status));
    }

    /** 各状态计数。 */
    counts(): PreloadTaskCounts {
        const counts: PreloadTaskCounts = { queued: 0, requesting: 0, failed: 0, cancelled: 0 };
        for (const record of this.tasks.values()) {
            counts[record.status]++;
        }
        return counts;
    }

    /** 清空终态记录。@returns 移除数量。 */
    clearTerminal(): number {
        let removed = 0;
        for (const key of [...this.tasks.keys()]) {
            const record = this.tasks.get(key);
            if (record && isTerminalStatus(record.status)) {
                this.tasks.delete(key);
                removed++;
            }
        }
        return removed;
    }

    /** 超容量时淘汰最旧的终态记录（非终态记录不淘汰，避免丢掉队列中任务的展示信息）。 */
    private prune(): void {
        if (this.tasks.size <= this.capacity) {
            return;
        }
        const terminal = this.listTerminal();
        for (const record of terminal) {
            if (this.tasks.size <= this.capacity) {
                break;
            }
            this.tasks.delete(record.key);
        }
    }
}
