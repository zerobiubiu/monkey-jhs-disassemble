/**
 * JavDB 归属清单跨站同步协议与发布用例 —— JavDB → GM 存储 → MissAV。
 *
 * 与车号状态同步（`car-status-publish.ts`）共用同一油猴 GM 存储零后端原理，
 * 但使用独立的 GM 键与修订号分配器，彼此水位线完全隔离、互不干扰：
 * - 压缩载荷采用「清单元数据数组 + 归一化番号 → 清单下标数组」紧凑格式，
 *   经 `gzipToBase64` 压缩后仅数十 KB，全量发布幂等、无删改名漂移风险；
 * - 番号匹配键统一走领域层 `normalizeCarNum(..., 'path')`，与 MissAV 状态标签保持单源一致；
 * - 消费端严格校验 `validateVltSnapshot` 与颜色/链接安全性，防止损坏载荷污染本地库。
 */

import { normalizeCarNum } from '../../core/domain/car-num';
import { sanitizeUrl } from '../../core/jsx-to-string';
import { withExclusiveLock } from '../../core/sync';

import type { InventoryRecord } from '../video-lists-tag/vlt-db';
import { gzipToBase64 } from './car-status-columnar';

/** GM 存储键：JavDB 清单跨站同步全量快照（gzip + base64）。 */
export const GM_KEY_VLT_SYNC_DATA = 'jhs_vlt_lists_data';

/** GM 存储键：JavDB 清单跨站同步单调修订号分配器。 */
export const GM_KEY_VLT_SYNC_REVISION = 'jhs_vlt_lists_revision';

/** GM 存储键：JavDB 清单上次成功发布时间戳。 */
export const GM_KEY_VLT_SYNC_LAST_TS = 'jhs_vlt_lists_last_sync';

/** JavDB 端发布互斥锁名。 */
const JAVDB_VLT_PUBLISH_LOCK = 'jhs-javdb-vlt-sync-publisher';

/** JavDB 清单根域名（相对路径补全目标）。 */
const JAVDB_ORIGIN = 'https://javdb.com';

/** 控制字符校验（防不安全字符串）。 */
const CONTROL_CHAR_REGEX = new RegExp(`[\\u0000-\\u001f\\u007f]`);

/** 允许的简单十六进制颜色（Bootstrap 调色板与合法 CSS hex）。 */
const SAFE_HEX_COLOR_REGEX = /^#[0-9a-fA-F]{3,8}$/;

/** 跨站传输的清单元数据。 */
export interface MissavVltListMeta {
    id: string;
    name: string;
    url: string | null;
    style: { name: string; bg: string; text: string } | null;
}

/** 解压后的紧凑清单快照。 */
export interface MissavVltSnapshot {
    /** 清单元数据数组，下标即紧凑引用 ID。 */
    lists: MissavVltListMeta[];
    /** 归一化番号（`normalizeCarNum(..., 'path')`）→ 所属清单下标列表（去重升序）。 */
    byCarNum: Record<string, number[]>;
}

/** 写入 GM 存储的清单同步载荷。 */
export interface MissavVltSyncPayload {
    /** `MissavVltSnapshot` JSON 经 gzip + base64 编码的字符串。 */
    data: string;
    /** 单调递增修订号。 */
    revision: number;
    /** 清单总数（用于消费侧一致性校验）。 */
    listCount: number;
    /** 覆盖番号总数（用于消费侧一致性校验）。 */
    movieCount: number;
    /** 发布时间戳（毫秒）。 */
    ts: number;
    /** 就绪标记（允许空快照合法清空本地旧清单）。 */
    ready: true;
}

/** 校验结果。 */
export type VltSnapshotValidationResult =
    | { ok: true; snapshot: MissavVltSnapshot }
    | { ok: false; reason: string };

/** 发布失败原因。 */
export type VltPublishFailureReason = 'compress-failed' | 'superseded';

/** 清单跨站发布结果。 */
export interface PublishVltResult {
    ok: boolean;
    reason?: VltPublishFailureReason;
    listCount: number;
    movieCount: number;
    revision: number | null;
}

/** 当前标签页内的清单修订号逻辑时钟。 */
let lastIssuedVltRevision = 0;

