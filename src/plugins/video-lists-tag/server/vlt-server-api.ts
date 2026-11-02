/**
 * 服务端变更管线 —— JavDB API 请求 + 恢复日志。
 *
 * 提取自 vlt-server.ts：
 * - postJavdbListMutation：POST /users/save_video_to_list
 * - fetchAuthoritativeCheckboxState：GET /users/simple_lists 权威状态查询
 * - 恢复日志（journal）读写：createPendingJournal / removePendingJournal / readPendingJournals；独立持久数据 IndexedDB
 */
import {
    readPersistentPrefix,
    removePersistentValue,
    writePersistentValueAndWait
} from '../../../core/storage/persistent-data-store';
import { fetchSimpleListsPage } from '../../../core/util/util-simple-lists';

import { getCsrfToken } from '../../../core/util/site/csrf';
import {
    extractListNameFromInput,
    getCheckboxCount,
    LOG_PREFIX,
    PENDING_SYNC_PREFIX
} from '../vlt-helpers';
import type { ListInfo, MovieInfo } from '../vlt-helpers';
import { isCurrentListIntent, publishListIntent } from './vlt-intent';

export interface PendingServerSync {
    version: 1;
    videoId: string;
    desiredChecked: boolean;
    movieInfo: MovieInfo;
    listInfo: ListInfo;
    createdAt: number;
    /** 旧版日志缺省；新版在预写完成后登记到跨入口最新意图权威。 */
    intentId?: string;
}

export interface AuthoritativeCheckboxState {
    checked: boolean;
    count: number | null;
    name: string | null;
}

export type ServerMutationResult =
    | { kind: 'confirmed'; message: string }
    | { kind: 'rejected'; message: string }
    | { kind: 'unknown'; message: string };

export async function createPendingJournal(entry: PendingServerSync): Promise<string | null> {
    try {
        const randomPart =
            typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : `${Math.random().toString(36).slice(2)}-${Date.now()}`;
        const key = `${PENDING_SYNC_PREFIX}${entry.createdAt}:${randomPart}`;
        entry.intentId ||= randomPart;
        await writePersistentValueAndWait(
            'vltPending',
            key.slice(PENDING_SYNC_PREFIX.length),
            key,
            entry
        );
        publishListIntent(entry.videoId, entry.listInfo.list_id, entry.intentId, entry.createdAt, entry.desiredChecked, { explicit: true });
        if (!isCurrentListIntent(entry.videoId, entry.listInfo.list_id, entry.intentId)) {
            throw new Error('清单操作已被较新意图取代');
        }
        return key;
    } catch (error) {
        clog.error(`${LOG_PREFIX} 无法写入清单同步恢复日志`, error);
        return null;
    }
}

export function removePendingJournal(key: string | null): void {
    if (!key) return;
    const entryKey = key.startsWith(PENDING_SYNC_PREFIX)
        ? key.slice(PENDING_SYNC_PREFIX.length)
        : key;
    removePersistentValue('vltPending', entryKey, key);
}

export function readPendingJournals(): { key: string; entry: PendingServerSync }[] {
    const entries: { key: string; entry: PendingServerSync }[] = [];
    const values = readPersistentPrefix<Partial<PendingServerSync>>(
        'vltPending',
        PENDING_SYNC_PREFIX
    );

    for (const [entryKey, entry] of Object.entries(values)) {
        const key = PENDING_SYNC_PREFIX + entryKey;
        if (
            entry.version !== 1 ||
            !entry.videoId ||
            !entry.movieInfo?.designation ||
            !entry.listInfo?.list_id ||
            typeof entry.desiredChecked !== 'boolean' ||
            typeof entry.createdAt !== 'number' || !Number.isSafeInteger(entry.createdAt) || entry.createdAt < 0 ||
            (entry.intentId !== undefined && (typeof entry.intentId !== 'string' || !entry.intentId.trim()))
        ) {
            removePersistentValue('vltPending', entryKey, key);
            continue;
        }
        entries.push({ key, entry: entry as PendingServerSync });
    }
    return entries.sort((left, right) => left.entry.createdAt - right.entry.createdAt);
}

export async function postJavdbListMutation(
    videoId: string,
    listId: string,
    checked: boolean
): Promise<ServerMutationResult> {
    const csrfToken = getCsrfToken();
    if (!csrfToken) return { kind: 'rejected', message: '无法获取 CSRF token' };

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
        const response = await fetch(
            new URL('/users/save_video_to_list', window.location.origin).href,
            {
                method: 'POST',
                body: JSON.stringify({ video_id: videoId, checked, list_id: listId }),
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                signal: controller.signal,
                credentials: 'same-origin'
            }
        );
        const data = (await response.json().catch(() => null)) as {
            success?: unknown;
            message?: unknown;
        } | null;
        const message = typeof data?.message === 'string' ? data.message : `HTTP ${response.status}`;
        if (response.ok && data?.success === true) return { kind: 'confirmed', message };
        if (response.ok && data?.success === false) return { kind: 'rejected', message };
        return { kind: 'unknown', message };
    } catch (error) {
        return {
            kind: 'unknown',
            message: error instanceof Error ? error.message : String(error)
        };
    } finally {
        window.clearTimeout(timeout);
    }
}


export async function fetchAuthoritativeCheckboxState(
    videoId: string,
    listId: string
): Promise<AuthoritativeCheckboxState | null> {
    try {
        let url: URL | null = new URL('/users/simple_lists', window.location.origin);
        url.searchParams.set('vid', videoId);
        const visited = new Set<string>();

        while (url) {
            if (visited.has(url.href)) return null;
            visited.add(url.href);
            const result = await fetchSimpleListsPage(url.href, videoId);

            const documentNode = new DOMParser().parseFromString(result.entries, 'text/html');
            const input = (Array.from(
                documentNode.querySelectorAll('input[type="checkbox"][data-list-id]')
            ) as HTMLInputElement[]).find((item) => item.dataset.listId === listId);
            if (input) {
                return {
                    checked: input.checked,
                    count: getCheckboxCount(input),
                    name: extractListNameFromInput(input) || null
                };
            }

            if (!result.nextUrl) return { checked: false, count: null, name: null };
            url = new URL(result.nextUrl);
        }
        return null;
    } catch (error) {
        clog.error(`${LOG_PREFIX} 查询 JavDB 权威清单状态失败`, error);
        return null;
    }
}
