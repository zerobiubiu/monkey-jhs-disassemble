/**
 * 纯工具函数 —— DOM 提取、清单名称匹配、checkbox 状态操作、共享常量。
 *
 * 提取自 vlt-sync.tsx：无 vlt 模块依赖，仅操作 DOM / 读取页面元素。
 */

/** 日志前缀。 */
export const LOG_PREFIX = '[JavDB]';

/** 服务端写入已发出、但尚未完成本地镜像的持久化日志前缀。 */
export const PENDING_SYNC_PREFIX = 'jdb:vlt-pending-server-sync:';

/** 触发自动收藏的清单名称关键词（清单名称包含此词时，添加视频自动收藏）。 */
export const AUTO_FAVORITE_KEYWORD = '等待更新';

/**
 * 从番号提取系列名（`-` 前部分）。
 * 对应原 L334-338。
 */
export function getSeries(d: string): string {
    if (!d) return d;
    const i = d.indexOf('-');
    return i > 0 ? d.slice(0, i) : d;
}

/**
 * 从番号提取后缀编号（`-` 后部分）。
 * 对应原 L339-343。
 */
export function getCode(d: string): string | null {
    if (!d) return null;
    const i = d.indexOf('-');
    return i > 0 ? d.slice(i + 1) : null;
}

/**
 * 从详情页提取评分。
 * 对应原 L344-355。
 * @returns 评分数值，找不到返回 0
 */
function getScore(): number {
    const spans = document.querySelectorAll('nav span');
    const found = Array.from(spans).find((s: Element) => s.textContent?.trim().endsWith('人評價'));
    if (!found) return 0.0;
    const m = found.innerHTML.match(/(\d+\.\d+)/);
    return m ? parseFloat(m[1]) : 0.0;
}

/** 缓存的评分（单次页面加载只计算一次）。 */
let _cachedScore: number | undefined;

/** 获取缓存的评分。 */
function getScoreCached(): number {
    if (_cachedScore === undefined) _cachedScore = getScore();
    return _cachedScore;
}

/**
 * 从详情页 DOM 提取影片信息。
 * 对应原 L364-405。
 * @param videoId 视频 ID（URL 末段）
 * @returns 影片信息或 null
 */
export function getMovieInfo(videoId: string): {
    designation: string;
    info: {
        href: string;
        title: string;
        release_date: string;
        cover_src: string;
        score: number;
        series: string;
        code: string;
    };
} | null {
    const detail = document.querySelector('.video-detail');
    if (!detail) {
        console.warn(`${LOG_PREFIX} 未找到 .video-detail，跳过`);
        return null;
    }

    const desEl = detail.querySelector('.panel-block.first-block a[data-clipboard-text]');
    if (!desEl) {
        console.warn(`${LOG_PREFIX} 未找到番号元素，跳过`);
        return null;
    }
    const designation = (desEl as HTMLElement).dataset.clipboardText || '';
    if (!designation) {
        console.warn(`${LOG_PREFIX} 番号为空，跳过`);
        return null;
    }
    const href = 'https://javdb.com/v/' + videoId;

    const titleEl = detail.querySelector('strong.current-title');
    const title = titleEl ? titleEl.innerHTML : '';

    const dateEl = detail.querySelector('.video-meta-panel nav > div:nth-child(2) > span');
    const release_date = dateEl ? dateEl.innerHTML : '';

    const coverEl = detail.querySelector('.column-video-cover img');
    const cover_src = coverEl ? (coverEl as HTMLImageElement).src : '';

    const score = getScoreCached();
    const series = getSeries(designation);
    const code = getCode(designation);

    return {
        designation,
        info: { href, title, release_date, cover_src, score, series, code: code || '' }
    };
}

/**
 * 从 DOM 提取清单名称。
 * 对应原 L407-424。
 */
