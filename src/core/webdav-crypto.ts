/**
 * WebDav 凭据加密/解密辅助（提取自 archetype/jhs.user.js L10563-10581 / legacy L450-470）
 *
 * 用固定 salt 对称位移码点（+5/-5）做轻度混淆，存放 WebDav 授权串到 storage。
 * 非安全加密，仅用于避免明文。setting-plugin 通过 userscript 沙箱
 * `(window as any).encryptCredential/.decryptCredential` 访问。
 */

/** 加密 salt，作为密文前后缀。 */
const WEBDAV_SALT = 'x7k9p3';

/**
 * 加密：salt 前后包裹后，每个码点 +5。
 *
 * @param value 原始字符串
 * @returns 混淆后的字符串
 */
export function encryptCredential(value: string): string {
    return (WEBDAV_SALT + value + WEBDAV_SALT)
        .split('')
        .map((ch) => {
            const code = ch.codePointAt(0)!;
            return String.fromCodePoint(code + 5);
        })
        .join('');
}

/**
 * 解密：每个码点 -5 后，去掉前后 salt。
 *
 * @param value 混淆后的字符串
 * @returns 原始字符串
 */
export function decryptCredential(value: string): string {
    return value
        .split('')
        .map((ch) => {
            const code = ch.codePointAt(0)!;
            return String.fromCodePoint(code - 5);
        })
        .join('')
        .slice(WEBDAV_SALT.length, -WEBDAV_SALT.length);
}
