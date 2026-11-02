/** 批量清单网站适配：完整读取目录，权威回查成功后才提交本地关联。 */

import type { BatchListApplyContext, BatchListChoice, BatchListItem } from '../../../types/batch-lists';

import { withState } from '../../video-lists-tag/db/vlt-db-core';
import { handleCheckboxChange } from '../../video-lists-tag/vlt-checkbox';
import { getCode, getSeries } from '../../video-lists-tag/vlt-helpers';
import { enqueueAssociationTask, listAssociationKey } from '../../video-lists-tag/vlt-lock-queue';
import { isCurrentListIntent, publishListIntent } from '../../video-lists-tag/server/vlt-intent';
import { buildMergeConfig } from '../../detail-page-button/dpb-list-merge';
import { fetchBatchListDirectory } from './directory';
import { applyBatchListGroup, buildBatchListChoices } from './groups';
import {
    fetchAuthoritativeCheckboxState,
    postJavdbListMutation
} from '../../video-lists-tag/server/vlt-server-api';

/** 展示逻辑组与独立清单；合并规则与详情页共用唯一实现。 */
export async function fetchBatchListChoices(videoId: string): Promise<BatchListChoice[]> {
    const members = await fetchBatchListDirectory(videoId);
    const config = buildMergeConfig(await storageManager.getSetting());
    return buildBatchListChoices(members, config);
}

/** 调用方在进入此函数前已持久化预写记录；异常必须向上传播以保留待恢复项。 */
async function applyPhysicalListItem(
    item: BatchListItem,
    list: BatchListChoice,
    desiredChecked: boolean,
    intentId?: string,
    context?: BatchListApplyContext
): Promise<'superseded' | 'stopped' | void> {
    if (context?.signal?.aborted) return 'stopped';
    if (context) {
        const route = { ...context.route, listIds: context.route?.listIds.includes(list.id) ? context.route.listIds : [list.id] };
        await context.saveRoute(route);
        context.route = route;
    }
    let outcome: 'superseded' | 'stopped' | undefined;
    await enqueueAssociationTask(listAssociationKey(item.videoId, list.id), async () => {
        if (context?.signal?.aborted) { outcome = 'stopped'; return; }
        if (intentId && context) publishListIntent(item.videoId, list.id, intentId, context.createdAt, desiredChecked);
        if (intentId && !isCurrentListIntent(item.videoId, list.id, intentId)) {
            outcome = 'superseded';
            return;
        }
        if (!item.carNum || !item.videoId || !list.id) throw new Error('影片或清单标识缺失');
        let authoritative = await fetchAuthoritativeCheckboxState(item.videoId, list.id);
        if (!authoritative?.name) throw new Error('无法确认目标清单存在，请检查登录状态与清单目录');
        if (authoritative.checked !== desiredChecked) {
            if (context?.signal?.aborted) { outcome = 'stopped'; return; }
            const previousUncertain = context?.route?.uncertain;
            if (context) {
                const route = { ...context.route, listIds: context.route?.listIds || [list.id], uncertain: true };
                await context.saveRoute(route);
                context.route = route;
            }
            if (context?.signal?.aborted) {
                const route = { ...context.route, listIds: context.route?.listIds || [list.id], uncertain: previousUncertain };
                await context.saveRoute(route);
                context.route = route;
                outcome = 'stopped';
                return;
            }
            const response = await postJavdbListMutation(item.videoId, list.id, desiredChecked);
            if (response.kind === 'rejected') {
                if (context) {
                    const route = { ...context.route, listIds: context.route?.listIds || [list.id], uncertain: false };
                    await context.saveRoute(route);
                    context.route = route;
                }
                throw new Error(`网站拒绝清单更新：${response.message}`);
            }
            authoritative = await fetchAuthoritativeCheckboxState(item.videoId, list.id);
            if (!authoritative?.name || authoritative.checked !== desiredChecked) {
                throw new Error(`网站最终状态尚未确认：${response.message}`);
            }
        }

        if (context?.route?.uncertain) {
            const route = { ...context.route, uncertain: false };
            await context.saveRoute(route);
            context.route = route;
        }
        // 列表页不存在详情页 DOM；从已有影片信息补齐，避免空值覆盖既有详情元数据。
        const previous = await withState('readonly', (state) => state.movies[item.carNum]);
        const result = await handleCheckboxChange(
            {
                designation: item.carNum,
                info: {
                    href: previous?.href || item.url,
                    title: previous?.title ?? '',
                    release_date: previous?.releaseDate ?? item.publishTime ?? '',
                    cover_src: previous?.coverSrc ?? '',
                    score: previous?.score ?? 0,
                    series: previous?.series ?? getSeries(item.carNum),
                    code: previous?.code ?? getCode(item.carNum) ?? ''
                }
            },
            { list_id: list.id, info: { name: authoritative.name, url: list.url } },
            desiredChecked,
            { serverConfirmed: true, silent: true, skipAutomation: true }
        );
        if (!result || result.association === 'limit_exceeded') {
            throw new Error('网站状态已确认，但脚本清单关联尚未写入，将继续恢复');
        }
    });
    return outcome;
}

/** 聚合选择只在已有完整预写上下文时执行，具体成员路由由持久映射约束。 */
export async function applyBatchListItem(
    item: BatchListItem, list: BatchListChoice, desiredChecked: boolean,
    intentId?: string, context?: BatchListApplyContext
): Promise<'superseded' | 'stopped' | void> {
    if (context?.signal?.aborted) return 'stopped';
    if (list.group) {
        if (!intentId || !context) throw new Error('缺少可恢复的逻辑清单预写记录，已停止网站操作');
        return applyBatchListGroup(item, list, desiredChecked, intentId, context, applyPhysicalListItem);
    }
    return applyPhysicalListItem(item, list, desiredChecked, intentId, context);
}
