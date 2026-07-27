/**
 * dpb-list-merge 纯逻辑单测（doc/清单序号合并）。
 *
 * 覆盖：清单名解析、正则容错、排除名单、配置构建、条目归组（D1 单序号成组 /
 * 裸名吸收 / 排除回退 / 停用全单条）、满员判定、加入目标选取、下一清单名、
 * 组合并勾选态。纯函数，node 环境即可运行。
 */
import { describe, expect, it } from 'vitest';

import {
    buildMergeConfig,
    compileMergePattern,
    computeGroupCheckState,
    DEFAULT_LIST_MERGE_PATTERN,
    groupEntries,
    isMemberFull,
    isMergeExcluded,
    LIST_FULL_THRESHOLD,
    nextListName,
    parseListName,
    pickTargetMember,
    sortMembersByNum
} from '../src/plugins/detail-page-button/dpb-list-merge';
import type { ListGroup, ListMember, ListMergeConfig } from '../src/plugins/detail-page-button/dpb-list-merge';

const PATTERN = new RegExp(DEFAULT_LIST_MERGE_PATTERN);

function makeConfig(overrides: Partial<ListMergeConfig> = {}): ListMergeConfig {
    return {
        enabled: true,
        pattern: PATTERN,
        excludeNames: new Set<string>(),
        ...overrides
    };
}

function makeMember(overrides: Partial<ListMember> = {}): ListMember {
    return {
        listId: '1',
        name: '等待更新1',
        num: 1,
        count: 0,
        checked: false,
        disabled: false,
        ...overrides
    };
}

describe('parseListName', () => {
    it('解析「前缀+末尾数字」', () => {
        expect(parseListName('等待更新2', PATTERN)).toEqual({ base: '等待更新', num: 2 });
        expect(parseListName('迫切想看10', PATTERN)).toEqual({ base: '迫切想看', num: 10 });
        expect(parseListName('ABC123', PATTERN)).toEqual({ base: 'ABC', num: 123 });
    });

    it('仅末尾连续数字作为序号，中间数字归入前缀', () => {
        expect(parseListName('abc1def2', PATTERN)).toEqual({ base: 'abc1def', num: 2 });
    });

    it('无末尾数字 / 空名 → null', () => {
        expect(parseListName('Top榜', PATTERN)).toBeNull();
        expect(parseListName('等待更新', PATTERN)).toBeNull();
        expect(parseListName('  ', PATTERN)).toBeNull();
    });

    it('前缀全数字（纯数字清单名）→ null，不参与合并', () => {
        expect(parseListName('2024', PATTERN)).toBeNull();
    });
});

describe('compileMergePattern', () => {
    it('空值回退默认规则', () => {
        const pattern = compileMergePattern('');
        expect(pattern.source).toBe(DEFAULT_LIST_MERGE_PATTERN);
    });

    it('非法正则回退默认规则而非抛错', () => {
        const pattern = compileMergePattern('([');
        expect(pattern.source).toBe(DEFAULT_LIST_MERGE_PATTERN);
        expect(parseListName('等待更新3', pattern)).toEqual({ base: '等待更新', num: 3 });
    });

    it('采用用户自定义正则', () => {
        const pattern = compileMergePattern('^(.+?)-p(\\d+)$');
        expect(parseListName('收藏-p2', pattern)).toEqual({ base: '收藏', num: 2 });
        expect(parseListName('等待更新2', pattern)).toBeNull();
    });
});

describe('isMergeExcluded', () => {
    const config = makeConfig({ excludeNames: new Set(['top10', '等待更新']) });

    it('完整名命中（大小写不敏感）', () => {
        expect(isMergeExcluded('Top10', 'Top', config)).toBe(true);
    });

    it('base 命中', () => {
        expect(isMergeExcluded('等待更新5', '等待更新', config)).toBe(true);
    });

    it('未命中', () => {
        expect(isMergeExcluded('迫切想看1', '迫切想看', config)).toBe(false);
    });

    it('排除集为空时恒 false', () => {
        expect(isMergeExcluded('Top10', 'Top', makeConfig())).toBe(false);
    });
});

describe('buildMergeConfig', () => {
    it('默认开启', () => {
        expect(buildMergeConfig({}).enabled).toBe(true);
    });

    it('显式 no 关闭', () => {
        expect(buildMergeConfig({ listMergeEnabled: 'no' }).enabled).toBe(false);
    });

    it('解析排除名数组并小写归一', () => {
        const config = buildMergeConfig({ listMergeExcludeNames: ['Top10', ' 2024 ', ''] });
        expect(config.excludeNames.has('top10')).toBe(true);
        expect(config.excludeNames.has('2024')).toBe(true);
        expect(config.excludeNames.size).toBe(2);
    });

    it('兼容字符串形式的排除名', () => {
        const config = buildMergeConfig({ listMergeExcludeNames: 'A, b' });
        expect(config.excludeNames.has('a')).toBe(true);
        expect(config.excludeNames.has('b')).toBe(true);
    });
});

