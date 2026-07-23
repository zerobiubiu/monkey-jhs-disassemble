/**
 * 备份加密模块 V2 — AES-GCM + PBKDF2-SHA-256。
 *
 * 替代原 Caesar 位移混淆（webdav-crypto.ts），提供真正的加密保护。
 * 旧格式（V1）仅保留导入兼容，新导出统一使用 V2。
 *
 * BackupEnvelopeV2 格式：
 * {
 *   "v": 2,
 *   "alg": "AES-GCM",
 *   "kdf": "PBKDF2-SHA-256",
 *   "iter": 100000,
 *   "salt": "<base64 16 bytes>",
 *   "iv": "<base64 12 bytes>",
 *   "ct": "<base64 ciphertext>",
 *   "ts": "<ISO 8601 创建时间>"
 * }
 */

const PBKDF2_ITERATIONS = 100000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

/** V2 备份信封格式。 */
export interface BackupEnvelopeV2 {
    v: 2;
    alg: 'AES-GCM';
    kdf: 'PBKDF2-SHA-256';
    iter: number;
    salt: string;
    iv: string;
    ct: string;
    ts: string;
}

/** 从 base64 字符串解码为 Uint8Array。 */
function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/** 将 Uint8Array 编码为 base64 字符串。 */
function bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/** 从口令派生 AES-GCM 密钥。 */
async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
    );
    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt,
            iterations: PBKDF2_ITERATIONS,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

/**
 * 使用 AES-GCM 加密备份数据。
 * @param plaintext 备份 JSON 字符串
 * @param password  用户口令
 * @returns V2 信封 JSON 字符串
 */
export async function encryptBackupV2(plaintext: string, password: string): Promise<string> {
    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const key = await deriveKey(password, salt);
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encoder.encode(plaintext)
    );
    const envelope: BackupEnvelopeV2 = {
        v: 2,
        alg: 'AES-GCM',
        kdf: 'PBKDF2-SHA-256',
        iter: PBKDF2_ITERATIONS,
        salt: bytesToBase64(salt),
        iv: bytesToBase64(iv),
        ct: bytesToBase64(new Uint8Array(ciphertext)),
        ts: new Date().toISOString()
    };
    return JSON.stringify(envelope);
}

/**
 * 使用 AES-GCM 解密备份数据。
 * @param envelopeJson V2 信封 JSON 字符串
 * @param password     用户口令
 * @returns 解密后的备份 JSON 字符串
 * @throws 口令错误或数据被篡改时抛出 DOMException (OperationError)
 */
export async function decryptBackupV2(envelopeJson: string, password: string): Promise<string> {
    const envelope: BackupEnvelopeV2 = JSON.parse(envelopeJson);
    if (envelope.v !== 2) {
        throw new Error(`不支持的备份格式版本: ${envelope.v}`);
    }
    const salt = base64ToBytes(envelope.salt);
    const iv = base64ToBytes(envelope.iv);
    const ct = base64ToBytes(envelope.ct);
    const key = await deriveKey(password, salt);
    const plainBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ct
    );
    return new TextDecoder().decode(plainBuffer);
}

/** 判断备份内容是否为 V2 格式。 */
export function isBackupV2(content: string): boolean {
    try {
        const parsed = JSON.parse(content);
        return parsed && parsed.v === 2 && parsed.alg === 'AES-GCM';
    } catch {
        return false;
    }
}
