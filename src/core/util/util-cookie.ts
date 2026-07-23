/**
 * Cookie 工具（提取自 CommonUtil）。
 */

/** addCookie 选项（原 addCookie 第二参数 t 的解构字段） */
export interface AddCookieOptions {
    maxAge?: number;
    path?: string;
    domain?: string;
    secure?: boolean;
    sameSite?: string;
}

/**
 * 批量写入 cookie（原 addCookie）：按 ";" 拆分多组键值，附加 max-age/path 等。
 * @param cookieStr 形如 "k1=v1; k2=v2" 的 cookie 字符串
 * @param options   maxAge/path/domain/secure/sameSite 选项
 */
export function addCookie(cookieStr: string, options: AddCookieOptions = {}): void {
    const {
        maxAge = 604800,
        path = '/',
        domain = '',
        secure = false,
        sameSite = 'Lax'
    } = options;
    cookieStr.split(';').forEach((pair: string) => {
        const trimmed = pair.trim();
        if (trimmed) {
            const parts = trimmed.split('=');
            if (parts.length >= 2 && parts[0].trim()) {
                const segments: string[] = [`${parts[0].trim()}=${parts.slice(1).join('=')}`];
                if (maxAge > 0) {
                    segments.push(`max-age=${maxAge}`);
                }
                segments.push(`path=${path}`);
                if (domain) {
                    segments.push(`domain=${domain}`);
                }
                if (secure) {
                    segments.push('Secure');
                }
                if (sameSite) {
                    segments.push(`SameSite=${sameSite}`);
                }
                document.cookie = segments.join('; ');
            }
        }
    });
}
