/**
 * 编号清单整理面板挂载与交互（doc/202，期1 只读）。
 *
 * 在 /lists/{id} 清单页注入 ReflowPanel 外壳，按需：
 * - 「识别编号组」→ 抓 /users/lists 发现同 base 编号组，渲染各清单数量/满员行。
 * - 「生成整理计划」→ 枚举组内影片 + 规划，渲染只读压实预览（lr-plan）。
 * 全部只读，不写任何数据。
 */
import { jsxToString } from '../../core/jsx-to-string';

import { LIST_FULL_THRESHOLD } from '../detail-page-button/dpb-list-merge';
import type { ListMergeConfig } from '../detail-page-button/dpb-list-merge';
import { discoverGroup, fetchAllUserLists, getCurrentListId } from './lr-data';
import { runPlanPreview } from './lr-plan';
import type { ReflowGroup } from './lr-types';

import { ReflowPanel } from '../../components/list-reflow/reflow-panel';

/** 将 JSX 渲染的 HTML 字符串转为单个元素。 */
function toElement(html: string): HTMLElement {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstElementChild as HTMLElement;
}

/** 渲染编号组成员行（序号/名称/数量/裸名/已满标记）。 */
function renderMemberRows(listsElement: HTMLElement, group: ReflowGroup): void {
    listsElement.replaceChildren();
    for (const member of group.members) {
        const row = document.createElement('div');
        row.className = 'jhs-reflow-list';
        row.dataset.listId = member.listId;

        const num = document.createElement('span');
        num.className = 'jhs-reflow-list__num';
        num.textContent = member.num === 0 ? '★' : String(member.num);
        num.title = member.num === 0 ? '裸名清单（压实最优先）' : `序号 ${member.num}`;

        const name = document.createElement('span');
        name.className = 'jhs-reflow-list__name';
        name.textContent = member.name;
        name.title = member.name;

        const count = document.createElement('span');
        count.className = 'jhs-reflow-list__count';
        count.textContent = member.count === null ? '—' : String(member.count);

        row.append(num, name, count);
        if (member.num === 0) {
            const flag = document.createElement('span');
            flag.className = 'jhs-reflow-list__flag is-bare';
            flag.textContent = '裸名';
            row.append(flag);
        }
        if (member.count !== null && member.count >= LIST_FULL_THRESHOLD) {
            const flag = document.createElement('span');
            flag.className = 'jhs-reflow-list__flag is-full';
            flag.textContent = '已满';
            row.append(flag);
        }
        listsElement.append(row);
    }
}

/**
 * 在当前清单页挂载整理面板并绑定交互。幂等（已存在则跳过）。
 * @param config 合并配置（复用 listMergePattern / listMergeExcludeNames 分组规则）
 */
export function initReflowPanel(config: ListMergeConfig): void {
    const currentListId = getCurrentListId();
    if (!currentListId) return;
    if (document.querySelector('.jhs-reflow-panel')) return;

    const panel = toElement(jsxToString(<ReflowPanel />));
    const anchor = document.querySelector('.movie-list');
    if (anchor) {
        anchor.insertAdjacentElement('beforebegin', panel);
    } else {
        (document.querySelector('main') || document.body).prepend(panel);
    }

    const statusElement = panel.querySelector<HTMLElement>('[data-reflow-status]');
    const listsElement = panel.querySelector<HTMLElement>('[data-reflow-lists]');
    const planElement = panel.querySelector<HTMLElement>('[data-reflow-plan]');
    const identifyButton = panel.querySelector<HTMLButtonElement>('[data-reflow-identify]');
    const planButton = panel.querySelector<HTMLButtonElement>('[data-reflow-plan-btn]');
    if (!statusElement || !listsElement || !planElement || !identifyButton || !planButton) return;

    const setStatus = (message: string, stateClass = ''): void => {
        statusElement.textContent = message;
        statusElement.className =
            'jhs-reflow-panel__status' + (stateClass ? ` ${stateClass}` : '');
    };

    let group: ReflowGroup | null = null;

    identifyButton.addEventListener('click', () => {
        identifyButton.disabled = true;
        setStatus('正在识别编号组…');
        void (async () => {
            try {
                const allLists = await fetchAllUserLists();
                group = discoverGroup(currentListId, allLists, config);
                if (!group) {
                    listsElement.hidden = true;
                    planButton.hidden = true;
                    if (planElement) planElement.hidden = true;
                    setStatus('此清单不属于编号组');
                    return;
                }
                renderMemberRows(listsElement, group);
                listsElement.hidden = false;
                planButton.hidden = false;
                setStatus(`编号组「${group.base}」· ${group.members.length} 个清单`, 'is-ok');
            } catch (error) {
                setStatus(
                    '识别失败：' + (error instanceof Error ? error.message : String(error)),
                    'is-error'
                );
            } finally {
                identifyButton.disabled = false;
            }
        })();
    });

    planButton.addEventListener('click', () => {
        if (!group) return;
        planButton.disabled = true;
        void runPlanPreview(panel, group, setStatus)
            .catch((error: unknown) => {
                setStatus(
                    '生成计划失败：' + (error instanceof Error ? error.message : String(error)),
                    'is-error'
                );
            })
            .finally(() => {
                planButton.disabled = false;
            });
    });
}
