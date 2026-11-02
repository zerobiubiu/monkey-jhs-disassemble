/** 复用详情页合并规则规划逻辑组，并在持久路由与组锁保护下分配具体清单。 */
import { withExclusiveLock } from '../../../core/sync';

import type { BatchListApplyContext, BatchListChoice, BatchListItem, BatchListRoute } from '../../../types/batch-lists';

import { buildMergeConfig, groupEntries, isMemberFull, nextListName, pickTargetMember } from '../../detail-page-button/dpb-list-merge';
import type { ListGroup, ListMember, ListMergeConfig } from '../../detail-page-button/dpb-list-merge';
import { createListForVideo } from '../../video-lists-tag/server/vlt-create-request';
import { isCurrentListIntent, readCurrentListIntent } from '../../video-lists-tag/server/vlt-intent';
import { normalizeListName } from '../../video-lists-tag/vlt-helpers';
import { fetchBatchListDirectory } from './directory';

export function physicalListChoice(member: Pick<ListMember, 'listId' | 'name'>): BatchListChoice {
    return { id: member.listId, name: member.name, url: new URL(`/lists/${encodeURIComponent(member.listId)}`, window.location.origin).href };
}

export function buildBatchListChoices(members: ListMember[], config: ListMergeConfig): BatchListChoice[] {
    const grouped = groupEntries(members, config);
    return [
        ...grouped.groups.map((group) => ({
            id: `group:${encodeURIComponent(group.base)}`, name: group.base,
            url: physicalListChoice(group.members[0]).url,
            group: { base: group.base, pattern: config.pattern.source, excludeNames: [...config.excludeNames] },
            members: group.members.map((member) => ({ id: member.listId, name: member.name, num: member.num }))
        })),
        ...grouped.singleIndexes.map((index) => physicalListChoice(members[index]))
    ];
}

function currentGroup(choice: BatchListChoice, directory: ListMember[]): ListGroup {
    if (!choice.group) throw new Error('逻辑清单规则缺失');
    const config = buildMergeConfig({ listMergePattern: choice.group.pattern, listMergeExcludeNames: choice.group.excludeNames });
    const group = groupEntries(directory, config).groups.find((entry) => entry.base === choice.group?.base);
    if (!group) throw new Error('逻辑清单成员已变化，暂时无法确认目标组');
    return group;
}

/** 已知创建成员统一执行容量判据，旧恢复与本轮创建后的新鲜目录使用同一路径。 */
async function resolveCreatedMember(
    item: BatchListItem, choice: BatchListChoice, group: ListGroup,
    context: BatchListApplyContext, target: ListMember
): Promise<ListMember | 'stopped'> {
    await context.saveRoute({ listIds: [target.listId], uncertain: context.route?.uncertain });
    if (context.signal?.aborted) return 'stopped';
    if (target.checked) return target;
    if (target.count === null) throw new Error('已创建清单容量未知，暂不重新分配');
    if (!isMemberFull(target)) return target;
    if (context.route?.uncertain) throw new Error('原加入请求结果待确认，不能改投其他成员');
    if (group.members.some((member) => member.count === null && !member.checked)) throw new Error('无法确认全部清单容量，暂不分配或创建');
    const available = pickTargetMember(group.members);
    if (available) return available;
    await context.saveRoute({ listIds: [], createName: nextListName(group), createAttempted: false });
    return createOverflow(item, choice, group, context);
}

/** 创建前保存名字和已尝试标记；unknown 及目录不可读时绝不重新发创建请求。 */
async function createOverflow(
    item: BatchListItem, choice: BatchListChoice, group: ListGroup, context: BatchListApplyContext
): Promise<ListMember | 'stopped'> {
    if (context.signal?.aborted) return 'stopped';
    const createName = context.route?.createName || nextListName(group);
    const existing = group.members.filter((member) => normalizeListName(member.name) === normalizeListName(createName));
    if (existing.length > 1) throw new Error('下一编号存在重名清单，已停止自动创建');
    if (existing.length === 1) return resolveCreatedMember(item, choice, group, context, existing[0]);
    if (!context.route?.createAttempted) {
        const config = buildMergeConfig({ listMergePattern: choice.group?.pattern, listMergeExcludeNames: choice.group?.excludeNames });
        const projected = groupEntries([{ name: createName, listId: '__new__', count: 0, checked: false, disabled: false }], config);
        if (!projected.groups.some((entry) => entry.base === group.base)) throw new Error('当前合并规则不能生成下一编号清单，请检查合并设置');
        await context.saveRoute({ listIds: [], createName, createAttempted: true });
        const result = context.signal?.aborted ? 'stopped' : context.signal
            ? await createListForVideo(createName, item.videoId, context.signal)
            : await createListForVideo(createName, item.videoId);
        if (result === 'failed' || result === 'stopped') {
            await context.saveRoute({ listIds: [], createName, createAttempted: false });
            if (result === 'stopped') return 'stopped';
            throw new Error('自动新建下一编号清单失败，将保留同名预写后重试');
        }
    }
    let directory: ListMember[];
    try {
        // 创建 POST 已发出时即使请求停止，也要完成当前回查，留下可恢复的具体路由。
        directory = await fetchBatchListDirectory(item.videoId);
    } catch (error) {
        if (context.signal?.aborted) return 'stopped';
        throw error;
    }
    const matches = directory.filter((member) => normalizeListName(member.name) === normalizeListName(createName));
    if (matches.length !== 1) {
        if (context.signal?.aborted) return 'stopped';
        throw new Error('新清单创建结果待确认，已保留名称，不会重复创建');
    }
    const fresh = currentGroup(choice, directory);
    const target = fresh.members.find((member) => member.listId === matches[0].listId);
    if (!target) throw new Error('新清单不属于当前逻辑组，已停止路由');
    return resolveCreatedMember(item, choice, fresh, context, target);
}

