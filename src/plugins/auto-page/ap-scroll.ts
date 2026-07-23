/**
 * 瀑布流滚动与加载全部 —— 从 auto-page-plugin.ts 拆出的滚动/按钮方法组。
 *
 * checkScrollPosition：滚动时同步内部 currentPage。
 * checkLoad：探测 loader 是否进入预加载区间（auto/click 两种模式）。
 * setLoadMode：运行时切换触底加载方式。
 * showLoadAllBtn / hideLoadAllBtn / createLoadAllBtn / loadAllPages / updateLoadAllBtn：
 *   「加载全部」浮动按钮的创建、显隐、循环加载与文案更新。
 * setState：设置 loader 的状态类与文案。
 */
import type { AutoPagePlugin } from '../auto-page-plugin';

/**
 * 滚动时同步内部 currentPage（供「加载全部」文案等使用）。
 * 不再改地址栏，避免瀑布流滚动污染 URL。对应原 L9237-9249（已去 URL 同步）。
 */
export function checkScrollPosition(plugin: AutoPagePlugin): void {
    const scrollY = window.scrollY;
    for (let i = plugin.pageItems.length - 1; i >= 0; i--) {
        const item = plugin.pageItems[i];
        if (scrollY >= item.top) {
            if (plugin.currentPage !== item.page) {
                plugin.currentPage = item.page;
            }
            break;
        }
    }
}

/**
 * 探测 loader 是否进入预加载区间。
 * - loadMode=auto：自动抓取下一页
 * - loadMode=click：展示「点击加载下一页」，由用户点击 loader 再抓取
 */
export function checkLoad(plugin: AutoPagePlugin): void {
    if (!plugin.loader) {
        return;
    }
    if (plugin.loader.getBoundingClientRect().top < window.innerHeight + plugin.preloadDistance) {
        if (plugin.loadMode === 'click') {
            if (
                plugin.pagination.isLoading ||
                !plugin.pagination.hasMore ||
                !plugin.nextUrl ||
                plugin.loader.classList.contains('waterfall-error') ||
                plugin.loader.classList.contains('waterfall-loading') ||
                plugin.loader.classList.contains('waterfall-no-more')
            ) {
                return;
            }
            plugin.setState('waterfall-click', '点击加载下一页');
        } else {
            plugin.loadNextPage().then();
        }
    }
}

/**
 * 运行时切换触底加载方式（设置面板即时生效，无需整页刷新）。
 * @param plugin AutoPagePlugin 实例
 * @param mode auto | click
 */
export function setLoadMode(plugin: AutoPagePlugin, mode: 'auto' | 'click'): void {
    plugin.loadMode = mode === 'click' ? 'click' : 'auto';
    if (plugin.loadMode === 'auto') {
        // 切回自动：若已在底部则立即尝试加载
        plugin.checkLoad();
    } else if (
        plugin.loader &&
        plugin.pagination.hasMore &&
        plugin.nextUrl &&
        !plugin.pagination.isLoading &&
        !plugin.loader.classList.contains('waterfall-no-more')
    ) {
        // 切到点按钮：若已在底部则显示提示
        if (
            plugin.loader.getBoundingClientRect().top <
            window.innerHeight + plugin.preloadDistance
        ) {
            plugin.setState('waterfall-click', '点击加载下一页');
        }
    }
}

/**
 * 显示「加载全部」按钮（瀑布流模式开启时由设置面板 change 调用）。
 * 已存在 / 无下一页 / 容器未初始化时不创建，避免重复。
 */
export function showLoadAllBtn(plugin: AutoPagePlugin): void {
    if (plugin.loadAllBtn) return;
    if (!plugin.container || !plugin.pagination.hasMore) return;
    plugin.createLoadAllBtn();
}

/**
 * 隐藏并移除「加载全部」按钮（瀑布流模式关闭时由设置面板 change 调用）。
 * 正在 loadAllPages 时安全移除（后续 updateLoadAllBtn 对 null 跳过）。
 */
