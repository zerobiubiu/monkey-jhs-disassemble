/**
 * 筛选栏 UI —— 从 status-tag-filter-plugin.ts 拆出的 UI 构建方法。
 *
 * createFilterChip：创建单个筛选芯片（标签名+计数，点击 toggle active + applyFilter）。
 * doBuild：构建筛选栏并插入到挂载目标之后（内部 refreshChips 保留已激活状态）。
 * findMountTarget：按优先级查找挂载目标（jhs-vlt-filter-bar → tabs → section）。
 */
import { collectStatusTagCounts, countNoStatusItems, NO_TAG_VALUE } from './stf-collect';
import { applyFilter } from './stf-apply';

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
 * @param mountTarget 挂载参考元素
 */
export function doBuild(mountTarget: Element): void {
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
    };

    // 初始构建芯片
    refreshChips();

    // 插入到 DOM
    if (mountTarget.matches('.jhs-vlt-filter-bar, .actor-tags.tags, .tabs.is-boxed')) {
        mountTarget.insertAdjacentElement('afterend', filterBar);
    } else {
        mountTarget.insertAdjacentElement('beforebegin', filterBar);
    }

    // 保存 refreshChips 引用以便后续更新（与原脚本 filterBar._refreshChips 一致）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DOM augmentation: storing function ref on element
    (filterBar as any)._refreshChips = refreshChips;

    console.log(`${LOG} 筛选栏已挂载`);
}

/**
 * 按优先级依次查找可用的挂载目标。对应原 L197-220。
 *
 * @returns 挂载目标元素或 null
 */
export function findMountTarget(): Element | null {
    // 1) 优先挂在 videoListsTag 的 .jhs-vlt-filter-bar 之后
    const tagFilterBar = document.querySelector('.jhs-vlt-filter-bar');
    if (tagFilterBar) return tagFilterBar;

    // 2) 挂在页面默认 tabs 容器之后
    const isActorPage = /^\/actors\//.test(window.location.pathname);
    if (isActorPage) {
        const actorTags = document.querySelector('body > section > div > div.actor-tags.tags');
        if (actorTags) return actorTags;
    } else {
        const tabsBoxed = document.querySelector('body > section > div > div.tabs.is-boxed');
        if (tabsBoxed) return tabsBoxed;
    }

    // 3) 回退：挂在 section 容器的第一个子元素之前
    const section = document.querySelector('body > section > div > div');
    if (section && section.firstElementChild) {
        if (!section.firstElementChild.matches('.jhs-vlt-filter-bar, .status-tag-filter-bar')) {
            return section.firstElementChild;
        }
    }

    // 4) 最终回退：挂在 body > section > div 的第一个子元素之前
    const container = document.querySelector('body > section > div');
    if (container && container.firstElementChild) {
        if (!container.firstElementChild.matches('.jhs-vlt-filter-bar, .status-tag-filter-bar')) {
            return container.firstElementChild;
        }
    }

    return null;
}
