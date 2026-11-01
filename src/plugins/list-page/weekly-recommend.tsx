import { WEEKLY_RECOMMEND_ITEMS_EVENT, WEEKLY_RECOMMEND_VISIBILITY_EVENT } from '../../constants/weekly-recommend';

import { jsxToString } from '../../core/jsx-to-string';
import { pageContext } from '../../core/page-context';
import { TaskSupervisor } from '../../core/task-supervisor';
import { siteSelector } from '../../core/util/site/selectors';

import { ensureBatchSideBarContainer } from './lp-batch';
import { WeeklyRecommendFilters } from './weekly-recommend-filters';
import type { OtherSitePlugin } from '../other-site-plugin';

import { WeeklyRecommendPanel } from '../../components/list-page/weekly-recommend-panel';

/** 只调整首页推荐的展示位置，不复制内容、不新增请求或持久化状态。 */
export class WeeklyRecommendController {
    private supervisor = new TaskSupervisor();
    private anchor: Comment | null = null;
    private nodes: Node[] = [];
    private entry: HTMLElement | null = null;
    private panel: HTMLElement | null = null;
    private toggle: HTMLButtonElement | null = null;
    private waiting = false;
    private originalTitleText = new Map<Text, string>();
    private itemRefreshPending = false;
    private cardSnapshot = new Map<Element, string>();
    private filters: WeeklyRecommendFilters | null = null;

    constructor(private onItemsChanged?: () => void, private getOtherSite?: () => OtherSitePlugin | undefined) {}

    init(): void {
        if (!pageContext.isHomePage || this.supervisor.aborted || this.entry || this.waiting) return;
        if (this.mount()) return;
        // 兼容站点晚到的推荐骨架；只观察首页，成功或超时后立即停止。
        this.waiting = true;
        const observer = this.supervisor.observe(document.body, () => {
            if (this.mount()) {
                observer.disconnect();
                this.waiting = false;
            }
        }, { childList: true, subtree: true });
        this.supervisor.setTimeout(() => {
            observer.disconnect();
            this.waiting = false;
        }, 10000);
    }

