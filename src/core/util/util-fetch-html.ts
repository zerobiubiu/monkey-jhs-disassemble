/**
 * 同源页面 HTML 抓取 —— 共享工具（doc/236）。
 *
 * 背景：GM_xmlhttpRequest 缺少 sec-ch-ua / sec-fetch-* 等浏览器指纹头，javdb
 * 的 Cloudflare 会按「非浏览器请求」返回 403 + Managed Challenge（"Just a
 * moment..."），而页面上下文 fetch（同源 + credentials: include）携带浏览器
 * 指纹与 Cookie 可正常通过。瀑布流等 javdb 同源页面抓取统一改用本工具，
 * 替代 gmHttp.get / 裸 GM_xmlhttpRequest。
 *
 * 提取自 video-lists-tag/vlt-reconcile.ts 的局部 fetchHtmlDocument（行为一致：
 * 3 次重试仅覆盖 429/502/503/504，验证页/登录页兜底抛错）。
 */

/**
 * 抓取 javdb 同源页面并返回原始 HTML。
 * 自动处理：429/502/503/504 带退避重试（最多 3 次）、HTTP 非 2xx 抛错、
 * Cloudflare 验证页 / 登录页检测抛错。
 * @param url 同源页面 URL（相对或绝对）
 * @returns 页面 HTML 文本
 * @throws 非 2xx、重试耗尽、验证页/登录页替代时抛出
 */
export async function fetchJavdbPageHtml(url: string): Promise<string> {
    let response: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
        response = await fetch(url, {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store',
            headers: { Accept: 'text/html,application/xhtml+xml' }
        });
        if (response.ok) break;
        if (![429, 502, 503, 504].includes(response.status) || attempt === 2) {
            throw new Error(`页面请求失败：HTTP ${response.status}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
    if (!response?.ok) throw new Error('页面请求失败');

    const html = await response.text();
    const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    if (
        !html.includes('<body') ||
        title.includes('cloudflare') ||
        title.includes('just a moment') ||
        /<form[^>]*action=["'][^"']*sign_in/i.test(html)
    ) {
        throw new Error('页面被登录页或人机验证页替代');
    }
    return html;
}