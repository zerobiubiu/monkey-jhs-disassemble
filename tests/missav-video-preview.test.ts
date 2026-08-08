// @vitest-environment jsdom
/**
 * MissAV 视频预览纯函数模块（mv-selectors.ts）回归测试。
 *
 * 覆盖（Task 1 简报）：
 * 1. CARD_SEL 常量值与 MAP_SEL.thumb 一致（'.thumbnail.group'）
 * 2. findDetailUrl：卡片内存在 a[href] → 返回绝对 URL（.href 属性）
 * 3. findDetailUrl：相对 href 经 .href 属性解析为绝对 URL
 * 4. findDetailUrl：无 a[href] 的卡片 → null
 * 5. findDetailUrl：多个链接 → 返回首个 a[href] 的 href
 * 6. isPlainLeftClick：普通左键（button=0 无修饰键）→ true
 * 7. isPlainLeftClick：非左键（右键 button=2）→ false
 * 8. isPlainLeftClick：Ctrl + 左键 → false
 * 9. isPlainLeftClick：Meta/Shift/Alt 任一修饰键组合 → false
 *
 * 输入用 HTML 字符串片段 + new DOMParser().parseFromString(html, 'text/html') 构造。
 * environment: jsdom（文件级 pragma，与 tests/missav-auto-page.test.ts 先例一致）——
 * 被测函数依赖 querySelectorAll / DOMParser，node 环境（vitest.config.ts 默认值）
 * 不提供 DOMParser 全局（Node 官方 globals 列表无此 API）。
 */
import { describe, expect, it } from 'vitest';
import { CARD_SEL, findDetailUrl, isPlainLeftClick } from '../src/plugins/missav-video-preview/mv-selectors';

const parse = (html: string): Document => new DOMParser().parseFromString(html, 'text/html');

describe('CARD_SEL', () => {
    it('常量值与 MAP_SEL.thumb 一致（.thumbnail.group）', () => {
        expect(CARD_SEL).toBe('.thumbnail.group');
    });
});

describe('findDetailUrl', () => {
    it('卡片内存在 a[href] 时返回其绝对 URL', () => {
        const doc = parse(
            '<div class="thumbnail group">' +
                '<a href="https://missav.ws/dm/ABC-123"><img src="https://missav.ws/cover.jpg"></a>' +
                '</div>'
        );
        const card = doc.querySelector(CARD_SEL)!;
        expect(findDetailUrl(card)).toBe('https://missav.ws/dm/ABC-123');
    });

    it('相对 href 经 .href 属性解析为绝对 URL', () => {
        const doc = parse(
            '<div class="thumbnail group">' +
                '<a href="/dm/ABC-123"><img></a>' +
                '</div>'
        );
        const card = doc.querySelector(CARD_SEL)!;
        const url = findDetailUrl(card);
        expect(url).not.toBeNull();
        expect(new URL(url!).pathname).toBe('/dm/ABC-123');
    });

    it('卡片内无 a[href] 时返回 null', () => {
        const doc = parse('<div class="thumbnail group"><span>无链接</span></div>');
        const card = doc.querySelector(CARD_SEL)!;
        expect(findDetailUrl(card)).toBeNull();
    });

    it('卡片内多个链接时返回首个 a[href] 的 href', () => {
        const doc = parse(
            '<div class="thumbnail group">' +
                '<a href="https://missav.ws/dm/ABC-123">详情</a>' +
                '<a href="https://missav.ws/dm/XYZ-999">番号标签</a>' +
                '</div>'
        );
        const card = doc.querySelector(CARD_SEL)!;
        expect(findDetailUrl(card)).toBe('https://missav.ws/dm/ABC-123');
    });
});

describe('isPlainLeftClick', () => {
    it('普通左键（button=0 且无修饰键）为 true', () => {
        const e = { button: 0, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false } as MouseEvent;
        expect(isPlainLeftClick(e)).toBe(true);
    });

    it('非左键（button=2 右键）为 false', () => {
        const e = { button: 2, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false } as MouseEvent;
        expect(isPlainLeftClick(e)).toBe(false);
    });

    it('Ctrl + 左键为 false', () => {
        const e = { button: 0, ctrlKey: true, metaKey: false, shiftKey: false, altKey: false } as MouseEvent;
        expect(isPlainLeftClick(e)).toBe(false);
    });

    it('Meta/Shift/Alt 任一修饰键组合均为 false', () => {
        const base = { button: 0, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false };
        expect(isPlainLeftClick({ ...base, metaKey: true } as MouseEvent)).toBe(false);
        expect(isPlainLeftClick({ ...base, shiftKey: true } as MouseEvent)).toBe(false);
        expect(isPlainLeftClick({ ...base, altKey: true } as MouseEvent)).toBe(false);
    });
});