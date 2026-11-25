/**
 * MissAV 原生收藏状态同步与实时监听模块。
 *
 * 严格基于真实登录态页面 DOM 实测结构实现（无猜测字段）：
 * 1. 收藏页（`/{lang}/saved`）：与普通列表页同款 `.thumbnail.group` + `a[alt]` + 分页，
 *    采用同源页面 `fetch(url, { credentials: 'include' })` 复用浏览器指纹头与登录 Cookie，
 *    完整抓完后权威替换本地 `missav_saved` 仓库；遇未登录/跳转/拦截安全中止不误清库。
 * 2. 详情页（含列表页通过 `MissavVideoPreviewPlugin` 打开的同源 iframe 预览弹窗）：
 *    精准定位 `@click.prevent="toggleSave"` 按钮，通过实时 `class`（`text-primary` vs `text-nord4`）
 *    与内部 `svg[x-show]` 显隐判定收藏态；支持初始已收藏自动补录与点击收藏/取消实时写库。
 * 3. 跨帧实时联动：通过同源 `BroadcastChannel('jhs-missav-saved-sync')` 在 iframe 预览弹窗、
 *    父窗口列表页以及其他 MissAV 标签页间毫秒级同步，点击收藏后父窗口卡片立刻刷新。
 */

import { normalizeCarNum } from '../../core/domain/car-num';
import type { TaskSupervisor } from '../../core/task-supervisor';
import {
    buildMissavSavedUrl,
    extractMissavSlug,
    isMissavSavedPage
} from '../../core/util/site/missav-paths';

import {
    deleteMissavSaved,
    replaceMissavSaved,
    upsertMissavSaved,
    type MissavSavedItemInput
} from './missav-saved-db';

/** 同源跨帧 / 跨标签页广播频道名（连接列表父页与 iframe 详情弹窗）。 */
export const MISSAV_SAVED_CHANNEL_NAME = 'jhs-missav-saved-sync';

/** 分页抓取页间节流间隔（毫秒，避免短时高频请求触发站点限流）。 */
const PAGE_FETCH_DELAY_MS = 400;

/** 异常分页循环保护上限（每页 12 条，500 页约 6000 条）。 */
const MAX_SAVED_PAGES = 500;

/** BroadcastChannel 广播载荷。 */
export type MissavSavedBroadcastEvent =
    | { type: 'saved-upsert'; slug: string; carNum: string }
    | { type: 'saved-delete'; slug: string }
    | { type: 'saved-full-sync'; count: number };

/** 全量同步进度回调。 */
export interface MissavSavedSyncProgress {
    page: number;
    collected: number;
}

/** 全量同步结果。 */
export type MissavSavedSyncResult =
    | { ok: true; total: number; pages: number; deleted: number }
    | { ok: false; reason: 'busy' | 'not-logged-in' | 'http-error' | 'invalid-page' | 'network'; message: string };

/** 单飞防重入标记。 */
let fullSyncInFlight: Promise<MissavSavedSyncResult> | null = null;

/**
 * 在视频详情页（含 iframe）中查找 MissAV 原生收藏按钮。
 *
 * 不依赖语言文本（「收藏」/「Save」），直接匹配 Alpine 绑定属性 `@click.prevent="toggleSave"`。
 */
export function findDetailSaveButton(root: ParentNode): HTMLButtonElement | null {
    const buttons = root.querySelectorAll<HTMLButtonElement>('button');
    for (const btn of Array.from(buttons)) {
        const clickExpr =
            btn.getAttribute('@click.prevent') ??
            btn.getAttribute('x-on:click.prevent') ??
            btn.getAttribute('@click') ??
            '';
        if (clickExpr.trim() === 'toggleSave') {
            return btn;
        }
    }
    return null;
}

/**
 * 读取详情页收藏按钮当前真实的运行时状态。
 *
 * 实测模板：`:class="{ 'text-primary': saved, 'text-nord4': ! saved, ... }"`
 * 以及内部 `<svg x-show="saved">` 与 `<svg x-show="! saved">`。
 * 未完成 Alpine 渲染或状态模糊时返回 `null`（宁可不写，绝不误判）。
 */
