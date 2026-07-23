/**
 * JavDB 清单对账模块。
 *
 * 仅在“服务端显示数量/当前影片勾选态”与本地 IDB 不一致时抓取全部分页。
 * 只有完整分页、总数、唯一性和二次首页稳定性全部通过后才允许写入本地。
 */

import { VltDb } from './vlt-db';
import type { ListReconcileSnapshot, MovieRecord } from './vlt-db';
import { showToast } from './vlt-toast';

const LOG_PREFIX = '[JavDB][清单对账]';
const MAX_PAGES = 100;
const AUTO_RECONCILE_DELAY = 350;

interface ReconcileExpectation {
    expectedCount?: number;
    designation?: string;
    checked?: boolean;
    quiet?: boolean;
}

interface ParsedListPage {
    expectedCount: number | null;
    name: string | null;
    movies: MovieRecord[];
    nextUrl: string | null;
}

const reconcileQueues = new Map<string, Promise<boolean>>();
let automaticReconciliationInstalled = false;
let automaticReconciliationInstalling = false;
let automaticReconciliationTimer: ReturnType<typeof setTimeout> | null = null;
let automaticReconciliationRunning = false;

function normalizeText(value: string | null | undefined): string {
    return (value || '').replace(/\s+/g, ' ').trim();
}

function getSeries(designation: string): string | null {
    const index = designation.indexOf('-');
    return index > 0 ? designation.slice(0, index) : designation || null;
}

function getCode(designation: string): string | null {
    const index = designation.indexOf('-');
    return index > 0 ? designation.slice(index + 1) : null;
}

function getDisplayedListCount(input: HTMLInputElement): number | null {
    const label = input.closest('label');
    const countText = label?.querySelector('span')?.textContent || label?.textContent || '';
    const match = countText.match(/\((\d+)\)/);
    if (!match) return null;
    const count = Number(match[1]);
    return Number.isSafeInteger(count) ? count : null;
}

function getDisplayedListName(input: HTMLInputElement): string {
    const labelText = normalizeText(input.closest('label')?.textContent);
    return labelText.replace(/\s*\(\d+\).*$/, '').trim();
}

