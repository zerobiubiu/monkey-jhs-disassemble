// @vitest-environment jsdom
/**
 * JavDB 女演员链接选择器兼容性测试（站点 DOM 改版回归）。
 *
 * 覆盖 2026-09 实测的新结构（`a.actor-female`）与原脚本旧读法
 *（`.female` 标记的 previousElementSibling），确保解析当前 document 与
 * detached HTML（list-page 的 GMHttp 详情页补录）都走同一兼容逻辑。
 */
import { describe, expect, it } from 'vitest';
import { getActressNames, queryActressLinks } from '../src/core/util/site/actress-links';

function parse(html: string): Document {
    return new DOMParser().parseFromString(html, 'text/html');
}

describe('JavDB 女演员链接选择器兼容', () => {
    it('读取新版详情页 a.actor-female 链接本身', () => {
        const root = parse(
            '<span class="value"><a class="actor-female" href="/actors/BKMM">大槻ひびき</a>, ' +
                '<a class="actor-female" href="/actors/X301">七瀬アリス</a></span>'
        );
        const links = queryActressLinks(root);
        expect(links.map((a) => a.getAttribute('href'))).toEqual(['/actors/BKMM', '/actors/X301']);
        expect(getActressNames(root)).toBe('大槻ひびき 七瀬アリス');
    });

    it('新版有命中时优先使用新链接，不把旧标记重复计入', () => {
        const root = parse(
            '<a class="actor-female" href="/actors/new">新结构</a>' +
                '<a href="/actors/old">旧结构</a><span class="female">♀</span>'
        );
        expect(queryActressLinks(root).map((a) => a.textContent)).toEqual(['新结构']);
    });

    it('新版无命中时回退旧版 .female 的前置兄弟', () => {
        const root = parse(
            '<span class="value"><a href="/actors/old1">旧演员一</a><span class="female">♀</span>, ' +
                '<a href="/actors/old2">旧演员二</a><span class="female">♀</span></span>'
        );
        expect(queryActressLinks(root).map((a) => a.getAttribute('href'))).toEqual([
            '/actors/old1',
            '/actors/old2'
        ]);
        expect(getActressNames(root)).toBe('旧演员一 旧演员二');
    });

    it('无新旧演员标记时返回空结果，不抛异常', () => {
        const root = parse('<div class="video-meta-panel"><span class="value">无演员区</span></div>');
        expect(queryActressLinks(root)).toEqual([]);
        expect(getActressNames(root)).toBe('');
    });
});
