/**
 * 详情页清单面板「序号清单合并」DOM 构建与交互路由模块。
 *
 * 职责（含 DOM 副作用，依赖插件实例与原生 #modal-save-list 容器）：
 * - 从已构建展示条目读取元数据，按配置归组并生成合并行 / 单条行
 * - 合并行勾选路由：按序号升序加入未满清单，全满时复用 VLT createList 自动新建
 * - 合并行取消勾选：从组内所有含片清单批量移除（串行，避免 JavDB ajax 竞态）
 * - 「整理」：将当前影片收敛到组内最靠前的清单（详情页仅见当前影片归属，
 *   跨影片回填需清单页数据，属未来功能）
 * - 原生 checkbox 状态变化时同步刷新对应合并行
 *
 * 路由不依赖成员行是否渲染在面板——始终基于常驻隐藏的原生
 * `#modal-save-list [data-list-target="listContainer"]` 按 listId 定位。
 */
import { sleep } from '../../core/util/util-misc';

import type { DetailPageButtonPlugin } from '../detail-page-button-plugin';
import { createList } from '../video-lists-tag/vlt-create-list-api';
import { VltDb } from '../video-lists-tag/vlt-db';
import { enqueueServerCheckboxMutation } from '../video-lists-tag/vlt-server';
import { getListInfo, getMovieInfo } from '../video-lists-tag/vlt-helpers';
import type { ListInfo, MovieInfo } from '../video-lists-tag/vlt-helpers';

import type { DetailListEntry, DetailListPanelElement } from './dpb-list-panel';
import {
    buildMergeConfig,
    computeGroupCheckState,
    findLocallyContained,
    groupEntries,
    isMemberFull,
    nextListName,
    pickTargetMember,
    sortMembersByNum
} from './dpb-list-merge';
import type { ListGroup, ListMember, ListMergeConfig } from './dpb-list-merge';

/** 原生清单容器选择器（JavDB 隐藏 modal 内的权威 checkbox 容器）。 */
const NATIVE_LIST_CONTAINER = '#modal-save-list [data-list-target="listContainer"]';

/** 批量移除/整理时，相邻两次原生 change 之间的间隔（ms），让 JavDB 串行处理。 */
const SERIAL_CHANGE_GAP_MS = 220;

/** 合并行 dataset.listMembers 存储的成员引用（仅含路由/展示所需的稳定字段）。 */
interface GroupMemberRef {
    id: string;
    num: number;
    name: string;
}

/**
 * 读取运行时合并配置（从 storageManager 设置对象解析）。
 * @returns 合并配置
 */
export async function loadListMergeConfig(): Promise<ListMergeConfig> {
    const settings = await storageManager.getSetting();
    return buildMergeConfig(settings);
}

