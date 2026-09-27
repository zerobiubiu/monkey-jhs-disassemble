/**
 * 评分持久化 —— 把「抓取到的 JavDB 个人评分」落进 `car_list`（doc/29）。
 *
 * 背景：`RatingCache` 是抓取缓存（虽也随备份，但语义上是缓存）；
 * 真正**可备份的用户数据**是 IDB `JAV-JHS/appData/car_list` 里的 `CarRecord.score`
 * （`storageManager.exportData()` 全量导出 + localStorage/GM 白名单共同构成备份）。
 * 本模块在评分被抓到后把它写进 `car_list`，使评分成为持久数据。
 *
 * 判定原则（**只补空缺**）：
 * - 无 car_list 记录 → **不新建**（不替用户扩写记录）；
 * - 状态不是「已读」→ 不写（评分只对已读有意义）；
 * - 记录**已有 score**（含主动打的 0 星）→ 不覆盖（尊重用户在本脚本的记录）；
 * - 其余情况才写入抓到的 1–5 分。
 *
 * 幂等：写入后 car_list 就有 score 了，后续监听回调会走 `has-score` 分支。
 */

import { HAS_WATCH_ACTION } from '../../constants/status';

import { RatingCache } from './rating-cache';
import { RatingUtils } from './rating-utils';

/** 日志前缀（与 rating-display 其它模块一致）。 */
const LOG_PREFIX = '[JHS-Rating]';

/** 持久化判定结果。 */
export type RatingPersistDecision = 'write' | 'no-record' | 'not-watched' | 'has-score' | 'invalid-rating';

/**
 * 判定是否应把评分写进 car_list（**纯函数**，便于单测）。
 *
 * @param car car_list 中的记录（可缺省）
 * @param rating 抓到的评分（应为 1–5）
 * @returns 判定结果
 */
export function decideRatingPersist(
    car: { status?: unknown; score?: unknown } | undefined | null,
    rating: number
): RatingPersistDecision {
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) return 'invalid-rating';
    if (!car) return 'no-record';
    if (car.status !== HAS_WATCH_ACTION) return 'not-watched';
    if (typeof car.score === 'number' && Number.isFinite(car.score)) return 'has-score';
    return 'write';
}

/**
 * 把某番号的评分持久化进 `car_list`（仅补空缺，见文件头判定原则）。
 *
 * @param code 规范化番号（`RatingCache` 的键，大小写不敏感匹配 car_list）
 * @param rating 评分（1–5）
 * @returns 是否实际写入
 */
export async function persistRating(code: string, rating: number): Promise<boolean> {
    if (!code) return false;
    try {
        const list = await storageManager.getCarList();
        const car = list.find((item) => RatingUtils.normalizeCode(item.carNum) === code);
        const decision = decideRatingPersist(car, rating);
        if (decision !== 'write' || !car) return false;

        await storageManager.saveCar({
            carNum: car.carNum,
            url: car.url,
            names: car.names,
            publishTime: car.publishTime,
            actionType: HAS_WATCH_ACTION,
            score: rating
        });
        console.log(`${LOG_PREFIX} 评分已持久化到 car_list: ${car.carNum} = ${rating} 星`);
        return true;
    } catch (error: unknown) {
        console.error(
            `${LOG_PREFIX} 评分持久化失败: ` + (error instanceof Error ? error.message : String(error))
        );
        return false;
    }
}

/** 是否已绑定（避免重复注册监听）。 */
let bound = false;

/**
 * 绑定评分持久化：`RatingCache` 每次成功写入新评分（抓取成功 / 同步回写）时尝试落库。
 *
 * 说明：`RatingDisplayPlugin` 移植自用户脚本，未接管 supervisor 生命周期
 * （其 document 级监听同样不注销），故本绑定与页面同生命周期。
 */
export function bindRatingPersistence(): void {
    if (bound) return;
    bound = true;
    RatingCache.addChangeListener((code: string, rating: number) => {
        persistRating(code, rating).then();
    });
}
