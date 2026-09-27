// @vitest-environment jsdom
/**
 * `sync-common.findReviewIdInHtml` 测试（doc/31 §4）。
 *
 * 批量「取消已读」需要从**拉取到的详情页 HTML** 中取出 reviewId，
 * 才能调用删除接口；这里覆盖：正常命中、无删除链接、空/异常输入。
 */
import { describe, expect, it } from 'vitest';
import { findReviewIdInHtml } from '../src/plugins/setting/jhs-sync/sync-common';

/** 造一段带删除链接的 .review-buttons 片段。 */
function htmlWithDeleteLink(href: string): string {
    return `<div class="review-buttons"><a data-method="delete" href="${href}">删除</a></div>`;
}

describe('findReviewIdInHtml', () => {
    it('从 .review-buttons 的删除链接提取 reviewId', () => {
        expect(findReviewIdInHtml(htmlWithDeleteLink('/v/abc123/reviews/4567'))).toBe('4567');
    });

    it('href 带查询参数 / 其它属性时仍能提取数字 id', () => {
        expect(
            findReviewIdInHtml(
                `<div class="review-buttons"><a data-method="delete" class="x" href="/v/abc/reviews/99?locale=zh">删除</a></div>`
            )
        ).toBe('99');
    });

    it('无删除链接（服务器上本无评价）→ null', () => {
        expect(findReviewIdInHtml('<div class="review-buttons"><a href="/users">已看</a></div>')).toBeNull();
    });

    it('删除链接但 href 不含 /reviews/ 数字 → null', () => {
        expect(findReviewIdInHtml(htmlWithDeleteLink('/v/abc123/reviews/'))).toBeNull();
    });

    it('空 / 异常输入返回 null（不抛错）', () => {
        expect(findReviewIdInHtml('')).toBeNull();
        expect(findReviewIdInHtml('not html at all')).toBeNull();
    });

    it('链接在 .review-buttons 之外时不误取（选择器作用域正确）', () => {
        expect(
            findReviewIdInHtml(`<div class="other"><a data-method="delete" href="/v/x/reviews/1">del</a></div>`)
        ).toBeNull();
    });
});
