/**
 * MissavStatusTagPlugin —— missav 端状态标签渲染插件。
 *
 * 来源：archetype/missavStatusTag.user.js（895 行）。
 * 原架构从后端服务器增量拉取数据到本地 IndexedDB，在 missav 页面渲染状态标签。
 * 现改为从 GM 存储实时消费数据（两层监听）：
 *
 * 1. 增量监听（实时）：GM_addValueChangeListener('jhs_car_status_delta')
 *    javdb 端每次 saveCar/removeCar 时触发，载荷几十字节不压缩，
 *    missav 端收到后直接 upsert/delete 本地 IndexedDB + 刷新标签，毫秒级。
 *
 * 2. 全量监听（兜底）：GM_addValueChangeListener('jhs_car_status_data')
 *    javdb 端页面加载时触发，载荷 ~600KB gzip+base64，
 *    missav 端收到后解压 + 全量 upsert + 刷新标签。
 *
 * 页面加载时先读 GM 存储中的全量数据初始化本地 IndexedDB，之后增量实时更新。
 */

import { BasePlugin } from '../base-plugin';
import {
    GM_KEY_CAR_STATUS_DATA,
    GM_KEY_CAR_STATUS_DELTA,
    LOG_PREFIX_MISSAV,
    type CarStatusPayload,
    type CarStatusDeltaPayload
} from './car-status-config';
import { gunzipFromBase64, columnarToFlat } from './car-status-columnar';
import { upsertLocalCars, queryLocalCars, deleteLocalCars } from './car-status-db';
import { normalizeCarNum, renderBadges, isVideoPage } from './missav-renderer';

/** 日志辅助。 */
function logInfo(msg: string, ...args: any[]): void {
    console.log(`%c${LOG_PREFIX_MISSAV} %c${msg}`, 'color:#25b1dc;font-weight:bold;', '', ...args);
}
function logOk(msg: string, ...args: any[]): void {
    console.log(
        `%c${LOG_PREFIX_MISSAV} ✓%c ${msg}`,
        'color:#1f7a3d;font-weight:bold;',
        '',
        ...args
    );
}
function logWarn(msg: string, ...args: any[]): void {
    console.warn(
        `%c${LOG_PREFIX_MISSAV} ⚠%c ${msg}`,
        'color:#d7a80c;font-weight:bold;',
        '',
        ...args
    );
}
function logErr(msg: string, ...args: any[]): void {
    console.error(
        `%c${LOG_PREFIX_MISSAV} ✗%c ${msg}`,
        'color:#de3333;font-weight:bold;',
        '',
        ...args
    );
}

/** 全量消费锁（增量不锁，因为处理极快）。 */
let isFullConsuming = false;

export class MissavStatusTagPlugin extends BasePlugin {
    getName(): string {
        return 'MissavStatusTagPlugin';
    }

    async initCss(): Promise<string> {
        return '';
    }

    async handle(): Promise<void> {
        logInfo('脚本启动', `页面类型: ${isVideoPage() ? '视频播放页' : '列表页'}`);

        // 1) 注册菜单命令
        try {
            GM_registerMenuCommand('🔄 MissAV 刷新标签', () => {
                this.processAll();
            });
        } catch {
            /* 某些环境不支持 GM_registerMenuCommand */
        }

        // 2) 注册增量变更监听（实时，不锁不冷却）
        try {
            GM_addValueChangeListener(
                GM_KEY_CAR_STATUS_DELTA,
                (_key: string, _oldValue: any, newValue: any, remote: boolean) => {
                    if (remote && newValue) {
                        this.consumeDelta(newValue as CarStatusDeltaPayload);
                    }
                }
            );
            logOk('已注册增量变更监听');
        } catch {
            logWarn('GM_addValueChangeListener 不可用');
        }

        // 3) 注册全量数据监听（兜底）
        try {
            GM_addValueChangeListener(
                GM_KEY_CAR_STATUS_DATA,
                (_key: string, _oldValue: any, newValue: any, remote: boolean) => {
                    if (remote && newValue) {
                        logInfo('收到 javdb 端全量数据通知');
                        this.consumeFull(newValue as CarStatusPayload);
                    }
                }
            );
        } catch {
            /* ignore */
        }

        // 4) 页面加载时读取当前 GM 存储全量数据初始化
        await this.consumeFull(undefined);

        // 5) 启动 MutationObserver 监听动态加载的缩略图
        this.observeAndProcess();
    }