export function readDetailSaveButtonState(btn: Element): boolean | null {
    const hasPrimary = btn.classList.contains('text-primary');
    const hasNord4 = btn.classList.contains('text-nord4');
    if (hasPrimary && !hasNord4) return true;
    if (hasNord4 && !hasPrimary) return false;

    const svgs = Array.from(btn.querySelectorAll<SVGElement>('svg'));
    const savedSvg = svgs.find((svg) => (svg.getAttribute('x-show') || '').trim() === 'saved');
    const unsavedSvg = svgs.find(
        (svg) => (svg.getAttribute('x-show') || '').replace(/\s+/g, '') === '!saved'
    );
    if (savedSvg && unsavedSvg) {
        const savedHidden = savedSvg.style.display === 'none';
        const unsavedHidden = unsavedSvg.style.display === 'none';
        if (!savedHidden && unsavedHidden) return true;
        if (savedHidden && !unsavedHidden) return false;
    }
    return null;
}

/** 从收藏页或列表页 DOM 提取所有视频条目的规范 slug 与标准番号（按 slug 去重）。 */
export function extractSavedItemsFromDoc(doc: ParentNode): MissavSavedItemInput[] {
    const seen = new Set<string>();
    const items: MissavSavedItemInput[] = [];
    doc.querySelectorAll<HTMLElement>('.thumbnail.group').forEach((thumb) => {
        const altLink = thumb.querySelector<HTMLAnchorElement>('a[alt]');
        const hrefLink = altLink ?? thumb.querySelector<HTMLAnchorElement>('a[href]');
        const raw = altLink?.getAttribute('alt') || hrefLink?.getAttribute('href') || '';
        const slug = extractMissavSlug(raw);
        if (!slug || seen.has(slug)) return;
        seen.add(slug);
        items.push({ slug, carNum: normalizeCarNum(slug, 'path') });
    });
    return items;
}

/** 从收藏页 DOM 提取下一页同源绝对 URL。 */
export function findSavedNextPageUrl(doc: Document, currentUrl: string): string | null {
    const current = new URL(currentUrl);
    const resolveSameOrigin = (rawHref: string | null): string | null => {
        if (!rawHref) return null;
        try {
            const target = new URL(rawHref, current);
            if (target.origin !== current.origin) return null;
            if (target.href === current.href) return null;
            return target.href;
        } catch {
            return null;
        }
    };

    const relNext = doc.querySelector<HTMLAnchorElement>('a[rel="next"][href]');
    const relResolved = resolveSameOrigin(relNext?.getAttribute('href') ?? null);
    if (relResolved) return relResolved;

    const pageLinks = Array.from(doc.querySelectorAll<HTMLAnchorElement>("a[href*='page=']"));
    const nextTextLink = pageLinks.find((a) => {
        const text = (a.textContent || '').trim();
        return text === '下一页' || text === 'Next' || text === '下一頁' || text === '›' || text === '»';
    });
    return resolveSameOrigin(nextTextLink?.getAttribute('href') ?? null);
}

/**
 * 校验抓取到的响应文档是否为有效的登录态收藏页（防止跳转登录页或风控页导致误清空本地库）。
 */
export function isValidSavedPageDoc(doc: Document, responseUrl: string): boolean {
    let pathname: string;
    try {
        pathname = new URL(responseUrl).pathname;
    } catch {
        return false;
    }
    if (!isMissavSavedPage(pathname)) return false;

    // 含卡片即确定是有效的已登录收藏页
    if (doc.querySelector('.thumbnail.group')) return true;

    // 空收藏页必须存在明确的收藏页标题（且非登录/验证页）
    const h1Text = (doc.querySelector('h1')?.textContent || '').trim();
    if (!h1Text) return false;
    if (/login|sign\s*in|登录|登入|just a moment|verify/i.test(h1Text)) return false;
    return /收藏|saved|favorite|favourite|ブックマーク|お気に入り|저장/i.test(h1Text);
}

/** 发送 MissAV 收藏状态同源广播（实时通知父窗口列表页与同源标签页）。 */
export function broadcastMissavSavedEvent(event: MissavSavedBroadcastEvent): void {
    if (typeof BroadcastChannel === 'undefined') return;
    try {
        const channel = new BroadcastChannel(MISSAV_SAVED_CHANNEL_NAME);
        channel.postMessage(event);
        channel.close();
    } catch {
        /* 某些受限环境不支持 BroadcastChannel */
    }
}

