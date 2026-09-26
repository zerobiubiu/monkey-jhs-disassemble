// @vitest-environment jsdom
/**
 * 站点选择器注册表回归测试。
 *
 * 覆盖两部分：
 * 1. 多语言文本变体（`textMatchesAny`）——JavDB 已支持 ?locale=zh / zh-CN / en，
 *    文本依赖选择器必须跨语言命中（实测：演员页元信息 繁体「男優, 3345 部影片」/
 *    简体「男优, 3345 部影片」/ 英文「Actor, 3345 movie(s)」）。
 * 2. 注册表查询 API（`siteSelector` / `siteQuery` / `siteQueryCompat`）。
 */
import { describe, expect, it } from 'vitest';
import {
    SITE_SELECTORS,
    type SiteSelector,
    SITE_TEXT_VARIANTS,
    siteQuery,
    siteQueryCompat,
    siteQueryOne,
    siteSelector,
    textMatchesAny
} from '../src/core/util/site/selectors';

function parse(html: string): Document {
    return new DOMParser().parseFromString(html, 'text/html');
}

describe('站点多语言文本变体', () => {
    it('男性角色标记跨繁体/简体/英文命中', () => {
        expect(textMatchesAny('男優, 3345 部影片', 'actorMale')).toBe(true);
        expect(textMatchesAny('男优, 3345 部影片', 'actorMale')).toBe(true);
        expect(textMatchesAny('Actor, 3345 movie(s)', 'actorMale')).toBe(true);
    });

    it('影片数量行跨繁体/简体/英文命中（用于排除该行取演员名）', () => {
        expect(textMatchesAny('77 部影片', 'movieCount')).toBe(true);
        expect(textMatchesAny('77 movie(s)', 'movieCount')).toBe(true);
    });

    it('演员名行不误判为影片数量行', () => {
        expect(textMatchesAny('みお', 'movieCount')).toBe(false);
        expect(textMatchesAny('朝日奈美緒, 朝日奈みお', 'movieCount')).toBe(false);
    });

    it('发布日期标签跨繁体/英文命中', () => {
        expect(textMatchesAny('日期:', 'publishDate')).toBe(true);
        expect(textMatchesAny('Released Date:', 'publishDate')).toBe(true);
    });

    it('女性角色页不误判为男演员页', () => {
        expect(textMatchesAny('77 部影片', 'actorMale')).toBe(false);
        expect(textMatchesAny('みお', 'actorMale')).toBe(false);
    });

    it('变体表每个键至少两种语言', () => {
        for (const tokens of Object.values(SITE_TEXT_VARIANTS)) {
            expect(tokens.length).toBeGreaterThanOrEqual(2);
        }
    });
});

describe('站点选择器注册表', () => {
    it('番号剪贴板锚点是语言无关选择器（三语言实测均命中）', () => {
        expect(siteSelector('detailMetaClipboard')).toBe('.panel-block.first-block a[data-clipboard-text]');
    });

    it('演员链接相关选择器不含语言依赖', () => {
        for (const key of ['actorSectionName', 'actorAvatar', 'actorTags'] as const) {
            expect(SITE_SELECTORS[key].current).not.toMatch(/[\u4e00-\u9fff]/);
        }
    });

    it('siteQuery / siteQueryOne 按注册表键查询', () => {
        const root = parse(
            '<div class="movie-panel-info"><div class="panel-block first-block">' +
                '<a data-clipboard-text="DAZD-314"></a></div></div>'
        );
        expect(siteQuery('detailMetaClipboard', root).length).toBe(1);
        expect(siteQueryOne('detailMetaClipboard', root)?.getAttribute('data-clipboard-text')).toBe('DAZD-314');
        expect(siteQueryOne('detailTitle', root)).toBeNull();
    });

    it('siteQueryCompat 无 legacy 时等价于当前结构查询', () => {
        const withOrigin = parse('<h2 class="title is-4"><span class="origin-title">原题</span></h2>');
        expect(siteQueryCompat('detailOriginTitle', withOrigin).length).toBe(1);
        expect(siteQueryCompat('detailOriginTitle', parse('<h2 class="title is-4"></h2>')).length).toBe(0);

        const publishTimeNew = parse(
            '<div class="video-meta-panel"><nav><div></div><div><span>2026-10-27</span></div></nav></div>'
        );
        expect(siteQueryCompat('detailPublishTime', publishTimeNew).length).toBe(1);

        // 注：注册表的 legacy 必须是合法 CSS（jQuery :contains 不能进表），由下一用例守护。
    });

    it('注册表内所有 legacy 选择器都是合法 CSS（jQuery 伪类不得进表）', () => {
        const probe = document.createDocumentFragment();
        for (const [key, entry] of Object.entries<SiteSelector>(SITE_SELECTORS)) {
            if (entry.legacy === undefined) {
                continue;
            }
            expect(() => probe.querySelectorAll(entry.legacy as string), `key=${key}`).not.toThrow();
        }
    });
});