describe('groupEntries', () => {
    const item = (name: string, listId: string, extra: Partial<ListMember> = {}) => ({
        name,
        listId,
        count: extra.count ?? null,
        checked: extra.checked ?? false,
        disabled: extra.disabled ?? false
    });

    it('D1：单个序号清单也成组（按 base 展示）', () => {
        const { groups, singleIndexes } = groupEntries([item('等待更新1', '1')], makeConfig());
        expect(groups).toHaveLength(1);
        expect(groups[0].base).toBe('等待更新');
        expect(groups[0].members).toHaveLength(1);
        expect(singleIndexes).toHaveLength(0);
    });

    it('同前缀多个序号归为一组', () => {
        const { groups } = groupEntries(
            [item('等待更新1', '1'), item('等待更新2', '2'), item('迫切想看1', '3')],
            makeConfig()
        );
        expect(groups).toHaveLength(2);
        const wait = groups.find((g) => g.base === '等待更新');
        expect(wait?.members.map((m) => m.num).sort()).toEqual([1, 2]);
    });

    it('裸名（完整名 == base）吸收为 num=0 成员', () => {
        const { groups } = groupEntries(
            [item('等待更新', '9'), item('等待更新1', '1')],
            makeConfig()
        );
        expect(groups).toHaveLength(1);
        const bare = groups[0].members.find((m) => m.listId === '9');
        expect(bare?.num).toBe(0);
    });

    it('被排除的清单回退为单条', () => {
        const config = makeConfig({ excludeNames: new Set(['top']) });
        const { groups, singleIndexes } = groupEntries(
            [item('Top1', '1'), item('Top2', '2')],
            config
        );
        expect(groups).toHaveLength(0);
        expect(singleIndexes).toEqual([0, 1]);
    });

    it('无数字清单保持单条', () => {
        const { groups, singleIndexes } = groupEntries([item('随便看看', '1')], makeConfig());
        expect(groups).toHaveLength(0);
        expect(singleIndexes).toEqual([0]);
    });

    it('停用合并时全部为单条', () => {
        const { groups, singleIndexes } = groupEntries(
            [item('等待更新1', '1'), item('等待更新2', '2')],
            makeConfig({ enabled: false })
        );
        expect(groups).toHaveLength(0);
        expect(singleIndexes).toEqual([0, 1]);
    });
});

describe('isMemberFull', () => {
    it('总数达到阈值即满', () => {
        expect(isMemberFull(makeMember({ count: LIST_FULL_THRESHOLD }))).toBe(true);
        expect(isMemberFull(makeMember({ count: LIST_FULL_THRESHOLD - 1 }))).toBe(false);
    });

    it('禁用且未含片视为满（不可加入）', () => {
        expect(isMemberFull(makeMember({ disabled: true, checked: false }))).toBe(true);
    });

    it('禁用但已含片不视为满（仍可移除）', () => {
        expect(isMemberFull(makeMember({ disabled: true, checked: true, count: 0 }))).toBe(false);
    });
});

describe('sortMembersByNum / pickTargetMember', () => {
    it('按序号升序，裸名 num=0 最靠前', () => {
        const sorted = sortMembersByNum([
            makeMember({ listId: 'a', num: 2 }),
            makeMember({ listId: 'b', num: 0 }),
            makeMember({ listId: 'c', num: 1 })
        ]);
        expect(sorted.map((m) => m.num)).toEqual([0, 1, 2]);
    });

    it('跳过已满与已含片，取最靠前可用', () => {
        const target = pickTargetMember([
            makeMember({ listId: '1', num: 1, count: 501 }),
            makeMember({ listId: '2', num: 2, checked: true }),
            makeMember({ listId: '3', num: 3, count: 10 })
        ]);
        expect(target?.listId).toBe('3');
    });

    it('全满返回 null（触发自动新建）', () => {
        const target = pickTargetMember([
            makeMember({ listId: '1', num: 1, count: 501 }),
            makeMember({ listId: '2', num: 2, disabled: true })
        ]);
        expect(target).toBeNull();
    });
});

describe('nextListName', () => {
    it('base + 最大序号 + 1', () => {
        const group: ListGroup = {
            base: '等待更新',
            members: [makeMember({ num: 1 }), makeMember({ num: 3 })]
        };
        expect(nextListName(group)).toBe('等待更新4');
    });

    it('仅裸名成员时从 1 开始', () => {
        const group: ListGroup = { base: '等待更新', members: [makeMember({ num: 0 })] };
        expect(nextListName(group)).toBe('等待更新1');
    });
});

describe('computeGroupCheckState', () => {
    it('任一含片即 checked', () => {
        const state = computeGroupCheckState({
            base: 'x',
            members: [makeMember({ listId: '1', checked: false }), makeMember({ listId: '2', checked: true })]
        });
        expect(state.checked).toBe(true);
        expect(state.containing.map((m) => m.listId)).toEqual(['2']);
    });

    it('部分含片为半选态', () => {
        const state = computeGroupCheckState({
            base: 'x',
            members: [makeMember({ listId: '1', checked: true }), makeMember({ listId: '2', checked: false })]
        });
        expect(state.indeterminate).toBe(true);
    });

    it('全部含片不为半选', () => {
        const state = computeGroupCheckState({
            base: 'x',
            members: [makeMember({ listId: '1', checked: true }), makeMember({ listId: '2', checked: true })]
        });
        expect(state.indeterminate).toBe(false);
        expect(state.checked).toBe(true);
    });

    it('无含片未勾选', () => {
        const state = computeGroupCheckState({
            base: 'x',
            members: [makeMember({ listId: '1', checked: false })]
        });
        expect(state.checked).toBe(false);
        expect(state.indeterminate).toBe(false);
    });
});
