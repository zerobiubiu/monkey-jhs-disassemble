/**
 * ListDomBus — 列表页 DOM 变更总线（Runtime V2 基础设施）。
 *
 * 集中管理 .movie-list 容器的 MutationObserver，将新增 .item 元素
 * 在一帧内批量分发给注册的处理器。替代各插件各自创建独立 Observer
 * 的模式，减少 Observer 数量、避免重复遍历、保证单帧内一次性处理。
 *
 * 使用方式：
 * ```typescript
 * // main.tsx 或 ListPagePlugin 中创建
 * const bus = new ListDomBus();
 * bus.start(document.querySelector('.movie-list'));
 *
 * // 各插件注册处理器
 * bus.onItemsAdded((items) => {
 *     for (const item of items) {
 *         this.processNewItem(item);
 *     }
 * });
 *
 * // 页面卸载时
 * bus.stop();
 * ```
 *
 * 设计原则：
 * - 单 Observer 监听 .movie-list 的 childList + subtree
 * - 新增节点累积到 pendingNodes，requestAnimationFrame 批量分发
 * - 每个 .item 只处理一次（去重由 pendingNodes 的 splice 保证）
 * - handler 异常隔离（一个 handler 失败不影响其他）
 */

/** 列表项添加处理器。 */
export type ListDomHandler = (addedItems: Element[]) => void;

export class ListDomBus {
    private observer: MutationObserver | null = null;
    private handlers: ListDomHandler[] = [];
    private pendingNodes: Element[] = [];
    private frameScheduled = false;

    /** 当前是否有活跃的监听。 */
    get active(): boolean {
        return this.observer !== null;
    }

    /**
     * 注册处理器：新 .item 元素追加到列表时调用。
     * 同一 handler 可重复注册（不去重），但通常不需要。
     */
    onItemsAdded(handler: ListDomHandler): void {
        this.handlers.push(handler);
    }

    /** 移除处理器。 */
    offItemsAdded(handler: ListDomHandler): void {
        this.handlers = this.handlers.filter((h) => h !== handler);
    }

    /**
     * 启动监听。
     * @param container .movie-list 容器元素
     */
    start(container: Element): void {
        if (this.observer) return;
        this.observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node instanceof Element) {
                        if (node.matches('.item')) {
                            this.pendingNodes.push(node);
                        } else {
                            // 片段中可能包含多个 .item（如瀑布流 append 整页 HTML）
                            const items = node.querySelectorAll('.item');
                            for (let i = 0; i < items.length; i++) {
                                this.pendingNodes.push(items[i]);
                            }
                        }
                    }
                }
            }
            this.scheduleFlush();
        });
        this.observer.observe(container, { childList: true, subtree: true });
    }

    /** 停止监听并清理所有状态。幂等。 */
    stop(): void {
        this.observer?.disconnect();
        this.observer = null;
        this.pendingNodes.length = 0;
        this.frameScheduled = false;
    }

    /** 在下一动画帧批量分发累积的节点。 */
    private scheduleFlush(): void {
        if (this.frameScheduled) return;
        this.frameScheduled = true;
        requestAnimationFrame(() => {
            this.frameScheduled = false;
            if (this.pendingNodes.length === 0) return;
            const batch = this.pendingNodes.splice(0);
            for (const handler of this.handlers) {
                try {
                    handler(batch);
                } catch (err) {
                    console.error('[ListDomBus] handler 执行失败', err);
                }
            }
        });
    }
}
