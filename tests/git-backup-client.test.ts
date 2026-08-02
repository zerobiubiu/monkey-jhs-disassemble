/**
 * git-backup-client 单元测试（doc/217）。
 *
 * 覆盖：base64/UTF-8 编解码往返、contents 路径编码、GitBackupClient
 * 各操作对 GM_xmlhttpRequest 的请求构造与响应解析（stub 全局函数 + clog）。
 *
 * 环境：node（Node 18+ 内置 atob/btoa/TextEncoder/TextDecoder）。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    DEFAULT_GIT_API_URL,
    DEFAULT_GIT_BRANCH,
    GitBackupClient,
    GitHttpError,
    base64ToUtf8,
    buildContentsPath,
    utf8ToBase64
} from '../src/plugins/setting/git-backup-client';

/** GM_xmlhttpRequest stub 接收的请求细节（最小字段集）。 */
interface StubDetails {
    method?: string;
    url: string;
    headers?: Record<string, string>;
    data?: string;
    onload?: (response: StubResponse) => void;
    onerror?: (error: unknown) => void;
}

/** stub 返回的响应。 */
interface StubResponse {
    status: number;
    statusText: string;
    responseText: string;
}

/** 已记录的请求序列（供断言）。 */
let recorded: StubDetails[] = [];

/** 每个用例自定义的请求应答函数。 */
let responder: (details: StubDetails) => StubResponse = () => ({
    status: 200,
    statusText: 'OK',
    responseText: '{}'
});

const g = globalThis as Record<string, unknown>;

beforeEach(() => {
    recorded = [];
    responder = () => ({ status: 200, statusText: 'OK', responseText: '{}' });
    g.GM_xmlhttpRequest = (details: StubDetails) => {
        recorded.push(details);
        details.onload?.(responder(details));
        return { abort: () => undefined };
    };
    g.clog = {
        log: () => undefined,
        warn: () => undefined,
        error: () => undefined,
        debug: () => undefined
    };
});

afterEach(() => {
    delete g.GM_xmlhttpRequest;
    delete g.clog;
});

/** 构造默认测试客户端。 */
function makeClient(overrides: Partial<{ apiUrl: string; repo: string; branch: string; token: string }> = {}) {
    return new GitBackupClient({
        apiUrl: overrides.apiUrl ?? 'https://api.github.com',
        repo: overrides.repo ?? 'tester/jhs-backup',
        branch: overrides.branch ?? 'main',
        token: overrides.token ?? 'ghp_testtoken'
    });
}

describe('base64 / UTF-8 编解码', () => {
    it('编码已知向量', () => {
        expect(utf8ToBase64('hello')).toBe('aGVsbG8=');
    });

    it('中文 + emoji 往返一致', () => {
        const original = '番号 ABC-123 🚀 备份 {"key":"值"}';
        expect(base64ToUtf8(utf8ToBase64(original))).toBe(original);
    });

    it('解码容忍换行分隔的 base64（GitHub 响应格式）', () => {
        expect(base64ToUtf8('aGVs\nbG8=')).toBe('hello');
    });

    it('大文本分块编码不爆栈且往返一致', () => {
        const large = '备'.repeat(100000) + JSON.stringify({ data: 'x'.repeat(50000) });
        expect(base64ToUtf8(utf8ToBase64(large))).toBe(large);
    });
});

describe('buildContentsPath 路径编码', () => {
    it('中文目录名逐段编码', () => {
        expect(buildContentsPath('JHS-数据备份')).toBe(encodeURIComponent('JHS-数据备份'));
    });

    it('目录 + 文件名以单斜杠连接', () => {
        expect(buildContentsPath('JHS-数据备份', 'auto_1.json')).toBe(
            `${encodeURIComponent('JHS-数据备份')}/auto_1.json`
        );
    });

    it('文件名含空格也安全编码', () => {
        expect(buildContentsPath('bk', '2026-08-02 10-30.json')).toBe('bk/2026-08-02%2010-30.json');
    });
});

