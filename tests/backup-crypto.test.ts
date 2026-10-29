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
    decodeBackup,
    decryptBackupV2,
    encryptBackupV2,
    isBackupV2,
    type BackupEnvelopeV2
} from '../src/core/backup-crypto';
import { decryptCredential, encryptCredential } from '../src/core/webdav-crypto';

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


describe('备份格式统一解码（doc/56）', () => {
    it('明文保持原文与全部附加数据，不按旧格式解密', async () => {
        const text = ' \n' + PLAIN + '\n';
        expect(await decodeBackup(text)).toEqual({ text, data: JSON.parse(PLAIN) });
    });

    it('容忍 UTF-8 BOM', async () => {
        expect((await decodeBackup('\uFEFF' + PLAIN)).data).toEqual(JSON.parse(PLAIN));
    });

    it('旧 Caesar 备份无需口令，本地与云端均可还原', async () => {
        expect(await decodeBackup(encryptCredential(PLAIN))).toEqual({
            text: PLAIN, data: JSON.parse(PLAIN)
        });
    });

    it('V2 信封使用已设置口令解密', async () => {
        const encrypted = await encryptBackupV2(PLAIN, PASSWORD);
        expect(await decodeBackup(encrypted, PASSWORD)).toEqual({
            text: PLAIN, data: JSON.parse(PLAIN)
        });
    });

    it('V2 缺口令时提示设置口令', async () => {
        const encrypted = await encryptBackupV2(PLAIN, PASSWORD);
        await expect(decodeBackup(encrypted)).rejects.toThrow(/先.*设置备份口令/);
    });

    it('V2 错口令时不回退旧格式或明文', async () => {
        const encrypted = await encryptBackupV2(PLAIN, PASSWORD);
        await expect(decodeBackup(encrypted, 'wrong')).rejects.toThrow(/口令错误或文件已损坏/);
    });

    it.each(['null', '[]', 'true', '42', '"text"'])('拒绝非键值对象：%s', async (text) => {
        await expect(decodeBackup(text)).rejects.toThrow(/必须是键值对对象/);
    });

    it.each(['', '{"car_list":', '\u001d5\u001d\\pojZ^_'])('损坏内容不泄露解析片段并提示重新下载：%j', async (text) => {
        await expect(decodeBackup(text)).rejects.toThrow(/重新下载原始备份/);
    });

    it('Git 文件元数据不是备份正文，不能作为键值数据导入', async () => {
        const metadata = JSON.stringify({
            type: 'file', path: 'backup/auto_1.json', sha: 'a'.repeat(40),
            size: 28445950, content: '', encoding: 'none'
        });
        await expect(decodeBackup(metadata)).rejects.toThrow(/Git.*元数据.*重新下载/);
    });

    it('复现旧下载链路：元数据误解密后的乱码必须拒绝，不能伪造恢复', async () => {
        const metadata = JSON.stringify({
            name: 'auto_1.json', type: 'file', path: 'backup/auto_1.json',
            sha: 'a'.repeat(40), size: 28445950, content: '', encoding: 'none'
        });
        await expect(decodeBackup(decryptCredential(metadata))).rejects.toThrow(/重新下载原始备份/);
    });


    it('元数据缺 SHA 也不能作为备份导入', async () => {
        await expect(decodeBackup(JSON.stringify({
            type: 'file', path: 'bk/auto_1.json', encoding: 'none', content: ''
        }))).rejects.toThrow(/Git.*元数据/);
    });

    it('未知 AES 信封版本不能作为明文键值对导入', async () => {
        await expect(decodeBackup('{"v":3,"alg":"AES-GCM"}')).rejects.toThrow(/不支持的备份格式版本/);
    });

    it('旧格式标记内部存在无效码点时给出可操作的错误', async () => {
        const wrapper = encryptCredential('');
        const marker = wrapper.slice(0, wrapper.length / 2);
        await expect(decodeBackup(marker + '\u0001' + marker)).rejects.toThrow(/旧版备份已损坏.*重新下载/);
    });
});
