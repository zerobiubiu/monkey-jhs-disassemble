/** 清单最新意图权威：原生与批量入口共同防止中断恢复重放旧意图。 */
import type { ListIntent, ListIntentPublishOptions } from '../../../types/list-intent';

const PREFIX = 'jhs:list-intent:';

function storageKey(videoId: string, listId: string): string {
    if (!videoId.trim() || !listId.trim()) throw new Error('无法登记缺少影片或清单 ID 的意图');
    return `${PREFIX}${window.location.origin}:${encodeURIComponent(videoId)}:${encodeURIComponent(listId)}`;
}

export function readCurrentListIntent(videoId: string, listId: string): ListIntent | null {
    if (typeof GM_getValue !== 'function') throw new Error('无法读取清单最新意图');
    const raw: unknown = GM_getValue(storageKey(videoId, listId), null);
    if (raw === null) return null;
    const value: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!value || typeof value !== 'object') throw new Error('清单最新意图记录损坏');
    const entry = value as Partial<ListIntent>;
    if (entry.version !== 1 || entry.videoId !== videoId || entry.listId !== listId ||
        typeof entry.intentId !== 'string' || !entry.intentId.trim() ||
        typeof entry.createdAt !== 'number' || !Number.isSafeInteger(entry.createdAt) || entry.createdAt < 0 ||
        typeof entry.desiredChecked !== 'boolean' ||
        (entry.supersedeOnly !== undefined && typeof entry.supersedeOnly !== 'boolean')) throw new Error('清单最新意图记录损坏');
    return entry as ListIntent;
}

/**
 * 必须在该影片/清单的共享关联锁内调用，且完整预写日志已经可靠落盘。
 * 默认用于恢复：较旧意图及同毫秒不同 token 均不能覆盖已发布意图。
 * 新明确操作传 explicit=true，同毫秒以持锁发布顺序为准；较旧时间仍不得覆盖。
 */
export function publishListIntent(
    videoId: string,
    listId: string,
    intentId: string,
    createdAt: number,
    desiredChecked: boolean,
    options: ListIntentPublishOptions = {}
): void {
    const key = storageKey(videoId, listId);
    if (!intentId.trim() || !Number.isSafeInteger(createdAt) || createdAt < 0 || typeof desiredChecked !== 'boolean') {
        throw new Error('清单意图标识、时间或目标状态无效');
    }
    const current = readCurrentListIntent(videoId, listId);
    if (current?.intentId === intentId) {
        if (current.createdAt !== createdAt || current.desiredChecked !== desiredChecked) {
            throw new Error('同一清单意图标识不能复用为不同操作');
        }
        // 路由落盘后才能把占位升级为实体目标；恢复占位不得降级已确定的实体目标。
        if (!current.supersedeOnly || options.supersedeOnly) return;
    }
    if (current && current.intentId !== intentId &&
        (current.createdAt > createdAt || (current.createdAt === createdAt && !options.explicit))) return;
    if (typeof GM_setValue !== 'function') throw new Error('无法保存清单最新意图');
    const payload = JSON.stringify({ version: 1, videoId, listId, intentId, createdAt, desiredChecked,
        ...(options.supersedeOnly ? { supersedeOnly: true } : {}) } satisfies ListIntent);
    GM_setValue(key, payload);
    if (GM_getValue(key, null) !== payload) throw new Error('清单最新意图写入回读不一致');
}

/** 无权威记录时返回 false；兼容旧日志的恢复方应先按原时间安全发布，再调用此检查。 */
export function isCurrentListIntent(videoId: string, listId: string, intentId: string): boolean {
    return readCurrentListIntent(videoId, listId)?.intentId === intentId;
}