/** 规整 JavDB 清单 URL 为安全绝对地址；非法协议返回 null。 */
export function normalizeJavdbListUrl(raw: string | null | undefined): string | null {
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (!trimmed || CONTROL_CHAR_REGEX.test(trimmed)) return null;
    const expanded = trimmed.startsWith('/') && !trimmed.startsWith('//')
        ? `${JAVDB_ORIGIN}${trimmed}`
        : trimmed;
    const safe = sanitizeUrl(expanded);
    if (!safe || safe === '#') return null;
    try {
        const parsed = new URL(safe);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
        return parsed.href;
    } catch {
        return null;
    }
}

/** 校验并归一化清单样式对象；非法颜色降级为 null（渲染时回退调色板）。 */
function normalizeListStyle(
    style: unknown
): { name: string; bg: string; text: string } | null {
    if (!style || typeof style !== 'object' || Array.isArray(style)) return null;
    const rec = style as Record<string, unknown>;
    if (
        typeof rec.bg !== 'string' ||
        typeof rec.text !== 'string' ||
        !SAFE_HEX_COLOR_REGEX.test(rec.bg.trim()) ||
        !SAFE_HEX_COLOR_REGEX.test(rec.text.trim())
    ) {
        return null;
    }
    return {
        name: typeof rec.name === 'string' ? rec.name.trim() : '',
        bg: rec.bg.trim(),
        text: rec.text.trim()
    };
}

/**
 * 将 JavDB `VltDb` 的 `inventory` 与 `movieInventory` 构造成跨站紧凑快照。
 *
 * 仅保留在 `inventory` 中已登记的清单；同一归一化番号在原库中若存在大小写或变体重复条目，
 * 自动合并其清单集合并按清单下标去重升序排列。
 */
export function buildVltSnapshot(
    inventory: Record<string, InventoryRecord>,
    movieInventory: Record<string, boolean>
): MissavVltSnapshot {
    const lists: MissavVltListMeta[] = [];
    const listIdToIndex = new Map<string, number>();

    for (const [key, item] of Object.entries(inventory || {})) {
        if (!item || typeof item !== 'object') continue;
        const id = String(item.listId || key).trim();
        const name = typeof item.name === 'string' ? item.name.trim() : '';
        if (!id || !name) continue;
        if (listIdToIndex.has(id)) continue;
        listIdToIndex.set(id, lists.length);
        lists.push({
            id,
            name,
            url: normalizeJavdbListUrl(item.url),
            style: normalizeListStyle(item.style)
        });
    }

    const byCarSet = new Map<string, Set<number>>();
    for (const [assocKey, active] of Object.entries(movieInventory || {})) {
        if (!active) continue;
        const sep = assocKey.indexOf('::');
        if (sep <= 0) continue;
        const designation = assocKey.slice(0, sep);
        const listId = assocKey.slice(sep + 2).trim();
        const listIndex = listIdToIndex.get(listId);
        if (listIndex === undefined) continue;
        const normalizedCar = normalizeCarNum(designation, 'path');
        if (!normalizedCar) continue;
        let set = byCarSet.get(normalizedCar);
        if (!set) {
            set = new Set<number>();
            byCarSet.set(normalizedCar, set);
        }
        set.add(listIndex);
    }

    const byCarNum: Record<string, number[]> = {};
    for (const [carNum, indexSet] of byCarSet) {
        byCarNum[carNum] = Array.from(indexSet).sort((a, b) => a - b);
    }

    return { lists, byCarNum };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

/**
 * 消费端严格校验解压后的清单快照。
 * 任一清单结构损坏、下标越界或计数与声明不符均拒绝应用，保护 MissAV 既有本地数据。
 */
export function validateVltSnapshot(
    raw: unknown,
    expectedListCount: unknown,
    expectedMovieCount: unknown
): VltSnapshotValidationResult {
    if (
        !Number.isInteger(expectedListCount) ||
        (expectedListCount as number) < 0 ||
        !Number.isInteger(expectedMovieCount) ||
        (expectedMovieCount as number) < 0
    ) {
        return { ok: false, reason: '清单快照计数声明无效' };
    }
    if (!isPlainObject(raw)) {
        return { ok: false, reason: '清单快照必须是普通对象' };
    }
    if (!Array.isArray(raw.lists) || !isPlainObject(raw.byCarNum)) {
        return { ok: false, reason: '清单快照缺少 lists 或 byCarNum 字段' };
    }

    const lists: MissavVltListMeta[] = [];
    const seenIds = new Set<string>();
    for (const entry of raw.lists) {
        if (!isPlainObject(entry)) {
            return { ok: false, reason: '清单元数据项不是普通对象' };
        }
        const id = typeof entry.id === 'string' ? entry.id.trim() : '';
        const name = typeof entry.name === 'string' ? entry.name.trim() : '';
        if (!id || !name || seenIds.has(id)) {
            return { ok: false, reason: `清单元数据无效或重复：${id || '(空)'}` };
        }
        seenIds.add(id);
        lists.push({
            id,
            name,
            url: normalizeJavdbListUrl(typeof entry.url === 'string' ? entry.url : null),
            style: normalizeListStyle(entry.style)
        });
    }

    if (lists.length !== expectedListCount) {
        return {
            ok: false,
            reason: `清单数量不一致：声明 ${String(expectedListCount)}，实际 ${lists.length}`
        };
    }

    const byCarNum: Record<string, number[]> = {};
    for (const [rawCar, rawIndices] of Object.entries(raw.byCarNum)) {
        const carNum = normalizeCarNum(rawCar, 'path');
        if (!carNum || !Array.isArray(rawIndices)) {
            return { ok: false, reason: `番号映射格式无效：${rawCar}` };
        }
        const dedup = new Set<number>();
        for (const idx of rawIndices) {
            if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0 || idx >= lists.length) {
                return { ok: false, reason: `番号 ${carNum} 含越界清单下标：${String(idx)}` };
            }
            dedup.add(idx);
        }
        if (dedup.size > 0) {
            byCarNum[carNum] = Array.from(dedup).sort((a, b) => a - b);
        }
    }

    const actualMovies = Object.keys(byCarNum).length;
    if (actualMovies !== expectedMovieCount) {
        return {
            ok: false,
            reason: `关联影片数量不一致：声明 ${String(expectedMovieCount)}，实际 ${actualMovies}`
        };
    }

    return { ok: true, snapshot: { lists, byCarNum } };
}