/** 订阅 MissAV 收藏状态同源广播（随 AbortSignal 自动释放）。 */
export function subscribeMissavSavedEvent(
    handler: (event: MissavSavedBroadcastEvent) => void,
    signal?: AbortSignal
): void {
    if (typeof BroadcastChannel === 'undefined') return;
    if (signal?.aborted) return;
    try {
        const channel = new BroadcastChannel(MISSAV_SAVED_CHANNEL_NAME);
        const onMessage = (e: MessageEvent<unknown>): void => {
            const data = e.data as Partial<MissavSavedBroadcastEvent> | null;
            if (!data || typeof data.type !== 'string') return;
            if (data.type === 'saved-upsert' && typeof data.slug === 'string') {
                handler({
                    type: 'saved-upsert',
                    slug: data.slug,
                    carNum: typeof data.carNum === 'string' ? data.carNum : normalizeCarNum(data.slug, 'path')
                });
            } else if (data.type === 'saved-delete' && typeof data.slug === 'string') {
                handler({ type: 'saved-delete', slug: data.slug });
            } else if (data.type === 'saved-full-sync') {
                handler({ type: 'saved-full-sync', count: typeof data.count === 'number' ? data.count : 0 });
            }
        };
        channel.addEventListener('message', onMessage);
        signal?.addEventListener(
            'abort',
            () => {
                channel.removeEventListener('message', onMessage);
                channel.close();
            },
            { once: true }
        );
    } catch {
        /* ignore */
    }
}

/**
 * 全量同步 MissAV 收藏页（`/{lang}/saved`）到本地 `missav_saved` 仓库。
 *
 * 采用同源 `fetch(..., { credentials: 'include' })` 复用真实浏览器会话，
 * 完整抓取全部分页并校验后才执行权威替换，失败不清空本地已有数据。
 */
export function syncAllMissavSavedPages(
    onProgress?: (progress: MissavSavedSyncProgress) => void
): Promise<MissavSavedSyncResult> {
    if (fullSyncInFlight) {
        return Promise.resolve({ ok: false, reason: 'busy', message: '正在同步 MissAV 收藏，请稍候' });
    }
    const run = async (): Promise<MissavSavedSyncResult> => {
        const startUrl = buildMissavSavedUrl(window.location.origin, window.location.pathname);
        const visited = new Set<string>();
        const collectedBySlug = new Map<string, MissavSavedItemInput>();
        let currentUrl: string | null = startUrl;
        let pages = 0;

        try {
            while (currentUrl && pages < MAX_SAVED_PAGES) {
                if (visited.has(currentUrl)) break;
                visited.add(currentUrl);

                if (pages > 0) {
                    await new Promise((resolve) => setTimeout(resolve, PAGE_FETCH_DELAY_MS));
                }

                const resp = await fetch(currentUrl, {
                    method: 'GET',
                    credentials: 'include',
                    redirect: 'follow'
                });
                if (!resp.ok) {
                    return {
                        ok: false,
                        reason: 'http-error',
                        message: `请求收藏页失败（HTTP ${resp.status}）`
                    };
                }
                const finalUrl = resp.url || currentUrl;
                const html = await resp.text();
                const doc = new DOMParser().parseFromString(html, 'text/html');

                if (!isValidSavedPageDoc(doc, finalUrl)) {
                    const redirectedToLogin = /\/login\b/i.test(finalUrl);
                    return {
                        ok: false,
                        reason: redirectedToLogin ? 'not-logged-in' : 'invalid-page',
                        message: redirectedToLogin
                            ? '当前未登录 MissAV，请登录后再同步收藏'
                            : '未识别到有效的 MissAV 收藏页内容（可能未登录或触发校验）'
                    };
                }

                pages++;
                const pageItems = extractSavedItemsFromDoc(doc);
                for (const item of pageItems) {
                    collectedBySlug.set(item.slug, item);
                }
                onProgress?.({ page: pages, collected: collectedBySlug.size });

                const nextUrl = findSavedNextPageUrl(doc, finalUrl);
                if (!nextUrl || pageItems.length === 0) {
                    currentUrl = null;
                } else {
                    currentUrl = nextUrl;
                }
            }

            const allItems = Array.from(collectedBySlug.values());
            const { written, deleted } = await replaceMissavSaved(allItems);
            broadcastMissavSavedEvent({ type: 'saved-full-sync', count: written });
            return { ok: true, total: written, pages, deleted };
        } catch (err: unknown) {
            return {
                ok: false,
                reason: 'network',
                message: `同步失败：${err instanceof Error ? err.message : String(err)}`
            };
        }
    };

    fullSyncInFlight = run().finally(() => {
        fullSyncInFlight = null;
    });
    return fullSyncInFlight;
}

