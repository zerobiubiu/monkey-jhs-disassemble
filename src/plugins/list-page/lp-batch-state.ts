/**
 * 列表页批量操作 —— 选择集与写入计划（纯逻辑，doc/27）。
 *
 * 拆成两层便于单测：
 * - `BatchSelection`：勾选状态（番号集合），工具栏与卡片勾选框共用；
 * - `planXxxBatch`：给定勾选番号、卡片信息与 car_list 现状，算出**要写入的记录**与
 *   **跳过的番号**（不直接落库，便于把「为什么跳过」讲清楚并单测）。
 *
 * 写入一律复用既有存储 API（`saveCarList` / `clearCarWatchStatus`），
 * 不做迁移、不删记录 —— 「取消已读」只清 status，保留 url/names/remark/score 等字段。
 */

import { FAVORITE_ACTION, HAS_WATCH_ACTION } from '../../constants/status';

import type { CarSaveInput } from '../../core/storage/car-list-ops';

/** 列表卡片上可供批量写入的信息（由 lp-dom 的 findCarNumAndHref + 演员名解析得到）。 */
export interface BatchItemInfo {
    /** 番号（原始大小写）。 */
    carNum: string;
    /** 详情页 url（相对或绝对；存储层会补全为绝对地址）。 */
    url: string;
    /** 女演员名（可选，仅新记录写入）。 */
    names?: string;
    /** 发布日期（可选）。 */
    publishTime?: string;
}

/** 批量操作类型。 */
export type BatchActionKind = 'favorite' | 'watched' | 'unwatch';

/** 写入计划结果。 */
export interface BatchPlan {
    /** 待写入的记录（交给 saveCarList）。 */
    inputs: CarSaveInput[];
    /** 已处于目标状态、无需重复写入的番号。 */
    skipped: string[];
    /** 页面上找不到卡片信息（无法取得 url）的番号。 */
    missing: string[];
}

/** 勾选状态（番号集合）。大小写按原样保存，比较时统一小写。 */
export class BatchSelection {
    private readonly selected = new Set<string>();

    /** 番号归一化键。 */
    private static key(carNum: string): string {
        return carNum.trim().toLowerCase();
    }

    /** 切换勾选。@returns 切换后的选中状态 */
    toggle(carNum: string): boolean {
        const key = BatchSelection.key(carNum);
        if (this.selected.has(key)) {
            this.selected.delete(key);
            return false;
        }
        this.selected.add(key);
        return true;
    }

    /** 是否已勾选。 */
    has(carNum: string): boolean {
        return this.selected.has(BatchSelection.key(carNum));
    }

    /** 清空选择。 */
    clear(): void {
        this.selected.clear();
    }

    /** 勾选数量。 */
    get size(): number {
        return this.selected.size;
    }

    /** 勾选番号列表（归一化小写键）。 */
    list(): string[] {
        return [...this.selected];
    }
    /**
     * 选中给定番号（并集，用于「全选」）。
     * @param carNums 番号列表
     */
    addAll(carNums: string[]): void {
        for (const carNum of carNums) this.selected.add(BatchSelection.key(carNum));
    }

    /**
     * 反选给定番号：集合内已选→取消、未选→选中；集合外的选择保持不动。
     * @param carNums 番号列表
     */
    invert(carNums: string[]): void {
        for (const carNum of carNums) {
            const key = BatchSelection.key(carNum);
            if (this.selected.has(key)) this.selected.delete(key);
            else this.selected.add(key);
        }
    }
}

/**
 * 收藏批量计划：已在收藏列表的番号跳过（存储层对重复收藏会抛错）。
 *
 * @param selectedCarNums 勾选番号（原始大小写）
 * @param infoByCarNum 番号 → 卡片信息
 * @param favoriteCarNums 已在收藏列表的番号
 */
export function planFavoriteBatch(
    selectedCarNums: string[],
    infoByCarNum: Map<string, BatchItemInfo>,
    favoriteCarNums: Iterable<string>
): BatchPlan {
    const favorites = new Set([...favoriteCarNums].map((n) => n.trim().toLowerCase()));
    return buildPlan(selectedCarNums, infoByCarNum, (carNumKey) => favorites.has(carNumKey), () => ({
        actionType: FAVORITE_ACTION
    }));
}

/**
 * 已读批量计划：写入 status = 已读 + 指定星级（0–5）。
 *
 * 存储层对「重复已读」不抛错，因此已在已读列表的番号**照常写入**（用于改星）。
 *
 * @param selectedCarNums 勾选番号
 * @param infoByCarNum 番号 → 卡片信息
 * @param score 星级（0–5，0 表示未评分）
 */
export function planWatchedBatch(
    selectedCarNums: string[],
    infoByCarNum: Map<string, BatchItemInfo>,
    score: number
): BatchPlan {
    return buildPlan(selectedCarNums, infoByCarNum, () => false, () => ({
        actionType: HAS_WATCH_ACTION,
        score
    }));
}

/**
 * 取消已读计划：只对**当前确为已读**的番号生效（不会误清收藏状态）。
 *
 * @param selectedCarNums 勾选番号
 * @param watchedCarNums 当前 status === 已读 的番号
 * @returns 需要清除已读状态的番号 + 跳过的番号
 */
export function planUnwatchBatch(
    selectedCarNums: string[],
    watchedCarNums: Iterable<string>
): { carNums: string[]; skipped: string[] } {
    const watched = new Set([...watchedCarNums].map((n) => n.trim().toLowerCase()));
    const carNums: string[] = [];
    const skipped: string[] = [];
    for (const carNum of selectedCarNums) {
        (watched.has(carNum.trim().toLowerCase()) ? carNums : skipped).push(carNum);
    }
    return { carNums, skipped };
}

/** 收藏 / 已读共用的计划构造：缺卡片信息 → missing，命中 skip 条件 → skipped。 */
function buildPlan(
    selectedCarNums: string[],
    infoByCarNum: Map<string, BatchItemInfo>,
    shouldSkip: (carNumKey: string) => boolean,
    extra: () => Partial<CarSaveInput>
): BatchPlan {
    const inputs: CarSaveInput[] = [];
    const skipped: string[] = [];
    const missing: string[] = [];
    for (const carNum of selectedCarNums) {
        const key = carNum.trim().toLowerCase();
        const info = infoByCarNum.get(key);
        if (!info) {
            missing.push(carNum);
            continue;
        }
        if (shouldSkip(key)) {
            skipped.push(carNum);
            continue;
        }
        inputs.push({
            carNum: info.carNum,
            url: info.url,
            ...(info.names ? { names: info.names } : {}),
            ...(info.publishTime ? { publishTime: info.publishTime } : {}),
            ...extra()
        });
    }
    return { inputs, skipped, missing };
}
