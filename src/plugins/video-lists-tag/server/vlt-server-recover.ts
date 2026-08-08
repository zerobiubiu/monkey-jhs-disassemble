/**
 * 服务端变更管线 —— 恢复未完成同步 + 权威状态提交。
 *
 * 提取自 vlt-server.ts：
 * - recoverPendingServerSyncs：页面加载时恢复未完成的变更
 * - commitAuthoritativeState：将权威状态写入本地 IDB
 */
import { VltDb } from '../vlt-db';
import { handleCheckboxChange } from '../vlt-checkbox';
import {
    reconcileListWithJavdb
} from '../vlt-reconcile';
import { enqueueAssociationTask } from '../vlt-lock-queue';
import {
    LOG_PREFIX,
    setListCheckboxState,
    setListDisplayedCount
} from '../vlt-helpers';
import type { ListInfo } from '../vlt-helpers';
import {
    fetchAuthoritativeCheckboxState,
    postJavdbListMutation,
    readPendingJournals,
    removePendingJournal
} from './vlt-server-api';
import type { AuthoritativeCheckboxState, PendingServerSync } from './vlt-server-api';

export async function commitAuthoritativeState(
    entry: PendingServerSync,
    authoritative: AuthoritativeCheckboxState,
    notify: boolean
): Promise<boolean> {
    // doc/234：权威状态与用户期望相反 → 服务器大概率未写入该变更（网络抖动等），
    // 按「脚本记录优先」重试推送用户期望状态；重推确认后才以期望状态提交本地。
    if (authoritative.checked !== entry.desiredChecked) {
        const retry = await postJavdbListMutation(
            entry.videoId,
            entry.listInfo.list_id,
            entry.desiredChecked
        );
        if (retry.kind !== 'confirmed') {
            console.warn(
                `${LOG_PREFIX} 权威状态与期望相反且重推未确认，保留恢复日志：` +
                    `${entry.movieInfo.designation} ${entry.listInfo.list_id}`
            );
            return false;
        }
        const recheck = await fetchAuthoritativeCheckboxState(entry.videoId, entry.listInfo.list_id);
        if (!recheck || recheck.checked !== entry.desiredChecked) {
            console.warn(
                `${LOG_PREFIX} 重推后仍无法确认期望状态，保留恢复日志：` +
                    `${entry.movieInfo.designation} ${entry.listInfo.list_id}`
            );
            return false;
        }
        authoritative = recheck;
    }

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

export async function recoverPendingServerSyncs(): Promise<void> {
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
