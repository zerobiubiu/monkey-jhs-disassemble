/**
 * 缓存诊断探针单测（doc/40）。
 *
 * 覆盖：缓存就绪判定、快照读写、检查报告的判据分支（缓存热/冷、耗时高低）。
 * 存储用内存替身，不触 GM / 真实 IndexedDB。
 *
 * 注：vitest 跑 `environment: 'node'`（无 `window`），而探针的 `frameTag()` 会读
 * `window.top`；因此这里装一个最小 window 替身，使探针可在单测中直接调用。
 *
 * 语义提醒：`checkCacheProbe` 报告的是**读取尝试之前**的缓存状态（这正是它的用途：
 * 「② 检查」在操作之后跑，报告那一刻缓存是否已被清空），因此「缓存热」用例必须
 * 复用同一个已被 ① 记录填充过缓存的替身。
 */

import { beforeEach, describe, expect, it } from 'vitest';

import {
    captureCacheProbe,
    checkCacheProbe,
    readCacheProbeSnapshot,
    type SettingsReader
} from '../src/core/plugin-diagnostics';

/** GM 存储替身。 */
function installGmStub() {
    const store = new Map<string, unknown>();
    (globalThis as unknown as { GM_setValue: unknown }).GM_setValue = (k: string, v: unknown) => {
        store.set(k, v);
    };
    (globalThis as unknown as { GM_getValue: unknown }).GM_getValue = (k: string, d: unknown) =>
        store.has(k) ? store.get(k) : d;
    return store;
}

/**
 * 最小 window 替身：`window` 与 `window.top` 不同 → 探针判定为 iframe 帧。
 *
 * @param topIsSelf true = 顶层帧；false = iframe 帧
 */
function installWindowStub(topIsSelf: boolean): void {
    const g = globalThis as unknown as { window?: unknown };
    const self = {};
    g.window = topIsSelf ? Object.assign(self, { top: self }) : { top: {} };
}

/** 设置读取替身：模拟「读取会填充缓存」，并可注入耗时。 */
function createSettingsStub(options: { warmAfterFirstRead?: boolean; delayMs?: number } = {}) {
    const state = { reads: 0 };
    // 探针从 reader 自身读取 cacheSettingObj（对应 StorageManager 的运行时私有字段）
    const reader = {
        cacheSettingObj: undefined as unknown,
        getSetting: async () => {
            state.reads++;
            if (options.warmAfterFirstRead !== false) {
                reader.cacheSettingObj = { dialogOpenDetail: 'yes' };
            }
            if (options.delayMs) await new Promise((r) => setTimeout(r, options.delayMs));
            return 'yes';
        }
    } satisfies SettingsReader & { cacheSettingObj?: unknown };
    return { reader, state };
}

beforeEach(() => {
    installGmStub();
    installWindowStub(false);
});

describe('captureCacheProbe / readCacheProbeSnapshot', () => {
    it('记录后快照可读回，且缓存状态为就绪', async () => {
        const { reader, state } = createSettingsStub();

        const snapshot = await captureCacheProbe(reader);

        expect(snapshot.warm).toBe(true);
        expect(snapshot.frame).toBe('iframe');
        expect(state.reads).toBe(1);
        expect(readCacheProbeSnapshot()?.warm).toBe(true);
    });

    it('无快照时返回 null', () => {
        expect(readCacheProbeSnapshot()).toBeNull();
    });

    it('替身始终不填缓存时为「未就绪」', async () => {
        const { reader } = createSettingsStub({ warmAfterFirstRead: false });

        const snapshot = await captureCacheProbe(reader);

        expect(snapshot.warm).toBe(false);
    });
});

describe('checkCacheProbe 报告判据', () => {
    it('缓存热 + 低耗时报 OK', async () => {
        const stub = createSettingsStub();
        await captureCacheProbe(stub.reader); // ① 记录（同时填充缓存）

        const report = await checkCacheProbe(stub.reader); // ② 检查

        expect(report).toContain('当前：缓存=已就绪');
        expect(report).toContain('OK 设置缓存仍是热的');
        expect(report).toContain('OK 读取耗时正常');
    });

    it('缓存被清时报 BAD（doc/39 根因回归信号）', async () => {
        await captureCacheProbe(createSettingsStub().reader);

        const report = await checkCacheProbe(createSettingsStub({ warmAfterFirstRead: false }).reader);

        expect(report).toContain('当前：缓存=空');
        expect(report).toContain('BAD 设置缓存是空的');
    });

    it('高耗时提示走了数据库', async () => {
        const stub = createSettingsStub({ delayMs: 12 });
        await captureCacheProbe(stub.reader);

        const report = await checkCacheProbe(stub.reader);

        expect(report).toContain('WARN 读取耗时');
    });

    it('无快照时提示先记录', async () => {
        const report = await checkCacheProbe(createSettingsStub().reader);

        expect(report).toContain('快照：无');
    });
});
