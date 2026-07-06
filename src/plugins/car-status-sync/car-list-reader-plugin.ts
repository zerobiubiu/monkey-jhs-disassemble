/**
 * CarListReaderPlugin —— javdb 端车辆状态同步插件。
 *
 * 来源：archetype/jhsCarListReader.user.js（1320 行）。
 * 原架构读取 JAV-JHS IndexedDB 的 car_list，转列存 gzip 后 POST 到后端服务器。
 * 现改为两层同步机制：
 *
 * 1. 增量推送（实时）：storageManager 的写方法（saveCar/removeCar 等）内部
 *    触发 carListChangeCallback，本插件注入回调后立即 GM_setValue 推送单条/
 *    批量变更到 missav 端。载荷几十字节，不压缩，毫秒级到达。
 *
 * 2. 全量同步（兜底）：页面加载时延迟 2s 执行全量同步（读 car_list → 列存
 *    → gzip+base64 → GM_setValue）。保证 missav 端离线后上线的数据一致性。
 *
 * 核心原理：集成后 javdb 和 missav 运行的是同一个 userscript，
 * GM 存储在同一脚本的所有实例间共享，GM_addValueChangeListener
 * 的 remote=true 表示变更来自其他标签页/域名实例。
 */

import { BasePlugin } from '../base-plugin';
import {
    GM_KEY_CAR_STATUS_DATA,
    GM_KEY_CAR_STATUS_DELTA,
    LOG_PREFIX_JHS,
    type CarStatusPayload,
    type CarStatusDeltaPayload
} from './car-status-config';
import { toColumnar, gzipToBase64, countColumnar, normalizeUrl } from './car-status-columnar';

/** 日志辅助。 */
function logInfo(step: string, ...args: any[]): void {
    console.log(
        `%c${LOG_PREFIX_JHS} %c${step}`,
        'color:#25b1dc;font-weight:bold;',
        'color:inherit;font-weight:bold;',
        ...args
    );
}
function logOk(step: string, ...args: any[]): void {
    console.log(
        `%c${LOG_PREFIX_JHS} ✓ %c${step}`,
        'color:#1f7a3d;font-weight:bold;',
        'color:inherit;font-weight:bold;',
        ...args
    );
}
function logWarn(step: string, ...args: any[]): void {
    console.warn(`%c${LOG_PREFIX_JHS} ⚠ ${step}`, 'color:#d7a80c;font-weight:bold;', ...args);
}
function logErr(step: string, ...args: any[]): void {
    console.error(`%c${LOG_PREFIX_JHS} ✗ ${step}`, 'color:#de3333;font-weight:bold;', ...args);
}

/** 全量同步锁，防止并发触发。 */
let isFullSyncing = false;

export class CarListReaderPlugin extends BasePlugin {
    getName(): string {
        return 'CarListReaderPlugin';
    }

    async initCss(): Promise<string> {
        return '';
    }

    async handle(): Promise<void> {
        // 跳过 iframe 内的重复触发
        if (window.self !== window.top) return;

        // 注册菜单命令
        try {
            GM_registerMenuCommand('🔁 全量同步车辆状态到 missav', () => {
                this.syncFullCarStatus();
            });
        } catch {
            /* 某些环境不支持 GM_registerMenuCommand */
        }

        // 注入增量回调：storageManager 每次 saveCar/removeCar 等操作后实时触发
        storageManager.setCarListChangeCallback(
            (event: { action: 'upsert' | 'delete'; upserts?: any[]; deletes?: string[] }) => {
                this.pushDelta(event);
            }
        );

        // 页面加载后延迟 2s 执行全量同步（等 jhs 初始化完成 + storageManager 数据就绪）
        setTimeout(() => this.syncFullCarStatus(), 2000);
    }

    /**
     * 增量推送：将单条/批量变更推送到 GM 存储。
     * 不压缩（几条记录几十字节），不锁（处理极快），不冷却（实时）。
     * @param event storageManager 的变更事件
     */
    pushDelta(event: { action: 'upsert' | 'delete'; upserts?: any[]; deletes?: string[] }): void {
        try {
            if (event.action === 'upsert' && event.upserts) {
                // 将完整 CarRecord 转为 missav 端需要的格式（url 转为 url_path 节省体积）
                const items = event.upserts.map((car) => {
                    const { code } = normalizeUrl(car.url || '');
                    return {
                        carNum: car.carNum,
                        status: car.status,
                        url_path: code
                    };
                });
                const payload: CarStatusDeltaPayload = {
                    action: 'upsert',
                    items,
                    ts: Date.now()
                };
                GM_setValue(GM_KEY_CAR_STATUS_DELTA, payload);
                logInfo('增量推送', `upsert ${items.length} 条`);
            } else if (event.action === 'delete' && event.deletes) {
                const payload: CarStatusDeltaPayload = {
                    action: 'delete',
                    items: event.deletes.map((carNum) => ({ carNum })),
                    ts: Date.now()
                };
                GM_setValue(GM_KEY_CAR_STATUS_DELTA, payload);
                logInfo('增量推送', `delete ${event.deletes.length} 条`);
            }
        } catch (err: any) {
            logErr('增量推送失败', err.message || String(err));
        }
    }

    /**
     * 全量同步：读 car_list → 转列存 → gzip → 写 GM 存储。
     * 页面加载时执行一次（延迟 2s），或菜单手动触发。
     * 不设冷却期（本地操作无瓶颈），但有 isFullSyncing 锁防并发。
     */
    async syncFullCarStatus(): Promise<void> {
        if (isFullSyncing) {
            logWarn('全量同步任务在进行中，跳过');
            return;
        }
        isFullSyncing = true;

        try {
            logInfo('全量同步开始');

            // 1) 读取本地 car_list
            const carList = await storageManager.getCarList();
            logInfo('1-读取', `本地 car_list 记录数：${carList.length}`);

            if (carList.length === 0) {
                logWarn('car_list 为空，跳过同步（jhs 可能尚未写入数据）');
                return;
            }

            // 2) 转列存格式
            const colRes = toColumnar(carList);
            const count = countColumnar(colRes.byStatus);
            logInfo(
                '2-转列存',
                `列存 ${count} 条 / 丢弃 ${colRes.dropped} / url 异常 ${colRes.malformed}`
            );

            if (count === 0) {
                logWarn('列存后无有效记录，跳过');
                return;
            }

            // 3) gzip + base64 压缩
            const base64 = await gzipToBase64(colRes.byStatus);
            if (!base64) {
                logErr('gzip 压缩失败（CompressionStream 不可用？非 https 环境？）');
                return;
            }
            logInfo('3-压缩', `gzip+base64 体积：约 ${(base64.length / 1024).toFixed(1)} KB`);

            // 4) 写入 GM 存储（触发 missav 端 GM_addValueChangeListener）
            const payload: CarStatusPayload = {
                data: base64,
                hwm: new Date().toISOString(),
                count,
                ts: Date.now()
            };
            GM_setValue(GM_KEY_CAR_STATUS_DATA, payload);

            logOk('4-完成', `已写入 GM 存储，count=${count}，hwm=${payload.hwm}`);
        } catch (err: any) {
            logErr('全量同步失败', err.message || String(err), err);
        } finally {
            isFullSyncing = false;
        }
    }
}
