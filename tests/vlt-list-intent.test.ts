/** 跨入口最新意图：真实权威、原生预写和恢复；网络与 IndexedDB 使用替身。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { writePersistentValueAndWait } from '../src/core/storage/persistent-data-store';
import { handleCheckboxChange } from '../src/plugins/video-lists-tag/vlt-checkbox';
import { enqueueAssociationTask } from '../src/plugins/video-lists-tag/vlt-lock-queue';
import { enqueueServerCheckboxMutation } from '../src/plugins/video-lists-tag/vlt-server';
import { isCurrentListIntent, publishListIntent, readCurrentListIntent } from '../src/plugins/video-lists-tag/server/vlt-intent';
import {
    createPendingJournal,
    fetchAuthoritativeCheckboxState,
    postJavdbListMutation
} from '../src/plugins/video-lists-tag/server/vlt-server-api';
import type { PendingServerSync } from '../src/plugins/video-lists-tag/server/vlt-server-api';
import { commitAuthoritativeState, recoverPendingServerSyncs } from '../src/plugins/video-lists-tag/server/vlt-server-recover';

let pendingStore: Map<string, PendingServerSync>;
let gmStore: Map<string, unknown>;
let gmSet: ReturnType<typeof vi.fn>;

vi.mock('../src/core/storage/persistent-data-store', () => ({
    writePersistentValueAndWait: vi.fn(async (_namespace, key: string, _legacy, value: PendingServerSync) => {
        pendingStore.set(key, structuredClone(value));
    }),
    readPersistentPrefix: vi.fn(() => Object.fromEntries(pendingStore)),
    removePersistentValue: vi.fn((_namespace, key: string) => { pendingStore.delete(key); })
}));
vi.mock('../src/plugins/video-lists-tag/server/vlt-server-api', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return { ...actual, fetchAuthoritativeCheckboxState: vi.fn(), postJavdbListMutation: vi.fn() };
});
vi.mock('../src/plugins/video-lists-tag/vlt-db', () => ({ VltDb: {
    getListReconcileState: vi.fn(async () => ({ inventory: null, actualCount: 0, hasDesignation: false }))
} }));
vi.mock('../src/plugins/video-lists-tag/vlt-checkbox', () => ({ handleCheckboxChange: vi.fn() }));
vi.mock('../src/plugins/video-lists-tag/vlt-reconcile', () => ({
    reconcileListWithJavdb: vi.fn(async () => true),
    reconcileAfterConfirmedMutation: vi.fn(async () => true),
    reconcileListBeforeMutation: vi.fn(async () => undefined),
    setupAutomaticListReconciliation: vi.fn()
}));
vi.mock('../src/plugins/video-lists-tag/vlt-toast', () => ({ showToast: vi.fn() }));
vi.mock('../src/plugins/video-lists-tag/vlt-helpers', async (importOriginal) => ({
    ...await importOriginal<Record<string, unknown>>(),
    setListCheckboxState: vi.fn(), setListCheckboxBusy: vi.fn(), setListDisplayedCount: vi.fn()
}));
vi.mock('../src/plugins/video-lists-tag/vlt-lock-queue', async (importOriginal) => ({
    ...await importOriginal<Record<string, unknown>>(),
    enqueueAssociationTask: vi.fn(async (_key: string, task: () => Promise<void>) => task())
}));

const stamp = 1793577600000;
const movieInfo = { designation: 'TEST-001', info: {
    href: 'https://javdb.com/v/v1', title: '', cover_src: '', release_date: '', score: 0, series: 'TEST', code: '001'
} };
const listInfo = { list_id: 'L1', info: { url: 'https://javdb.com/lists/L1', name: '清单一' } };
const authoritative = (checked: boolean) => ({ checked, count: null, name: '清单一' });
const entry = (overrides: Partial<PendingServerSync> = {}): PendingServerSync => ({
    version: 1, videoId: 'v1', movieInfo, listInfo, desiredChecked: true, createdAt: stamp - 1000, ...overrides
});

beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(stamp);
    pendingStore = new Map();
    gmStore = new Map();
    gmSet = vi.fn((key: string, value: unknown) => { gmStore.set(key, value); });
    vi.stubGlobal('GM_setValue', gmSet);
    vi.stubGlobal('GM_getValue', (key: string, fallback: unknown) => gmStore.get(key) ?? fallback);
    vi.stubGlobal('window', { location: { origin: 'https://javdb.com', pathname: '/v/v1' } });
    vi.stubGlobal('clog', { error: vi.fn(), warn: vi.fn(), log: vi.fn() });
    vi.mocked(writePersistentValueAndWait).mockImplementation(async (_namespace, key, _legacy, value) => {
        pendingStore.set(key, structuredClone(value) as PendingServerSync);
    });
    vi.mocked(enqueueAssociationTask).mockImplementation(async (_key, task) => task());
    vi.mocked(fetchAuthoritativeCheckboxState).mockReset().mockResolvedValue(authoritative(true));
    vi.mocked(postJavdbListMutation).mockReset().mockResolvedValue({ kind: 'confirmed', message: 'ok' });
    vi.mocked(handleCheckboxChange).mockReset().mockResolvedValue({ movie: 'existed', list: 'existed', association: 'created' });
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('最新意图权威', () => {
    it('逻辑组占位可升级为已预写实体目标，恢复占位不得再降级', () => {
        publishListIntent('v1', 'L1', 'job', stamp, true, { supersedeOnly: true });
        expect(readCurrentListIntent('v1', 'L1')?.supersedeOnly).toBe(true);
        publishListIntent('v1', 'L1', 'job', stamp, true);
        expect(readCurrentListIntent('v1', 'L1')?.supersedeOnly).toBeUndefined();
        publishListIntent('v1', 'L1', 'job', stamp, true, { supersedeOnly: true });
        expect(readCurrentListIntent('v1', 'L1')?.supersedeOnly).toBeUndefined();
    });
    it('无权威记录不把任何 token 误判为当前', () => {
        expect(isCurrentListIntent('v1', 'L1', 'unknown')).toBe(false);
    });

    it('较旧恢复不覆盖新操作；相同 token 可幂等重入', () => {
        publishListIntent('v1', 'L1', 'new', stamp, false, { explicit: true });
        publishListIntent('v1', 'L1', 'old', stamp - 1, true);
        publishListIntent('v1', 'L1', 'new', stamp, false);
        expect(isCurrentListIntent('v1', 'L1', 'new')).toBe(true);
        expect(gmSet).toHaveBeenCalledTimes(1);
    });

    it('同毫秒新明确操作按发布顺序胜出，旧恢复不能反抢', () => {
        publishListIntent('v1', 'L1', 'batch-old', stamp, true, { explicit: true });
        publishListIntent('v1', 'L1', 'native-new', stamp, false, { explicit: true });
        publishListIntent('v1', 'L1', 'batch-old', stamp, true);
        expect(isCurrentListIntent('v1', 'L1', 'native-new')).toBe(true);
        expect(isCurrentListIntent('v1', 'L1', 'batch-old')).toBe(false);
    });

    it('同毫秒未发布过的旧预写恢复也不覆盖现权威', () => {
        publishListIntent('v1', 'L1', 'native-new', stamp, false, { explicit: true });
        publishListIntent('v1', 'L1', 'batch-crashed-before-publish', stamp, true);
        expect(isCurrentListIntent('v1', 'L1', 'native-new')).toBe(true);
    });

    it('相同 token 不能重新解释为不同的时间或目标状态', () => {
        publishListIntent('v1', 'L1', 'token', stamp, true);
        expect(() => publishListIntent('v1', 'L1', 'token', stamp, false)).toThrow('不能复用');
        expect(() => publishListIntent('v1', 'L1', 'token', stamp + 1, true)).toThrow('不能复用');
    });

    it('坏数据与回读失败会关闭写入，保留原始坏数据', () => {
        publishListIntent('v1', 'L1', 'token', stamp, true);
        const key = [...gmStore.keys()][0];
        gmStore.set(key, 'bad-json');
        expect(() => publishListIntent('v1', 'L1', 'new', stamp + 1, false)).toThrow();
        expect(gmStore.get(key)).toBe('bad-json');
        gmStore.clear();
        gmSet.mockImplementationOnce(() => undefined);
        expect(() => publishListIntent('v1', 'L1', 'new', stamp, false)).toThrow('回读不一致');
    });

    it('网站影片 ID 与清单 ID 共同隔离记录', () => {
        publishListIntent('v1', 'L1', 'a', stamp, true);
        publishListIntent('v1', 'L2', 'b', stamp, false);
        publishListIntent('v2', 'L1', 'c', stamp, false);
        expect(gmStore.size).toBe(3);
        expect(isCurrentListIntent('v1', 'L1', 'a')).toBe(true);
    });
});

describe('原生预写与批量意图双向覆盖', () => {
    it('原生完整日志必须先落盘，才允许发布权威', async () => {
        gmSet.mockImplementation((key: string, value: unknown) => {
            expect(pendingStore.size).toBe(1);
            expect([...pendingStore.values()][0].intentId).toBeTruthy();
            gmStore.set(key, value);
        });
        const pending = entry();
        expect(await createPendingJournal(pending)).toBeTruthy();
        expect(isCurrentListIntent('v1', 'L1', pending.intentId!)).toBe(true);
    });

    it('原生日志落盘失败，不发布权威也不发网站请求', async () => {
        vi.mocked(writePersistentValueAndWait).mockRejectedValueOnce(new Error('IDB failed'));
        await enqueueServerCheckboxMutation(movieInfo, listInfo, true, null, false);
        expect(gmStore.size).toBe(0);
        expect(postJavdbListMutation).not.toHaveBeenCalled();
    });

    it('原生权威回读失败，不发网站请求，完整预写可在之后恢复', async () => {
        gmSet.mockImplementationOnce(() => undefined);
        await enqueueServerCheckboxMutation(movieInfo, listInfo, true, null, false);
        expect(pendingStore.size).toBe(1);
        expect(postJavdbListMutation).not.toHaveBeenCalled();
    });

    it('旧原生点击排队期间出现较新批量意图，拿锁后不能重新获得较新的时间', async () => {
        let resume!: () => Promise<void>;
        vi.mocked(enqueueAssociationTask).mockImplementationOnce((_key, task) => new Promise<void>((resolve) => {
            resume = async () => { await task(); resolve(); };
        }));
        const queued = enqueueServerCheckboxMutation(movieInfo, listInfo, true, null, false);
        vi.setSystemTime(stamp + 10);
        publishListIntent('v1', 'L1', 'batch-later', stamp + 10, false, { explicit: true });
        vi.setSystemTime(stamp + 20);
        await resume();
        await queued;
        expect(postJavdbListMutation).not.toHaveBeenCalled();
        expect(isCurrentListIntent('v1', 'L1', 'batch-later')).toBe(true);
        expect([...pendingStore.values()][0].createdAt).toBe(stamp);
    });

    it('原生旧加入 → 批量新移出：旧原生恢复不 POST、不提交本地', async () => {
        const pending = entry();
        await createPendingJournal(pending);
        publishListIntent('v1', 'L1', 'batch-new', stamp, false, { explicit: true });
        await recoverPendingServerSyncs();
        expect(fetchAuthoritativeCheckboxState).not.toHaveBeenCalled();
        expect(postJavdbListMutation).not.toHaveBeenCalled();
        expect(handleCheckboxChange).not.toHaveBeenCalled();
        expect(pendingStore.size).toBe(0);
    });

    it('批量旧加入 → 原生新移出：新原生 token 胜出，旧批量默认发布不能复活', async () => {
        publishListIntent('v1', 'L1', 'batch-old', stamp - 1000, true, { explicit: true });
        vi.mocked(fetchAuthoritativeCheckboxState).mockResolvedValue(authoritative(false));
        await enqueueServerCheckboxMutation(movieInfo, listInfo, false, null, true);
        expect(postJavdbListMutation).toHaveBeenCalledWith('v1', 'L1', false);
        publishListIntent('v1', 'L1', 'batch-old', stamp - 1000, true);
        expect(isCurrentListIntent('v1', 'L1', 'batch-old')).toBe(false);
        expect(enqueueAssociationTask).toHaveBeenCalledWith('video:v1::L1', expect.any(Function));
    });

    it('legacy 原生日志不能覆盖已发布的批量意图', async () => {
        pendingStore.set('legacy', entry());
        publishListIntent('v1', 'L1', 'batch-new', stamp, false, { explicit: true });
        await recoverPendingServerSyncs();
        expect(postJavdbListMutation).not.toHaveBeenCalled();
        expect(handleCheckboxChange).not.toHaveBeenCalled();
        expect(pendingStore.size).toBe(0);
        expect(isCurrentListIntent('v1', 'L1', 'batch-new')).toBe(true);
    });

    it('没有权威时兼容 legacy，按稳定 token 恢复且匹配状态不重复 POST', async () => {
        pendingStore.set('legacy', entry());
        await recoverPendingServerSyncs();
        expect(postJavdbListMutation).not.toHaveBeenCalled();
        expect(handleCheckboxChange).toHaveBeenCalledTimes(1);
        expect(pendingStore.size).toBe(0);
        expect(isCurrentListIntent('v1', 'L1', 'legacy:jdb:vlt-pending-server-sync:legacy')).toBe(true);
    });

    it('完整预写后、发布前中断，恢复时可安全补发权威', async () => {
        pendingStore.set('interrupted', entry({ intentId: 'native-interrupted' }));
        await recoverPendingServerSyncs();
        expect(isCurrentListIntent('v1', 'L1', 'native-interrupted')).toBe(true);
        expect(handleCheckboxChange).toHaveBeenCalledTimes(1);
    });

    it('等待关联锁期间出现新意图，旧枚举必须在锁内重新检查并丢弃', async () => {
        pendingStore.set('legacy', entry());
        vi.mocked(enqueueAssociationTask).mockImplementationOnce(async (_key, task) => {
            publishListIntent('v1', 'L1', 'batch-new', stamp, false, { explicit: true });
            await task();
        });
        await recoverPendingServerSyncs();
        expect(postJavdbListMutation).not.toHaveBeenCalled();
        expect(fetchAuthoritativeCheckboxState).not.toHaveBeenCalled();
        expect(pendingStore.size).toBe(0);
    });

    it('直接提交旧 token 也不得重推或写入；目标不存在不提交移出', async () => {
        const pending = entry({ intentId: 'old' });
        publishListIntent('v1', 'L1', 'new', stamp, false, { explicit: true });
        expect(await commitAuthoritativeState(pending, authoritative(false), false)).toBe(false);
        expect(postJavdbListMutation).not.toHaveBeenCalled();
        expect(handleCheckboxChange).not.toHaveBeenCalled();
        expect(await commitAuthoritativeState(entry({ intentId: 'new', desiredChecked: false }), { checked: false, count: null, name: null }, false)).toBe(false);
    });

    it('无权威的升级恢复先执行最新日志，旧日志不产生临时反向写', async () => {
        pendingStore.set('older', entry());
        pendingStore.set('newer', entry({ createdAt: stamp, desiredChecked: false }));
        vi.mocked(fetchAuthoritativeCheckboxState).mockResolvedValue(authoritative(true));
        // 新期望移出被明确拒绝时仍保留最新权威，不能退而恢复旧加入。
        vi.mocked(postJavdbListMutation).mockResolvedValue({ kind: 'rejected', message: 'test' });
        await recoverPendingServerSyncs();
        expect(postJavdbListMutation).toHaveBeenCalledTimes(1);
        expect(postJavdbListMutation).toHaveBeenCalledWith('v1', 'L1', false);
        expect(pendingStore.has('older')).toBe(false);
        expect(pendingStore.has('newer')).toBe(true);
    });
});
