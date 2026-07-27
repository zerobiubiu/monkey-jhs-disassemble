/**
 * 编号清单整理计划预览（doc/202，期1 只读）。
 *
 * 驱动组内各清单影片枚举（带进度），调用纯规划器 planCompaction，
 * 将目标分布 / 搬运明细 / 重复审计 / 溢出渲染为只读预览。不写任何数据。
 */
import { enumerateListVideos } from './lr-data';
import { planCompaction } from './lr-planner';

import type { CompactionPlan, PlannerListInput, ReflowGroup } from './lr-types';

/** 搬运明细预览条数上限（超出折叠为「…及其他 N 条」）。 */
const MOVE_PREVIEW_CAP = 100;

/** 重复/溢出影片预览条数上限。 */
const ID_PREVIEW_CAP = 50;

/** 创建带类名的 div。 */
function div(className: string, text?: string): HTMLDivElement {
    const element = document.createElement('div');
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

/** 截取 ID 列表预览（超限追加省略）。 */
function previewIds(ids: string[], cap: number): string {
    const head = ids.slice(0, cap).join('、');
    return ids.length > cap ? `${head}…` : head;
}

/**
 * 渲染压实计划预览到 [data-reflow-plan] 容器。
 * @param planElement 计划容器
 * @param plan 规划结果
 */
export function renderPlan(planElement: HTMLElement, plan: CompactionPlan): void {
    planElement.replaceChildren();

    planElement.appendChild(
        div(
            'jhs-reflow-plan__summary',
            `组内共 ${plan.totalUnique} 部（去重后）· 重复 ${plan.duplicateCount} 部 · ` +
                `需搬运 ${plan.moves.length} 部（加入 ${plan.addCount} 次 / 移除 ${plan.removeCount} 次）`
        )
    );

    planElement.appendChild(
        div(
            'jhs-reflow-plan__targets',
            '目标分布：' +
                plan.targets.map((t) => `${t.name} ${t.current}→${t.target}`).join(' ｜ ')
        )
    );

    if (plan.overflow.length > 0) {
        planElement.appendChild(
            div(
                'jhs-reflow-plan__overflow',
                `⚠ 组总容量不足，${plan.overflow.length} 部无法安置（期2 可自动新建清单消化）：` +
                    previewIds(plan.overflow, ID_PREVIEW_CAP)
            )
        );
    }

    if (plan.duplicates.length > 0) {
        planElement.appendChild(
            div(
                'jhs-reflow-plan__dups',
                `⚠ 收藏错误审计——${plan.duplicateCount} 部在组内多个清单重复：` +
                    previewIds(plan.duplicates, ID_PREVIEW_CAP)
            )
        );
    }

    const nameOf = new Map(plan.targets.map((t) => [t.listId, t.name]));
    const movesList = document.createElement('ul');
    movesList.className = 'jhs-reflow-plan__moves';
    for (const move of plan.moves.slice(0, MOVE_PREVIEW_CAP)) {
        const li = document.createElement('li');
        li.className = 'jhs-reflow-plan__move';
        const parts: string[] = [];
        if (move.removeFrom.length > 0) {
            parts.push(`移出 ${move.removeFrom.map((id) => nameOf.get(id) ?? id).join('、')}`);
        }
        if (move.addTo !== null) {
            parts.push(`移入 ${nameOf.get(move.addTo) ?? move.addTo}`);
        }
        li.textContent = `${move.videoId}：${parts.join('，')}`;
        movesList.appendChild(li);
    }
    if (plan.moves.length > MOVE_PREVIEW_CAP) {
        const more = document.createElement('li');
        more.className = 'jhs-reflow-plan__more';
        more.textContent = `…及其他 ${plan.moves.length - MOVE_PREVIEW_CAP} 条`;
        movesList.appendChild(more);
    }
    planElement.appendChild(movesList);

    planElement.appendChild(
        div('jhs-reflow-plan__note', '期1 仅预览，不执行任何写入；搬运顺序优化与执行为期2 内容。')
    );
}

/**
 * 枚举组内全部清单影片并生成计划预览。
 * @param panel 面板根元素
 * @param group 编号组
 * @param setStatus 进度/状态回调
 */
export async function runPlanPreview(
    panel: HTMLElement,
    group: ReflowGroup,
    setStatus: (message: string, stateClass?: string) => void
): Promise<void> {
    const planElement = panel.querySelector<HTMLElement>('[data-reflow-plan]');
    if (!planElement) return;
    planElement.hidden = false;
    planElement.replaceChildren(div('jhs-reflow-plan__summary', '正在枚举组内影片…'));

    const inputs: PlannerListInput[] = [];
    for (let i = 0; i < group.members.length; i++) {
        const member = group.members[i];
        setStatus(`正在枚举 ${member.name}（${i + 1}/${group.members.length}）…`);
        const videoIds = await enumerateListVideos(member.listId);
        inputs.push({
            listId: member.listId,
            num: member.num,
            name: member.name,
            videoIds
        });
    }

    const plan = planCompaction(group.base, inputs);
    renderPlan(planElement, plan);
    setStatus(`计划已生成：需搬运 ${plan.moves.length} 部`, 'is-ok');
}
