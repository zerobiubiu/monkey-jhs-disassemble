/**
 * 服务端变更管线 —— JavDB API 请求 + 恢复日志 + 权威状态校验。
 *
 * 提取自 vlt-sync.tsx：
 * - setupCheckboxListener：接管 JavDB 原生清单 checkbox change 事件
 * - enqueueServerCheckboxMutation：串行化服务端变更请求
 * - performServerCheckboxMutation：POST → 权威查询 → 本地提交
 * - recoverPendingServerSyncs：页面加载时恢复未完成的变更
 * - postJavdbListMutation / fetchAuthoritativeCheckboxState：JavDB API 调用
 */

import { VltDb } from './vlt-db';
import { showToast } from './vlt-toast';
import {
    reconcileAfterConfirmedMutation,
    reconcileListBeforeMutation,
    reconcileListWithJavdb,
    setupAutomaticListReconciliation
} from './vlt-reconcile';
import { enqueueAssociationTask } from './vlt-lock-queue';
import { handleCheckboxChange } from './vlt-checkbox';
import {
    AUTHORITATIVE_LIST_TIMEOUT_MS,
    extractListNameFromInput,
    getCheckboxCount,
    getCsrfToken,
    getListInfo,
    getMovieInfo,
    LOG_PREFIX,
    PENDING_SYNC_PREFIX,
    setListCheckboxBusy,
    setListCheckboxState,
    setListDisplayedCount
} from './vlt-helpers';
import type { ListInfo, MovieInfo } from './vlt-helpers';

interface PendingServerSync {
    version: 1;
    videoId: string;
    desiredChecked: boolean;
    movieInfo: MovieInfo;
    listInfo: ListInfo;
    createdAt: number;
}

interface AuthoritativeCheckboxState {
    checked: boolean;
    count: number | null;
    name: string | null;
}

type ServerMutationResult =
    | { kind: 'confirmed'; message: string }
    | { kind: 'rejected'; message: string }
    | { kind: 'unknown'; message: string };

let checkboxListenerInstalled = false;

