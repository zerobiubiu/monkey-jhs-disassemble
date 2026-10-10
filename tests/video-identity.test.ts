/**
 * 番号身份领域模块单测（doc/46 领域重构试点）。
 *
 * 覆盖 `src/core/domain/car-num.ts` 的三种归一化策略、匹配键/等价判定与
 * 西方番号格式化规则。用例口径来自各调用点在重构前的实测行为：
 * 迁移必须逐字保语义（同一入参 → 同一出参），因此这里同时是回归基线。
 */
import { describe, expect, it } from 'vitest';

import { carNumEquals, carNumKey, formatWesternCarNum, normalizeCarNum } from '../src/core/domain/car-num';

describe('normalizeCarNum（upper：存储键口径）', () => {
    it('去空白并大写', () => {
        expect(normalizeCarNum('  ebod-857 ', 'upper')).toBe('EBOD-857');
        expect(normalizeCarNum('EBOD-857', 'upper')).toBe('EBOD-857');
    });

    it('默认策略为 upper', () => {
        expect(normalizeCarNum(' abc ')).toBe('ABC');
    });

    it('空入参返回空串', () => {
        expect(normalizeCarNum('', 'upper')).toBe('');
        expect(normalizeCarNum(null, 'upper')).toBe('');
        expect(normalizeCarNum(undefined, 'upper')).toBe('');
    });

    it('不动内部空白（与 rating 策略区分）', () => {
        expect(normalizeCarNum('car 1', 'upper')).toBe('CAR 1');
    });
});

describe('normalizeCarNum（rating：评分域口径）', () => {
    it('空白转连字符', () => {
        expect(normalizeCarNum('HMN 095', 'rating')).toBe('HMN-095');
        expect(normalizeCarNum('  hmn-095  ', 'rating')).toBe('HMN-095');
    });

    it('连续空白折叠为一个连字符', () => {
        expect(normalizeCarNum('a   b', 'rating')).toBe('A-B');
    });

    it('空入参返回空串', () => {
        expect(normalizeCarNum('', 'rating')).toBe('');
        expect(normalizeCarNum(null, 'rating')).toBe('');
    });
});

describe('normalizeCarNum（path：MissAV 页面形态口径）', () => {
    it('取末段后按 _/- 取前两段（doc 中记录的四个真实样本）', () => {
        expect(normalizeCarNum('hmn-095-uncensored-leak', 'path')).toBe('HMN-095');
        expect(normalizeCarNum('ebod-857', 'path')).toBe('EBOD-857');
        expect(normalizeCarNum('fc2-ppv-4771232', 'path')).toBe('FC2-PPV-4771232');
        expect(normalizeCarNum('112325_01', 'path')).toBe('112325-01');
    });

    it('带路径前缀时只取末段', () => {
        expect(normalizeCarNum('/v/hmn-095-uncensored-leak', 'path')).toBe('HMN-095');
    });

    it('单段番号原样大写', () => {
        expect(normalizeCarNum('abc123', 'path')).toBe('ABC123');
    });

    it('空入参返回空串', () => {
        expect(normalizeCarNum('', 'path')).toBe('');
    });
});

describe('carNumKey / carNumEquals（匹配口径）', () => {
    it('忽略大小写时折叠为大写无关键', () => {
        expect(carNumKey('Abc-1', true)).toBe('abc-1');
        expect(carNumKey('Abc-1', false)).toBe('Abc-1');
    });

    it('等价判定跟随调用方传入的大小写口径', () => {
        expect(carNumEquals('abc-1', 'ABC-1', true)).toBe(true);
        expect(carNumEquals('abc-1', 'ABC-1', false)).toBe(false);
        expect(carNumEquals('ABC-1', 'ABC-1', false)).toBe(true);
    });

    it('不做 trim：空白差异仍视为不同番号（保持既有语义）', () => {
        expect(carNumEquals(' abc-1', 'abc-1', true)).toBe(false);
    });
});

describe('formatWesternCarNum（西方番号格式化业务规则）', () => {
    it('纯字母番号 + 发布日期 → CAR.YY.MM.DD', () => {
        expect(formatWesternCarNum('ABC', '2023-05-06')).toBe('ABC.23.05.06');
    });

    it('多词字母番号去掉内部空白', () => {
        expect(formatWesternCarNum('ABC DEF', '2023-05-06')).toBe('ABCDEF.23.05.06');
    });

    it('非纯字母番号原样返回', () => {
        expect(formatWesternCarNum('ABC-123', '2023-05-06')).toBe('ABC-123');
    });

    it('缺日期或日期不含 YY-MM-DD 时原样返回', () => {
        expect(formatWesternCarNum('ABC', '')).toBe('ABC');
        expect(formatWesternCarNum('ABC', '无日期')).toBe('ABC');
    });
});