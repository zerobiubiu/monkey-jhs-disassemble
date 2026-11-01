import { PRELOAD_FILTER_READY_EVENT, STATUS_FILTER_DATA_EVENT } from '../../constants/weekly-recommend';

import { TaskSupervisor } from '../../core/task-supervisor';
import { siteSelector } from '../../core/util/site/selectors';
import { queryFilterItems, reconcileFilterVisibility } from '../../core/util/site/filter-scope';
import type { FilterScope } from '../../types/filter-scope';

import type { OtherSitePlugin } from '../other-site-plugin';
import { buildFilterBar, refreshScopedPreloadFilter } from '../other-site/osp-filter-bar';
import { applyFilter as applyStatusFilter } from '../status-tag-filter/stf-apply';
import { doBuild } from '../status-tag-filter/stf-ui';
import { VltTags } from '../video-lists-tag/vlt-tags';

/** 复用三套筛选组件，仅协调推荐范围的挂载、刷新和生命周期。 */
export class WeeklyRecommendFilters {
    private supervisor = new TaskSupervisor();
    private tags: VltTags;
    private pending = false;

    constructor(private scope: FilterScope, private getOtherSite?: () => OtherSitePlugin | undefined) {
        this.tags = new VltTags(scope);
    }

    init(): void {
        this.refresh();
        // 筛选操作后重算其他栏的可见计数，不通过观察自身 style/隐藏标记触发。
        this.supervisor.addEventListener(this.scope.mount, 'click', () => this.schedule());
        const container = this.scope.root.querySelector(siteSelector('weeklyRecommend'));
        if (container) this.supervisor.observe(container, () => this.schedule(), {
            childList: true, subtree: true, characterData: true,
            attributes: true, attributeFilter: ['class']
        });
        this.supervisor.addEventListener(document, PRELOAD_FILTER_READY_EVENT, () => this.refresh());
        this.supervisor.addEventListener(document, STATUS_FILTER_DATA_EVENT, () => this.refresh());
    }

    private schedule(): void {
        if (this.pending || this.supervisor.aborted) return;
        this.pending = true;
        this.supervisor.setTimeout(() => {
            this.pending = false;
            this.refresh();
        }, 50);
    }

    refresh(): void {
        if (this.supervisor.aborted) return;
        this.tags.buildFilterBar();
        this.tags.updateFilterBar();
        const status = doBuild(undefined, this.scope);
        status?._refreshChips();
        applyStatusFilter(this.scope);
        const otherSite = this.getOtherSite?.();
        if (otherSite?.preloadFilterReady && otherSite.preloadStatusEnabled) {
            buildFilterBar(otherSite, this.scope);
            refreshScopedPreloadFilter(this.scope);
        }
    }

    destroy(): void {
        this.supervisor.abort();
        queryFilterItems(this.scope).forEach((item) => {
            const attributes = ['data-status-tag-hidden', 'data-video-lists-tag-hidden', 'data-preload-hidden'];
            if (!attributes.some((attribute) => item.hasAttribute(attribute))) return;
            attributes.forEach((attribute) => item.removeAttribute(attribute));
            reconcileFilterVisibility(item);
        });
    }
}