/** 分配下一个清单跨站同步单调修订号。 */
async function allocateVltRevision(): Promise<number> {
    return withExclusiveLock(JAVDB_VLT_PUBLISH_LOCK, async () => {
        const now = Date.now();
        let persisted = 0;
        try {
            const value = GM_getValue(GM_KEY_VLT_SYNC_REVISION, 0);
            if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
                persisted = value;
            }
        } catch {
            /* 回退至本地逻辑时钟 */
        }
        lastIssuedVltRevision = Math.max(now, persisted + 1, lastIssuedVltRevision + 1);
        GM_setValue(GM_KEY_VLT_SYNC_REVISION, lastIssuedVltRevision);
        return lastIssuedVltRevision;
    });
}

/**
 * JavDB 发布侧清单全量快照发布用例：
 * 读取 `inventory`/`movieInventory` → 构造紧凑快照 → gzip+base64 → 修订号门控写入 GM。
 */
export async function publishVltSnapshot(
    readSnapshot: () => Promise<{
        inventory: Record<string, InventoryRecord>;
        movieInventory: Record<string, boolean>;
    }>
): Promise<PublishVltResult> {
    const { inventory, movieInventory } = await readSnapshot();
    const snapshot = buildVltSnapshot(inventory, movieInventory);
    const listCount = snapshot.lists.length;
    const movieCount = Object.keys(snapshot.byCarNum).length;

    const revision = await allocateVltRevision();
    const base64 = await gzipToBase64(snapshot);
    if (!base64) {
        return { ok: false, reason: 'compress-failed', listCount, movieCount, revision };
    }

    const payload: MissavVltSyncPayload = {
        data: base64,
        revision,
        listCount,
        movieCount,
        ts: revision,
        ready: true
    };

    const published = await withExclusiveLock(JAVDB_VLT_PUBLISH_LOCK, async () => {
        const current = GM_getValue(GM_KEY_VLT_SYNC_DATA) as Partial<MissavVltSyncPayload> | undefined;
        const currentRev = typeof current?.revision === 'number' ? current.revision : -1;
        if (currentRev >= revision) return false;
        GM_setValue(GM_KEY_VLT_SYNC_DATA, payload);
        GM_setValue(GM_KEY_VLT_SYNC_LAST_TS, Date.now());
        return true;
    });

    if (!published) {
        return { ok: false, reason: 'superseded', listCount, movieCount, revision };
    }
    return { ok: true, listCount, movieCount, revision };
}

/** 重置模块态（仅限测试）。 */
export function __resetVltPublisherForTest(): void {
    lastIssuedVltRevision = 0;
}
