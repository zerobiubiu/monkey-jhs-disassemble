/**
 * deltaRoute 形状路由回归测试 —— 保护 doc/189 跨站 flag 不对称静默丢增量修复。
 *
 * 背景：javdb=ON 把 GM_KEY_CAR_STATUS_DELTA 写成数组 journal，missav=OFF 的旧
 * consumeDelta 只认单对象 `.action`，收到数组静默丢弃。修复让消费端按**载荷形状**
 * 路由：数组无条件走 journal 消费器，单对象维持本地 flag 门控。
 *
 * 本套件只测纯函数 seam `deltaRoute`（无 GM/IDB/DOM 依赖）；监听器整体依赖
 * GM_addValueChangeListener + IndexedDB，非纯函数，不在单测范围。
 *
 * environment: node（纯函数，无 window 依赖）。
 */
import { describe, expect, it } from 'vitest';

import { deltaRoute } from '../src/plugins/car-status-sync/car-status-delta-route';

/** 一个合法的单对象增量载荷（flag-OFF javdb 发布端所写形状）。 */
const SINGLE_OBJECT = {
    action: 'upsert',
    items: [{ carNum: 'ABC-123', status: 'favorite', url_path: 'abc123' }],
    ts: 1721800000000
};

/** 一个合法的数组 journal（flag-ON javdb 发布端所写形状）。 */
const JOURNAL = [SINGLE_OBJECT];

describe('deltaRoute 四组合（doc/189 核心契约）', () => {
    it('数组 + 本地 flag ON → journal', () => {
        expect(deltaRoute(JOURNAL, true)).toBe('journal');
    });

    it('数组 + 本地 flag OFF → journal（修复点：不再按本地 flag 走 legacy 静默丢）', () => {
        expect(deltaRoute(JOURNAL, false)).toBe('journal');
    });

    it('单对象 + 本地 flag ON → journal（readDeltaJournal 把单对象包成数组）', () => {
        expect(deltaRoute(SINGLE_OBJECT, true)).toBe('journal');
    });

    it('单对象 + 本地 flag OFF → legacy（flag 对称旧路径，逐字节不变）', () => {
        expect(deltaRoute(SINGLE_OBJECT, false)).toBe('legacy');
    });
});

describe('deltaRoute 边界值', () => {
    it('空数组 → journal（形状是数组即新协议发布端所写，readDeltaJournal([]) 空转无副作用）', () => {
        // 理由：空数组若判 legacy 会被塞给只认单对象的 consumeDelta，正是本修复要消灭的
        // 静默丢路径；判 journal 时 readDeltaJournal([]) 过滤为 []，消费器 for 循环零次，安全。
        expect(deltaRoute([], true)).toBe('journal');
        expect(deltaRoute([], false)).toBe('journal');
    });

    it('null → 按本地 flag（ON→journal，OFF→legacy；监听器真值守卫下不会收到）', () => {
        expect(deltaRoute(null, true)).toBe('journal');
        expect(deltaRoute(null, false)).toBe('legacy');
    });

    it('undefined → 按本地 flag（GM 键不存在；readDeltaJournal 对 falsy 返回 []）', () => {
        expect(deltaRoute(undefined, true)).toBe('journal');
        expect(deltaRoute(undefined, false)).toBe('legacy');
    });

    it('字符串 → 按本地 flag（非对象非数组，与修复前逐字节一致）', () => {
        expect(deltaRoute('not-a-payload', true)).toBe('journal');
        expect(deltaRoute('not-a-payload', false)).toBe('legacy');
    });
});
