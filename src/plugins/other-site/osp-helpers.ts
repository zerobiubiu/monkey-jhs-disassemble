/**
 * 判断预加载缓存条目是否仍在有效期内（配合设置项 preloadCacheTTL）。
 * - entry 缺失 → 无效
 * - TTL=0（永不过期）→ 有效
 * - 旧条目无 ts（向后兼容）→ 有效
 * - 有 ts 且未过期 → 有效；已过期 → 无效（触发重新预加载）
 */
export function isCacheEntryValid(entry: unknown, preloadCacheTTLDays: number): boolean {
    if (!entry) return false;
    if (!preloadCacheTTLDays) return true;
    const ts = (entry as { ts?: number }).ts;
    if (!ts) return true;
    return Date.now() - ts < preloadCacheTTLDays * 86400000;
}

/**
 * 构造浏览器导航级请求头，用于绕过 Cloudflare 对 GM_xmlhttpRequest 裸请求的 403 拦截。
 *
 * GM_xmlhttpRequest 默认不携带 Sec-Fetch / Referer 等导航头，Cloudflare 会将其
 * 判定为机器人请求并返回 403。此函数生成与浏览器地址栏直接访问一致的请求头，
 * 关键是 `Sec-Fetch-Site: same-origin` + `Referer: <origin>/`，使 Cloudflare
 * 认为请求来自目标站点内部的正常导航。
 *
 * @param baseUrl 目标站点基址（如 https://missav.ws/cn），用于提取 origin 填充 Referer。
 * @returns 浏览器导航风格的请求头 Record。
 */
export function buildBrowserNavHeaders(baseUrl: string): Record<string, string> {
    let origin: string;
    try {
        origin = new URL(baseUrl).origin;
    } catch {
        origin = baseUrl.replace(/\/[^/]*$/, '');
    }
    return {
        'Accept':
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Referer': origin + '/',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
    };
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
