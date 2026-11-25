import { PRELOAD_FILTER_READY_EVENT, STATUS_FILTER_DATA_EVENT } from '../../constants/weekly-recommend';

import { TaskSupervisor } from '../../core/task-supervisor';
import { FILTER_CHANGE_EVENT } from '../../core/util/site/filter-chips';
import { siteSelector } from '../../core/util/site/selectors';
import { queryFilterItems, reconcileFilterVisibility } from '../../core/util/site/filter-scope';
import type { FilterScope } from '../../types/filter-scope';

import type { OtherSitePlugin } from '../other-site-plugin';
import { buildFilterBar, refreshScopedPreloadFilter } from '../other-site/osp-filter-bar';
import { SITE_TAG_HIDDEN_ATTR } from '../site-tag-filter/stgf-collect';
import { refreshSiteTagFilterBar } from '../site-tag-filter/stgf-ui';
import { applyFilter as applyStatusFilter } from '../status-tag-filter/stf-apply';
import { doBuild } from '../status-tag-filter/stf-ui';
import { VltTags } from '../video-lists-tag/vlt-tags';

/** 复用三套筛选组件，仅协调推荐范围的挂载、刷新和生命周期。 */
export class WeeklyRecommendFilters {
    private supervisor = new TaskSupervisor();
    private tags: VltTags;
    private pending = false;
    private preloadPending = false;

    constructor(private scope: FilterScope, private getOtherSite?: () => OtherSitePlugin | undefined) {
        this.tags = new VltTags(scope);
    }

    init(): void {
        this.refresh();
        // 筛选变化后仅合批重算预加载可见计数，避免重建正在交互中的筛选栏芯片 DOM（保障双击与焦点连续性）。
        this.supervisor.addEventListener(this.scope.mount, FILTER_CHANGE_EVENT, (event: Event) => {
            const detail = (event as CustomEvent<{ bar?: Element; cleared?: boolean }>).detail;
            if (detail?.cleared || detail?.bar?.classList.contains('preload-filter-bar')) return;
            this.schedulePreloadRefresh();
        });
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

    private schedulePreloadRefresh(): void {
        if (this.preloadPending || this.supervisor.aborted) return;
        this.preloadPending = true;
        this.supervisor.setTimeout(() => {
            this.preloadPending = false;
            if (!this.supervisor.aborted) refreshScopedPreloadFilter(this.scope);
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
        refreshSiteTagFilterBar(this.scope);
    }

    destroy(): void {
        this.supervisor.abort();
        queryFilterItems(this.scope).forEach((item) => {
            const attributes = [
                'data-status-tag-hidden',
                'data-video-lists-tag-hidden',
                'data-preload-hidden',
                SITE_TAG_HIDDEN_ATTR
            ];
            if (!attributes.some((attribute) => item.hasAttribute(attribute))) return;
            attributes.forEach((attribute) => item.removeAttribute(attribute));
            reconcileFilterVisibility(item);
        });
    }
}
