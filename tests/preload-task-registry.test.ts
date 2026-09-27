/**
 * 预加载任务注册表（`osp-preload-tasks.ts`）回归测试（doc/26）。
 *
 * 面板的数据源：展示信息（番号/站点）、失败留存、状态计数与容量淘汰。
 */
import { describe, expect, it } from 'vitest';
import { PreloadTaskRegistry, isTerminalStatus } from '../src/plugins/other-site/osp-preload-tasks';

describe('PreloadTaskRegistry', () => {
    it('upsert 写入 queued 记录并保存展示信息', () => {
        const registry = new PreloadTaskRegistry();
        const record = registry.upsert('DAZD-314_missAvBtn', 'DAZD-314', 'missAvBtn', 'missAv');
        expect(record.status).toBe('queued');
        expect(registry.get('DAZD-314_missAvBtn')).toMatchObject({
            carNum: 'DAZD-314',
            siteId: 'missAvBtn',
            siteLabel: 'missAv'
        });
        expect(registry.size).toBe(1);
    });

    it('同键重复 upsert 回到 queued 并刷新时间戳（重试语义）', () => {
        const registry = new PreloadTaskRegistry();
        registry.upsert('k', 'A', 's', 'S');
        registry.setStatus('k', 'failed');
        expect(registry.get('k')?.status).toBe('failed');
        registry.upsert('k', 'A', 's', 'S', 999);
        expect(registry.get('k')?.status).toBe('queued');
        expect(registry.get('k')?.updatedAt).toBe(999);
        expect(registry.size).toBe(1);
    });

    it('setStatus 只改已知任务，未知键返回 false（不凭空创建）', () => {
        const registry = new PreloadTaskRegistry();
        registry.upsert('k', 'A', 's', 'S');
        expect(registry.setStatus('k', 'requesting')).toBe(true);
        expect(registry.setStatus('nope', 'failed')).toBe(false);
        expect(registry.size).toBe(1);
    });

    it('counts 统计各状态数量', () => {
        const registry = new PreloadTaskRegistry();
        registry.upsert('a', 'A', 's', 'S');
        registry.upsert('b', 'B', 's', 'S');
        registry.upsert('c', 'C', 's', 'S');
        registry.setStatus('b', 'requesting');
        registry.setStatus('c', 'failed');
        expect(registry.counts()).toEqual({ queued: 1, requesting: 1, failed: 1, cancelled: 0 });
    });

    it('list 把执行中/等待中排在终态之前（各自按时间升序）', () => {
        const registry = new PreloadTaskRegistry();
        registry.upsert('failed-old', 'F1', 's', 'S', 10);
        registry.upsert('failed-new', 'F2', 's', 'S', 20);
        registry.setStatus('failed-old', 'failed');
        registry.setStatus('failed-new', 'cancelled');
        registry.upsert('queued-late', 'Q2', 's', 'S', 40);
        registry.upsert('queued-early', 'Q1', 's', 'S', 30);
        expect(registry.list().map((r) => r.key)).toEqual([
            'queued-early',
            'queued-late',
            'failed-old',
            'failed-new'
        ]);
    });

    it('clearTerminal 只清终态并返回数量', () => {
        const registry = new PreloadTaskRegistry();
        registry.upsert('a', 'A', 's', 'S');
        registry.upsert('b', 'B', 's', 'S');
        registry.upsert('c', 'C', 's', 'S');
        registry.setStatus('b', 'failed');
        registry.setStatus('c', 'cancelled');
        expect(registry.clearTerminal()).toBe(2);
        expect(registry.list().map((r) => r.key)).toEqual(['a']);
    });

    it('remove / clear', () => {
        const registry = new PreloadTaskRegistry();
        registry.upsert('a', 'A', 's', 'S');
        expect(registry.remove('a')).toBe(true);
        expect(registry.remove('a')).toBe(false);
        registry.upsert('b', 'B', 's', 'S');
        registry.clear();
        expect(registry.size).toBe(0);
    });

    it('超容量时优先淘汰最旧的终态记录，等待中记录保留', () => {
        const registry = new PreloadTaskRegistry(3);
        registry.upsert('t1', 'T1', 's', 'S', 1);
        registry.setStatus('t1', 'failed');
        registry.upsert('t2', 'T2', 's', 'S', 2);
        registry.setStatus('t2', 'failed');
        registry.upsert('q1', 'Q1', 's', 'S', 3);
        registry.upsert('q2', 'Q2', 's', 'S', 4);
        registry.upsert('q3', 'Q3', 's', 'S', 5);
        expect(registry.get('t1')).toBeUndefined();
        expect(registry.get('q1')).toBeDefined();
        expect(registry.size).toBeLessThanOrEqual(3);
    });

    it('isTerminalStatus 只认 failed / cancelled', () => {
        expect(isTerminalStatus('failed')).toBe(true);
        expect(isTerminalStatus('cancelled')).toBe(true);
        expect(isTerminalStatus('queued')).toBe(false);
        expect(isTerminalStatus('requesting')).toBe(false);
    });
});
