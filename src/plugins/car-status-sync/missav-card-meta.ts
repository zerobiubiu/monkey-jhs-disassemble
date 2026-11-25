/**
 * MissAV 卡片底部独立信息区渲染模块 —— MissAV 原生收藏徽标 + JavDB 归属清单胶囊行。
 *
 * 挂载位置：追加在每个 `.thumbnail.group` 的最底部（原生封面 `div.relative` 与标题之后），
 * 完全不覆盖视频封面；兼容初始页 `grid > 包装DIV > .thumbnail.group` 与瀑布流
 * `grid > .thumbnail.group` 两种卡片形态。
 *
 * 复用逻辑与 JavDB `vlt-tag-renderer.ts` 保持一致：
 * - 优先使用 JavDB 清单配色（浅底配深字、深底配白字），缺失时按清单名确定性选色；
 * - 有链接时渲染为新标签页打开的 `<a>`（经 `normalizeJavdbListUrl` 安全校验）；
 * - 鼠标滚轮横向滚动，触达边界后自动交还页面纵向滚动；
 * - 既无 MissAV 收藏又无 JavDB 清单时放置暗色低对比度 `—` 占位符，保持同行卡片底部齐平。
 */

import { normalizeCarNum } from '../../core/domain/car-num';
import { extractMissavSlug } from '../../core/util/site/missav-paths';

import { normalizeJavdbListUrl, type MissavVltListMeta } from './vlt-sync-protocol';

/** 回退配色池（与 JavDB VltDb 调色板一致）。 */
const FALLBACK_LIST_COLORS = [
    { bg: '#0d6efd', text: '#fff' },
    { bg: '#6c757d', text: '#fff' },
    { bg: '#198754', text: '#fff' },
    { bg: '#dc3545', text: '#fff' },
    { bg: '#ffc107', text: '#212529' },
    { bg: '#0dcaf0', text: '#212529' },
    { bg: '#212529', text: '#fff' }
] as const;

/** 基于清单名称确定性挑选回退配色，避免刷新时同一清单颜色跳变。 */
function pickDeterministicColor(name: string): { bg: string; text: string } {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    }
    return FALLBACK_LIST_COLORS[hash % FALLBACK_LIST_COLORS.length];
}

/** 创建 MissAV 原生收藏实心心形内联 SVG（复用 MissAV 详情页实测心形路径）。 */
function createSavedHeartSvg(): SVGSVGElement {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'jhs-missav-saved-icon');
    svg.setAttribute('viewBox', '0 0 20 20');
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('fill-rule', 'evenodd');
    path.setAttribute(
        'd',
        'M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z'
    );
    path.setAttribute('clip-rule', 'evenodd');
    svg.appendChild(path);
    return svg;
}

/** 创建左侧 MissAV 原生收藏徽标（图标 + 文字双通道表态，清晰区别于右上角 JavDB 徽标）。 */
function createMissavSavedBadge(): HTMLSpanElement {
    const badge = document.createElement('span');
    badge.className = 'jhs-missav-saved-badge';
    badge.title = '已在 MissAV 收藏此影片';
    badge.setAttribute('aria-label', 'MissAV 已收藏');
    badge.appendChild(createSavedHeartSvg());
    badge.appendChild(document.createTextNode('MissAV'));
    return badge;
}

/** 创建单个 JavDB 归属清单胶囊。 */
function createVltListBadge(tag: MissavVltListMeta): HTMLElement {
    const safeUrl = normalizeJavdbListUrl(tag.url);
    const el = document.createElement(safeUrl ? 'a' : 'span');
    el.className = 'jhs-missav-vlt-tag';
    el.dataset.vltName = tag.name;
    el.textContent = tag.name;

    if (safeUrl) {
        const anchor = el as HTMLAnchorElement;
        anchor.href = safeUrl;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.title = `在 JavDB 打开清单：${tag.name}`;
    }

    const palette =
        tag.style && tag.style.bg && tag.style.text
            ? { bg: tag.style.bg, text: tag.style.text }
            : pickDeterministicColor(tag.name);

    el.style.backgroundColor = palette.bg;
    el.style.color = palette.text;
    if (palette.text.toLowerCase() !== '#fff' && palette.text.toLowerCase() !== '#ffffff') {
        el.classList.add('jhs-vlt-light-bg');
    }

    return el;
}

