// @vitest-environment jsdom
/** 清单适配安全契约：完整目录、权威状态确认、元数据保留与有界网络等待。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchSimpleListsPage } from '../src/core/util/util-simple-lists';
import { applyBatchListItem, fetchBatchListChoices } from '../src/plugins/list-page/batch-lists/site';
import { withState } from '../src/plugins/video-lists-tag/db/vlt-db-core';
import { handleCheckboxChange } from '../src/plugins/video-lists-tag/vlt-checkbox';
import { enqueueAssociationTask } from '../src/plugins/video-lists-tag/vlt-lock-queue';
import { publishListIntent } from '../src/plugins/video-lists-tag/server/vlt-intent';
import {
    fetchAuthoritativeCheckboxState,
    postJavdbListMutation
} from '../src/plugins/video-lists-tag/server/vlt-server-api';

vi.mock('../src/core/util/util-simple-lists', () => ({ fetchSimpleListsPage: vi.fn() }));
vi.mock('../src/plugins/video-lists-tag/db/vlt-db-core', () => ({ withState: vi.fn() }));
vi.mock('../src/plugins/video-lists-tag/vlt-checkbox', () => ({ handleCheckboxChange: vi.fn() }));
vi.mock('../src/plugins/video-lists-tag/vlt-lock-queue', () => ({
    listAssociationKey: (videoId: string, listId: string) => `video:${videoId}::${listId}`,
    enqueueAssociationTask: vi.fn(async (_key: string, task: () => Promise<void>) => task())
}));
vi.mock('../src/plugins/video-lists-tag/server/vlt-server-api', () => ({
    fetchAuthoritativeCheckboxState: vi.fn(),
    postJavdbListMutation: vi.fn()
}));

const item = { carNum: 'TEST-001', videoId: 'v1', url: 'https://javdb.com/v/v1', publishTime: '2026-11-02' };
const list = { id: 'L1', name: '目标清单', url: 'https://javdb.com/lists/L1' };
const state = (checked: boolean, name: string | null = list.name) => ({ checked, count: 1, name });
const row = (id: string, name = `清单${id}`) => `<label><input type="checkbox" data-list-id="${id}">${name}<span>(1)</span></label>`;

beforeEach(() => {
    const journal = new Map<string, unknown>();
    vi.stubGlobal('GM_getValue', (key: string, fallback: unknown) => journal.get(key) ?? fallback);
    vi.stubGlobal('GM_setValue', (key: string, value: unknown) => { journal.set(key, value); });
    vi.clearAllMocks();
    vi.mocked(fetchSimpleListsPage).mockReset();
    vi.mocked(fetchAuthoritativeCheckboxState).mockReset();
    vi.mocked(postJavdbListMutation).mockResolvedValue({ kind: 'confirmed', message: 'ok' });
    vi.mocked(withState).mockResolvedValue(undefined);
    vi.mocked(handleCheckboxChange).mockResolvedValue({ movie: 'created', list: 'existed', association: 'created' });
    vi.stubGlobal('storageManager', { getSetting: vi.fn(async () => ({ listMergeEnabled: 'no' })) });
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.head.innerHTML = '';
});

describe('fetchBatchListChoices', () => {
    it('读取全部分页并按 ID 去重，超过 50 页也不静默截断', async () => {
        vi.mocked(fetchSimpleListsPage).mockImplementation(async (url) => {
            const page = Number(new URL(url).searchParams.get('page') || 1);
            return { entries: row(String(page)), nextUrl: page < 51 ? `http://localhost/users/simple_lists?page=${page + 1}` : null };
        });
        const choices = await fetchBatchListChoices('v1');
        expect(choices).toHaveLength(51);
        expect(choices[50].name).toBe('清单51');
        expect(choices[0].url).toBe(`${window.location.origin}/lists/1`);
    });

    it('目录循环失败，不返回部分结果', async () => {
        vi.mocked(fetchSimpleListsPage).mockResolvedValue({ entries: row('1'), nextUrl: `${window.location.origin}/users/simple_lists?vid=v1` });
        await expect(fetchBatchListChoices('v1')).rejects.toThrow('循环');
    });

    it('分页失败、登录页及无名称条目均拒绝', async () => {
        vi.mocked(fetchSimpleListsPage).mockRejectedValueOnce(new Error('HTTP 401'));
        await expect(fetchBatchListChoices('v1')).rejects.toThrow('401');
        vi.mocked(fetchSimpleListsPage).mockResolvedValueOnce({ entries: '<form>请登录</form>', nextUrl: null });
        await expect(fetchBatchListChoices('v1')).rejects.toThrow('登录');
        vi.mocked(fetchSimpleListsPage).mockResolvedValueOnce({ entries: row('1', ''), nextUrl: null });
        await expect(fetchBatchListChoices('v1')).rejects.toThrow('名称');
    });

    it('同一清单名称跨分页变化时拒绝混合目录', async () => {
        vi.mocked(fetchSimpleListsPage)
            .mockResolvedValueOnce({ entries: row('1'), nextUrl: `${window.location.origin}/users/simple_lists?page=2` })
            .mockResolvedValueOnce({ entries: row('1', '改名后'), nextUrl: null });
        await expect(fetchBatchListChoices('v1')).rejects.toThrow('状态变化');
    });

    it('空目录与重复但一致的清单可安全返回', async () => {
        vi.mocked(fetchSimpleListsPage).mockResolvedValueOnce({ entries: '', nextUrl: null });
        expect(await fetchBatchListChoices('v1')).toEqual([]);
        vi.mocked(fetchSimpleListsPage).mockResolvedValueOnce({ entries: row('1') + row('1'), nextUrl: null });
        expect(await fetchBatchListChoices('v1')).toHaveLength(1);
    });
});

describe('applyBatchListItem', () => {
    it('等待实体锁期间请求停止，拿锁后不再读取或写入网站', async () => {
        const controller = new AbortController();
        let resume!: () => Promise<void>;
        const ctx = { createdAt: 100, signal: controller.signal, saveRoute: vi.fn(async () => undefined) };
        vi.mocked(enqueueAssociationTask).mockImplementationOnce((_key, task) => new Promise<void>((resolve) => {
            resume = async () => { await task(); resolve(); };
        }));
        const running = applyBatchListItem(item, list, true, 'job', ctx);
        await vi.waitFor(() => expect(resume).toBeDefined());
        controller.abort(); await resume();
        expect(await running).toBe('stopped');
        expect(fetchAuthoritativeCheckboxState).not.toHaveBeenCalled();
        expect(postJavdbListMutation).not.toHaveBeenCalled();
    });

    it('网站回查期间停止，尚未发出的POST不再开始', async () => {
        const controller = new AbortController();
        vi.mocked(fetchAuthoritativeCheckboxState).mockImplementationOnce(async () => { controller.abort(); return state(false); });
        const ctx = { createdAt: 100, signal: controller.signal, saveRoute: vi.fn(async () => undefined) };
        expect(await applyBatchListItem(item, list, true, 'job', ctx)).toBe('stopped');
        expect(postJavdbListMutation).not.toHaveBeenCalled();
        expect(handleCheckboxChange).not.toHaveBeenCalled();
    });

    it('POST前路由保存期间停止，复原未发请求标记并返回stopped', async () => {
        const controller = new AbortController();
        const routes: Array<{ listIds: string[]; uncertain?: boolean }> = [];
        vi.mocked(fetchAuthoritativeCheckboxState).mockResolvedValue(state(false));
        const ctx = { createdAt: 100, signal: controller.signal, saveRoute: async (route) => {
            routes.push(structuredClone(route));
            if (route.uncertain) controller.abort();
        } };
        expect(await applyBatchListItem(item, list, true, 'job', ctx)).toBe('stopped');
        expect(postJavdbListMutation).not.toHaveBeenCalled();
        expect(routes.at(-1)?.uncertain).toBeFalsy();
    });

    it('POST已经发出时只停止下一实体，当前回查与本地提交仍完成', async () => {
        const controller = new AbortController();
        vi.mocked(fetchAuthoritativeCheckboxState).mockResolvedValueOnce(state(false)).mockResolvedValueOnce(state(true));
        vi.mocked(postJavdbListMutation).mockImplementationOnce(async () => { controller.abort(); return { kind: 'confirmed', message: 'ok' }; });
        const ctx = { createdAt: 100, signal: controller.signal, saveRoute: vi.fn(async () => undefined) };
        expect(await applyBatchListItem(item, list, true, 'job', ctx)).toBeUndefined();
        expect(fetchAuthoritativeCheckboxState).toHaveBeenCalledTimes(2);
        expect(handleCheckboxChange).toHaveBeenCalledTimes(1);
    });
    it('实体请求unknown保持uncertain固定目标；明确拒绝后才允许重新规划', async () => {
        const routes: Array<{ listIds: string[]; uncertain?: boolean }> = [];
        const context = { createdAt: 100, route: { listIds: ['L1'] }, saveRoute: async (route) => { routes.push(structuredClone(route)); } };
        vi.mocked(fetchAuthoritativeCheckboxState).mockResolvedValue(state(false));
        vi.mocked(postJavdbListMutation).mockResolvedValueOnce({ kind: 'unknown', message: '超时' });
        await expect(applyBatchListItem(item, list, true, 'job', context)).rejects.toThrow('尚未确认');
        expect(routes.at(-1)).toMatchObject({ listIds: ['L1'], uncertain: true });
        vi.mocked(postJavdbListMutation).mockResolvedValueOnce({ kind: 'rejected', message: '已满' });
        await expect(applyBatchListItem(item, list, true, 'job', context)).rejects.toThrow('已满');
        expect(routes.at(-1)).toMatchObject({ listIds: ['L1'], uncertain: false });
    });
    it('较新的详情移出意图取代旧批量加入，恢复不得反向请求或写本地', async () => {
        publishListIntent('v1', 'L1', 'old-batch', 1000, true, { explicit: true });
        publishListIntent('v1', 'L1', 'new-detail', 2000, false, { explicit: true });
        expect(await applyBatchListItem(item, list, true, 'old-batch')).toBe('superseded');
        expect(fetchAuthoritativeCheckboxState).not.toHaveBeenCalled();
        expect(postJavdbListMutation).not.toHaveBeenCalled();
        expect(handleCheckboxChange).not.toHaveBeenCalled();
    });
    it('POST 确认后仍需权威回查；只在匹配时写本地', async () => {
        let release!: (value: ReturnType<typeof state>) => void;
        vi.mocked(fetchAuthoritativeCheckboxState)
            .mockResolvedValueOnce(state(false))
            .mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
        const running = applyBatchListItem(item, list, true);
        await vi.waitFor(() => expect(fetchAuthoritativeCheckboxState).toHaveBeenCalledTimes(2));
        expect(handleCheckboxChange).not.toHaveBeenCalled();
        release(state(true));
        await running;
        expect(postJavdbListMutation).toHaveBeenCalledWith('v1', 'L1', true);
        expect(handleCheckboxChange).toHaveBeenCalledWith(expect.objectContaining({ designation: 'TEST-001' }),
            { list_id: 'L1', info: { name: '目标清单', url: list.url } }, true,
            { serverConfirmed: true, silent: true, skipAutomation: true });
        expect(enqueueAssociationTask).toHaveBeenCalledWith('video:v1::L1', expect.any(Function));
    });

    it('POST 结果不确定但回查成功时可以提交', async () => {
        vi.mocked(postJavdbListMutation).mockResolvedValueOnce({ kind: 'unknown', message: '超时' });
        vi.mocked(fetchAuthoritativeCheckboxState).mockResolvedValueOnce(state(false)).mockResolvedValueOnce(state(true));
        await applyBatchListItem(item, list, true);
        expect(handleCheckboxChange).toHaveBeenCalledTimes(1);
    });

    it('恢复时网站已符合目标则不重复 POST，仍补交本地', async () => {
        vi.mocked(fetchAuthoritativeCheckboxState).mockResolvedValue(state(false));
        await applyBatchListItem(item, list, false);
        expect(postJavdbListMutation).not.toHaveBeenCalled();
        expect(handleCheckboxChange).toHaveBeenCalledTimes(1);
    });

    it('清单不存在不能被视为移出成功', async () => {
        vi.mocked(fetchAuthoritativeCheckboxState).mockResolvedValue(state(false, null));
        await expect(applyBatchListItem(item, list, false)).rejects.toThrow('存在');
        expect(postJavdbListMutation).not.toHaveBeenCalled();
        expect(handleCheckboxChange).not.toHaveBeenCalled();
    });

    it('网站拒绝或权威状态相反时不提交本地', async () => {
        vi.mocked(fetchAuthoritativeCheckboxState).mockResolvedValue(state(false));
        vi.mocked(postJavdbListMutation).mockResolvedValueOnce({ kind: 'rejected', message: '已满' });
        await expect(applyBatchListItem(item, list, true)).rejects.toThrow('已满');
        await expect(applyBatchListItem(item, list, true)).rejects.toThrow('尚未确认');
        expect(handleCheckboxChange).not.toHaveBeenCalled();
    });

    it('权威回查失败或本地写入失败时向上传播，保留恢复责任', async () => {
        vi.mocked(fetchAuthoritativeCheckboxState).mockResolvedValueOnce(state(false)).mockResolvedValueOnce(null);
        await expect(applyBatchListItem(item, list, true)).rejects.toThrow('尚未确认');
        vi.mocked(fetchAuthoritativeCheckboxState).mockResolvedValue(state(true));
        vi.mocked(handleCheckboxChange).mockResolvedValueOnce(null);
        await expect(applyBatchListItem(item, list, true)).rejects.toThrow('尚未写入');
    });

    it('复用已有详情元数据，不从当前列表页或其他视频提取', async () => {
        vi.mocked(fetchAuthoritativeCheckboxState).mockResolvedValue(state(true));
        vi.mocked(withState).mockResolvedValue({ href: item.url, title: '详情标题', coverSrc: 'cover.jpg', score: 8.6, releaseDate: '2021-01-01', series: 'TEST', code: '001' });
        await applyBatchListItem(item, list, true);
        expect(handleCheckboxChange).toHaveBeenCalledWith({ designation: item.carNum, info: {
            href: item.url, title: '详情标题', cover_src: 'cover.jpg', score: 8.6, release_date: '2021-01-01', series: 'TEST', code: '001'
        } }, expect.anything(), true, expect.anything());
    });
});

describe('postJavdbListMutation 请求边界', () => {
    it('权威查询可读取第 51 页目标，完整目录中缺失的目标不伪报存在', async () => {
        const actual = await vi.importActual<typeof import('../src/plugins/video-lists-tag/server/vlt-server-api')>('../src/plugins/video-lists-tag/server/vlt-server-api');
        vi.mocked(fetchSimpleListsPage).mockImplementation(async (url) => {
            const page = Number(new URL(url).searchParams.get('page') || 1);
            return {
                entries: row(String(page)).replace('type="checkbox"', 'type="checkbox" checked'),
                nextUrl: page < 51 ? `${window.location.origin}/users/simple_lists?page=${page + 1}` : null
            };
        });
        expect(await actual.fetchAuthoritativeCheckboxState('v1', '51')).toEqual({ checked: true, count: 1, name: '清单51' });
        expect(await actual.fetchAuthoritativeCheckboxState('v1', 'missing')).toEqual({ checked: false, count: null, name: null });
    });

    it('真实网络等待最多 15 秒；超时只标记不确定，不伪报失败或成功', async () => {
        vi.useFakeTimers();
        const actual = await vi.importActual<typeof import('../src/plugins/video-lists-tag/server/vlt-server-api')>('../src/plugins/video-lists-tag/server/vlt-server-api');
        document.head.innerHTML = '<meta name="csrf-token" content="test-token">';
        const fetchMock = vi.fn((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
            options.signal?.addEventListener('abort', () => reject(new Error('请求超时')));
        }));
        vi.stubGlobal('fetch', fetchMock);
        const result = actual.postJavdbListMutation('v1', 'L1', true);
        await vi.advanceTimersByTimeAsync(15000);
        expect(await result).toEqual({ kind: 'unknown', message: '请求超时' });
        expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ signal: expect.any(AbortSignal) }));
        expect(vi.getTimerCount()).toBe(0);
    });
});
