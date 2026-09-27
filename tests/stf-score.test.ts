// @vitest-environment jsdom
/**
 * 已读星级筛选索引（`stf-score.ts`）回归测试。
 *
 * 覆盖：car_list → 评分索引的构建与归一化、星级芯片值解析、
 * 以及卡片番号/星级分布读取（需求 doc/24）。
 *
 * 关键设计：星级判定**不依赖 DOM 里是否渲染了「已读」标签**，只看 car_list
 * 是否有该番号的已读记录 —— 这样「有记录但标签未渲染」的卡片也能被计入与筛选。
 */
import { describe, expect, it } from 'vitest';
import { FAVORITE_ACTION, FILTER_ACTION, HAS_WATCH_ACTION } from '../src/constants/status';
import {
    SCORE_RANGE,
    SCORE_VALUE_PREFIX,
    countWatchedByScore,
    formatScoreLabel,
    getItemCarNum,
    getScore,
    hasScoreIndex,
    parseScoreChipValue,
    setCarRecords,
    collectMissingStatusTags,
    getStatus
} from '../src/plugins/status-tag-filter/stf-score';

/** 构造一条 car_list 记录（只填测试需要的字段）。 */
function record(carNum: string, status: string, score?: number): never {
    return { carNum, status, score } as never;
}

/** 构造列表卡片 HTML（番号在 `.video-title strong`）。 */
function card(carNum: string, attrs = ''): string {
    return `<div class="item" ${attrs}><div class="video-title"><strong>${carNum}</strong></div></div>`;
}

describe('car_list → 评分索引', () => {
    it('只收录已读记录，非已读不进入索引', () => {
        setCarRecords([
            record('AAA-001', HAS_WATCH_ACTION, 4),
            record('BBB-002', FAVORITE_ACTION, 5),
            record('CCC-003', HAS_WATCH_ACTION, 2)
        ]);
        expect(hasScoreIndex()).toBe(true);
        expect(getScore('AAA-001')).toBe(4);
        expect(getScore('CCC-003')).toBe(2);
        expect(getScore('BBB-002')).toBeNull();
        expect(getScore('NOPE-000')).toBeNull();
    });

    it('缺失/非法评分归一化为 0（未评分），越界值截断到 0–5', () => {
        setCarRecords([
            record('D1', HAS_WATCH_ACTION),
            record('D2', HAS_WATCH_ACTION, 9),
            record('D3', HAS_WATCH_ACTION, -3),
            record('D4', HAS_WATCH_ACTION, 3.6)
        ]);
        expect(getScore('D1')).toBe(0);
        expect(getScore('D2')).toBe(5);
        expect(getScore('D3')).toBe(0);
        expect(getScore('D4')).toBe(4);
    });

    it('空 car_list 视为索引未就绪（星级芯片不生成）', () => {
        setCarRecords([]);
        expect(hasScoreIndex()).toBe(false);
        expect(getScore('AAA-001')).toBeNull();
    });

    it('番号带空白会被裁剪，空番号记录被忽略', () => {
        setCarRecords([record('  E1  ', HAS_WATCH_ACTION, 3), record('   ', HAS_WATCH_ACTION, 1)]);
        expect(getScore('E1')).toBe(3);
        expect(hasScoreIndex()).toBe(true);
    });
});

describe('星级芯片值', () => {
    it('解析合法星级值', () => {
        expect(parseScoreChipValue(`${SCORE_VALUE_PREFIX}0`)).toBe(0);
        expect(parseScoreChipValue(`${SCORE_VALUE_PREFIX}5`)).toBe(5);
    });

    it('非星级芯片值返回 null（普通标签文本不受影响）', () => {
        setCarRecords([]);
        expect(parseScoreChipValue('已观看')).toBeNull();
        expect(parseScoreChipValue('')).toBeNull();
        expect(parseScoreChipValue(`${SCORE_VALUE_PREFIX}9`)).toBeNull();
        expect(parseScoreChipValue(`${SCORE_VALUE_PREFIX}abc`)).toBeNull();
    });

    it('刻度固定为 0–5 六档', () => {
        expect(SCORE_RANGE).toEqual([0, 1, 2, 3, 4, 5]);
        expect(formatScoreLabel(3)).toBe('3星');
    });
});

describe('卡片读取', () => {
    it('从 .video-title strong 取番号', () => {
        document.body.innerHTML = card('DAZD-314');
        const item = document.querySelector('.item') as Element;
        expect(getItemCarNum(item)).toBe('DAZD-314');
    });

    it('取不到番号返回空串', () => {
        document.body.innerHTML = '<div class="item"></div>';
        const item = document.querySelector('.item') as Element;
        expect(getItemCarNum(item)).toBe('');
    });

    it('按 car_list 已读记录统计星级分布，跳过 data-hide 卡片', () => {
        setCarRecords([
            record('AAA-001', HAS_WATCH_ACTION, 4),
            record('BBB-002', HAS_WATCH_ACTION, 4),
            record('CCC-003', HAS_WATCH_ACTION, 0)
        ]);
        document.body.innerHTML =
            card('AAA-001') + // 已读 4 星 —— 即使没有渲染「已读」标签也计入
            card('BBB-002') +
            card('CCC-003') +
            card('AAA-001', 'data-hide="yes"') + // 被其他脚本隐藏 → 跳过
            card('DDD-004'); // 非已读 → 不计入
        expect(countWatchedByScore()).toEqual({ 4: 2, 0: 1 });
    });

    it('无已读记录时分布为空（调用方据此不生成星级芯片）', () => {
        setCarRecords([record('FAV-1', FAVORITE_ACTION)]);
        document.body.innerHTML = card('FAV-1');
        expect(countWatchedByScore()).toEqual({});
    });

    it('状态索引覆盖全部 car_list 记录（收藏/已读/屏蔽均可查状态）', () => {
        setCarRecords([
            record('W-1', HAS_WATCH_ACTION, 3),
            record('F-1', FAVORITE_ACTION),
            record('B-1', FILTER_ACTION)
        ]);
        expect(getStatus('W-1')).toBe(HAS_WATCH_ACTION);
        expect(getStatus('F-1')).toBe(FAVORITE_ACTION);
        expect(getStatus('B-1')).toBe(FILTER_ACTION);
        expect(getStatus('NONE-1')).toBeNull();
        // 评分只对已读记录有意义
        expect(getScore('W-1')).toBe(3);
        expect(getScore('F-1')).toBeNull();
    });

    it('补渲染候选：有记录但缺标签的卡片被收集，已渲染/被隐藏/无记录的排除', () => {
        setCarRecords([
            record('W-1', HAS_WATCH_ACTION, 3),
            record('F-1', FAVORITE_ACTION),
            record('W-2', HAS_WATCH_ACTION, 1),
            record('W-3', HAS_WATCH_ACTION, 1)
        ]);
        document.body.innerHTML =
            card('W-1') + // 有记录、无标签 → 待补
            card('F-1') + // 有记录、无标签 → 待补
            '<div class="item"><div class="video-title"><strong>W-2</strong></div>' +
            '<div class="tags has-addons"><span class="status-tag">已渲染</span></div></div>' + // 已有标签 → 排除
            card('W-3', 'data-hide="yes"') + // 被其他脚本隐藏 → 排除
            card('NONE-1'); // 无 car_list 记录 → 排除

        const missing = collectMissingStatusTags(
            (item: Element) => item.querySelectorAll('.status-tag').length > 0
        );
        expect(missing.map((entry) => entry.carNum)).toEqual(['W-1', 'F-1']);
    });
});