async function fetchHtmlDocument(url: string): Promise<Document> {
    let response: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
        response = await fetch(url, {
            method: 'GET',
            credentials: 'same-origin',
            cache: 'no-store',
            headers: { Accept: 'text/html,application/xhtml+xml' }
        });
        if (response.ok) break;
        if (![429, 502, 503, 504].includes(response.status) || attempt === 2) {
            throw new Error(`清单页面请求失败：HTTP ${response.status}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
    if (!response?.ok) throw new Error('清单页面请求失败');

    const html = await response.text();
    const documentNode = new DOMParser().parseFromString(html, 'text/html');
    const title = normalizeText(documentNode.title).toLowerCase();
    if (
        !documentNode.body ||
        title.includes('cloudflare') ||
        title.includes('just a moment') ||
        documentNode.querySelector('form[action*="sign_in"]')
    ) {
        throw new Error('清单页面被登录页或人机验证页替代');
    }
    return documentNode;
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
async function fetchCompleteListSnapshot(listId: string): Promise<ListReconcileSnapshot> {
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

function snapshotMatchesExpectation(
    snapshot: ListReconcileSnapshot,
    expectation: ReconcileExpectation
): boolean {
    if (
        expectation.expectedCount !== undefined &&
        snapshot.expectedCount !== expectation.expectedCount
    ) {
        return false;
    }
    if (expectation.designation !== undefined && expectation.checked !== undefined) {
        const contains = snapshot.movies.some(
            (movie) => movie.designation === expectation.designation
        );
        return contains === expectation.checked;
    }
    return true;
}

async function performReconciliation(
    listId: string,
    expectation: ReconcileExpectation
): Promise<boolean> {
    try {
        for (let attempt = 0; attempt < 2; attempt++) {
            const state = await VltDb.getListReconcileState(listId);
            const snapshot = await fetchCompleteListSnapshot(listId);
            if (!snapshotMatchesExpectation(snapshot, expectation)) {
                throw new Error('服务端清单状态已变化，与触发对账时的状态不一致');
            }

            const result = await VltDb.reconcileListSnapshot(snapshot, state.guard);
            if (result.status === 'conflict') {
                console.warn(`${LOG_PREFIX} 本地数据在抓取期间变化，准备重试 listId=${listId}`);
                continue;
            }

            console.log(
                `${LOG_PREFIX} 完成 listId=${listId} count=${result.count} added=${result.added} removed=${result.removed}`
            );
            if (!expectation.quiet && (result.added > 0 || result.removed > 0)) {
                showToast(
                    `✓ 已按 JavDB 校准「${snapshot.name}」：新增 ${result.added}，移除 ${result.removed}`,
                    'success'
                );
            }
            return true;
        }
        throw new Error('本地清单持续变化，两次对账均发生冲突');
    } catch (error) {
        clog.error(`${LOG_PREFIX} 失败 listId=${listId}`, error);
        if (!expectation.quiet) {
            const message = error instanceof Error ? error.message : String(error);
            showToast(`⚠ 清单自动校准失败：${message}`, 'warning');
        }
        return false;
    }
}

/** 同一清单的对账任务串行执行，避免多处同时触发分页抓取。 */
export function reconcileListWithJavdb(
    listId: string,
    expectation: ReconcileExpectation = {}
): Promise<boolean> {
    const previous = reconcileQueues.get(listId) || Promise.resolve(true);
    const current = previous
        .catch(() => false)
        .then(() => performReconciliation(listId, expectation));
    reconcileQueues.set(listId, current);
    current.finally(() => {
        if (reconcileQueues.get(listId) === current) reconcileQueues.delete(listId);
    });
    return current;
}

/**
 * 用户切换某个清单前做轻量检查；只有数量或当前影片归属不一致才抓全量分页。
 */
export async function reconcileListBeforeMutation(
    input: HTMLInputElement,
    designation: string,
    checkedBeforeMutation: boolean
): Promise<void> {
    const listId = input.dataset.listId || '';
    const serverCount = getDisplayedListCount(input);
    if (!listId || serverCount === null) return;

    const state = await VltDb.getListReconcileState(listId, designation);
    if (!state.inventory) return;
    if (
        state.actualCount === serverCount &&
        state.hasDesignation === checkedBeforeMutation
    ) {
        return;
    }

    console.warn(
        `${LOG_PREFIX} 检测到差异 listId=${listId} local=${state.actualCount} server=${serverCount} ` +
            `localChecked=${state.hasDesignation} serverChecked=${checkedBeforeMutation}`
    );
    await reconcileListWithJavdb(listId, {
        expectedCount: serverCount,
        designation,
        checked: checkedBeforeMutation,
        quiet: false
    });
}

/** JavDB 已成功写入但本地出现异常时，按服务端完整快照强制修复。 */
export function reconcileAfterConfirmedMutation(
    listId: string,
    designation: string,
    checked: boolean
): Promise<boolean> {
    return reconcileListWithJavdb(listId, { designation, checked, quiet: false });
}

async function runAutomaticReconciliation(designation: string): Promise<void> {
    if (automaticReconciliationRunning) return;
    automaticReconciliationRunning = true;
    try {
        const inputs = Array.from(
            document.querySelectorAll(
                '#modal-save-list input[type="checkbox"][data-list-id][data-action="change->list#listCheckboxChanged"]'
            )
        ) as HTMLInputElement[];

        for (const input of inputs) {
            const listId = input.dataset.listId || '';
            const serverCount = getDisplayedListCount(input);
            if (!listId || serverCount === null) continue;
            const state = await VltDb.getListReconcileState(listId, designation);
            // 未登记过的清单沿用按用户操作逐条建立本地镜像，避免首次运行下载全部清单。
            if (!state.inventory) continue;
            if (state.actualCount === serverCount && state.hasDesignation === input.checked) continue;

            console.warn(
                `${LOG_PREFIX} 页面加载发现差异「${getDisplayedListName(input)}」 ` +
                    `local=${state.actualCount} server=${serverCount}`
            );
            await reconcileListWithJavdb(listId, {
                expectedCount: serverCount,
                designation,
                checked: input.checked,
                quiet: false
            });
        }
    } finally {
        automaticReconciliationRunning = false;
    }
}

/** 在详情页清单 AJAX 内容稳定后自动检查数量和当前影片归属。 */
export function setupAutomaticListReconciliation(designation: string): void {
    if (automaticReconciliationInstalled || automaticReconciliationInstalling) return;
    automaticReconciliationInstalling = true;

    const schedule = (): void => {
        if (automaticReconciliationTimer) clearTimeout(automaticReconciliationTimer);
        automaticReconciliationTimer = setTimeout(() => {
            automaticReconciliationTimer = null;
            runAutomaticReconciliation(designation).then();
        }, AUTO_RECONCILE_DELAY);
    };

    const attach = (): void => {
        const modal = document.querySelector('#modal-save-list');
        if (!modal) {
            setTimeout(attach, 250);
            return;
        }
        automaticReconciliationInstalling = false;
        automaticReconciliationInstalled = true;
        const observer = new MutationObserver(schedule);
        observer.observe(modal, { childList: true, subtree: true });
        schedule();
    };
    attach();
}
