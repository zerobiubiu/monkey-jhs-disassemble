/**
 * 站点原生卡片标签筛选插件 SiteTagFilterPlugin。
 *
 * 功能：实时扫描列表页卡片 `div.tags.has-addons` 中的站点原生 `span` 标签（排除扩展注入的
 * `.status-tag` 收藏/已观看/已屏蔽标签），不预设任何固定标签，按当前页面实际内容动态渲染
 * 筛选芯片并支持多选（OR 逻辑）及「无标签」筛选；监听瀑布流追加与 DOM 变动实时同步。
 */
import { isVideoListContext, type PageType } from '../../core/page-context';
import { TaskSupervisor } from '../../core/task-supervisor';
import { queryFilterControls } from '../../core/util/site/filter-scope';
import { siteSelector } from '../../core/util/site/selectors';

import { BasePlugin } from '../base-plugin';
import { refreshSiteTagFilterBar } from './stgf-ui';

import siteTagFilterCssRaw from '../../styles/site-tag-filter/site-tag-filter.css?raw';

/** 判断单个变动节点是否可能影响原生卡片标签统计或列表挂载。 */
function isRelevantNode(node: Node, target: Node, itemSel: string, tagsSel: string): boolean {
    if (node.nodeType !== Node.ELEMENT_NODE) return false;
    const el = node as Element;
    if (el.classList.contains('status-tag') || el.classList.contains('jhs-lp-batch-item')) {
        return false;
    }
    if (el.matches(itemSel) || el.querySelector(itemSel) !== null) return true;
    if (el.matches(tagsSel) || el.querySelector(tagsSel) !== null) return true;
    return (
        el.tagName === 'SPAN' &&
        target instanceof Element &&
        target.matches(tagsSel) &&
        !target.classList.contains('jhs-status-tags')
    );
}

/** 站点原生卡片标签筛选插件主类。 */
export class SiteTagFilterPlugin extends BasePlugin {
    /** 变更防抖计时器。 */
    private observerDebounce = 0;
    /** 统一生命周期管理器。 */
    private supervisor = new TaskSupervisor();

    getName(): string {
        return 'SiteTagFilterPlugin';
    }

    /** 仅在列表页与 JavDB 首页激活。 */
    get pageTypes(): PageType[] {
        return ['list', 'home'];
    }

    async initCss(): Promise<string> {
        return siteTagFilterCssRaw;
    }

    async handle(): Promise<void> {
        if (!isVideoListContext()) return;
        this.init();
    }

    private init(): void {
        if (!document.body) {
            this.supervisor.setTimeout(() => this.init(), 100);
            return;
        }

        refreshSiteTagFilterBar();
        this.startObserving();
    }

    private startObserving(): void {
        const itemSel = siteSelector('parsedItem');
        const tagsSel = siteSelector('listTags');

        this.supervisor.observe(
            document.body,
            (mutations: MutationRecord[]) => {
                const hasBar = queryFilterControls('.jhs-site-tag-filter-bar').length > 0;
                let shouldRefresh = false;

                for (const mutation of mutations) {
                    const target = mutation.target;
                    const targetEl =
                        target.nodeType === Node.ELEMENT_NODE ? (target as Element) : target.parentElement;
                    if (targetEl?.closest('.jhs-site-tag-filter-bar')) continue;

                    if (mutation.type === 'attributes') {
                        if (targetEl?.matches(itemSel)) {
                            shouldRefresh = true;
                            break;
                        }
                        continue;
                    }

                    if (mutation.type === 'characterData') {
                        const parentSpan = targetEl?.closest('span');
                        const tagsHost = parentSpan?.parentElement;
                        if (
                            parentSpan &&
                            !parentSpan.classList.contains('status-tag') &&
                            tagsHost?.matches(tagsSel) &&
                            !tagsHost.classList.contains('jhs-status-tags')
                        ) {
                            shouldRefresh = true;
                            break;
                        }
                        continue;
                    }

                    const touchedNodes = [...Array.from(mutation.addedNodes), ...Array.from(mutation.removedNodes)];
                    if (!hasBar && touchedNodes.some((node) => node.nodeType === Node.ELEMENT_NODE)) {
                        shouldRefresh = true;
                        break;
                    }
                    if (touchedNodes.some((node) => isRelevantNode(node, target, itemSel, tagsSel))) {
                        shouldRefresh = true;
                        break;
                    }
                }

                if (shouldRefresh) {
                    clearTimeout(this.observerDebounce);
                    this.observerDebounce = this.supervisor.setTimeout(() => {
                        refreshSiteTagFilterBar();
                    }, 150);
                }
            },
            {
                childList: true,
                subtree: true,
                characterData: true,
                attributes: true,
                attributeFilter: ['data-hide']
            }
        );
    }

    destroy(): void {
        this.supervisor.abort();
    }
}