/** 转义 listId 用于属性选择器，避免特殊字符破坏查询。 */
function cssEscape(value: string): string {
    return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(value) : value.replace(/"/g, '\\"');
}

/** 定位原生权威 checkbox。 */
function findNativeInput(listId: string): HTMLInputElement | null {
    const container = document.querySelector(NATIVE_LIST_CONTAINER);
    if (!container) return null;
    return container.querySelector<HTMLInputElement>(
        `input[type="checkbox"][data-list-id="${cssEscape(listId)}"]`
    );
}

/** 从原生 checkbox 的 label span 读取清单影片总数。 */
function readNativeCount(input: HTMLInputElement): number | null {
    const label = input.closest('label');
    const span = label?.querySelector('span');
    const matched = span?.textContent?.match(/\d+/);
    return matched ? Number(matched[0]) : null;
}

/**
 * 从已构建的展示条目读取归组所需元数据。
 * @param element createListPanelEntry 产出的 .jhs-list-item 元素
 * @returns 元数据；缺少 listId 时返回 null
 */
function readItemMeta(element: HTMLElement): {
    name: string;
    listId: string;
    count: number | null;
    checked: boolean;
    disabled: boolean;
} | null {
    const input = element.querySelector<HTMLInputElement>('input[type="checkbox"]');
    const listId = element.dataset.listId || input?.dataset.listId || '';
    if (!listId) return null;
    const countText = element.querySelector('.jhs-list-item__count')?.textContent || '';
    const matched = countText.match(/\d+/);
    return {
        name: element.dataset.listName || '',
        listId,
        count: matched ? Number(matched[0]) : null,
        checked: Boolean(input?.checked),
        disabled: Boolean(input?.disabled)
    };
}

/** 解析合并行 dataset.listMembers 中的成员引用。 */
function parseMemberRefs(groupElement: HTMLElement): GroupMemberRef[] {
    try {
        const parsed = JSON.parse(groupElement.dataset.listMembers || '[]');
        return Array.isArray(parsed) ? (parsed as GroupMemberRef[]) : [];
    } catch {
        return [];
    }
}

/**
 * 依据原生容器实时状态构建组成员列表（用于路由与展示刷新）。
 * 原生 checkbox 查不到的成员（容器重建中/未载入分页）不静默丢弃，单列返回，
 * 供展示端区分「未含片」与「状态未知」（doc/13 修复）。
 */
function liveMembers(groupElement: HTMLElement): {
    members: ListMember[];
    unresolved: GroupMemberRef[];
} {
    const members: ListMember[] = [];
    const unresolved: GroupMemberRef[] = [];
    for (const ref of parseMemberRefs(groupElement)) {
        const input = findNativeInput(ref.id);
        if (!input) {
            unresolved.push(ref);
            continue;
        }
        members.push({
            listId: ref.id,
            name: ref.name,
            num: ref.num,
            count: readNativeCount(input),
            checked: input.checked,
            disabled: input.disabled
        });
    }
    return { members, unresolved };
}

/**
 * 设置原生权威 checkbox 并派发 change，交由 JavDB 原生逻辑完成服务端读写。
 * @param listId 目标清单 ID
 * @param checked 目标勾选态
 * @returns 是否成功派发（加入时若目标被禁用则返回 false）
 */
function setNativeCheckbox(listId: string, checked: boolean): boolean {
    const input = findNativeInput(listId);
    if (!input) return false;
    if (checked && input.disabled) return false;
    input.checked = checked;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
}

/** 渲染合并行明细列表（各成员序号/名称/数量/已含/已满标记）。 */
function renderMemberDetail(groupElement: HTMLElement, members: ListMember[]): void {
    const detail = groupElement.querySelector('.jhs-list-group__detail');
    if (!detail) return;
    detail.replaceChildren();
    for (const member of sortMembersByNum(members)) {
        const li = document.createElement('li');
        li.className = 'jhs-list-group__member';
        li.dataset.listId = member.listId;

        const num = document.createElement('span');
        num.className = 'jhs-list-group__member-num';
        num.textContent = member.num === 0 ? '★' : String(member.num);
        num.title = member.num === 0 ? '裸名清单（最优先）' : `序号 ${member.num}`;

        const name = document.createElement('span');
        name.className = 'jhs-list-group__member-name';
        name.textContent = member.name;
        name.title = member.name;

        const count = document.createElement('span');
        count.className = 'jhs-list-group__member-count';
        count.textContent = member.count === null ? '—' : String(member.count);

        li.append(num, name, count);
        if (member.checked) {
            const flag = document.createElement('span');
            flag.className = 'jhs-list-group__member-flag is-checked';
            flag.textContent = '已含';
            li.append(flag);
        }
        if (isMemberFull(member)) {
            const flag = document.createElement('span');
            flag.className = 'jhs-list-group__member-flag is-full';
            flag.textContent = '已满';
            li.append(flag);
        }
        detail.append(li);
    }
}

/**
 * 依据原生实时状态刷新合并行展示（勾选/半选/汇总数量/状态/明细）。
 * 构建时与状态同步时共用，天然保持一致。
 * @param groupElement 合并行根元素 .jhs-list-group
 */
export function refreshMergedRowDisplay(groupElement: HTMLElement): void {
    const { members, unresolved } = liveMembers(groupElement);
    const checkbox = groupElement.querySelector<HTMLInputElement>(
        '.jhs-list-item__label input[type="checkbox"]'
    );
    const countElement = groupElement.querySelector<HTMLElement>('.jhs-list-item__count');
    const statusElement = groupElement.querySelector<HTMLElement>('.jhs-list-item__status');
    const toggle = groupElement.querySelector<HTMLButtonElement>('.jhs-list-group__toggle');
    const detail = groupElement.querySelector<HTMLElement>('.jhs-list-group__detail');
    if (!checkbox || !countElement || !statusElement) return;

    const base = groupElement.dataset.listGroup || '';
    const state = computeGroupCheckState({ base, members } as ListGroup);
    checkbox.checked = state.checked;
    // 状态未知的成员不得被展示端当作「未含片」：保持半选，避免出现“已取消”的错觉
    checkbox.indeterminate = state.indeterminate || unresolved.length > 0;

    const allKnown = members.length > 0 && members.every((m) => m.count !== null);
    const total = members.reduce((sum, m) => sum + (m.count ?? 0), 0);
    countElement.textContent = allKnown ? String(total) : '—';
    countElement.title = allKnown ? `组内共 ${total} 部影片` : '部分清单数量未知';

    const allFull = members.length > 0 && members.every((m) => isMemberFull(m));
    if (allFull && !state.checked) {
        statusElement.hidden = false;
        statusElement.dataset.state = 'full';
        statusElement.textContent = '全满';
    } else {
        statusElement.hidden = true;
        delete statusElement.dataset.state;
        statusElement.textContent = '';
    }

    if (toggle) {
        const expanded = Boolean(detail && !detail.hidden);
        toggle.textContent = `${expanded ? '▾' : '▸'} ${members.length + unresolved.length} 个清单`;
    }
    renderMemberDetail(groupElement, members);
}

/**
 * 构建合并行 DOM（复用 .jhs-list-item 结构与状态样式）。
 * @param group 合并组
 * @returns 合并行根元素
 */
export function buildMergedRow(group: ListGroup): HTMLElement {
    const element = document.createElement('div');
    element.className = 'jhs-list-item jhs-list-group';
    element.dataset.listName = group.base;
    element.dataset.listGroup = group.base;
    const refs: GroupMemberRef[] = sortMembersByNum(group.members).map((m) => ({
        id: m.listId,
        num: m.num,
        name: m.name
    }));
    element.dataset.listMembers = JSON.stringify(refs);

    const label = document.createElement('label');
    label.className = 'jhs-list-item__label';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.dataset.listGroup = group.base;

    const name = document.createElement('span');
    name.className = 'jhs-list-item__name';
    name.textContent = group.base;
    name.title = group.base;

    const count = document.createElement('span');
    count.className = 'jhs-list-item__count';

    const status = document.createElement('span');
    status.className = 'jhs-list-item__status';
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
    status.hidden = true;

    label.append(input, name, count, status);

    const bar = document.createElement('div');
    bar.className = 'jhs-list-group__bar';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'jhs-list-group__toggle';
    toggle.setAttribute('aria-expanded', 'false');

    const reflow = document.createElement('button');
    reflow.type = 'button';
    reflow.className = 'jhs-list-group__reflow';
    reflow.textContent = '整理';
    reflow.title = '将当前影片收敛到组内最靠前的清单';

    bar.append(toggle, reflow);

    const detail = document.createElement('ul');
    detail.className = 'jhs-list-group__detail';
    detail.hidden = true;

    element.append(label, bar, detail);
    refreshMergedRowDisplay(element);
    return element;
}

/**
 * 依据配置将展示条目归组，产出最终行序列（合并行 + 单条行）。
 * @param plugin 插件实例（读取运行时合并配置）
 * @param entries createListPanelEntry 产出的全部条目
 * @returns 待注入 .jhs-list-panel__items 的行元素数组
 */
export function buildListPanelRows(
    plugin: DetailPageButtonPlugin,
    entries: DetailListEntry[]
): HTMLElement[] {
    const config = plugin._listMergeConfig;
    const groupItems = entries.map(
        (entry) =>
            readItemMeta(entry.element) ?? {
                name: '',
                listId: '',
                count: null,
                checked: false,
                disabled: false
            }
    );
    const { groups, singleIndexes } = groupEntries(groupItems, config);
    const rows: HTMLElement[] = groups.map((group) => buildMergedRow(group));
    for (const index of singleIndexes) rows.push(entries[index].element);
    return rows;
}

/** 将合并行置为忙碌态（禁用 checkbox + 状态区提示）。 */
function setGroupBusy(groupElement: HTMLElement, busy: boolean): void {
    const checkbox = groupElement.querySelector<HTMLInputElement>(
        '.jhs-list-item__label input[type="checkbox"]'
    );
    const status = groupElement.querySelector<HTMLElement>('.jhs-list-item__status');
    if (checkbox) checkbox.disabled = busy;
    if (busy && status) {
        status.hidden = false;
        status.dataset.state = 'busy';
        status.textContent = '处理中';
    }
}

/** 读取当前详情页影片信息（供原生 checkbox 不可用时的服务端兜底使用）。 */
function getCurrentMovieInfo(): MovieInfo | null {
    const videoId = window.location.pathname.match(/\/v\/([^/?#]+)/)?.[1];
    if (!videoId) return null;
    return getMovieInfo(videoId);
}

/** 查询当前影片在本地的清单关联；非详情页或查询失败时返回 null。 */
async function queryLocalMemberships(): Promise<Array<{ name: string; url: string | null }> | null> {
    const movieInfo = getCurrentMovieInfo();
    if (!movieInfo) return null;
    try {
        const map = await VltDb.queryMoviesLists([movieInfo.designation]);
        return map[movieInfo.designation] || [];
    } catch (error) {
        clog.warn('[JHS] 本地清单关联查询失败，按原生状态继续', error);
        return null;
    }
}

/**
 * 取消单个成员在当前影片上的勾选：原生 checkbox → 重试一次 → VLT 服务端管线直连兜底。
 * 兜底路径绕过原生 DOM（容器重建/成员未载入分页时原生查找会失败），
 * 由服务端管线完成「先服务端、后本地镜像」的移除（doc/13 修法 1）。
 * @returns 是否已实际送达（原生已派发或服务端管线成功执行）
 */
async function cancelMemberAssociation(listId: string, name: string): Promise<boolean> {
    if (setNativeCheckbox(listId, false)) return true;
    await sleep(SERIAL_CHANGE_GAP_MS);
    if (setNativeCheckbox(listId, false)) return true;
    const movieInfo = getCurrentMovieInfo();
    if (!movieInfo) {
        clog.warn('[JHS] 清单移除兜底失败：无法读取当前影片信息', listId);
        return false;
    }
    const listInfo: ListInfo = getListInfo(listId);
    if (!listInfo.info.name) listInfo.info.name = name;
    try {
        await enqueueServerCheckboxMutation(movieInfo, listInfo, false, null, true);
        return true;
    } catch (error) {
        clog.error('[JHS] 清单移除兜底失败', listId, error);
        return false;
    }
}

/** 加入路由：已在组内则提示；否则入最靠前未满清单；全满则自动新建。 */
async function addToGroup(
    plugin: DetailPageButtonPlugin,
    panel: DetailListPanelElement,
    groupElement: HTMLElement
): Promise<void> {
    const base = groupElement.dataset.listGroup || '';
    const { members } = liveMembers(groupElement);
    const state = computeGroupCheckState({ base, members } as ListGroup);
    if (state.containing.length > 0) {
        refreshMergedRowDisplay(groupElement);
        plugin._showListPanelNotice(panel, '该影片已在此清单组中');
        return;
    }
    // 原生勾选态可能滞后（本地已写、站点刷新未回）：与本地关联交叉校验，
    // 避免把已在组内清单的影片再塞进同组第二个清单（doc/13 修法 3）
    const localContained = findLocallyContained(members, (await queryLocalMemberships()) || []);
    if (localContained.length > 0) {
        refreshMergedRowDisplay(groupElement);
        plugin._showListPanelNotice(
            panel,
            `该影片已在「${localContained[0].name}」（本地记录），请稍后重试或刷新页面`
        );
        plugin._scheduleListPanelSync(0);
        return;
    }
    const target = pickTargetMember(members);
    if (target) {
        const ok = setNativeCheckbox(target.listId, true);
        if (!ok) {
            plugin._showListPanelNotice(panel, `无法加入「${target.name}」，请稍后重试`);
        }
        refreshMergedRowDisplay(groupElement);
        return;
    }
    // 全满 → 自动新建下一序号清单（createList 会自动关联当前影片）
    groupElement.dataset.jhsBusy = '1';
    setGroupBusy(groupElement, true);
    const newName = nextListName({ base, members });
    let result: string;
    try {
        result = await createList(newName);
    } catch {
        result = 'failed';
    }
    delete groupElement.dataset.jhsBusy;
    setGroupBusy(groupElement, false);
    if (result === 'created') {
        plugin._scheduleListPanelSync(0);
    } else {
        refreshMergedRowDisplay(groupElement);
        plugin._showListPanelNotice(
            panel,
            result === 'unknown'
                ? `清单「${newName}」状态未知，请刷新确认`
                : '自动新建清单失败，请手动处理'
        );
    }
}

/** 移除路由：从组内所有含片清单串行移除；原生不可见的成员按本地关联兜底（doc/13）。 */
async function removeFromGroup(
    plugin: DetailPageButtonPlugin,
    panel: DetailListPanelElement,
    groupElement: HTMLElement
): Promise<void> {
    const { members, unresolved } = liveMembers(groupElement);
    const containing = sortMembersByNum(members.filter((m) => m.checked));
    // 原生不可见的成员（未载入分页/容器重建）若本地关联记录显示含片，同样纳入取消范围
    const unresolvedContained =
        unresolved.length > 0
            ? findLocallyContained(
                  unresolved.map((ref) => ({ listId: ref.id, name: ref.name })),
                  (await queryLocalMemberships()) || []
              )
            : [];
    if (containing.length === 0 && unresolvedContained.length === 0) {
        refreshMergedRowDisplay(groupElement);
        return;
    }
    groupElement.dataset.jhsBusy = '1';
    setGroupBusy(groupElement, true);
    const failed: string[] = [];
    for (const member of containing) {
        const ok = await cancelMemberAssociation(member.listId, member.name);
        if (!ok) failed.push(member.name);
        await sleep(SERIAL_CHANGE_GAP_MS);
    }
    for (const ref of unresolvedContained) {
        const ok = await cancelMemberAssociation(ref.listId, ref.name);
        if (!ok) failed.push(ref.name);
        await sleep(SERIAL_CHANGE_GAP_MS);
    }
    delete groupElement.dataset.jhsBusy;
    plugin._scheduleListPanelSync(0);
    if (failed.length > 0) {
        plugin._showListPanelNotice(panel, `以下清单移除失败：${failed.join('、')}`);
    }
}

/**
 * 合并行勾选变更入口：按目标勾选态分发加入 / 移除路由。
 * 忙碌中的合并行忽略本次变更并回滚展示。
 */
export function forwardListGroupChange(
    plugin: DetailPageButtonPlugin,
    panel: DetailListPanelElement,
    displayInput: HTMLInputElement
): void {
    const groupElement = displayInput.closest('.jhs-list-group') as HTMLElement | null;
    if (!groupElement) return;
    if (groupElement.dataset.jhsBusy === '1') {
        refreshMergedRowDisplay(groupElement);
        return;
    }
    if (displayInput.checked) {
        void addToGroup(plugin, panel, groupElement);
    } else {
        void removeFromGroup(plugin, panel, groupElement);
    }
}

/**
 * 「整理」：将当前影片收敛到组内最靠前的清单（移除其余含片清单）。
 * 详情页仅能获得当前影片的清单归属，故整理范围为当前影片在组内的去重。
 */
export async function reflowGroup(
    plugin: DetailPageButtonPlugin,
    panel: DetailListPanelElement,
    groupElement: HTMLElement
): Promise<void> {
    if (groupElement.dataset.jhsBusy === '1') return;
    const { members } = liveMembers(groupElement);
    const containing = sortMembersByNum(members.filter((m) => m.checked));
    if (containing.length <= 1) {
        plugin._showListPanelNotice(panel, '当前影片在该清单组内无需整理');
        return;
    }
    const keep = containing.find((m) => !isMemberFull(m)) ?? containing[0];
    groupElement.dataset.jhsBusy = '1';
    setGroupBusy(groupElement, true);
    for (const member of containing) {
        if (member.listId === keep.listId) continue;
        setNativeCheckbox(member.listId, false);
        await sleep(SERIAL_CHANGE_GAP_MS);
    }
    delete groupElement.dataset.jhsBusy;
    plugin._scheduleListPanelSync(0);
    plugin._showListPanelNotice(panel, `已整理：当前影片仅保留在「${keep.name}」`);
}

/**
 * 展开 / 收起合并行明细。
 * @param toggleButton 触发展开的按钮
 */
export function toggleGroupDetail(toggleButton: HTMLElement): void {
    const groupElement = toggleButton.closest('.jhs-list-group') as HTMLElement | null;
    const detail = groupElement?.querySelector<HTMLElement>('.jhs-list-group__detail');
    if (!groupElement || !detail) return;
    detail.hidden = !detail.hidden;
    toggleButton.setAttribute('aria-expanded', String(!detail.hidden));
    refreshMergedRowDisplay(groupElement);
}

/**
 * 原生 checkbox 状态变化时，刷新所有包含该清单的合并行。
 * 供 syncListPanelInputState 的属性快速同步路径调用。
 * @param listId 发生变化的原生清单 ID
 */
export function syncMergedRowsForListId(listId: string): void {
    const groups = document.querySelectorAll<HTMLElement>('.jhs-list-group');
    groups.forEach((groupElement) => {
        const refs = parseMemberRefs(groupElement);
        if (refs.some((ref) => ref.id === listId)) {
            refreshMergedRowDisplay(groupElement);
        }
    });
}
