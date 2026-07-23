/** 预加载缓存最大条目数（超出时淘汰最旧的）。 */
export const PRELOAD_CACHE_MAX = 5000;

/**
 * LRU 淘汰：缓存条目超过上限时按 ts 排序删除最旧的。
 * 没有 ts 的旧格式条目优先淘汰。仅在写入缓存时调用。
 */
export function evictStaleCache(cache: Record<string, any>): void {
    const keys = Object.keys(cache);
    if (keys.length > PRELOAD_CACHE_MAX) {
        const sorted = keys
            .filter((k) => cache[k] && cache[k].ts)
            .sort((a, b) => (cache[a].ts || 0) - (cache[b].ts || 0));
        // 没有 ts 的旧格式条目优先淘汰
        const noTs = keys.filter((k) => !cache[k] || !cache[k].ts);
        const toRemove = [...noTs, ...sorted].slice(0, keys.length - PRELOAD_CACHE_MAX);
        for (const k of toRemove) {
            delete cache[k];
        }
    }
}

/**
 * 判断预加载缓存条目是否仍在有效期内（配合设置项 preloadCacheTTL）。
 * - entry 缺失 → 无效
 * - TTL=0（永不过期）→ 有效
 * - 旧条目无 ts（向后兼容）→ 有效
 * - 有 ts 且未过期 → 有效；已过期 → 无效（触发重新预加载）
 */
export function isCacheEntryValid(entry: any, preloadCacheTTLDays: number): boolean {
    if (!entry) return false;
    if (!preloadCacheTTLDays) return true;
    if (!entry.ts) return true;
    return Date.now() - entry.ts < preloadCacheTTLDays * 86400000;
}

/**
 * 读取单个 .item 的预加载状态（供筛选计数/过滤用）。
 * @returns 状态值（queued/requesting/success/failed）；无徽标返回 'none'。
 */
export function getItemPreloadStatus(item: Element): string {
    const badge = item.querySelector('.jhs-preload-status .jhs-ps-badge');
    if (!badge) return 'none';
    for (const key of ['queued', 'requesting', 'success', 'failed']) {
        if (badge.classList.contains(`jhs-ps-${key}`)) return key;
    }
    return 'none';
}
