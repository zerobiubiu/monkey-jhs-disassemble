import { vi, type Mock } from 'vitest';
import type { BatchListChoice, BatchListJob, BatchListJournalItem } from '../src/types/batch-lists';
import { drainBatchRatings } from '../src/plugins/list-page/lp-batch-sync';
import { applyBatchListItem } from '../src/plugins/list-page/batch-lists/site';
import { captureBatchRating, finishBatchRatings, prepareBatchRatings } from '../src/plugins/list-page/batch-lists/ratings';

export const origin = 'https://javdb.com';
export const journalKey = 'jhs:batch-list-journal:' + origin;
export const executionKey = 'jhs:batch-list-running:' + origin;
export const executionLock = 'jhs:batch-lists:' + origin;
export const list = { id: 'L1', name: '清单一', url: origin + '/lists/L1' };
export const secondList = { id: 'L2', name: '清单二', url: origin + '/lists/L2' };
export const item = (id: number) => ({ carNum: `TEST-00${id}`, videoId: `v${id}`, url: `${origin}/v/v${id}` });

export function journalItem(id: number, overrides: Partial<BatchListJournalItem> = {}, lists: BatchListChoice[] = [list]): BatchListJournalItem {
    return { ...item(id), state: 'pending', error: '', ratingsComplete: true,
        operations: lists.map((entry) => ({ listId: entry.id, state: 'pending', error: '' })), ...overrides };
}

export function pendingJob(overrides: Partial<BatchListJob> = {}): BatchListJob {
    return { version: 2, id: 'persisted-job', origin, lists: [list], desiredChecked: true,
        createdAt: Date.now() - 60000, updatedAt: Date.now() - 60000,
        attempts: 1, retryAt: Date.now() - 1000, ratingsComplete: true, items: [journalItem(1)], ...overrides };
}

export interface BatchListTestEnvironment {
    persisted: Map<string, unknown>;
    gmSet: Mock<(key: string, value: unknown) => void>;
    getSetting: Mock<() => Promise<unknown>>;
    lockRequest: Mock<(name: string, options: { signal?: AbortSignal; ifAvailable?: boolean },
        task: (lock: { name: string } | null) => Promise<unknown>) => Promise<unknown>>;
    seed(...jobs: BatchListJob[]): void;
}

export function installBatchListEnvironment(): BatchListTestEnvironment {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-02T00:00:00Z'));
    vi.clearAllMocks();
    const persisted = new Map<string, unknown>();
    const gmSet = vi.fn((key: string, value: unknown) => { persisted.set(key, value); });
    vi.stubGlobal('GM_setValue', gmSet);
    vi.stubGlobal('GM_getValue', (key: string, fallback: unknown) => persisted.get(key) ?? fallback);
    vi.stubGlobal('window', { location: { origin } });
    vi.stubGlobal('clog', { error: vi.fn(), warn: vi.fn(), log: vi.fn() });
    const getSetting = vi.fn(async () => undefined as unknown);
    vi.stubGlobal('storageManager', { getSetting });
    const tails = new Map<string, Promise<unknown>>();
    const counts = new Map<string, number>();
    const held = new Set<string>();
    const lockRequest = vi.fn((name: string, options: { signal?: AbortSignal; ifAvailable?: boolean },
        task: (lock: { name: string } | null) => Promise<unknown>) => {
        if (options.ifAvailable && counts.get(name)) return Promise.resolve().then(() => task(null));
        counts.set(name, (counts.get(name) ?? 0) + 1);
        let started = false;
        const run = async () => {
            try {
                if (options.signal?.aborted) throw options.signal.reason;
                started = true;
                held.add(name);
                return await task({ name });
            } finally { held.delete(name); counts.set(name, counts.get(name)! - 1); }
        };
        const current = (tails.get(name) ?? Promise.resolve()).then(run, run);
        tails.set(name, current.catch(() => undefined));
        if (!options.signal) return current;
        const signal = options.signal;
        return new Promise((resolve, reject) => {
            const stop = () => { if (!started) reject(signal.reason); };
            signal.addEventListener('abort', stop, { once: true });
            current.then(resolve, reject).then(() => signal.removeEventListener('abort', stop));
            if (signal.aborted) stop();
        });
    });
    vi.stubGlobal('navigator', { locks: { request: lockRequest,
        query: vi.fn(async () => ({ held: [...held].map((name) => ({ name })), pending: [] })) } });
    vi.mocked(applyBatchListItem).mockReset().mockResolvedValue(undefined);
    vi.mocked(drainBatchRatings).mockReset().mockImplementation(async (_targets, notify) => {
        notify?.(0, 0, 0); return { total: 0, succeeded: 0, failed: 0 };
    });
    vi.mocked(captureBatchRating).mockReset().mockImplementation(async (_item, revision) => ({
        revision, requestedAt: Date.now(), baseline: '', before: { status: '', score: 0 }, phase: 'pending'
    }));
    vi.mocked(prepareBatchRatings).mockReset().mockImplementation(async (job, persist, _signal, items = job.items) => {
        for (const entry of items) if (entry.rating && !['success', 'superseded'].includes(entry.rating.phase)) entry.rating.phase = 'registered';
        await persist();
    });
    vi.mocked(finishBatchRatings).mockReset().mockImplementation(async (job, persist, items = job.items) => {
        for (const entry of items) if (entry.rating?.phase === 'registered') entry.rating.phase = 'success';
        await persist();
    });
    return { persisted, gmSet, getSetting, lockRequest, seed: (...jobs: BatchListJob[]) => { persisted.set(journalKey, JSON.stringify(jobs)); } };
}

export async function finishTimers<T>(running: Promise<T>): Promise<T> { await vi.runAllTimersAsync(); return running; }
