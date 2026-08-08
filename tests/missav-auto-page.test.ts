// @vitest-environment jsdom
/**
 * MissAV 列表页瀑布流纯函数模块（map-selectors.ts）回归测试。
 *
 * 覆盖（Task 1 简报）：
 * 1. findNextUrl：中文站 HTML（分页链接文本"下一页"）→ 返回该链接 href
 * 2. findNextUrl：英文站 HTML（文本"Next"）→ 返回 href
 * 3. findNextUrl：无分页链接 → null
 * 4. findNextUrl：有 ?page= 链接但文本不是 下一页/Next（如数字"2"）→ null
 * 5. extractThumbs：含 3 个 .thumbnail.group 的 HTML → 返回 3 个元素
 * 6. extractThumbs：无缩略图 → 空数组
 * 7. collectCarNums：a[alt="hmn-095-uncensored-leak"] → HMN-095（normalizeCarNum 归一化）
 * 8. collectCarNums：a[alt="fc2-ppv-4955762"] → FC2-PPV-4955762
 * 9. collectCarNums：无 alt 链接的缩略图被过滤（空字符串过滤）
 * 10. MAP_SEL.grid 常量值正确性
 *
 * 输入用 HTML 字符串片段 + new DOMParser().parseFromString(html, 'text/html') 构造。
 * environment: jsdom（文件级 pragma）——被测函数依赖 querySelectorAll / DOMParser。
 */
import { describe, expect, it } from 'vitest';
import {
    findNextUrl,
    extractThumbs,
    collectCarNums,
    MAP_SEL
} from '../src/plugins/missav-auto-page/map-selectors';

const parse = (html: string): Document => new DOMParser().parseFromString(html, 'text/html');

describe('findNextUrl', () => {
    it('中文站：分页链接文本为"下一页"时返回其 href', () => {
        const doc = parse(
            '<div>' +
                '<a href="https://missav.ws/?page=2" rel="next">下一页</a>' +
                '</div>'
        );
        expect(findNextUrl(doc)).toBe('https://missav.ws/?page=2');
    });

    it('英文站：分页链接文本为"Next"时返回其 href', () => {
        const doc = parse(
            '<div>' +
                '<a href="https://missav.ws/?page=2" rel="next">Next</a>' +
                '</div>'
        );
        expect(findNextUrl(doc)).toBe('https://missav.ws/?page=2');
    });

    it('无分页链接时返回 null', () => {
        const doc = parse('<div><a href="https://missav.ws/">首页</a></div>');
        expect(findNextUrl(doc)).toBeNull();
    });

    it('有 ?page= 链接但文本不是 下一页/Next（如数字"2"）时返回 null', () => {
        const doc = parse(
            '<div>' +
                '<a href="https://missav.ws/?page=1">1</a>' +
                '<a href="https://missav.ws/?page=2">2</a>' +
                '<a href="https://missav.ws/?page=3">3</a>' +
                '</div>'
        );
        expect(findNextUrl(doc)).toBeNull();
    });
});

describe('extractThumbs', () => {
    it('含 3 个 .thumbnail.group 时返回 3 个元素', () => {
        const doc = parse(
            '<div class="grid">' +
                '<div class="thumbnail group"><a alt="hmn-095-uncensored-leak"></a></div>' +
                '<div class="thumbnail group"><a alt="ebod-857"></a></div>' +
                '<div class="thumbnail group"><a alt="fc2-ppv-4955762"></a></div>' +
                '</div>'
        );
        const thumbs = extractThumbs(doc.body);
        expect(thumbs).toHaveLength(3);
        expect(thumbs.every((el) => el.classList.contains('group'))).toBe(true);
    });

    it('无缩略图时返回空数组', () => {
        const doc = parse('<div class="grid"><div class="video-item"></div></div>');
        expect(extractThumbs(doc.body)).toEqual([]);
    });
});

describe('collectCarNums', () => {
    it('a[alt="hmn-095-uncensored-leak"] 归一化为 HMN-095', () => {
        const doc = parse(
            '<div class="thumbnail group"><a alt="hmn-095-uncensored-leak"></a></div>'
        );
        expect(collectCarNums(extractThumbs(doc.body))).toEqual(['HMN-095']);
    });

    it('a[alt="fc2-ppv-4955762"] 归一化为 FC2-PPV-4955762', () => {
        const doc = parse(
            '<div class="thumbnail group"><a alt="fc2-ppv-4955762"></a></div>'
        );
        expect(collectCarNums(extractThumbs(doc.body))).toEqual(['FC2-PPV-4955762']);
    });

    it('无 alt 链接的缩略图被过滤（空字符串过滤）', () => {
        const doc = parse(
            '<div class="grid">' +
                '<div class="thumbnail group"><a alt="ebod-857"></a></div>' +
                '<div class="thumbnail group"><a href="https://missav.ws/dm/xxx"></a></div>' +
                '<div class="thumbnail group"><a alt=""></a></div>' +
                '</div>'
        );
        expect(collectCarNums(extractThumbs(doc.body))).toEqual(['EBOD-857']);
    });
});

describe('MAP_SEL', () => {
    it('grid 常量值正确（CSS 转义冒号）', () => {
        // 源码中 \\: 是 CSS 选择器转义，字符串值应为 \: 字面量
        expect(MAP_SEL.grid).toBe('div.grid.grid-cols-2.md\\:grid-cols-3.xl\\:grid-cols-4.gap-5');
    });

    it('thumb / nextLink 常量值正确', () => {
        expect(MAP_SEL.thumb).toBe('.thumbnail.group');
        expect(MAP_SEL.nextLink).toBe("a[href*='page=']");
    });
});