/** 为横向清单滚动区绑定滚轮横向滚动，触达边界时交还页面纵向滚动。 */
function bindHorizontalWheel(scroller: HTMLElement): void {
    scroller.addEventListener(
        'wheel',
        (e: WheelEvent) => {
            if (e.deltaY === 0) return;
            const atStart = scroller.scrollLeft <= 0 && e.deltaY < 0;
            const atEnd =
                scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 1 &&
                e.deltaY > 0;
            if (!atStart && !atEnd) {
                e.preventDefault();
                scroller.scrollLeft += e.deltaY;
            }
        },
        { passive: false }
    );
}

/** 计算单卡底部信息区的内容签名，用于差量跳过无变化的重绘。 */
export function buildCardMetaSignature(lists: MissavVltListMeta[], isSaved: boolean): string {
    const listPart = lists
        .map((t) => `${t.id}:${t.name}:${t.url ?? ''}:${t.style?.bg ?? ''}:${t.style?.text ?? ''}`)
        .join('|');
    return `${isSaved ? '1' : '0'}#${listPart}`;
}

/** 从单个 `.thumbnail.group` 卡片提取 MissAV slug 与 JavDB 标准番号。 */
export function extractCardIdentity(item: Element): { slug: string; carNum: string } | null {
    const altLink = item.querySelector<HTMLAnchorElement>('a[alt]');
    const hrefLink = altLink ?? item.querySelector<HTMLAnchorElement>('a[href]');
    const raw = altLink?.getAttribute('alt') || hrefLink?.getAttribute('href') || '';
    const slug = extractMissavSlug(raw);
    if (!slug) return null;
    const carNum = normalizeCarNum(slug, 'path');
    return { slug, carNum };
}

/**
 * 批量渲染或差量更新容器内所有 `.thumbnail.group` 的底部独立信息区。
 *
 * @param container 包含视频卡片的容器
 * @param vltMap 归一化番号 → JavDB 归属清单数组
 * @param savedSet MissAV 原生已收藏的规范 slug 集合
 * @returns updated 实际新建或变更的卡片数；savedMatched 命中 MissAV 收藏数；vltMatched 命中 JavDB 清单数
 */
export function renderCardMeta(
    container: HTMLElement,
    vltMap: ReadonlyMap<string, MissavVltListMeta[]>,
    savedSet: ReadonlySet<string>
): { updated: number; savedMatched: number; vltMatched: number } {
    if (!container) return { updated: 0, savedMatched: 0, vltMatched: 0 };

    const items = container.querySelectorAll<HTMLElement>('.thumbnail.group');
    let updated = 0;
    let savedMatched = 0;
    let vltMatched = 0;

    for (const item of items) {
        const identity = extractCardIdentity(item);
        if (!identity) continue;

        const lists = vltMap.get(identity.carNum) ?? [];
        const isSaved = savedSet.has(identity.slug);
        if (isSaved) savedMatched++;
        if (lists.length > 0) vltMatched++;

        const nextSig = buildCardMetaSignature(lists, isSaved);
        let metaRow = item.querySelector<HTMLDivElement>(':scope > .jhs-missav-card-meta');
        if (metaRow && metaRow.dataset.metaSig === nextSig) {
            continue;
        }

        if (!metaRow) {
            metaRow = document.createElement('div');
            metaRow.className = 'jhs-missav-card-meta';
            item.appendChild(metaRow);
        } else {
            metaRow.textContent = '';
        }

        metaRow.dataset.metaSig = nextSig;
        metaRow.dataset.missavSaved = isSaved ? 'yes' : 'no';
        metaRow.dataset.missavSlug = identity.slug;

        if (isSaved) {
            metaRow.appendChild(createMissavSavedBadge());
        }

        if (lists.length > 0 || !isSaved) {
            const scroller = document.createElement('div');
            scroller.className = 'jhs-missav-vlt-tags';
            if (lists.length > 0) {
                for (const tag of lists) {
                    scroller.appendChild(createVltListBadge(tag));
                }
                bindHorizontalWheel(scroller);
            } else {
                const empty = document.createElement('span');
                empty.className = 'jhs-missav-vlt-empty';
                empty.textContent = '\u2014';
                empty.setAttribute('aria-hidden', 'true');
                scroller.appendChild(empty);
            }
            metaRow.appendChild(scroller);
        }

        updated++;
    }

    return { updated, savedMatched, vltMatched };
}