    /**
     * 消费增量变更：直接 upsert/delete 本地 IndexedDB + 刷新标签。
     * 不压缩（几条记录），不锁（处理极快），不冷却（实时）。
     */
    async consumeDelta(delta: CarStatusDeltaPayload): Promise<void> {
        try {
            if (delta.action === 'upsert' && delta.items) {
                // 将增量项转为 upsertLocalCars 需要的格式
                const records = delta.items.map((item) => ({
                    carNum: item.carNum,
                    status: item.status || '',
                    url_path: item.url_path || ''
                }));
                await upsertLocalCars(records);
                logInfo('增量更新', `upsert ${records.length} 条`);
            } else if (delta.action === 'delete' && delta.items) {
                const carNums = delta.items.map((item) => item.carNum);
                await deleteLocalCars(carNums);
                logInfo('增量更新', `delete ${carNums.length} 条`);
            }
            // 刷新页面标签
            await this.processAll();
        } catch (err: any) {
            logErr('增量消费失败', err.message || String(err));
        }
    }

    /**
     * 消费全量数据：解压 → 全量 upsert → 刷新标签。
     * @param payload 直接传入的载荷；undefined 时从 GM_getValue 读取
     */
    async consumeFull(payload?: CarStatusPayload): Promise<void> {
        if (isFullConsuming) {
            logWarn('全量消费任务在进行中');
            return;
        }
        isFullConsuming = true;

        try {
            // 读取 GM 存储数据
            const data: CarStatusPayload | undefined =
                payload ?? (GM_getValue(GM_KEY_CAR_STATUS_DATA) as CarStatusPayload | undefined);
            if (!data || !data.data) {
                if (payload !== undefined) logWarn('GM 存储中无全量数据');
                return;
            }

            logInfo('全量消费开始', `count=${data.count} hwm=${data.hwm}`);

            // 1) 解压 base64 + gzip
            const store = await gunzipFromBase64<Record<string, any>>(data.data);
            if (!store) {
                logErr('解压失败（DecompressionStream 不可用？数据损坏？）');
                return;
            }

            // 2) 转行式 → 写入本地 IndexedDB
            const records = columnarToFlat(store);
            if (records.length === 0) {
                logWarn('解压后无有效记录');
                return;
            }

            logInfo('解压完成', `${records.length} 条记录`);
            const written = await upsertLocalCars(records);
            logOk('写入本地 IDB', `${written} 条`);

            // 3) 刷新页面标签
            await this.processAll();
        } catch (err: any) {
            logErr('全量消费失败', err.message || String(err));
        } finally {
            isFullConsuming = false;
        }
    }

    /**
     * 全量处理：从本地 IndexedDB 查出所有记录，然后渲染所有页面区域。
     * 来源：missavStatusTag.user.js L797-823 processAll。
     */
    async processAll(): Promise<void> {
        try {
            // 收集页面所有番号
            const allCarNums = new Set<string>();
            const allThumbs = document.querySelectorAll<HTMLElement>('.thumbnail.group');
            for (const thumb of allThumbs) {
                const link = thumb.querySelector<HTMLAnchorElement>('a[alt]');
                if (link) {
                    const cn = link.getAttribute('alt');
                    if (cn) {
                        allCarNums.add(normalizeCarNum(cn));
                    }
                }
            }

            if (allCarNums.size === 0) return;

            const carMap = await queryLocalCars(Array.from(allCarNums));
            if (carMap.size === 0) return;

            this.processPage(carMap);
        } catch (err: any) {
            logErr('处理页面失败', err.message || String(err));
        }
    }

    /**
     * 收集页面所有番号，去重后批量查库，再统一渲染。
     * 来源：missavStatusTag.user.js L606-677 processPage/processVideoPage/processListPage。
     */
    processPage(carMap: Map<string, { status: string; url: string }>): void {
        if (isVideoPage()) {
            this.processVideoPage(carMap);
        } else {
            this.processListPage(carMap);
        }
    }

