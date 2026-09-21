/**
 * 访问记录查询纯函数 lookupVisitTime（visit-history-plugin.ts）回归测试。
 *
 * 覆盖：
 * 1. 精确匹配优先：pathname+search 完全一致直接命中，即使存在同 pathname
 *    更新的带参记录也返回精确键的时间戳
 * 2. 回退匹配：链接无 query（如 `/actors/xxx`）而访问记录带翻页/筛选参数
 *    （如 `/actors/xxx?page=2`）时，取同 pathname 最新一条
 * 3. pathname 边界：`/actors/a` 不得匹配 `/actors/ab`（base 后必须紧跟
 *    '?' 或结尾）
 * 4. 无命中返回 undefined
 *
 * environment: jsdom（文件级 pragma）——模块链上的 constants/site 依赖
 * window.location，node 环境无法导入。
 */
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { lookupVisitTime } from '../src/plugins/visit-history-plugin';

describe('lookupVisitTime 精确匹配', () => {
    it('pathname+search 完全一致时直接命中', () => {
        const history = { '/actors/a?page=2': 100, '/actors/a': 200 };
        expect(lookupVisitTime(history, '/actors/a?page=2')).toBe(100);
    });

    it('精确键优先于同 pathname 的其他记录', () => {
        const history = { '/actors/a?page=2': 100, '/actors/a?page=3': 999 };
        expect(lookupVisitTime(history, '/actors/a?page=2')).toBe(100);
    });

    it('无 query 的 path 精确命中', () => {
        const history = { '/actors/a?page=2': 100, '/actors/a': 200 };
        expect(lookupVisitTime(history, '/actors/a')).toBe(200);
    });
});

describe('lookupVisitTime 回退匹配（翻页/筛选参数不一致）', () => {
    it('无 query 链接回退到同 pathname 带参记录的最新一条', () => {
        const history = { '/actors/a?page=1': 100, '/actors/a?page=2': 300, '/actors/a?page=3': 200 };
        expect(lookupVisitTime(history, '/actors/a')).toBe(300);
    });

    it('带 query 但精确未命中时也回退（如筛选参数变化）', () => {
        const history = { '/search?q=x&f=all': 100, '/search?q=x&f=actor': 400 };
        expect(lookupVisitTime(history, '/search?q=x')).toBe(400);
    });

    it('回退覆盖仅记录无 query 版本的场景', () => {
        const history = { '/actors/a': 100 };
        expect(lookupVisitTime(history, '/actors/a?page=1')).toBe(100);
    });
});

describe('lookupVisitTime 边界', () => {
    it('pathname 前缀相同但更长的 path 不误匹配', () => {
        const history = { '/actors/ab?page=1': 100 };
        expect(lookupVisitTime(history, '/actors/a')).toBeUndefined();
    });

    it('反向：查带参记录时同前缀更长 pathname 不误匹配', () => {
        const history = { '/actors/ab': 100 };
        expect(lookupVisitTime(history, '/actors/a?page=1')).toBeUndefined();
    });

    it('空历史返回 undefined', () => {
        expect(lookupVisitTime({}, '/actors/a')).toBeUndefined();
    });

    it('其他 pathname 的记录不参与回退', () => {
        const history = { '/directors/b': 100, '/actors/c?page=1': 200 };
        expect(lookupVisitTime(history, '/actors/a')).toBeUndefined();
    });
});