describe('GitBackupClient.backup', () => {
    it('新文件：GET 404 后 PUT 不带 sha', async () => {
        responder = (details) =>
            details.method === 'GET'
                ? { status: 404, statusText: 'Not Found', responseText: '{"message":"Not Found"}' }
                : { status: 201, statusText: 'Created', responseText: '{"content":{"sha":"new"}}' };
        const client = makeClient();
        await client.backup('JHS-数据备份', 'auto_1.json', '{"a":1}');

        expect(recorded).toHaveLength(2);
        expect(recorded[0].method).toBe('GET');
        expect(recorded[0].url).toBe(
            `https://api.github.com/repos/tester/jhs-backup/contents/${encodeURIComponent('JHS-数据备份')}/auto_1.json?ref=main`
        );
        expect(recorded[0].headers?.Authorization).toBe('Bearer ghp_testtoken');
        expect(recorded[1].method).toBe('PUT');
        const body = JSON.parse(recorded[1].data ?? '{}') as Record<string, unknown>;
        expect(body.content).toBe(utf8ToBase64('{"a":1}'));
        expect(body.branch).toBe('main');
        expect(String(body.message)).toContain('jhs-backup');
        expect('sha' in body).toBe(false);
    });

    it('已有文件：PUT 携带旧 sha 乐观锁', async () => {
        responder = (details) =>
            details.method === 'GET'
                ? {
                      status: 200,
                      statusText: 'OK',
                      responseText: '{"type":"file","sha":"old-sha-123","size":6}'
                  }
                : { status: 200, statusText: 'OK', responseText: '{}' };
        const client = makeClient();
        await client.backup('bk', 'auto_1.json', 'hello');

        const body = JSON.parse(recorded[1].data ?? '{}') as Record<string, unknown>;
        expect(body.sha).toBe('old-sha-123');
    });

    it('服务端 401 抛 GitHttpError 并携带 message', async () => {
        responder = () => ({
            status: 401,
            statusText: 'Unauthorized',
            responseText: '{"message":"Bad credentials"}'
        });
        const client = makeClient();
        await expect(client.backup('bk', 'a.json', 'x')).rejects.toMatchObject({
            name: 'GitHttpError',
            status: 401
        });
        await expect(client.backup('bk', 'a.json', 'x')).rejects.toThrow(/Bad credentials/);
    });
});

describe('GitBackupClient.getBackupList', () => {
    it('映射文件项、过滤目录、倒序并查询 commit 日期', async () => {
        responder = (details) => {
            if (details.url.includes('/commits?path=')) {
                if (details.url.includes(encodeURIComponent('a.json'))) {
                    return {
                        status: 200,
                        statusText: 'OK',
                        responseText: '[{"commit":{"committer":{"date":"2026-08-01T00:00:00Z"}}}]'
                    };
                }
                // b.json 的提交查询故意失败 → 日期回退空串
                return { status: 500, statusText: 'Error', responseText: '{}' };
            }
            return {
                status: 200,
                statusText: 'OK',
                responseText:
                    '[{"name":"a.json","size":1,"type":"file"},' +
                    '{"name":"sub","size":0,"type":"dir"},' +
                    '{"name":"b.json","size":2,"type":"file"}]'
            };
        };
        const client = makeClient();
        const list = await client.getBackupList('JHS-数据备份');

        expect(client.folderName).toBe('JHS-数据备份');
        expect(list).toHaveLength(2);
        expect(list.map((item) => item.name)).toEqual(['b.json', 'a.json']);
        expect(list[1].createTime).toBe('2026-08-01T00:00:00Z');
        expect(list[0].createTime).toBe('');
    });

    it('目录不存在（404）返回空列表', async () => {
        responder = () => ({ status: 404, statusText: 'Not Found', responseText: '{"message":"Not Found"}' });
        const client = makeClient();
        expect(await client.getBackupList('no-such-folder')).toEqual([]);
    });
});

