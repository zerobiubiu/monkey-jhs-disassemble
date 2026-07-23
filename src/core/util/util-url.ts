/**
 * URL 工具（提取自 CommonUtil）。
 * 纯函数 / window API，无实例状态依赖。
 */

/**
 * 判断字符串是否为合法 URL（原 isUrl）。
 * @param str 待检测字符串
 * @returns 可被 new URL 解析则 true
 */
export function isUrl(str: string): boolean {
    try {
        new URL(str);
        return true;
    } catch {
        return false;
    }
}

/**
 * 在当前地址上设置/更新查询参数并 pushState（原 setHrefParam）。
 * @param key   参数名
 * @param value 参数值
 */
export function setHrefParam(key: string, value: string): void {
    const url = new URL(window.location.href);
    url.searchParams.set(key, value);
    window.history.pushState({}, '', url.toString());
}

/**
 * 从 URL 字符串中提取指定查询参数（原 getUrlParam）。
 * @param url   含查询串的 URL
 * @param param 参数名
 * @returns 解析值：布尔 / 数字 / 字符串；无查询或无匹配返回 null/空串
 */
export function getUrlParam(url: string, param: string): string | number | boolean | null {
    const query = url.split('?')[1];
    if (!query) {
        return null;
    }
    const regex = new RegExp(`(?:^|&)${param}=([^&]*)`);
    const match = query.match(regex);
    let value = '';
    if (match && match[1]) {
        value = decodeURIComponent(match[1].replace(/\+/g, ' '));
    }
    if (value) {
        if (value === 'true' || value === 'false') {
            return value.toLowerCase() === 'true';
        } else if (typeof value !== 'string' || value.trim() === '' || isNaN(Number(value))) {
            return value;
        } else {
            return Number(value);
        }
    } else {
        return value;
    }
}