/** 实体执行由网站适配注入，避免组规划与实体适配相互导入。 */
export async function applyBatchListGroup(
    item: BatchListItem, choice: BatchListChoice, desired: boolean, intentId: string,
    originalContext: BatchListApplyContext,
    applyPhysical: (item: BatchListItem, choice: BatchListChoice, desired: boolean, intentId: string,
        context: BatchListApplyContext) => Promise<'superseded' | 'stopped' | void>
): Promise<'superseded' | 'stopped' | void> {
    return withExclusiveLock(`jhs:batch-list-group:${window.location.origin}:${choice.id}`, async () => {
        if (originalContext.signal?.aborted) return 'stopped';
        if (!isCurrentListIntent(item.videoId, choice.id, intentId)) return 'superseded';
        const context: BatchListApplyContext = {
            createdAt: originalContext.createdAt,
            signal: originalContext.signal,
            route: originalContext.route ? { ...originalContext.route, listIds: [...originalContext.route.listIds] } : undefined,
            saveRoute: async (route: BatchListRoute) => {
                await originalContext.saveRoute(route);
                context.route = { ...route, listIds: [...route.listIds] };
            }
        };
        const directory = await fetchBatchListDirectory(item.videoId);
        if (context.signal?.aborted) return 'stopped';
        const group = currentGroup(choice, directory);
        // 新明确操作即使发生在尚未选定的实体，也不能被旧逻辑组任务改投其他成员绕过。
        if (group.members.some((member) => {
            const latest = readCurrentListIntent(item.videoId, member.listId);
            return latest && latest.intentId !== intentId && latest.createdAt >= context.createdAt;
        })) return 'superseded';
        let targets: ListMember[];
        if (!desired) {
            const missing = context.route?.listIds.some((id) => !group.members.some((member) => member.listId === id));
            if (missing) throw new Error('尚未确认先前移出路由的全部成员，不能将未知状态计为成功');
            targets = group.members; // 已取消的成员也只补本地；实体适配不会重复 POST。
        } else {
            const containing = group.members.filter((member) => member.checked);
            if (containing.length) {
                if (context.route?.uncertain && context.route.listIds.some((id) => !containing.some((member) => member.listId === id))) {
                    throw new Error('旧加入路由结果待确认，已在组内其他成员中，暂不重复加入');
                }
                targets = containing;
            } else if (context.route?.uncertain && context.route.listIds.length) {
                const target = group.members.find((member) => member.listId === context.route?.listIds[0]);
                if (!target) throw new Error('原加入路由尚未确认，不能改投其他成员');
                targets = [target];
            } else if (context.route?.createName) {
                const target = await createOverflow(item, choice, group, context);
                if (target === 'stopped') return target;
                targets = [target];
            } else {
                if (group.members.some((member) => member.count === null && !member.checked)) throw new Error('无法确认全部清单容量，暂不分配或创建');
                const target = pickTargetMember(group.members);
                if (target) targets = [target];
                else {
                    const created = await createOverflow(item, choice, group, context);
                    if (created === 'stopped') return created;
                    targets = [created];
                }
            }
        }
        // 一旦唯一实体映射已确认，后续只按实体恢复，不再把创建意图当作可重复创建的入口。
        await context.saveRoute({ listIds: targets.map((member) => member.listId), uncertain: context.route?.uncertain });
        for (const target of targets) {
            if (context.signal?.aborted) return 'stopped';
            if (!isCurrentListIntent(item.videoId, choice.id, intentId)) return 'superseded';
            const result = await applyPhysical(item, physicalListChoice(target), desired, intentId, context);
            if (result === 'superseded' || result === 'stopped') return result;
        }
        return undefined;
    });
}