    private mount(): boolean {
        if (this.entry) return true;
        if (document.getElementById('jhs-weekly-recommend-panel')) return false;
        const heading = document.querySelector<HTMLElement>(siteSelector('weeklyRecommendHeading'));
        const container = document.querySelector<HTMLElement>(siteSelector('weeklyRecommend'));
        if (!heading || !container || heading.parentNode !== container.parentNode) return false;

        // 先确认结束节点可达，再修改 DOM；结构漂移时保留原站内容。
        const nodes: Node[] = [];
        let cursor: Node | null = heading;
        while (cursor) {
            nodes.push(cursor);
            if (cursor === container) break;
            cursor = cursor.nextSibling;
        }
        if (nodes[nodes.length - 1] !== container) return false;

        const template = document.createElement('template');
        template.innerHTML = jsxToString(<WeeklyRecommendPanel />);
        const entry = template.content.querySelector<HTMLButtonElement>('.jhs-weekly-recommend-entry')!;
        const panel = template.content.querySelector<HTMLElement>('.jhs-weekly-recommend-panel')!;
        const toggle = entry;
        const closeButton = panel.querySelector<HTMLButtonElement>('.jhs-weekly-recommend-close')!;
        const anchor = document.createComment('jhs-weekly-recommend-origin');
        heading.before(anchor);
        ensureBatchSideBarContainer().prepend(entry);
        document.body.appendChild(panel);
        panel.querySelector('#jhs-weekly-recommend-title')!.appendChild(heading);
        panel.querySelector('.jhs-weekly-recommend-content')!.append(...nodes.slice(1));
        this.nodes = nodes;
        this.anchor = anchor;
        this.entry = entry;
        this.panel = panel;
        this.toggle = toggle;
        this.hideUpdateTime(heading);
        panel.dataset.jhsFilterScope = 'recommend';
        this.filters = new WeeklyRecommendFilters({
            root: panel,
            itemSelector: siteSelector('weeklyRecommendItem'),
            mount: panel.querySelector<HTMLElement>('.jhs-weekly-recommend-filters')!
        }, this.getOtherSite);
        this.filters.init();

        this.supervisor.addEventListener(toggle, 'click', () => {
            if (panel.hidden) {
                panel.hidden = false;
                toggle.setAttribute('aria-expanded', 'true');
                closeButton.focus({ preventScroll: true });
                this.filters?.refresh();
                this.onItemsChanged?.();
                document.dispatchEvent(new Event(WEEKLY_RECOMMEND_VISIBILITY_EVENT));
            } else {
                this.close(true);
            }
        });
        this.supervisor.addEventListener(closeButton, 'click', () => this.close(true));
        this.supervisor.addEventListener(document, 'pointerdown', (event: Event) => {
            if (panel.hidden || !(event.target instanceof Node)) return;
            if (!panel.contains(event.target) && !entry.contains(event.target)) this.close(false);
        });
        // 冒泡阶段尊重已有 layer 的捕获阶段 ESC 门闩，不在同一次按键关闭两层。
        this.supervisor.addEventListener(document, 'keydown', (event: Event) => {
            const keyEvent = event as KeyboardEvent;
            if (keyEvent.key !== 'Escape' || keyEvent.defaultPrevented || panel.hidden) return;
            keyEvent.preventDefault();
            keyEvent.stopPropagation();
            this.close(true);
        });
        this.cardSnapshot = this.snapshotCards();
        this.supervisor.observe(container, () => {
            const next = this.snapshotCards();
            const changed = next.size !== this.cardSnapshot.size ||
                Array.from(next).some(([item, identity]) => this.cardSnapshot.get(item) !== identity);
            this.cardSnapshot = next;
            if (!changed || this.itemRefreshPending) return;
            this.itemRefreshPending = true;
            this.supervisor.setTimeout(() => {
                this.itemRefreshPending = false;
                this.onItemsChanged?.();
                document.dispatchEvent(new Event(WEEKLY_RECOMMEND_ITEMS_EVENT));
            }, 0);
        }, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['href'] });
        this.onItemsChanged?.();
        document.dispatchEvent(new Event(WEEKLY_RECOMMEND_ITEMS_EVENT));
        return true;
    }

    /** 只比较卡片身份、原生番号和链接，忽略脚本添加的标签、译文和徽标。 */
    private snapshotCards(): Map<Element, string> {
        return new Map(Array.from(document.querySelectorAll(siteSelector('weeklyRecommendItem')), (item) => [
            item,
            JSON.stringify([
                item.querySelector(siteSelector('listTitleStrong'))?.textContent?.trim(),
                item.querySelector('a')?.getAttribute('href'),
                Array.from(item.querySelectorAll('date'), (date) => date.textContent)
            ])
        ]));
    }

    /** 只收起标题中的更新时间后缀，保留原节点以便销毁时原样还原。 */
    private hideUpdateTime(heading: HTMLElement): void {
        const match = /\s*(?:更新[於于]|Updated\s+(?:at|on))\s*[:：]?\s*\d{4}[-/]\d{1,2}[-/]\d{1,2}/i.exec(heading.textContent || '');
        if (!match) return;
        const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
        let node: Node | null;
        let offset = 0;
        while ((node = walker.nextNode())) {
            const text = node as Text;
            const original = text.data;
            if (offset + original.length > match.index) {
                this.originalTitleText.set(text, original);
                text.data = original.slice(0, Math.max(0, match.index - offset)).trimEnd();
            }
            offset += original.length;
        }
    }

    private close(restoreFocus: boolean): void {
        if (!this.panel || this.panel.hidden) return;
        this.panel.hidden = true;
        this.toggle?.setAttribute('aria-expanded', 'false');
        document.dispatchEvent(new Event(WEEKLY_RECOMMEND_VISIBILITY_EVENT));
        if (restoreFocus || this.panel.contains(document.activeElement)) {
            this.toggle?.focus({ preventScroll: true });
        }
    }

    destroy(): void {
        this.supervisor.abort();
        this.filters?.destroy();
        this.filters = null;
        this.originalTitleText.forEach((text, node) => { node.data = text; });
        this.originalTitleText.clear();
        this.cardSnapshot.clear();
        if (this.anchor?.isConnected) {
            // 整段原节点回到注释锚点，站点后续新增在推荐容器内的内容也随容器保留。
            const fragment = document.createDocumentFragment();
            fragment.append(...this.nodes);
            this.anchor.replaceWith(fragment);
        }
        this.panel?.remove();
        this.entry?.remove();
        this.nodes = [];
        this.panel = this.entry = this.anchor = this.toggle = null;
    }
}