export function extractListNameFromInput(input: HTMLInputElement): string {
    const label = input.closest('label');
    if (!label) return '';
    const clone = label.cloneNode(true) as HTMLElement;
    clone.querySelector('input')?.remove();
    const count = clone.querySelector('.jhs-list-item__count') || clone.querySelector('span');
    count?.remove();
    return (clone.textContent || '').replace(/\s+/g, ' ').trim();
}

export function getListName(listId: string): string {
    const modalInputs = Array.from(
        document.querySelectorAll<HTMLInputElement>('#modal-save-list input[data-list-id]')
    );
    const panelInputs = Array.from(
        document.querySelectorAll<HTMLInputElement>('.jhs-list-panel input[data-list-id]')
    );
    const input =
        modalInputs.find((item) => item.dataset.listId === listId) ||
        panelInputs.find((item) => item.dataset.listId === listId) ||
        null;
    if (!input) return '';
    return extractListNameFromInput(input);
}

/**
 * 获取清单信息。
 * 对应原 L426-430。
 */
export function getListInfo(listId: string): {
    list_id: string;
    info: { url: string; name: string };
} {
    const url = 'https://javdb.com/lists/' + listId + '?locale=zh';
    const name = getListName(listId);
    return { list_id: listId, info: { url, name } };
}

/** 影片信息类型（getMovieInfo 返回值的非空版本）。 */
export type MovieInfo = NonNullable<ReturnType<typeof getMovieInfo>>;
/** 清单信息类型。 */
export type ListInfo = ReturnType<typeof getListInfo>;