/**
 * 在用户正在浏览 MissAV 收藏页（`/{lang}/saved`）时自动将当前页条目校对到本地库。
 * - 若当前为第 1 页且无后续分页，执行权威替换（顺带清理已取消的条目）；
 * - 否则做增量 upsert（零额外网络请求）。
 */
export async function reconcileCurrentSavedPage(): Promise<void> {
    if (!isMissavSavedPage(window.location.pathname)) return;
    if (!isValidSavedPageDoc(document, window.location.href)) return;

    const items = extractSavedItemsFromDoc(document);
    const searchParams = new URLSearchParams(window.location.search);
    const pageNum = Number(searchParams.get('page') || '1');
    const nextUrl = findSavedNextPageUrl(document, window.location.href);

    if (pageNum === 1 && !nextUrl) {
        const { written } = await replaceMissavSaved(items);
        broadcastMissavSavedEvent({ type: 'saved-full-sync', count: written });
        return;
    }

    if (items.length > 0) {
        await upsertMissavSaved(items);
        broadcastMissavSavedEvent({ type: 'saved-full-sync', count: items.length });
    }
}

/**
 * 监听详情页（含 iframe 预览弹窗）原生收藏按钮状态变化：
 * - 初次检测到按钮处于已收藏态（`text-primary`）立即补录到本地并广播；
 * - 用户点击按钮后检测到状态切换（`true ↔ false`）立即增量写入/删除并广播，
 *   让父窗口列表卡片与同源标签页实时同步；
 * - 未点击时即使读到 `false` 也不盲目删除本地数据，避免未登录会话误清空记录。
 */
export function observeDetailSaveButton(
    supervisor: TaskSupervisor,
    onLocalChange?: (slug: string, saved: boolean) => void
): void {
    const slug = extractMissavSlug(window.location.pathname);
    if (!slug) return;
    const carNum = normalizeCarNum(slug, 'path');

    let observedBtn: HTMLButtonElement | null = null;
    let lastKnownState: boolean | null = null;
    let lastClickAt = 0;

    const commitState = async (nextState: boolean, fromClick: boolean): Promise<void> => {
        if (nextState) {
            await upsertMissavSaved([{ slug, carNum }]);
            broadcastMissavSavedEvent({ type: 'saved-upsert', slug, carNum });
            onLocalChange?.(slug, true);
        } else if (fromClick) {
            await deleteMissavSaved([slug]);
            broadcastMissavSavedEvent({ type: 'saved-delete', slug });
            onLocalChange?.(slug, false);
        }
    };

    const syncFromButton = (btn: HTMLButtonElement): void => {
        const current = readDetailSaveButtonState(btn);
        if (current === null) return;
        const fromClick = Date.now() - lastClickAt <= 5000;
        if (lastKnownState === null) {
            lastKnownState = current;
            if (current) {
                void commitState(true, fromClick);
            }
            return;
        }
        if (current === lastKnownState) return;
        lastKnownState = current;
        void commitState(current, fromClick);
    };

    const attachButton = (btn: HTMLButtonElement): void => {
        if (observedBtn === btn) return;
        observedBtn = btn;
        supervisor.addEventListener(
            btn,
            'click',
            () => {
                lastClickAt = Date.now();
                // Alpine 在点击微任务中切换 class/x-show，双时机读取兜底
                supervisor.setTimeout(() => syncFromButton(btn), 30);
                supervisor.setTimeout(() => syncFromButton(btn), 300);
            },
            { capture: true }
        );
        supervisor.observe(
            btn,
            () => {
                syncFromButton(btn);
            },
            {
                attributes: true,
                attributeFilter: ['class', 'style'],
                subtree: true
            }
        );
        syncFromButton(btn);
        // 等待 Alpine 异步 hydration 完成后再补读一次
        supervisor.setTimeout(() => syncFromButton(btn), 600);
    };

    const existing = findDetailSaveButton(document);
    if (existing) {
        attachButton(existing);
        return;
    }

    const bodyObserver = supervisor.observe(
        document.body,
        () => {
            const found = findDetailSaveButton(document);
            if (found) {
                bodyObserver.disconnect();
                attachButton(found);
            }
        },
        { childList: true, subtree: true }
    );
}
