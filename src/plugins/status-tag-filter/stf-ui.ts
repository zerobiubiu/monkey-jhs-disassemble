/**
 * 筛选栏 UI —— 从 status-tag-filter-plugin.ts 拆出的 UI 构建方法。
 *
 * createFilterChip：创建单个筛选芯片（标签名+计数，点击 toggle active + applyFilter）。
 * doBuild：构建筛选栏并插入到挂载目标之后（内部 refreshChips 保留已激活状态）。
 * findMountPoint：解析挂载点（优先邻接清单标签栏，否则用共享站点锚点 list-mount）。
 */

import { applyListMountPoint, findListMountPoint, type ListMountPoint } from '../../core/util/site/list-mount';
import { collectStatusTagCounts, countNoStatusItems, NO_TAG_VALUE } from './stf-collect';
import { applyFilter } from './stf-apply';
import {
    SCORE_VALUE_PREFIX,
    countWatchedByScore,
    formatScoreLabel,
    visibleScoreChips
} from './stf-score';

/** 日志前缀。 */
export const LOG = '[状态标签筛选]';

/**
 * 创建单个筛选芯片。对应原 L130-145。
 *
 * @param labelText 芯片文本
 * @param value 芯片值（标签文本或 'no-tag'）
 * @param opts 选项（isNoTag/count）
 * @returns 芯片 span 元素
 */
export function createFilterChip(
    labelText: string,
    value: string,
    opts: { isNoTag?: boolean; count?: number } = {}
): HTMLSpanElement {
    const { isNoTag = false, count } = opts;
    const chip = document.createElement('span');
    chip.className = 'status-tag-filter-chip';
    if (isNoTag) chip.classList.add('no-status');
    // 芯片文本：标签名 + 计数（如 "⭐ 已收藏 12"）
    chip.textContent = count !== undefined ? `${labelText} ${count}` : labelText;
    chip.dataset.value = value;

    chip.addEventListener('click', () => {
        chip.classList.toggle('active');
        applyFilter();
    });

    return chip;
}

/**
 * 构建筛选栏并插入到挂载目标之后。对应原 L150-195。
 * 内部定义 refreshChips（收集 status-tag 文本并重建芯片，保留已激活状态）。
 *
 * @param mount 挂载点（目标 + 插入方位，见 core/util/site/list-mount）
 */
export function doBuild(mount: ListMountPoint): void {
    if (document.querySelector('.status-tag-filter-bar')) return;

    const filterBar = document.createElement('div');
    filterBar.className = 'status-tag-filter-bar';

    // 标签
    const label = document.createElement('span');
    label.className = 'status-tag-filter-label';
    label.textContent = '\u72B6\u6001:'; // 状态:
    filterBar.appendChild(label);

    // 芯片容器
    const chipsContainer = document.createElement('div');
    chipsContainer.className = 'status-tag-filter-chips';
    filterBar.appendChild(chipsContainer);

    // 保存 refreshChips 引用以便后续更新（挂在 DOM 元素上，与原脚本一致）
    const refreshChips = (): void => {
        // 保存当前选中状态
        const activeValues = new Set(
            Array.from(chipsContainer.querySelectorAll('.status-tag-filter-chip.active')).map(
                (c: Element) => (c as HTMLElement).dataset.value || ''
            )
        );

        chipsContainer.innerHTML = '';

        // "无状态标签" 芯片（始终在第一位，带计数）
        const noCount = countNoStatusItems();
        const noTagChip = createFilterChip('无状态标签', NO_TAG_VALUE, {
            isNoTag: true,
            count: noCount
        });
        if (activeValues.has(NO_TAG_VALUE)) noTagChip.classList.add('active');
        chipsContainer.appendChild(noTagChip);

        // 各状态标签芯片（根据页面实际内容动态生成，带计数）
        const allCounts = collectStatusTagCounts();
        const sortedTags = Object.keys(allCounts).sort();
        sortedTags.forEach((tagName: string) => {
            const chip = createFilterChip(tagName, tagName, {
                count: allCounts[tagName]
            });
            if (activeValues.has(tagName)) chip.classList.add('active');
            chipsContainer.appendChild(chip);
        });

        // 已读星级芯片（需求 doc/24）：按本脚本 car_list 的 score（0–5）分级过滤已读卡片。
        // 计数不依赖「已读」标签是否已渲染（有记录即计入）；
        // 展示口径与「已观看/已收藏/无状态标签」一致 —— 只显示当前页实际存在的档位。
        const scoreCounts = countWatchedByScore();
        visibleScoreChips(scoreCounts, activeValues).forEach((score: number) => {
            const value = `${SCORE_VALUE_PREFIX}${score}`;
            const chip = createFilterChip(formatScoreLabel(score), value, {
                count: scoreCounts[score] ?? 0
            });
            chip.classList.add('score-chip');
            if (activeValues.has(value)) chip.classList.add('active');
            chipsContainer.appendChild(chip);
        });
    };

    // 初始构建芯片
    refreshChips();

    // 插入到 DOM：方位由挂载点决定（已知栏位之后 / 列表之前 / 容器顶部）
    applyListMountPoint(mount, filterBar);

    // 保存 refreshChips 引用以便后续更新（与原脚本 filterBar._refreshChips 一致）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DOM augmentation: storing function ref on element
    (filterBar as any)._refreshChips = refreshChips;

    console.log(`${LOG} 筛选栏已挂载`);
}

/**
 * 解析本栏的挂载点：优先挂在清单标签筛选栏之后（两根栏相邻），
 * 否则用共享站点锚点（doc/48/49）。
 *
 * @returns 挂载点或 null
 */
export function findMountPoint(): ListMountPoint | null {
    const tagFilterBar = document.querySelector('.jhs-vlt-filter-bar');
    if (tagFilterBar) return { target: tagFilterBar, position: 'afterend' };
    return findListMountPoint();
}
