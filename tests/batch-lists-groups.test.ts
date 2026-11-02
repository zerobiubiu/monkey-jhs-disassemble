/** 聚合清单复用详情页规则；容量、路由、未知创建与跨视频互斥。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { BatchListApplyContext, BatchListChoice, BatchListRoute } from '../src/types/batch-lists';
import { buildMergeConfig } from '../src/plugins/detail-page-button/dpb-list-merge';
import type { ListMember } from '../src/plugins/detail-page-button/dpb-list-merge';
import { fetchBatchListDirectory } from '../src/plugins/list-page/batch-lists/directory';
import { applyBatchListGroup, buildBatchListChoices } from '../src/plugins/list-page/batch-lists/groups';
import { createListForVideo } from '../src/plugins/video-lists-tag/server/vlt-create-request';
import { publishListIntent } from '../src/plugins/video-lists-tag/server/vlt-intent';

vi.mock('../src/plugins/list-page/batch-lists/directory', () => ({ fetchBatchListDirectory: vi.fn() }));
vi.mock('../src/plugins/video-lists-tag/server/vlt-create-request', () => ({ createListForVideo: vi.fn() }));

const member = (id: string, name: string, count = 1, checked = false, disabled = false): ListMember =>
    ({ listId: id, name, count, checked, disabled, num: 0 });
const item = { carNum: 'TEST-001', videoId: 'v1', url: 'https://javdb.com/v/v1' };
const choice = (): BatchListChoice => buildBatchListChoices([member('1', '待看1'), member('2', '待看2')], buildMergeConfig({}))[0];
let saved: BatchListRoute[];

function context(route?: BatchListRoute): BatchListApplyContext {
    const value: BatchListApplyContext = { createdAt: 100, route, saveRoute: async (next) => {
        saved.push(structuredClone(next)); value.route = structuredClone(next);
    } };
    return value;
}

function publish(videoId = 'v1'): void { publishListIntent(videoId, choice().id, 'job', 100, true, { explicit: true }); }

beforeEach(() => {
    vi.clearAllMocks();
    saved = [];
    const values = new Map<string, unknown>();
    vi.stubGlobal('window', { location: { origin: 'https://javdb.com' } });
    vi.stubGlobal('GM_getValue', (key: string, fallback: unknown) => values.get(key) ?? fallback);
    vi.stubGlobal('GM_setValue', (key: string, value: unknown) => { values.set(key, value); });
    const tails = new Map<string, Promise<unknown>>();
    vi.stubGlobal('navigator', { locks: { request: vi.fn((name: string, _opts: unknown, task: () => Promise<unknown>) => {
        const current = (tails.get(name) || Promise.resolve()).then(task);
        tails.set(name, current.catch(() => undefined));
        return current;
    }) } });
    vi.mocked(fetchBatchListDirectory).mockReset();
    vi.mocked(createListForVideo).mockReset().mockResolvedValue('created');
});

afterEach(() => vi.unstubAllGlobals());

describe('逻辑选择与详情页规则相同', () => {
    it('默认规则把序号与裸名合并，只暴露稳定逻辑标识', () => {
        const choices = buildBatchListChoices([member('2', '待看2'), member('0', '待看'), member('1', '待看1'), member('x', '独立')], buildMergeConfig({}));
        expect(choices.map((entry) => entry.name)).toEqual(['待看', '独立']);
        expect(choices[0].id).toBe('group:' + encodeURIComponent('待看'));
        expect(choices[0].members).toHaveLength(3);
    });

    it('尊重关闭、排除及自定义正则配置', () => {
        const rows = [member('1', '待看1'), member('2', '待看2')];
        expect(buildBatchListChoices(rows, buildMergeConfig({ listMergeEnabled: 'no' })).every((entry) => !entry.group)).toBe(true);
        expect(buildBatchListChoices(rows, buildMergeConfig({ listMergeExcludeNames: ['待看'] })).every((entry) => !entry.group)).toBe(true);
        expect(buildBatchListChoices([member('1', '资料_1')], buildMergeConfig({ listMergePattern: '^(.+?)_(\\d+)$' }))[0].name).toBe('资料');
    });
});

describe('具体成员规划与恢复', () => {
    it('请求停止后拿到组锁，零网站目录或变更请求', async () => {
        publish();
        const controller = new AbortController(); controller.abort();
        const ctx = context(); ctx.signal = controller.signal;
        const apply = vi.fn(async () => undefined);
        expect(await applyBatchListGroup(item, choice(), false, 'job', ctx, apply)).toBe('stopped');
        expect(fetchBatchListDirectory).not.toHaveBeenCalled();
        expect(apply).not.toHaveBeenCalled();
    });

    it('组内多成员移出中途停止，已发当前成员完成，剩余成员不再开始且保留全部路由', async () => {
        publish();
        const controller = new AbortController();
        vi.mocked(fetchBatchListDirectory).mockResolvedValue([member('1', '待看1', 2, true), member('2', '待看2', 3, true)]);
        const ctx = context(); ctx.signal = controller.signal;
        const apply = vi.fn(async () => { controller.abort(); });
        expect(await applyBatchListGroup(item, choice(), false, 'job', ctx, apply)).toBe('stopped');
        expect(apply).toHaveBeenCalledTimes(1);
        expect(ctx.route?.listIds).toEqual(['1', '2']);
    });
    it('较新的原生实体意图使旧逻辑组任务失效，不能改投其他成员或另建', async () => {
        publish();
        publishListIntent('v1', '1', 'native-new', 200, false, { explicit: true });
        vi.mocked(fetchBatchListDirectory).mockResolvedValue([member('1', '待看1', 501), member('2', '待看2', 501)]);
        const apply = vi.fn(async () => undefined);
        expect(await applyBatchListGroup(item, choice(), true, 'job', context(), apply)).toBe('superseded');
        expect(createListForVideo).not.toHaveBeenCalled();
        expect(apply).not.toHaveBeenCalled();
    });
    it('新鲜容量中按编号加入首个未满、未禁用成员，并先持久路由', async () => {
        publish();
        vi.mocked(fetchBatchListDirectory).mockResolvedValue([member('2', '待看2', 3), member('1', '待看1', 501, false, true)]);
        const apply = vi.fn(async (_item, target) => { expect(saved.at(-1)?.listIds).toEqual(['2']); expect(target.id).toBe('2'); });
        await applyBatchListGroup(item, choice(), true, 'job', context(), apply);
        expect(apply).toHaveBeenCalledTimes(1);
        expect(createListForVideo).not.toHaveBeenCalled();
    });

    it('网站已经在组内时只确认所在成员，不再塞第二个清单', async () => {
        publish();
        vi.mocked(fetchBatchListDirectory).mockResolvedValue([member('1', '待看1', 4), member('2', '待看2', 3, true)]);
        const apply = vi.fn(async () => undefined);
        await applyBatchListGroup(item, choice(), true, 'job', context(), apply);
        expect(apply).toHaveBeenCalledWith(item, expect.objectContaining({ id: '2' }), true, 'job', expect.anything());
        expect(apply).toHaveBeenCalledTimes(1);
    });

    it('移出覆盖组内全部成员，已取消项由实体适配幂等确认', async () => {
        publish();
        vi.mocked(fetchBatchListDirectory).mockResolvedValue([member('1', '待看1', 2, true), member('2', '待看2', 3, true), member('3', '待看3', 4)]);
        const apply = vi.fn(async () => undefined);
        await applyBatchListGroup(item, choice(), false, 'job', context(), apply);
        expect(apply.mock.calls.map((call) => call[1].id)).toEqual(['1', '2', '3']);
        expect(saved[0].listIds).toEqual(['1', '2', '3']);
    });

    it('原移出目标状态不明或容量未知时不伪报成功、不盲目创建', async () => {
        publish();
        vi.mocked(fetchBatchListDirectory).mockResolvedValue([member('1', '待看1')]);
        const apply = vi.fn(async () => undefined);
        await expect(applyBatchListGroup(item, choice(), false, 'job', context({ listIds: ['missing'] }), apply)).rejects.toThrow('不能将未知');
        vi.mocked(fetchBatchListDirectory).mockResolvedValue([{ ...member('1', '待看1'), count: null }]);
        await expect(applyBatchListGroup(item, choice(), true, 'job', context(), apply)).rejects.toThrow('容量');
        expect(apply).not.toHaveBeenCalled();
        expect(createListForVideo).not.toHaveBeenCalled();
    });

    it('可能已经发出的加入固定原目标，不能改投另一个有空位的成员', async () => {
        publish();
        vi.mocked(fetchBatchListDirectory).mockResolvedValue([member('1', '待看1', 501), member('2', '待看2', 1)]);
        const apply = vi.fn(async () => undefined);
        await applyBatchListGroup(item, choice(), true, 'job', context({ listIds: ['1'], uncertain: true }), apply);
        expect(apply).toHaveBeenCalledWith(item, expect.objectContaining({ id: '1' }), true, 'job', expect.anything());
    });

    it('明确未发出或拒绝后的路由按新容量重新规划', async () => {
        publish();
        vi.mocked(fetchBatchListDirectory).mockResolvedValue([member('1', '待看1', 501), member('2', '待看2', 1)]);
        const apply = vi.fn(async () => undefined);
        await applyBatchListGroup(item, choice(), true, 'job', context({ listIds: ['1'], uncertain: false }), apply);
        expect(apply).toHaveBeenCalledWith(item, expect.objectContaining({ id: '2' }), true, 'job', expect.anything());
    });

    it('预写路由失败时不执行任何实体修改或创建', async () => {
        publish();
        vi.mocked(fetchBatchListDirectory).mockResolvedValue([member('1', '待看1')]);
        const apply = vi.fn(async () => undefined);
        const ctx = context(); ctx.saveRoute = async () => { throw new Error('落盘失败'); };
        await expect(applyBatchListGroup(item, choice(), true, 'job', ctx, apply)).rejects.toThrow('落盘失败');
        expect(apply).not.toHaveBeenCalled();
    });
});

describe('自动创建的持久恢复', () => {
    it('创建尝试落盘时停止，实际POST未发出可在继续时安全尝试同名', async () => {
        publish();
        const controller = new AbortController();
        vi.mocked(fetchBatchListDirectory).mockResolvedValue([member('1', '待看1', 501), member('2', '待看2', 501)]);
        const ctx = context(); ctx.signal = controller.signal;
        const save = ctx.saveRoute;
        ctx.saveRoute = async (route) => { await save(route); if (route.createAttempted) controller.abort(); };
        expect(await applyBatchListGroup(item, choice(), true, 'job', ctx, vi.fn())).toBe('stopped');
        expect(createListForVideo).not.toHaveBeenCalled();
        expect(ctx.route).toMatchObject({ createName: '待看3', createAttempted: false });
    });

    it('创建POST发出后停止，完成当前目录回查并保存具体ID，继续时不重复创建', async () => {
        publish();
        const controller = new AbortController();
        const full = [member('1', '待看1', 501), member('2', '待看2', 501)];
        const created = [...full, member('3', '待看3', 1, true)];
        vi.mocked(fetchBatchListDirectory).mockResolvedValueOnce(full).mockResolvedValue(created);
        vi.mocked(createListForVideo).mockImplementationOnce(async () => { controller.abort(); return 'created'; });
        const ctx = context(); ctx.signal = controller.signal;
        const apply = vi.fn(async () => undefined);
        expect(await applyBatchListGroup(item, choice(), true, 'job', ctx, apply)).toBe('stopped');
        expect(ctx.route?.listIds).toEqual(['3']);
        expect(apply).not.toHaveBeenCalled();
        ctx.signal = undefined;
        expect(await applyBatchListGroup(item, choice(), true, 'job', ctx, apply)).toBeUndefined();
        expect(createListForVideo).toHaveBeenCalledTimes(1);
        expect(apply).toHaveBeenCalledWith(item, expect.objectContaining({ id: '3' }), true, 'job', expect.anything());
    });

    it('本轮创建后的新鲜目录已显示满员，与旧创建恢复统一判据立即续建下一编号', async () => {
        publish();
        const full = [member('1', '待看1', 501), member('2', '待看2', 501)];
        const fullCreated = [...full, member('3', '待看3', 501, false, true)];
        vi.mocked(fetchBatchListDirectory).mockResolvedValueOnce(full).mockResolvedValueOnce(fullCreated).mockResolvedValueOnce([...fullCreated, member('4', '待看4', 1, true)]);
        const apply = vi.fn(async () => undefined);
        await applyBatchListGroup(item, choice(), true, 'job', context(), apply);
        expect(createListForVideo.mock.calls.map((call) => call[0])).toEqual(['待看3', '待看4']);
        expect(apply).toHaveBeenCalledTimes(1);
        expect(apply).toHaveBeenCalledWith(item, expect.objectContaining({ id: '4' }), true, 'job', expect.anything());
    });
    it('原创建名已确认但新成员已满时，同轮跳过满员并续建下一编号', async () => {
        publish();
        const full = [member('1', '待看1', 501), member('2', '待看2', 501), member('3', '待看3', 501, false, true)];
        vi.mocked(fetchBatchListDirectory).mockResolvedValueOnce(full).mockResolvedValueOnce([...full, member('4', '待看4', 1, true)]);
        const apply = vi.fn(async () => undefined);
        await applyBatchListGroup(item, choice(), true, 'job', context({ listIds: [], createName: '待看3', createAttempted: true, uncertain: false }), apply);
        expect(createListForVideo).toHaveBeenCalledTimes(1);
        expect(createListForVideo).toHaveBeenCalledWith('待看4', 'v1');
        expect(apply).toHaveBeenCalledWith(item, expect.objectContaining({ id: '4' }), true, 'job', expect.anything());
        expect(apply.mock.calls.some((call) => call[1].id === '3')).toBe(false);
    });

    it('原创建目标已满但其他已有成员有容量时，本轮直接分配已有空位', async () => {
        publish();
        vi.mocked(fetchBatchListDirectory).mockResolvedValue([member('1', '待看1', 12), member('3', '待看3', 501)]);
        const apply = vi.fn(async () => undefined);
        await applyBatchListGroup(item, choice(), true, 'job', context({ listIds: [], createName: '待看3', createAttempted: true, uncertain: false }), apply);
        expect(createListForVideo).not.toHaveBeenCalled();
        expect(apply).toHaveBeenCalledWith(item, expect.objectContaining({ id: '1' }), true, 'job', expect.anything());
    });
    it('全满先预写下一编号，再创建；完整回查唯一结果后才选为路由', async () => {
        publish();
        const full = [member('1', '待看1', 501), member('2', '待看2', 501)];
        vi.mocked(fetchBatchListDirectory).mockResolvedValueOnce(full).mockResolvedValueOnce([...full, member('3', '待看3', 1, true)]);
        vi.mocked(createListForVideo).mockImplementationOnce(async () => {
            expect(saved.at(-1)).toEqual({ listIds: [], createName: '待看3', createAttempted: true });
            return 'created';
        });
        const apply = vi.fn(async () => undefined);
        await applyBatchListGroup(item, choice(), true, 'job', context(), apply);
        expect(createListForVideo).toHaveBeenCalledWith('待看3', 'v1');
        expect(apply).toHaveBeenCalledWith(item, expect.objectContaining({ id: '3' }), true, 'job', expect.anything());
    });

    it('创建结果不确定且回查缺失，恢复仅查原名，绝不重复创建', async () => {
        publish();
        vi.mocked(fetchBatchListDirectory).mockResolvedValue([member('1', '待看1', 501), member('2', '待看2', 501)]);
        vi.mocked(createListForVideo).mockResolvedValue('unknown');
        const ctx = context(); const apply = vi.fn(async () => undefined);
        await expect(applyBatchListGroup(item, choice(), true, 'job', ctx, apply)).rejects.toThrow('不会重复创建');
        await expect(applyBatchListGroup(item, choice(), true, 'job', ctx, apply)).rejects.toThrow('不会重复创建');
        expect(createListForVideo).toHaveBeenCalledTimes(1);
        expect(apply).not.toHaveBeenCalled();
    });

    it('恢复发现唯一同名成员后复用，重名或规则无法命名时停止', async () => {
        publish();
        vi.mocked(fetchBatchListDirectory).mockResolvedValue([member('1', '待看1', 501), member('3', '待看3', 3)]);
        const apply = vi.fn(async () => undefined);
        await applyBatchListGroup(item, choice(), true, 'job', context({ listIds: [], createName: '待看3', createAttempted: true }), apply);
        expect(createListForVideo).not.toHaveBeenCalled();
        expect(apply).toHaveBeenCalledWith(item, expect.objectContaining({ id: '3' }), true, 'job', expect.anything());
    });

    it('同组跨视频执行持有同一把锁，路由目录按串行实时容量读取', async () => {
        publish(); publish('v2');
        let release!: () => void;
        const apply = vi.fn().mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; })).mockResolvedValue(undefined);
        vi.mocked(fetchBatchListDirectory).mockResolvedValue([member('1', '待看1')]);
        const first = applyBatchListGroup(item, choice(), true, 'job', context(), apply);
        await vi.waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
        const second = applyBatchListGroup({ ...item, videoId: 'v2' }, choice(), true, 'job', context(), apply);
        await Promise.resolve();
        expect(fetchBatchListDirectory).toHaveBeenCalledTimes(1);
        release(); await Promise.all([first, second]);
        expect(apply).toHaveBeenCalledTimes(2);
        expect(navigator.locks.request).toHaveBeenCalledWith(`jhs:batch-list-group:https://javdb.com:${choice().id}`, { mode: 'exclusive' }, expect.any(Function));
    });
});
