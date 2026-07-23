/**
 * 详情页「想看/已观看」同步功能模块。
 * 从 detail-page-button-plugin.tsx 提取，逻辑与原实现一致。
 */
import { isJavdbSite } from '../../constants/site';
import { FAVORITE_ACTION, HAS_WATCH_ACTION } from '../../constants/status';

import type { DetailPageButtonPlugin } from '../detail-page-button-plugin';
import type { WantWatchedState, WantWatchedSyncPayload } from './dpb-types';

/**
 * 监听 JavDB 原生「想看/看過」按钮变化，自动同步到 JHS。
 * 用 MutationObserver 监听 .review-buttons 子树变化，比对前后状态差异。
 * 对应原 L5217-5264。
 */
export function hookWantAndWatchedButtons(plugin: DetailPageButtonPlugin): void {
    if (!isJavdbSite) return;
    if (plugin._wantWatchedObserved) return;
    const self = plugin;
    // 等待 .review-buttons 出现
    const ensure = () => {
        const container = document.querySelector(
            'body > section > div > div.video-detail > div.video-meta-panel > div > div:nth-child(2) > nav > div.review-buttons'
        ) as (Element & { __jhsObserved?: boolean }) | null;
        if (!container) {
            setTimeout(ensure, 200);
            return;
        }
        if (container.__jhsObserved) return;
        container.__jhsObserved = true;
        self._wantWatchedObserved = true;
        // 记录初始状态
        self._lastWantState = self.detectWantWatchedState(container);
        const observer = new MutationObserver(() => {
            if (self._wantWatchedSyncing) return;
            // 防抖：连续多次变化合并
            clearTimeout(self._wantWatchedDebounce ?? undefined);
            self._wantWatchedDebounce = setTimeout(() => {
                self._wantWatchedSyncing = true;
                try {
                    const currentState = self.detectWantWatchedState(container);
                    const lastState = self._lastWantState || {
                        want: false,
                        watched: false
                    };
                    if (currentState.want !== lastState.want) {
                        if (currentState.want) self.onWantAdded();
                        else self.onWantRemoved();
                    }
                    if (currentState.watched !== lastState.watched) {
                        if (currentState.watched) self.onWatchedAdded();
                        else self.onWatchedRemoved();
                    }
                    self._lastWantState = currentState;
                } finally {
                    self._wantWatchedSyncing = false;
                }
            }, 150);
        });
        observer.observe(container, { childList: true, subtree: true });
    };
    ensure();
}

/**
 * 从 .review-buttons DOM 推断当前 JavDB 的「想看」和「已观看」状态。
 * 对应原 L5271-5285。
 * @param container .review-buttons 容器
 * @returns 状态推断结果
 */
export function detectWantWatchedState(container: Element): WantWatchedState {
    // is-info is-light tag = 我想看
    // is-success is-light tag = 我看過
    // 它们的 parent a[href] 指向 /users/want_watch_videos 或 /users/watched_videos
    const wantTag = container.querySelector(
        "a[href='/users/want_watch_videos'] .tag.is-info.is-light"
    );
    const watchedTag = container.querySelector(
        "a[href='/users/watched_videos'] .tag.is-success.is-light"
    );
    return {
        want: !!wantTag,
        watched: !!watchedTag
    };
}

/**
 * 检测到「想看」被勾选时的处理：写入 JHS favorite 并广播。
 * 对应原 L5290-5316。
 */
export async function onWantAdded(plugin: DetailPageButtonPlugin): Promise<void> {
    const pageInfo = plugin.getPageInfo();
    try {
        // 避免重复写入同状态导致 _saveSingleCar 抛错
        const carRecord = await storageManager.getCar(pageInfo.carNum!);
        if (carRecord && carRecord.status === FAVORITE_ACTION) {
            // 已为 favorite，不重复写
        } else {
            await storageManager.saveCar({
                carNum: pageInfo.carNum!,
                url: pageInfo.url ?? undefined,
                names: pageInfo.actress ?? undefined,
                actionType: FAVORITE_ACTION,
                publishTime: pageInfo.publishTime ?? undefined
            });
            plugin.broadcastWantWatchedSync({
                carNum: pageInfo.carNum!,
                status: FAVORITE_ACTION,
                op: 'add'
            });
            show.ok(`${pageInfo.carNum} 已收藏`);
        }
    } catch (err: unknown) {
        clog.error('[JHS-想看自动同步] 写入失败', err);
    }
    plugin.showStatus(pageInfo.carNum!).then();
}