describe('GitBackupClient.getFileContent', () => {
    it('解码 base64 JSON 内容', async () => {
        const payload = '{"x":"中文"}';
        responder = (details) =>
            details.url.includes('/contents/')
                ? {
                      status: 200,
                      statusText: 'OK',
                      responseText: `{"content":"${utf8ToBase64(payload)}","encoding":"base64","size":10}`
                  }
                : { status: 200, statusText: 'OK', responseText: '[]' };
        const client = makeClient();
        await client.getBackupList('bk');
        expect(await client.getFileContent('a.json')).toBe(payload);
    });

    it('>1MB 文件回退 raw 媒体类型', async () => {
        let bigFileCalls = 0;
        responder = (details) => {
            if (details.url.includes('/contents/bk/big.json')) {
                bigFileCalls++;
                if (details.headers?.Accept === 'application/vnd.github.raw+json') {
                    return { status: 200, statusText: 'OK', responseText: '{"big":true}' };
                }
                // 首次 JSON 请求：GitHub 对 >1MB 文件省略 content
                return { status: 200, statusText: 'OK', responseText: '{"size":2000000,"encoding":"base64"}' };
            }
            return { status: 200, statusText: 'OK', responseText: '[]' };
        };
        const client = makeClient();
        await client.getBackupList('bk');
        expect(await client.getFileContent('big.json')).toBe('{"big":true}');
        expect(bigFileCalls).toBe(2);
    });

    it('未先 getBackupList 时抛错', async () => {
        const client = makeClient();
        await expect(client.getFileContent('a.json')).rejects.toThrow(/目录未初始化/);
    });
});

describe('GitBackupClient.deleteFile', () => {
    it('先取 sha 再 DELETE', async () => {
        responder = (details) => {
            if (details.method === 'DELETE') return { status: 200, statusText: 'OK', responseText: '{}' };
            if (details.url.includes('/contents/')) {
                return {
                    status: 200,
                    statusText: 'OK',
                    responseText: '{"type":"file","sha":"del-sha","size":3}'
                };
            }
            return { status: 200, statusText: 'OK', responseText: '[]' };
        };
        const client = makeClient();
        await client.getBackupList('bk');
        await client.deleteFile('a.json');

        const del = recorded[recorded.length - 1];
        expect(del.method).toBe('DELETE');
        const body = JSON.parse(del.data ?? '{}') as Record<string, unknown>;
        expect(body.sha).toBe('del-sha');
        expect(body.branch).toBe('main');
        expect(String(body.message)).toContain('jhs-delete');
    });

    it('文件不存在时抛明确错误', async () => {
        responder = (details) =>
            details.url.includes('/contents/')
                ? { status: 404, statusText: 'Not Found', responseText: '{"message":"Not Found"}' }
                : { status: 200, statusText: 'OK', responseText: '[]' };
        const client = makeClient();
        await client.getBackupList('bk');
        await expect(client.deleteFile('gone.json')).rejects.toThrow(/不存在或已被删除/);
    });
});

describe('GitBackupClient 配置缺省值', () => {
    it('apiUrl/branch 缺省回退 GitHub 官方与 main', async () => {
        responder = () => ({ status: 404, statusText: 'Not Found', responseText: '{}' });
        const client = makeClient({ apiUrl: '', branch: '' });
        await client.getBackupList('bk');

        expect(recorded[0].url.startsWith(DEFAULT_GIT_API_URL)).toBe(true);
        expect(recorded[0].url).toContain(`ref=${DEFAULT_GIT_BRANCH}`);
    });

    it('自建基址末尾斜杠自动去除', async () => {
        responder = () => ({ status: 404, statusText: 'Not Found', responseText: '{}' });
        const client = makeClient({ apiUrl: 'https://git.example.com/api/v1/' });
        await client.getBackupList('bk');

        expect(recorded[0].url.startsWith('https://git.example.com/api/v1/repos/')).toBe(true);
    });
});

describe('GitHttpError', () => {
    it('消息合并状态码与服务端 message', () => {
        const err = new GitHttpError(422, 'Unprocessable Entity', 'sha is required');
        expect(err.status).toBe(422);
        expect(err.message).toBe('请求失败 422: Unprocessable Entity（sha is required）');
    });

    it('无服务端 message 时仅状态信息', () => {
        const err = new GitHttpError(500, 'Internal Server Error', '');
        expect(err.message).toBe('请求失败 500: Internal Server Error');
    });
});
