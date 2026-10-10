// @vitest-environment jsdom
/**
 * MissAV 状态标签筛选纯函数模块（mstf-collect.ts / mstf-apply.ts）回归测试。
 *
 * 覆盖（Task 1 简报 Step 1）：
 * 1. shouldShow：空 active 全 true / 命中 / 未命中 / 无标签状态（NO_TAG_VALUE）
 * 2. statusToLabel：favorite→'⭐ 已收藏' / 未知原样返回
 * 3. getItemStatus：有 dataset.status / 无标签 null
 * 4. collectStatusCounts：混合计数 / 无标签计入 NO_TAG_VALUE / 空页面 {}
 * 5. applyFilter：OR 显隐 + data-mstf-hidden 属性
 * 6. 导出常量：NO_TAG_VALUE / STATUS_ORDER（Task 2 依赖，签名锁定）
 *
 * 输入用 HTML 字符串构造：单元素场景用 DOMParser；collect/apply 依赖全局
 * document.querySelectorAll，直接设置 document.body.innerHTML。
 * environment: jsdom（文件级 pragma）——被测函数依赖 querySelectorAll / DOMParser。
 */
import { afterEach, describe, expect, it } from 'vitest';

import {
    NO_TAG_VALUE,
    STATUS_ORDER,
    collectStatusCounts,
    getItemStatus,
    statusToLabel
} from '../src/plugins/missav-status-filter/mstf-collect';
import { isVideoDetailPath } from '../src/core/util/site/missav-paths';
import { applyFilter, shouldShow } from '../src/plugins/missav-status-filter/mstf-apply';

const parse = (html: string): Document => new DOMParser().parseFromString(html, 'text/html');

// jsdom 环境测试用例间共享 document，清理 body 防止 DOM 残留串扰（doc/223 补）
afterEach(() => {
    document.body.innerHTML = '';
});

describe('导出常量', () => {
    it('NO_TAG_VALUE / STATUS_ORDER 与 Task 2 依赖签名一致', () => {
        expect(NO_TAG_VALUE).toBe('no-tag');
        expect(STATUS_ORDER).toEqual(['favorite', 'hasWatch', 'filter', 'hasDown']);
    });
});

describe('isVideoDetailPath', () => {
    it('视频详情页：/cn/mkmp-745 → true', () => {
        expect(isVideoDetailPath('/cn/mkmp-745')).toBe(true);
    });

    it('列表页：/cn/new → false', () => {
        expect(isVideoDetailPath('/cn/new')).toBe(false);
    });

    it('搜索页含番号：/cn/search/mkmp-745 → false（搜索页需要筛选器）', () => {
        expect(isVideoDetailPath('/cn/search/mkmp-745')).toBe(false);
    });

    it('分类/列表路径无番号尾段 → false', () => {
        expect(isVideoDetailPath('/cn/tag/female')).toBe(false);
        expect(isVideoDetailPath('/')).toBe(false);
    });

    it('FC2 番号（含额外段）仍判定为视频页', () => {
        expect(isVideoDetailPath('/cn/fc2-ppv-4955762')).toBe(true);
    });
});

describe('shouldShow', () => {
    it('空 active 集合 → 任意状态（含无标签）全部显示', () => {
        expect(shouldShow('favorite', new Set())).toBe(true);
        expect(shouldShow(null, new Set())).toBe(true);
    });

    it('命中：active 包含该状态 → true', () => {
        expect(shouldShow('favorite', new Set(['favorite']))).toBe(true);
    });

    it('未命中：active 不包含该状态 → false', () => {
        expect(shouldShow('hasWatch', new Set(['favorite']))).toBe(false);
    });

    it('无标签：null 状态按 NO_TAG_VALUE 参与判定', () => {
        expect(shouldShow(null, new Set([NO_TAG_VALUE]))).toBe(true);
        expect(shouldShow(null, new Set(['favorite']))).toBe(false);
    });
});

describe('statusToLabel', () => {
    it('已知状态 → STATUS_CONFIG.label（favorite → ⭐ 已收藏）', () => {
        expect(statusToLabel('favorite')).toBe('⭐ 已收藏');
    });

    it('未知状态原样返回', () => {
        expect(statusToLabel('unknown-status')).toBe('unknown-status');
    });
});

describe('getItemStatus', () => {
    it('元素含 .missav-status-tag 且带 dataset.status → 返回 status', () => {
        const doc = parse(
            '<div class="thumbnail group"><span class="missav-status-tag" data-status="hasDown">💾</span></div>'
        );
        const item = doc.querySelector('.thumbnail.group')!;
        expect(getItemStatus(item)).toBe('hasDown');
    });

    it('无标签 → null', () => {
        const doc = parse('<div class="thumbnail group"><a>no tag</a></div>');
        const item = doc.querySelector('.thumbnail.group')!;
        expect(getItemStatus(item)).toBeNull();
    });
});