    /**
     * 处理视频播放页：底部推荐网格 + 侧边推荐列表。
     * 来源：missavStatusTag.user.js L618-663 processVideoPage。
     */
    processVideoPage(carMap: Map<string, { status: string; url: string }>): void {
        const bottomGrid = document.querySelector<HTMLElement>(
            'body > div:nth-child(3) > div.sm\\:container.mx-auto.px-4.content-without-search.pb-12 > div > div.flex-1.order-first > div.relative.overflow-hidden > div.grid.grid-cols-2.md\\:grid-cols-3.xl\\:grid-cols-4.gap-5'
        );
        if (bottomGrid) {
            this.queryAndRender(bottomGrid, carMap.size > 0 ? carMap : null, '视频页-底部推荐');
        }

        const sideContainer = document.querySelector<HTMLElement>(
            'body > div:nth-child(3) > div.sm\\:container.mx-auto.px-4.content-without-search.pb-12 > div > div.hidden.lg\\:flex.h-full.ml-6.order-last > div'
        );
        if (sideContainer) {
            this.queryAndRender(sideContainer, carMap.size > 0 ? carMap : null, '视频页-侧边推荐');
        }
    }

    /**
     * 处理列表页：视频卡片网格。
     * 来源：missavStatusTag.user.js L669-677 processListPage。
     */
    processListPage(carMap: Map<string, { status: string; url: string }>): void {
        this.queryAndRender(document.body, carMap.size > 0 ? carMap : null, '列表页');
    }

    /**
     * 统一的"查询 + 渲染"流程。
     * 来源：missavStatusTag.user.js L688-718 queryAndRender。
     */
    async queryAndRender(
        container: HTMLElement | null,
        existingMap: Map<string, { status: string; url: string }> | null,
        label: string
    ): Promise<void> {
        if (!container) return;

        let map = existingMap;
        if (!map || map.size === 0) {
            const carNums = new Set<string>();
            const thumbs = container.querySelectorAll<HTMLElement>('.thumbnail.group');
            for (const thumb of thumbs) {
                const link = thumb.querySelector<HTMLAnchorElement>('a[alt]');
                if (link) {
                    const cn = link.getAttribute('alt');
                    if (cn) carNums.add(normalizeCarNum(cn));
                }
            }
            if (carNums.size === 0) return;
            map = await queryLocalCars(Array.from(carNums));
        }

        if (!map || map.size === 0) return;

        const { total, matched } = renderBadges(container, map);
        const cumulativeMatched = container.querySelectorAll('.missav-status-tag').length;
        const totalThumbs = container.querySelectorAll('.thumbnail.group').length;
        logInfo(
            '渲染标签',
            `${label}: +${total} 新增, +${matched} 命中 | 累计 ${cumulativeMatched}/${totalThumbs} 个标签`
        );
    }

    /**
     * 使用 MutationObserver 监听 DOM 变化，在 Alpine.js 渲染完成后自动处理。
     * 来源：missavStatusTag.user.js L727-792 observeAndProcess。
     */
    observeAndProcess(): void {
        let retries = 0;
        const maxRetries = 30;
        const tryProcess = (): void => {
            const thumbItems = document.querySelectorAll('.thumbnail.group');
            if (thumbItems.length > 0) {
                this.processAll();
                return;
            }
            retries++;
            if (retries < maxRetries) {
                setTimeout(tryProcess, 500);
            }
        };

        setTimeout(tryProcess, 1500);

        let debounceTimer: ReturnType<typeof setTimeout> | null = null;
        const observer = new MutationObserver((mutations: MutationRecord[]) => {
            let hasNewThumbnails = false;
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType !== Node.ELEMENT_NODE) continue;
                        const el = node as HTMLElement;
                        if (
                            el.matches?.('.thumbnail.group') ||
                            el.querySelector?.('.thumbnail.group')
                        ) {
                            hasNewThumbnails = true;
                            break;
                        }
                    }
                }
                if (
                    mutation.type === 'attributes' &&
                    mutation.attributeName === 'alt' &&
                    (mutation.target as HTMLElement).matches?.('a[alt]') &&
                    (mutation.target as HTMLElement).closest?.('.thumbnail.group')
                ) {
                    hasNewThumbnails = true;
                }
                if (hasNewThumbnails) break;
            }
            if (hasNewThumbnails) {
                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => this.processAll(), 300);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['alt']
        });
    }
}
