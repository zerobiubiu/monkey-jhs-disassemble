/**
 * simple_lists 分页获取共享基础设施。
 * 从 dpb-list-panel-fetch.ts 与 vlt-server-api.ts 提取的公共单页 fetch+parse 逻辑。
 * 仅做单页请求与解析，不含循环与错误决策（throw-vs-null 由调用方决定）。
 */

const SIMPLE_LISTS_PAGE_TIMEOUT_MS = 10000;

/** 单页 simple_lists 响应解析结果。 */
export interface SimpleListsPage {
    /** 清单条目 HTML 片段（payload.lists 原始字符串）。 */
    entries: string;
    /** 经验证的下一页 URL（含 vid 参数），无下一页时为 null。 */
    nextUrl: string | null;
}

/**
 * 获取并解析单页 simple_lists 数据。
 * @param url 请求地址（已含 vid 参数）
 * @param vid 视频 ID（设置到下一页 URL 的 searchParam）
 * @returns 解析后的清单 HTML 片段与下一页 URL
 * @throws 网络失败、HTTP 非 2xx、响应格式异常、下一页地址非法时抛出
 */
export async function fetchSimpleListsPage(url: string, vid?: string): Promise<SimpleListsPage> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), SIMPLE_LISTS_PAGE_TIMEOUT_MS);
    try {
        const response = await fetch(url, {
            credentials: 'same-origin',
            cache: 'no-store',
            headers: { Accept: 'application/json' },
            signal: controller.signal
        });
        if (!response.ok) {
            throw new Error(`清单分页请求失败：HTTP ${response.status}`);
        }
        const payload = (await response.json()) as { lists?: unknown; page?: unknown };
        if (typeof payload.lists !== 'string') throw new Error('清单分页响应格式异常');

        const pageHtml = typeof payload.page === 'string' ? payload.page : '';
        const pageDocument = new DOMParser().parseFromString(pageHtml, 'text/html');
        const nextHref = pageDocument.querySelector('a[rel="next"]')?.getAttribute('href');
        if (!nextHref) {
            return { entries: payload.lists, nextUrl: null };
        }
        const nextUrl: URL = new URL(nextHref, url);
        if (
            nextUrl.origin !== window.location.origin ||
            nextUrl.pathname !== '/users/simple_lists'
        ) {
            throw new Error('清单下一页地址异常');
        }
        if (vid) nextUrl.searchParams.set('vid', vid);
        return { entries: payload.lists, nextUrl: nextUrl.href };
    } finally {
        window.clearTimeout(timeout);
    }
}