/**
 * 检测到「想看」被取消时的处理：从 JHS 移除 favorite 并广播。
 * 对应原 L5321-5337。
 */
export async function onWantRemoved(plugin: DetailPageButtonPlugin): Promise<void> {
    const pageInfo = plugin.getPageInfo();
    try {
        const removed = await plugin.removeCarIfStatus(pageInfo.carNum!, FAVORITE_ACTION);
        if (removed) {
            plugin.broadcastWantWatchedSync({
                carNum: pageInfo.carNum!,
                status: FAVORITE_ACTION,
                op: 'remove'
            });
            show.ok(`${pageInfo.carNum} 已取消收藏`);
        }
    } catch (err: unknown) {
        clog.error('[JHS-想看自动同步] 移除失败', err);
    }
    plugin.showStatus(pageInfo.carNum!).then();
}

/**
 * 检测到「已观看」被勾选时的处理：写入 JHS hasWatch 并广播。
 * 对应原 L5342-5367。
 */
export async function onWatchedAdded(plugin: DetailPageButtonPlugin): Promise<void> {
    const pageInfo = plugin.getPageInfo();
    try {
        const carRecord = await storageManager.getCar(pageInfo.carNum!);
        if (carRecord && carRecord.status === HAS_WATCH_ACTION) {
            // 已为 hasWatch，不重复写
        } else {
            await storageManager.saveCar({
                carNum: pageInfo.carNum!,
                url: pageInfo.url ?? undefined,
                names: pageInfo.actress ?? undefined,
                actionType: HAS_WATCH_ACTION,
                publishTime: pageInfo.publishTime ?? undefined
            });
            plugin.broadcastWantWatchedSync({
                carNum: pageInfo.carNum!,
                status: HAS_WATCH_ACTION,
                op: 'add'
            });
            show.ok(`${pageInfo.carNum} 已标记看过`);
        }
    } catch (err: unknown) {
        clog.error('[JHS-观看自动同步] 写入失败', err);
    }
    plugin.showStatus(pageInfo.carNum!).then();
}

/**
 * 检测到「已观看」被取消时的处理：从 JHS 移除 hasWatch 并广播。
 * 对应原 L5372-5388。
 */
export async function onWatchedRemoved(plugin: DetailPageButtonPlugin): Promise<void> {
    const pageInfo = plugin.getPageInfo();
    try {
        const removed = await plugin.removeCarIfStatus(pageInfo.carNum!, HAS_WATCH_ACTION);
        if (removed) {
            plugin.broadcastWantWatchedSync({
                carNum: pageInfo.carNum!,
                status: HAS_WATCH_ACTION,
                op: 'remove'
            });
            show.ok(`${pageInfo.carNum} 已取消看过`);
        }
    } catch (err: unknown) {
        clog.error('[JHS-观看自动同步] 移除失败', err);
    }
    plugin.showStatus(pageInfo.carNum!).then();
}

/**
 * 仅当 JHS 中该番号状态为目标 status 时移除记录。
 * 对应原 L5396-5401。
 * @param carNum 番号
 * @param status 目标状态（FAVORITE_ACTION=想看 / HAS_WATCH_ACTION=已观看）
 * @returns 是否执行了移除
 */
export async function removeCarIfStatus(carNum: string, status: string): Promise<boolean> {
    const carRecord = await storageManager.getCar(carNum);
    if (!carRecord) return false;
    if (carRecord.status !== status) return false;
    return await storageManager.removeCar(carNum);
}

/**
 * 广播「想看/观看」状态变更，供其他标签页/脚本接收。
 * 三重通道：GM_setValue / localStorage / CustomEvent。对应原 L5407-5429。
 * @param payload 变更载荷
 */
