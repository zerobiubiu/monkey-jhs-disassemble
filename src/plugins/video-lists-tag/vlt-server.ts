/**
 * 服务端变更管线 —— JavDB API 请求 + 恢复日志 + 权威状态校验。
 *
 * 实现已拆分至：
 * - vlt-server-api.ts — postJavdbListMutation + fetchAuthoritativeCheckboxState + 恢复日志
 * - vlt-server-recover.ts — recoverPendingServerSyncs + commitAuthoritativeState
 *
 * 本文件保留：
 * - setupCheckboxListener：接管 JavDB 原生清单 checkbox change 事件
 * - enqueueServerCheckboxMutation / performServerCheckboxMutation：串行化变更管线
 * - re-export fetchAuthoritativeCheckboxState（vlt-create-list.tsx 依赖）
 */

import { showToast } from './vlt-toast';
import {
    reconcileAfterConfirmedMutation,
    reconcileListBeforeMutation,
    setupAutomaticListReconciliation
} from './vlt-reconcile';
import { enqueueAssociationTask } from './vlt-lock-queue';
import { handleCheckboxChange } from './vlt-checkbox';
import {
    getListInfo,
    getMovieInfo,
    LOG_PREFIX,
    setListCheckboxBusy,
    setListCheckboxState,
    setListDisplayedCount
} from './vlt-helpers';
import type { ListInfo, MovieInfo } from './vlt-helpers';
import {
    createPendingJournal,
    fetchAuthoritativeCheckboxState,
    postJavdbListMutation,
    removePendingJournal
} from './server/vlt-server-api';
import type { PendingServerSync } from './server/vlt-server-api';
import { commitAuthoritativeState, recoverPendingServerSyncs } from './server/vlt-server-recover';

export { fetchAuthoritativeCheckboxState };

let checkboxListenerInstalled = false;

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
