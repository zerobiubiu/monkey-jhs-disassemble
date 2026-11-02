/** 完整清单快照获取：连续两遍抓取全部分页并校验计数、唯一性及顺序稳定性。 */
import { fetchJavdbPageHtml } from '../../../core/util/util-fetch-html';

import type { ListReconcileSnapshot, MovieRecord } from '../vlt-db';

const MAX_PAGES = 100;

function normalizeText(value: string | null | undefined): string {
    return (value || '').replace(/\s+/g, ' ').trim();
}

interface ParsedListPage {
    expectedCount: number | null;
    name: string | null;
    movies: MovieRecord[];
    nextUrl: string | null;
}

function getSeries(designation: string): string | null {
    const index = designation.indexOf('-');
    return index > 0 ? designation.slice(0, index) : designation || null;
}

function getCode(designation: string): string | null {
    const index = designation.indexOf('-');
    return index > 0 ? designation.slice(index + 1) : null;
}

async function fetchHtmlDocument(url: string): Promise<Document> {
    const html = await fetchJavdbPageHtml(url);
    return new DOMParser().parseFromString(html, 'text/html');
}

function parseExpectedCountAndName(documentNode: Document): {
    expectedCount: number;
    name: string;
} {
    const headings = Array.from(documentNode.querySelectorAll('h1, h2, h3, .title'));
    for (const heading of headings) {
        const text = normalizeText(heading.textContent);
        const match = text.match(/^(.*?)\s+(\d+)\s*部影片/);
        if (!match) continue;
        return { name: match[1].trim(), expectedCount: Number(match[2]) };
    }
    throw new Error('无法从清单标题读取服务端影片总数');
}

function parseMovie(item: Element, pageUrl: string): MovieRecord {
    const link = item.querySelector('a[href*="/v/"]') as HTMLAnchorElement | null;
    const designation = normalizeText(item.querySelector('.video-title strong')?.textContent);
    const hrefValue = link?.getAttribute('href') || '';
    if (!designation || !hrefValue) throw new Error('清单分页中存在无法识别的影片卡片');

    const titleText = normalizeText(item.querySelector('.video-title')?.textContent);
    const title = titleText.startsWith(designation)
        ? titleText.slice(designation.length).trim()
        : titleText;
    const image = item.querySelector('img') as HTMLImageElement | null;
    const coverValue =
        image?.getAttribute('src') || image?.getAttribute('data-src') || image?.currentSrc || '';
    const scoreText = normalizeText(item.querySelector('.score')?.textContent);
    const scoreMatch = scoreText.match(/(\d+(?:\.\d+)?)/);
    const releaseDate = normalizeText(item.querySelector('.meta')?.textContent);

    return {
        designation,
        href: new URL(hrefValue, pageUrl).href,
        title: title || null,
        coverSrc: coverValue ? new URL(coverValue, pageUrl).href : null,
        score: scoreMatch ? Number(scoreMatch[1]) : null,
        releaseDate: releaseDate || null,
        createdAt: null,
        series: getSeries(designation),
        code: getCode(designation)
    };
}

function parseListPage(
    documentNode: Document,
    pageUrl: string,
    listId: string,
    firstPage: boolean
): ParsedListPage {
    const heading = firstPage ? parseExpectedCountAndName(documentNode) : null;
    const movies = Array.from(documentNode.querySelectorAll('.movie-list .item')).map((item) =>
        parseMovie(item, pageUrl)
    );
    const nextHref = (
        documentNode.querySelector('a.pagination-next') as HTMLAnchorElement | null
    )?.getAttribute('href');
    let nextUrl: string | null = null;
    if (nextHref) {
        const candidate = new URL(nextHref, pageUrl);
        const expectedPath = `/lists/${encodeURIComponent(listId)}`;
        if (candidate.origin !== window.location.origin || candidate.pathname !== expectedPath) {
            throw new Error(`清单下一页地址异常：${candidate.href}`);
        }
        nextUrl = candidate.href;
    }
    return {
        expectedCount: heading?.expectedCount ?? null,
        name: heading?.name ?? null,
        movies,
        nextUrl
    };
}

/** 单次抓取并严格校验 JavDB 单个清单的全部分页。 */
async function fetchCompleteListPass(listId: string): Promise<ListReconcileSnapshot> {
    const firstUrl = new URL(`/lists/${encodeURIComponent(listId)}`, window.location.origin);
    firstUrl.searchParams.set('locale', 'zh');

    const visited = new Set<string>();
    const movies: MovieRecord[] = [];
    let expectedCount: number | null = null;
    let name: string | null = null;
    let nextUrl: string | null = firstUrl.href;

    while (nextUrl) {
        if (visited.size >= MAX_PAGES) throw new Error(`清单分页超过 ${MAX_PAGES} 页，已中止`);
        const normalizedUrl = new URL(nextUrl).href;
        if (visited.has(normalizedUrl)) throw new Error('清单分页出现循环，已中止');
        visited.add(normalizedUrl);

        const documentNode = await fetchHtmlDocument(normalizedUrl);
        const parsed = parseListPage(documentNode, normalizedUrl, listId, visited.size === 1);
        if (visited.size === 1) {
            expectedCount = parsed.expectedCount;
            name = parsed.name;
        }
        movies.push(...parsed.movies);
        nextUrl = parsed.nextUrl;
    }

    if (expectedCount === null || name === null) throw new Error('清单首页信息不完整');
    const uniqueDesignations = new Set(movies.map((movie) => movie.designation));
    if (movies.length !== expectedCount || uniqueDesignations.size !== expectedCount) {
        throw new Error(
            `清单分页不完整或含重复番号：服务端 ${expectedCount}，抓取 ${movies.length}，唯一 ${uniqueDesignations.size}`
        );
    }

    return {
        listId,
        name,
        url: firstUrl.href,
        expectedCount,
        movies
    };
}

/**
 * 连续抓取两份完整快照并比较全量番号顺序，防止后页发生等量替换时写入混合快照。
 */
export async function fetchCompleteListSnapshot(listId: string): Promise<ListReconcileSnapshot> {
    const first = await fetchCompleteListPass(listId);
    await new Promise((resolve) => setTimeout(resolve, 250));
    const second = await fetchCompleteListPass(listId);
    const firstSequence = first.movies.map((movie) => movie.designation).join('\u001f');
    const secondSequence = second.movies.map((movie) => movie.designation).join('\u001f');
    if (
        first.expectedCount !== second.expectedCount ||
        first.name !== second.name ||
        firstSequence !== secondSequence
    ) {
        throw new Error('清单在两次完整抓取之间发生变化，已放弃本次快照');
    }
    return second;
}
