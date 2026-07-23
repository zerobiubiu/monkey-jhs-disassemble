/**
 * BackupEnvelopeV2 加密回归测试 —— 保护 doc/137 加密备份升级。
 *
 * 断言 AES-GCM + PBKDF2-SHA-256 信封的契约：
 * 1. 正确口令下 encrypt→decrypt 往返恒等。
 * 2. 错误口令 / 篡改密文 解密必抛错（认证标签失败）。
 * 3. 信封结构合规（v=2 / alg / kdf / iter=100000 / salt 16B / iv 12B / ts ISO）。
 * 4. 同明文两次加密结果不同（独立随机 salt+IV）。
 * 5. isBackupV2 格式判别正确。
 *
 * environment: node —— Node 18+ 全局提供 crypto.subtle / atob / btoa。
 */
import { describe, expect, it } from 'vitest';
import {
    decryptBackupV2,
    encryptBackupV2,
    isBackupV2,
    type BackupEnvelopeV2
} from '../src/core/backup-crypto';

const PLAIN = JSON.stringify({
    car_list: [{ starId: '1', names: ['A'], status: 1 }],
    blacklist: [{ starId: '2', role: 'actor' }]
});
const PASSWORD = 'correct-horse-battery-staple';

describe('BackupEnvelopeV2 往返', () => {
    it('正确口令下 encrypt→decrypt 还原明文', async () => {
        const envelope = await encryptBackupV2(PLAIN, PASSWORD);
        const decrypted = await decryptBackupV2(envelope, PASSWORD);
        expect(decrypted).toBe(PLAIN);
    });

    it('同明文两次加密产生不同信封（独立 salt/IV）', async () => {
        const a = await encryptBackupV2(PLAIN, PASSWORD);
        const b = await encryptBackupV2(PLAIN, PASSWORD);
        expect(a).not.toBe(b);
    });
});

describe('BackupEnvelopeV2 信封结构', () => {
    it('包含 doc/137 规定的全部字段且取值合规', async () => {
        const envelope = await encryptBackupV2(PLAIN, PASSWORD);
        const env: BackupEnvelopeV2 = JSON.parse(envelope);
        expect(env.v).toBe(2);
        expect(env.alg).toBe('AES-GCM');
        expect(env.kdf).toBe('PBKDF2-SHA-256');
        expect(env.iter).toBe(100000);
        // salt 16 字节 / iv 12 字节（base64 解码长度）
        expect(atob(env.salt).length).toBe(16);
        expect(atob(env.iv).length).toBe(12);
        expect(typeof env.ct).toBe('string');
        expect(env.ct.length).toBeGreaterThan(0);
        // ts 为合法 ISO 8601
        expect(Number.isNaN(Date.parse(env.ts))).toBe(false);
    });
});

describe('BackupEnvelopeV2 失败路径', () => {
    it('错误口令解密抛错（认证标签失败）', async () => {
        const envelope = await encryptBackupV2(PLAIN, PASSWORD);
        await expect(decryptBackupV2(envelope, 'wrong-password')).rejects.toThrow();
    });

    it('篡改密文解密抛错', async () => {
        const envelope = await encryptBackupV2(PLAIN, PASSWORD);
        const env: BackupEnvelopeV2 = JSON.parse(envelope);
        // 翻转密文 base64 的首字符，破坏认证标签
        const ct = env.ct;
        env.ct = (ct[0] === 'A' ? 'B' : 'A') + ct.slice(1);
        await expect(decryptBackupV2(JSON.stringify(env), PASSWORD)).rejects.toThrow();
    });

    it('不支持的版本号抛错', async () => {
        const bad = JSON.stringify({ v: 1, alg: 'AES-GCM', kdf: 'x', iter: 1, salt: '', iv: '', ct: '', ts: '' });
        await expect(decryptBackupV2(bad, PASSWORD)).rejects.toThrow(/不支持的备份格式版本/);
    });
});

describe('isBackupV2 判别', () => {
    it('V2 信封判为 true', async () => {
        const envelope = await encryptBackupV2(PLAIN, PASSWORD);
        expect(isBackupV2(envelope)).toBe(true);
    });

    it('非 JSON / 旧版本 / 缺 alg 判为 false', () => {
        expect(isBackupV2('not json at all')).toBe(false);
        expect(isBackupV2(JSON.stringify({ v: 1 }))).toBe(false);
        expect(isBackupV2(JSON.stringify({ v: 2 }))).toBe(false); // 缺 alg
    });
});
