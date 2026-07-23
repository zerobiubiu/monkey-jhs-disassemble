/**
 * 服务端变更管线 —— JavDB API 请求 + 恢复日志。
 *
 * 提取自 vlt-server.ts：
 * - postJavdbListMutation：POST /users/save_video_to_list
 * - fetchAuthoritativeCheckboxState：GET /users/simple_lists 权威状态查询
 * - 恢复日志（journal）读写：createPendingJournal / removePendingJournal / readPendingJournals
 */
import {
    AUTHORITATIVE_LIST_TIMEOUT_MS,
    extractListNameFromInput,
    getCheckboxCount,
    getCsrfToken,
    LOG_PREFIX,
    PENDING_SYNC_PREFIX
} from '../vlt-helpers';
import type { ListInfo, MovieInfo } from '../vlt-helpers';

export interface PendingServerSync {
    version: 1;
    videoId: string;
    desiredChecked: boolean;
    movieInfo: MovieInfo;
    listInfo: ListInfo;
    createdAt: number;
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

export function createPendingJournal(entry: PendingServerSync): string | null {
    try {
        const randomPart =
            typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : `${Math.random().toString(36).slice(2)}-${Date.now()}`;
        const key = `${PENDING_SYNC_PREFIX}${entry.createdAt}:${randomPart}`;
        localStorage.setItem(key, JSON.stringify(entry));
        return key;
    } catch (error) {
        clog.error(`${LOG_PREFIX} 无法写入清单同步恢复日志`, error);
        return null;
    }
}

export function removePendingJournal(key: string | null): void {
    if (!key) return;
    try {
        localStorage.removeItem(key);
    } catch {}
}

export function readPendingJournals(): { key: string; entry: PendingServerSync }[] {
    const keys: string[] = [];
    try {
        for (let index = 0; index < localStorage.length; index++) {
            const key = localStorage.key(index);
            if (key?.startsWith(PENDING_SYNC_PREFIX)) keys.push(key);
        }
    } catch {
        return [];
    }

    const entries: { key: string; entry: PendingServerSync }[] = [];
    for (const key of keys) {
        try {
            const value = localStorage.getItem(key);
            if (!value) continue;
            const entry = JSON.parse(value) as Partial<PendingServerSync>;
            if (
                entry.version !== 1 ||
                !entry.videoId ||
                !entry.movieInfo?.designation ||
                !entry.listInfo?.list_id ||
                typeof entry.desiredChecked !== 'boolean' ||
                typeof entry.createdAt !== 'number'
            ) {
                removePendingJournal(key);
                continue;
            }
            entries.push({ key, entry: entry as PendingServerSync });
        } catch {
            removePendingJournal(key);
        }
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

        for (let page = 0; url && page < 50; page++) {
            if (visited.has(url.href)) return null;
            visited.add(url.href);
            const payload = await (async () => {
                const controller = new AbortController();
                const timeout = window.setTimeout(
                    () => controller.abort(),
                    AUTHORITATIVE_LIST_TIMEOUT_MS
                );
                try {
                    const response = await fetch(url.href, {
                        credentials: 'same-origin',
                        cache: 'no-store',
                        headers: { Accept: 'application/json' },
                        signal: controller.signal
                    });
                    if (!response.ok) return null;
                    return (await response.json()) as { lists?: unknown; page?: unknown };
                } finally {
                    window.clearTimeout(timeout);
                }
            })();
            if (!payload) return null;
            if (typeof payload.lists !== 'string') return null;

            const documentNode = new DOMParser().parseFromString(payload.lists, 'text/html');
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

            const pageHtml = typeof payload.page === 'string' ? payload.page : '';
            const pageDocument = new DOMParser().parseFromString(pageHtml, 'text/html');
            const nextHref = pageDocument.querySelector('a[rel="next"]')?.getAttribute('href');
            if (!nextHref) return { checked: false, count: null, name: null };
            const nextUrl: URL = new URL(nextHref, url.href);
            if (
                nextUrl.origin !== window.location.origin ||
                nextUrl.pathname !== '/users/simple_lists'
            ) {
                return null;
            }
            nextUrl.searchParams.set('vid', videoId);
            url = nextUrl;
        }
        return null;
    } catch (error) {
        clog.error(`${LOG_PREFIX} 查询 JavDB 权威清单状态失败`, error);
        return null;
    }
}