export function hideLoadAllBtn(plugin: AutoPagePlugin): void {
    if (!plugin.loadAllBtn) return;
    plugin.loadAllBtn.remove();
    plugin.loadAllBtn = null;
}

/**
 * 创建「加载全部」浮动按钮并追加到 body。
 * 瀑布流模式且有下一页时调用，点击后循环加载所有后续页。
 */
export function createLoadAllBtn(plugin: AutoPagePlugin): void {
    const btn = document.createElement('div');
    btn.className = 'jhs-load-all-btn';
    btn.textContent = '加载全部';
    plugin.supervisor.addEventListener(btn, 'click', () => {
        if (!plugin.isLoadingAll) {
            plugin.loadAllPages().then();
        }
    });
    document.body.appendChild(btn);
    plugin.loadAllBtn = btn;
}

/**
 * 自动加载后续所有页：循环 loadNextPage 直到无更多页、出错或无进展。
 * 通过 pageItems.length 变化检测无进展（autoPage 被关闭 / isLoading 重入）。
 * 循环退出后感知 loadNextPage 设置的 loader 状态（waterfall-error/no-more），
 * 区分"页码受限停止"/"加载失败"/"全部加载完"三种结果，同步按钮文案。
 */
export async function loadAllPages(plugin: AutoPagePlugin): Promise<void> {
    if (plugin.isLoadingAll || !plugin.pagination.hasMore) return;
    plugin.isLoadingAll = true;
    plugin.updateLoadAllBtn('加载中...', true);
    try {
        while (plugin.pagination.hasMore && plugin.nextUrl) {
            const before = plugin.pageItems.length;
            await plugin.loadNextPage();
            if (plugin.pageItems.length === before) break;
            plugin.updateLoadAllBtn(`加载中...（第 ${plugin.currentPage} 页）`, true);
        }
        // 深度融合：感知 loadNextPage 设置的 loader 状态
        if (plugin.loader?.classList.contains('waterfall-error')) {
            const text = plugin.loader?.textContent || '';
            if (text.includes('重复')) {
                plugin.updateLoadAllBtn('已停止（页码受限）', false);
            } else {
                plugin.updateLoadAllBtn('加载失败，点击重试', false);
            }
        } else {
            plugin.updateLoadAllBtn('✓ 已全部加载', false);
            plugin.supervisor.setTimeout(() => {
                plugin.loadAllBtn?.classList.add('jhs-load-all-fadeout');
                plugin.supervisor.setTimeout(() => {
                    plugin.loadAllBtn?.remove();
                    plugin.loadAllBtn = null;
                }, 500);
            }, 2000);
        }
    } catch {
        plugin.updateLoadAllBtn('加载失败，点击重试', false);
    } finally {
        plugin.isLoadingAll = false;
    }
}

/**
 * 更新「加载全部」按钮文案与禁用态。
 * @param plugin AutoPagePlugin 实例
 * @param text 按钮文案
 * @param disabled 是否禁用（加载中时禁用点击视觉）
 */
export function updateLoadAllBtn(plugin: AutoPagePlugin, text: string, disabled: boolean): void {
    if (!plugin.loadAllBtn) return;
    plugin.loadAllBtn.textContent = text;
    if (disabled) {
        plugin.loadAllBtn.classList.add('jhs-load-all-disabled');
    } else {
        plugin.loadAllBtn.classList.remove('jhs-load-all-disabled');
    }
}

/**
 * 设置 loader 的状态类与文案。对应原 L9292-9295。
 *
 * @param plugin AutoPagePlugin 实例
 * @param stateClass 状态类名（空字符串表示空闲态，或 waterfall-loading/error/no-more/click）
 * @param text 展示文案
 */
export function setState(plugin: AutoPagePlugin, stateClass: string, text: string): void {
    plugin.loader!.className = `jhs-scroll ${stateClass}`;
    plugin.loader!.textContent = text;
}