export function broadcastWantWatchedSync(payload: WantWatchedSyncPayload): void {
    try {
        const json = JSON.stringify({ ...payload, time: Date.now() });
        // 1) GM 原生通道（跨标签页）
        try {
            GM_setValue('jdb:want-watched-sync', json);
        } catch {}
        // 2) localStorage（跨脚本同源）
        try {
            localStorage.setItem('jdb:want-watched-sync', json);
        } catch {}
        // 3) CustomEvent（跨脚本同页面）
        try {
            document.dispatchEvent(
                new CustomEvent('jdb:want-watched-sync', {
                    detail: payload
                })
            );
        } catch {}
    } catch (err: unknown) {
        clog.error('[JHS-想看/观看同步] 广播失败', err);
    }
}

/**
 * 接收来自其他标签页/脚本的「想看/观看」状态变更，同步刷新本页状态。
 * 三重通道监听：CustomEvent / localStorage storage 事件 / GM_addValueChangeListener。
 * 对应原 L5435-5477。
 */
export function setupWantWatchedSyncListener(plugin: DetailPageButtonPlugin): void {
    if (!isJavdbSite) return;
    if (plugin._wantWatchedListenerInstalled) return;
    plugin._wantWatchedListenerInstalled = true;
    const self = plugin;
    const handleSync = (rawData: unknown) => {
        const rawDetail = rawData as { detail?: WantWatchedSyncPayload } | null;
        const payload: WantWatchedSyncPayload | null =
            rawDetail?.detail ||
            (() => {
                try {
                    return JSON.parse(rawData as string) as WantWatchedSyncPayload;
                } catch {
                    return null;
                }
            })();
        if (!payload || !payload.carNum) return;

        // 清除 carList 缓存：跨标签页广播时本页 cacheCarList 可能已过期
        //（detail 页 saveCar 仅更新自身缓存，不跨标签同步）
        storageManager.clearCarListCache();

        // 1) 详情页：刷新 JHS 菜单按钮文案
        try {
            const currentCarNum = self.getPageInfo().carNum;
            if (currentCarNum && payload.carNum === currentCarNum) {
                self.showStatus(currentCarNum).then(() => {});
            }
        } catch {}

        // 2) 列表页/series 页：刷新匹配卡片的 status-tag
        self.refreshItemStatusTag(payload.carNum);
    };
    // 1) 同页面 CustomEvent
    document.addEventListener('jdb:want-watched-sync', (event: Event) =>
        handleSync((event as CustomEvent).detail)
    );
    // 2) localStorage（跨标签页 / 跨 iframe）
    window.addEventListener('storage', (event: StorageEvent) => {
        if (event.key !== 'jdb:want-watched-sync' || !event.newValue) return;
        handleSync(event.newValue);
    });
    // 3) GM 通道
    try {
        GM_addValueChangeListener(
            'jdb:want-watched-sync',
            (_name: string, _oldValue: unknown, newValue: unknown) => {
                if (!newValue) return;
                handleSync(newValue);
            }
        );
    } catch {}
}

/**
 * 跨页/跨 iframe 同步：刷新当前页所有匹配 carNum 的视频卡片 status-tag。
 * 走 ListPagePlugin.filterMovieList 同样的渲染逻辑（取自 IndexedDB 真值）。
 * 对应原 L5485-5501。
 * @param carNum 要刷新的番号
 */
export function refreshItemStatusTag(plugin: DetailPageButtonPlugin, carNum: string): void {
    try {
        const selectorConfig = plugin.getSelector();
        const itemSelector = selectorConfig.itemSelector;
        const items = document.querySelectorAll(itemSelector);
        for (const item of items) {
            const strongEl = item.querySelector('a > div.video-title > strong');
            if (!strongEl || strongEl.innerHTML !== carNum) continue;
            // 找到匹配的卡片，交给 ListPagePlugin 重跑单卡片
            const listPagePlugin = plugin.getBean('ListPagePlugin');
            if (!listPagePlugin) continue;
            listPagePlugin.renderItemStatusTag(item as HTMLElement, carNum);
        }
    } catch (err: unknown) {
        clog.error('[JHS-想看/观看] 刷新列表项 status-tag 失败', err);
    }
}