export function normalizeListName(value: string): string {
    return value.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

/** 从删除链接 href 提取 listId（/users/remove_list?id=<listId>）。 */
export function extractListIdFromHref(href: string): string | null {
    const m = href.match(/[?&]id=([^&]+)/);
    return m ? m[1] : null;
}

/** 获取 CSRF token（从 meta[name=csrf-token] 读取）。 */
export function getCsrfToken(): string {
    const meta = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null;
    return meta?.content || '';
}

export function getCurrentListContainer(): HTMLElement | null {
    return document.querySelector(
        '#modal-save-list [data-list-target="listContainer"]'
    ) as HTMLElement | null;
}

export function getCheckboxCount(input: HTMLInputElement): number | null {
    const label = input.closest('label');
    const text =
        (label?.querySelector('.jhs-list-item__count') || label?.querySelector('span'))
            ?.textContent || '';
    const match = text.match(/\d+/);
    if (!match) return null;
    const count = Number(match[0]);
    return Number.isSafeInteger(count) ? count : null;
}

export function matchingListCheckboxes(listId: string): HTMLInputElement[] {
    return (Array.from(
        document.querySelectorAll(
            '#modal-save-list input[type="checkbox"][data-list-id], ' +
                '.jhs-list-panel input[type="checkbox"][data-list-id]'
        )
    ) as HTMLInputElement[]).filter((input) => input.dataset.listId === listId);
}

export function setListCheckboxState(listId: string, checked: boolean): void {
    for (const input of matchingListCheckboxes(listId)) input.checked = checked;
}

export function setListCheckboxBusy(listId: string, busy: boolean): void {
    const panel = document.querySelector('.jhs-list-panel') as
        | (HTMLElement & { __jhsPendingFocusListId?: string })
        | null;
    const activeElement = document.activeElement;
    if (
        busy &&
        panel &&
        activeElement instanceof HTMLInputElement &&
        panel.contains(activeElement) &&
        activeElement.dataset.listId === listId
    ) {
        panel.__jhsPendingFocusListId = listId;
    }

    for (const input of matchingListCheckboxes(listId)) {
        if (busy) {
            if (input.dataset.vltWasDisabled === undefined) {
                input.dataset.vltWasDisabled = input.disabled ? '1' : '0';
            }
            input.disabled = true;
            input.setAttribute('aria-busy', 'true');
        } else {
            if (input.dataset.vltWasDisabled === undefined) continue;
            input.disabled = input.dataset.vltWasDisabled === '1';
            delete input.dataset.vltWasDisabled;
            input.removeAttribute('aria-busy');
        }
    }

    if (!busy && panel?.__jhsPendingFocusListId === listId) {
        delete panel.__jhsPendingFocusListId;
        requestAnimationFrame(() => {
            const currentActive = document.activeElement;
            const canRestore =
                !currentActive ||
                currentActive === document.body ||
                (currentActive instanceof HTMLInputElement &&
                    currentActive.dataset.listId === listId);
            if (!canRestore) return;
            const displayInput = Array.from(
                panel.querySelectorAll<HTMLInputElement>(
                    'input[type="checkbox"][data-list-id]'
                )
            ).find((input) => input.dataset.listId === listId && !input.disabled);
            displayInput?.focus({ preventScroll: true });
        });
    }
}

export function setListDisplayedCount(listId: string, count: number): void {
    for (const input of matchingListCheckboxes(listId)) {
        const label = input.closest('label');
        const span = label?.querySelector('.jhs-list-item__count') || label?.querySelector('span');
        if (!span) continue;
        if (span.classList.contains('jhs-list-item__count')) {
            span.textContent = String(count);
            span.setAttribute('title', `清单内 ${count} 部影片`);
            span.setAttribute('aria-label', `${count} 部影片`);
        } else {
            span.textContent = `(${count})`;
        }
    }
}

/**
 * 从详情页 DOM 提取演员名（与 BasePlugin.getPageInfo 的 actress 提取逻辑一致）。
 * 用于自动收藏时填充 CarRecord.names 字段。
 */
export function getActressNames(): string {
    try {
        return $('.female')
            .prev()
            .map((_index: number, el: HTMLElement) => $(el).text())
            .get()
            .join(' ')
            .trim();
    } catch {
        return '';
    }
}

/**
 * 通过 DetailPageButtonPlugin 调用 JavDB API 设为「想看」并刷新星标评分组件。
 */
export function triggerJavdbWantAndSyncRatingBar(carNum: string): void {
    try {
        const detailPlugin = pluginManager?.getBean?.('DetailPageButtonPlugin');
        if (!detailPlugin) {
            console.warn(`${LOG_PREFIX} DetailPageButtonPlugin 未注册，跳过星标评分联动`);
            return;
        }
        detailPlugin._reviewChain = (detailPlugin._reviewChain || Promise.resolve())
            .then(async () => {
                detailPlugin._wantWatchedSyncing = true;
                try {
                    await detailPlugin._triggerJavdbWant();
                    detailPlugin._syncRatingBar();
                } finally {
                    detailPlugin._wantWatchedSyncing = false;
                }
            })
            .catch(() => {});
    } catch (err: unknown) {
        clog.error(`${LOG_PREFIX} 星标评分联动失败: ${carNum}`, err);
    }
}

/**
 * 刷新 `.jhs-list-panel` 平铺面板：从 modal 内最新 listContainer 克隆全部
 * 条目（跳过「预设清单」），与 DetailPageButtonPlugin._initListPanel 的 sync
 * 逻辑等价、幂等。
 */
export function refreshListPanel(): void {
    const panel = document.querySelector('.jhs-list-panel') as
        | (HTMLElement & { __jhsRefresh?: () => void })
        | null;
    if (!panel) return;
    if (panel.__jhsRefresh) {
        panel.__jhsRefresh();
        return;
    }
    const lc = document.querySelector('#modal-save-list [data-list-target="listContainer"]');
    if (!lc) return;
    const items = panel.querySelector('.jhs-list-panel__items') || panel;
    items.innerHTML = '';
    Array.from(lc.children).forEach((child: Element) => {
        // 跳过「预设清单」/「預設清單」（简/繁体均匹配）
        if (/[预預][设設]清[单單]/.test(child.textContent)) return;
        items.appendChild(child.cloneNode(true));
    });
}