function createPendingJournal(entry: PendingServerSync): string | null {
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

function removePendingJournal(key: string | null): void {
    if (!key) return;
    try {
        localStorage.removeItem(key);
    } catch {}
}

function readPendingJournals(): { key: string; entry: PendingServerSync }[] {
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

async function postJavdbListMutation(
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

async function commitAuthoritativeState(
    entry: PendingServerSync,
    authoritative: AuthoritativeCheckboxState,
    notify: boolean
): Promise<boolean> {
    const listInfo: ListInfo = {
        ...entry.listInfo,
        info: {
            ...entry.listInfo.info,
            name: authoritative.name || entry.listInfo.info.name
        }
    };
    let reconciledBeforeCommit = false;
    if (authoritative.count !== null) {
        const before = await VltDb.getListReconcileState(
            entry.listInfo.list_id,
            entry.movieInfo.designation
        );
        const projectedCount =
            before.actualCount +
            (authoritative.checked && before.hasDesignation === false
                ? 1
                : !authoritative.checked && before.hasDesignation === true
                  ? -1
                  : 0);
        if (projectedCount !== authoritative.count) {
            reconciledBeforeCommit = await reconcileListWithJavdb(entry.listInfo.list_id, {
                expectedCount: authoritative.count,
                designation: entry.movieInfo.designation,
                checked: authoritative.checked,
                quiet: !notify
            });
            if (!reconciledBeforeCommit) return false;
        }
    }

    const result = await handleCheckboxChange(
        entry.movieInfo,
        listInfo,
        authoritative.checked,
        {
            serverConfirmed: true,
            silent: !notify || reconciledBeforeCommit,
            skipAutomation: !notify
        }
    );
    if (!result) return false;

    setListCheckboxState(entry.listInfo.list_id, authoritative.checked);
    if (authoritative.count !== null) {
        setListDisplayedCount(entry.listInfo.list_id, authoritative.count);
        const state = await VltDb.getListReconcileState(
            entry.listInfo.list_id,
            entry.movieInfo.designation
        );
        if (
            state.inventory &&
            (state.actualCount !== authoritative.count ||
                state.hasDesignation !== authoritative.checked)
        ) {
            return reconcileListWithJavdb(entry.listInfo.list_id, {
                expectedCount: authoritative.count,
                designation: entry.movieInfo.designation,
                checked: authoritative.checked,
                quiet: !notify
            });
        }
    }
    return true;
}

async function recoverPendingServerSyncs(): Promise<void> {
    for (const { key, entry } of readPendingJournals()) {
        const associationKey = `${entry.movieInfo.designation}::${entry.listInfo.list_id}`;
        await enqueueAssociationTask(associationKey, async () => {
            const authoritative = await fetchAuthoritativeCheckboxState(
                entry.videoId,
                entry.listInfo.list_id
            );
            if (!authoritative) return;
            if (await commitAuthoritativeState(entry, authoritative, false)) {
                removePendingJournal(key);
                console.log(
                    `${LOG_PREFIX} 已恢复未完成清单同步：${entry.movieInfo.designation} ` +
                        `${authoritative.checked ? 'add' : 'remove'} ${entry.listInfo.list_id}`
                );
            }
        });
    }
}

async function performServerCheckboxMutation(
    movieInfo: MovieInfo,
    listInfo: ListInfo,
    checked: boolean,
    input: HTMLInputElement | null,
    checkedBeforeMutation: boolean
): Promise<void> {
    const listId = listInfo.list_id;
    let confirmedChecked: boolean | null = null;
    setListCheckboxState(listId, checked);
    setListCheckboxBusy(listId, true);

    try {
        if (input) {
            await reconcileListBeforeMutation(input, movieInfo.designation, checkedBeforeMutation);
        }

        const pending: PendingServerSync = {
            version: 1,
            videoId: input?.value || movieInfo.info.href.match(/\/v\/([^/?#]+)/)?.[1] || '',
            desiredChecked: checked,
            movieInfo,
            listInfo,
            createdAt: Date.now()
        };
        if (!pending.videoId) throw new Error('无法识别 JavDB 影片 ID');
        const journalKey = createPendingJournal(pending);
        if (!journalKey) throw new Error('无法建立清单同步恢复日志，本次操作已取消');
        const serverResult = await postJavdbListMutation(pending.videoId, listId, checked);

        if (serverResult.kind === 'rejected') {
            removePendingJournal(journalKey);
            setListCheckboxState(listId, checkedBeforeMutation);
            showToast(`✗ JavDB 清单更新失败：${serverResult.message}`, 'error');
            return;
        }

        if (serverResult.kind === 'unknown') {
            const observed = await fetchAuthoritativeCheckboxState(pending.videoId, listId);
            setListCheckboxState(listId, observed?.checked ?? checkedBeforeMutation);
            if (observed?.count !== null && observed?.count !== undefined) {
                setListDisplayedCount(listId, observed.count);
            }
            showToast(
                `⚠ 无法确认 JavDB 最终状态（${serverResult.message}），本地未改动；下次打开页面会自动核对`,
                'warning'
            );
            return;
        }

        confirmedChecked = checked;
        const authoritative = await fetchAuthoritativeCheckboxState(pending.videoId, listId);
        if (authoritative) {
            confirmedChecked = authoritative.checked;
            if (await commitAuthoritativeState(pending, authoritative, true)) {
                removePendingJournal(journalKey);
            } else {
                showToast(
                    '⚠ JavDB 已更新，本地完整清单将在下次打开页面时继续校准',
                    'warning'
                );
            }
            return;
        }

        setListCheckboxState(listId, checked);
        const reconciled = await reconcileAfterConfirmedMutation(
            listId,
            movieInfo.designation,
            checked
        );
        const result = reconciled
            ? await handleCheckboxChange(movieInfo, listInfo, checked, {
                  serverConfirmed: true
              })
            : null;
        if (result) {
            removePendingJournal(journalKey);
        } else {
            showToast(
                '⚠ JavDB 已更新，但暂时无法复核最终清单；恢复日志已保留',
                'warning'
            );
        }
    } catch (error) {
        setListCheckboxState(
            listId,
            confirmedChecked === null ? checkedBeforeMutation : confirmedChecked
        );
        const message = error instanceof Error ? error.message : String(error);
        console.error(`${LOG_PREFIX} JavDB 清单同步失败`, error);
        showToast(
            confirmedChecked === null
                ? `✗ JavDB 清单同步失败：${message}`
                : `⚠ JavDB 已更新，本地镜像将在下次打开页面时继续恢复：${message}`,
            confirmedChecked === null ? 'error' : 'warning'
        );
    } finally {
        setListCheckboxBusy(listId, false);
    }
}

export function enqueueServerCheckboxMutation(
    movieInfo: MovieInfo,
    listInfo: ListInfo,
    checked: boolean,
    input: HTMLInputElement | null,
    checkedBeforeMutation: boolean
): Promise<void> {
    const key = `${movieInfo.designation}::${listInfo.list_id}`;
    return enqueueAssociationTask(key, () =>
        performServerCheckboxMutation(
            movieInfo,
            listInfo,
            checked,
            input,
            checkedBeforeMutation
        )
    );
}

/**
 * 接管 JavDB 原生清单 checkbox：先等待 `/users/save_video_to_list` 明确成功，
 * 再写本地 IDB。网络结果不确定时保留恢复日志，下次加载后用
 * `/users/simple_lists` 的最终权威状态恢复。
 */
export function setupCheckboxListener(): void {
    if (checkboxListenerInstalled) return;
    checkboxListenerInstalled = true;

    document.addEventListener(
        'change',
        (event: Event) => {
            const input = event.target as HTMLInputElement;
            if (
                input.tagName !== 'INPUT' ||
                input.type !== 'checkbox' ||
                input.dataset.action !== 'change->list#listCheckboxChanged' ||
                !input.closest('#modal-save-list')
            ) {
                return;
            }

            event.preventDefault();
            event.stopImmediatePropagation();

            const checked = input.checked;
            const checkedBeforeMutation = !checked;
            const movieInfo = getMovieInfo(input.value);
            const listInfo = getListInfo(input.dataset.listId || '');
            if (!movieInfo || !listInfo.list_id || !listInfo.info.name) {
                setListCheckboxState(listInfo.list_id, checkedBeforeMutation);
                showToast('✗ 无法读取影片或清单信息，本次操作已取消', 'error');
                return;
            }

            enqueueServerCheckboxMutation(
                movieInfo,
                listInfo,
                checked,
                input,
                checkedBeforeMutation
            ).then();
        },
        true
    );

    const currentVideoId = window.location.pathname.match(/\/v\/([^/?#]+)/)?.[1];
    const currentMovie = currentVideoId ? getMovieInfo(currentVideoId) : null;
    if (currentMovie) setupAutomaticListReconciliation(currentMovie.designation);
    recoverPendingServerSyncs().then();
}
