/**
 * 预加载优先级排序 —— 带状态标签（已读/已收藏）的卡片降为最低优先级。
 *
 * 需求（doc/25 Q3）：列表页预加载应当**先跑没有状态标签的卡片**，
 * 已读/已收藏的卡片排到队列末尾 —— 它们多半已被用户处理过，预热价值最低。
 *
 * 判定依据是 `car_list`（由调用方传入番号集合），而不是 DOM 上是否已渲染标签：
 * 标签可能尚未（补）渲染，按 DOM 判断会漏掉应当降级的卡片。
 *
 * **纯函数**：不读写 DOM / 存储。
 */

/**
 * 按预加载优先级重排卡片：常规卡片保持原序在前，带状态标签的卡片保持原序在后。
 *
 * 番号取不到（空串）的卡片按**常规**优先级处理 —— 降级只会让它们更晚被处理，
 * 而解析失败不代表它已被用户标记过。
 *
 * @param items 当前页卡片（DOM 顺序）
 * @param statedCarNums 已读/已收藏的番号集合（小写化）
 * @param getCarNum 取卡片番号的函数（返回原样文本；内部小写化比较）
 * @returns 重排后的卡片数组（无降级卡片时返回原数组）
 */
export function orderItemsByPreloadPriority(
    items: HTMLElement[],
    statedCarNums: ReadonlySet<string>,
    getCarNum: (item: HTMLElement) => string
): HTMLElement[] {
    if (statedCarNums.size === 0) {
        return items;
    }
    const normal: HTMLElement[] = [];
    const stated: HTMLElement[] = [];
    for (const item of items) {
        const carNum = (getCarNum(item) || '').trim().toLowerCase();
        if (carNum && statedCarNums.has(carNum)) {
            stated.push(item);
        } else {
            normal.push(item);
        }
    }
    return stated.length > 0 ? [...normal, ...stated] : items;
}