describe('collectStatusCounts', () => {
    it('混合计数：按显示名聚合，重复状态叠加', () => {
        document.body.innerHTML =
            '<div class="thumbnail group"><span class="missav-status-tag" data-status="favorite"></span></div>' +
            '<div class="thumbnail group"><span class="missav-status-tag" data-status="favorite"></span></div>' +
            '<div class="thumbnail group"><span class="missav-status-tag" data-status="hasWatch"></span></div>';
        expect(collectStatusCounts()).toEqual({ '⭐ 已收藏': 2, '🔍 已观看': 1 });
    });

    it('无标签计入 NO_TAG_VALUE', () => {
        document.body.innerHTML =
            '<div class="thumbnail group"></div>' +
            '<div class="thumbnail group"><span class="missav-status-tag" data-status="filter"></span></div>';
        expect(collectStatusCounts()).toEqual({ [NO_TAG_VALUE]: 1, '🚫 已屏蔽': 1 });
    });

    it('空页面 → {}', () => {
        document.body.innerHTML = '';
        expect(collectStatusCounts()).toEqual({});
    });
});

describe('applyFilter', () => {
    it('无 grid 容器（异常 DOM）：隐藏缩略图自身', () => {
        document.body.innerHTML =
            '<div class="thumbnail group"><span class="missav-status-tag" data-status="favorite"></span></div>' +
            '<div class="thumbnail group"><span class="missav-status-tag" data-status="hasWatch"></span></div>';
        applyFilter(new Set(['favorite']));
        const items = Array.from(document.querySelectorAll<HTMLElement>('.thumbnail.group'));
        expect(items[0].style.display).toBe('');
        expect(items[1].style.display).toBe('none');
        expect(items[1].getAttribute('data-mstf-hidden')).toBe('yes');
    });

    it('初始页结构（grid > 包装DIV > 缩略图）：隐藏 grid cell（外层包装），grid 自动重排不留空洞', () => {
        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5';
        const wrap1 = document.createElement('div');
        wrap1.innerHTML = '<div class="thumbnail group"><span class="missav-status-tag" data-status="favorite"></span></div>';
        const wrap2 = document.createElement('div');
        wrap2.innerHTML = '<div class="thumbnail group"><span class="missav-status-tag" data-status="hasWatch"></span></div>';
        grid.append(wrap1, wrap2);
        document.body.appendChild(grid);

        applyFilter(new Set(['favorite']));

        // favorite 命中 → 包装 DIV 显示
        expect(wrap1.style.display).toBe('');
        expect(wrap1.getAttribute('data-mstf-hidden')).toBeNull();
        // hasWatch 未命中 → 包装 DIV 隐藏（而非缩略图），grid 项移除流中自动重排
        expect(wrap2.style.display).toBe('none');
        expect(wrap2.getAttribute('data-mstf-hidden')).toBe('yes');
        // 缩略图自身不受影响
        const thumbs = Array.from(document.querySelectorAll<HTMLElement>('.thumbnail.group'));
        expect(thumbs[1].style.display).toBe('');
        expect(thumbs[1].getAttribute('data-mstf-hidden')).toBeNull();
    });

    it('瀑布流追加结构（grid > 缩略图）：隐藏缩略图自身（grid 直接子项）', () => {
        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5';
        grid.innerHTML =
            '<div class="thumbnail group"><span class="missav-status-tag" data-status="favorite"></span></div>' +
            '<div class="thumbnail group"><span class="missav-status-tag" data-status="hasWatch"></span></div>';
        document.body.appendChild(grid);

        applyFilter(new Set(['favorite']));
        const items = Array.from(document.querySelectorAll<HTMLElement>('.thumbnail.group'));
        expect(items[0].style.display).toBe('');
        expect(items[1].style.display).toBe('none');
        expect(items[1].getAttribute('data-mstf-hidden')).toBe('yes');
    });

    it('空 active → 全部恢复显示，清除隐藏标记（含 grid cell 包装）', () => {
        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5';
        const wrap = document.createElement('div');
        wrap.setAttribute('data-mstf-hidden', 'yes');
        wrap.style.display = 'none';
        wrap.innerHTML = '<div class="thumbnail group"><span class="missav-status-tag" data-status="hasDown"></span></div>';
        grid.appendChild(wrap);
        document.body.appendChild(grid);

        applyFilter(new Set());
        expect(wrap.style.display).toBe('');
        expect(wrap.getAttribute('data-mstf-hidden')).toBeNull();
    });
});