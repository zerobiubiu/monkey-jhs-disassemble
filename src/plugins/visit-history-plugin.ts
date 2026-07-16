/**
 * 访问记录插件 VisitHistoryPlugin —— 记录所有打开过的 javdb 页面，并在影片
 * 详情页的元数据面板（番號/導演/片商/系列/類別/演員 等可跳转链接）上悬浮显示
 * 「最近打开时间」，且悬浮期间**实时跳动**（秒级刷新）。
 *
 * - 记录：每次页面加载 + pageshow(bfcache 恢复) 记录当前页 path → 时间戳到
 *   localStorage `jhs_visit_history`。
 * - 显示：详情页元数据链接绑 mouseenter/mouseleave；**每次 hover 重新读
 *   localStorage** 取最新 ts（避免注入时闭包固化、避免新开标签访问后需刷新
 *   详情页才更新）；显示期间 setInterval 每秒重算相对时间文案。
 * - 相对时间：<1 分秒前 / <1 时分钟前 / <1 天小时前 / <1 周天前 / 更久日期。
 *
 * 存储：localStorage（同步读写）。备份：经 SettingPlugin.buildBackupPayload 的
 * `__localStorage.jhs_visit_history` 随 WebDav/本地 JSON 导出；导入时写回 localStorage。
 */
import { isJavdbSite } from '../constants/site';
import { BasePlugin } from './base-plugin';
import visitHistoryCssRaw from '../styles/visit-history-tooltip.css?raw';

/** localStorage 键：path(pathname+search) → 访问时间戳(ms)。随 WebDav/JSON 备份。 */
export const VISIT_HISTORY_STORAGE_KEY = 'jhs_visit_history';
/** 记录上限，超过则淘汰最旧条目。 */
const MAX_ENTRIES = 5000;
/** 悬浮文案刷新间隔（ms），秒级相对时间需 ≤1000。 */
const TICK_MS = 500;

export class VisitHistoryPlugin extends BasePlugin {
    private tooltipEl: HTMLElement | null = null;
    private tooltipTimer: ReturnType<typeof setInterval> | null = null;
    /** 当前悬浮的 path（定时器内重读 history 用）。 */
    private activePath: string | null = null;
    private dismissListenerBound = false;
    private pageshowBound = false;

    getName(): string {
        return 'VisitHistoryPlugin';
    }

    async initCss(): Promise<string> {
        return visitHistoryCssRaw;
    }

    async handle(): Promise<void> {
        if (!isJavdbSite) return;
        this.recordVisit();
        this.bindPageshow();
        if ((window as any).isDetailPage) {
            this.injectMetaLinkTooltips();
        }
    }

    /**
     * bfcache 前进/后退恢复时脚本不重跑 handle，需补记访问并确保详情页 tooltip 仍可用。
     */
    private bindPageshow(): void {
        if (this.pageshowBound) return;
        this.pageshowBound = true;
        window.addEventListener('pageshow', (event: PageTransitionEvent) => {
            if (!isJavdbSite) return;
            // 恢复或普通显示都再记一次（幂等：覆盖为最新 ts）
            this.recordVisit();
            if (event.persisted && (window as any).isDetailPage) {
                // bfcache 恢复：旧监听可能还在，先卸再绑避免重复
                this.injectMetaLinkTooltips(true);
            }
        });
    }

    private recordVisit(): void {
        const path = location.pathname + location.search;
        const history = this.readHistory();
        history[path] = Date.now();
        this.evictIfNeeded(history);
        try {
            localStorage.setItem(VISIT_HISTORY_STORAGE_KEY, JSON.stringify(history));
        } catch {
            localStorage.removeItem(VISIT_HISTORY_STORAGE_KEY);
        }
    }

    private readHistory(): Record<string, number> {
        try {
            const raw = localStorage.getItem(VISIT_HISTORY_STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    }

    private evictIfNeeded(history: Record<string, number>): void {
        const keys = Object.keys(history);
        if (keys.length <= MAX_ENTRIES) return;
        keys.sort((a, b) => history[a] - history[b]);
        const removeCount = keys.length - MAX_ENTRIES;
        for (let i = 0; i < removeCount; i++) {
            delete history[keys[i]];
        }
    }

    /**
     * 为元数据链接绑定悬浮（所有链接都绑，不在注入时过滤是否已访问）。
     * hover 时再读 localStorage，保证新开标签访问后无需刷新详情页。
     * @param forceRebind 为 true 时移除旧监听再绑（bfcache 恢复）
     */
    private injectMetaLinkTooltips(forceRebind = false): void {
        const container =
            (document.querySelector(
                'body > section > div > div.video-detail > div.video-meta-panel > div > div:nth-child(2)'
            ) as Element | null) || document.querySelector('.movie-panel-info');
        if (!container) return;
        const links = container.querySelectorAll('.panel-block .value a[href]');
        links.forEach((a: Element) => {
            const href = a.getAttribute('href') || '';
            const path = this.normalizePath(href);
            if (!path) return;
            const el = a as HTMLElement & {
                __jhsVisitEnter?: (e: Event) => void;
                __jhsVisitLeave?: (e: Event) => void;
            };
            if (forceRebind && el.__jhsVisitEnter) {
                el.removeEventListener('mouseenter', el.__jhsVisitEnter);
                el.removeEventListener('mouseleave', el.__jhsVisitLeave!);
            }
            if (el.__jhsVisitEnter && !forceRebind) return; // 已绑过
            const onEnter = (): void => {
                // 每次悬浮重新读盘，取最新访问时间
                const history = this.readHistory();
                const ts = history[path];
                if (!ts) {
                    this.hideVisitTooltip();
                    return;
                }
                this.activePath = path;
                this.showVisitTooltip(el, ts);
            };
            const onLeave = (): void => {
                this.hideVisitTooltip();
            };
            el.__jhsVisitEnter = onEnter;
            el.__jhsVisitLeave = onLeave;
            el.addEventListener('mouseenter', onEnter);
            el.addEventListener('mouseleave', onLeave);
        });
    }

    private normalizePath(href: string): string | null {
        if (!href || href.startsWith('javascript:')) return null;
        try {
            const url = new URL(href, location.origin);
            if (url.origin !== location.origin) return null;
            return url.pathname + url.search;
        } catch {
            return null;
        }
    }

    private ensureTooltipEl(): HTMLElement {
        if (!this.tooltipEl || !this.tooltipEl.isConnected) {
            const el = document.createElement('div');
            el.className = 'jhs-visit-tooltip';
            document.body.appendChild(el);
            this.tooltipEl = el;
        }
        if (!this.dismissListenerBound) {
            this.dismissListenerBound = true;
            window.addEventListener('scroll', () => this.hideVisitTooltip(), true);
            window.addEventListener('resize', () => this.hideVisitTooltip(), true);
        }
        return this.tooltipEl;
    }

    /**
     * 显示 tooltip 并每 TICK_MS 刷新：
     * 1) 重读 localStorage 该 path 的 ts（跨标签访问后立即反映）
     * 2) 重算相对时间文案（秒级跳动）
     */
    private showVisitTooltip(link: HTMLElement, initialTs: number): void {
        const el = this.ensureTooltipEl();
        let ts = initialTs;
        const update = (): void => {
            // 定时重读：其他标签刚访问过同一 path 时 ts 会更新
            if (this.activePath) {
                const latest = this.readHistory()[this.activePath];
                if (latest) ts = latest;
            }
            el.textContent = this.formatVisitTime(ts);
            // 文案长度变化时重新量宽并夹紧水平位置
            const rect = link.getBoundingClientRect();
            const tw = el.offsetWidth;
            let left = rect.left + rect.width / 2 - tw / 2;
            if (left < 8) left = 8;
            if (left + tw > window.innerWidth - 8) left = window.innerWidth - tw - 8;
            el.style.left = `${Math.round(left)}px`;
        };
        el.style.display = 'block';
        el.textContent = this.formatVisitTime(ts);
        const rect = link.getBoundingClientRect();
        const tw = el.offsetWidth;
        const th = el.offsetHeight;
        let top = rect.top - th - 6;
        if (top < 8) top = rect.bottom + 6;
        let left = rect.left + rect.width / 2 - tw / 2;
        if (left < 8) left = 8;
        if (left + tw > window.innerWidth - 8) left = window.innerWidth - tw - 8;
        el.style.top = `${Math.round(top)}px`;
        el.style.left = `${Math.round(left)}px`;
        if (this.tooltipTimer) clearInterval(this.tooltipTimer);
        this.tooltipTimer = setInterval(update, TICK_MS);
    }

    private hideVisitTooltip(): void {
        this.activePath = null;
        if (this.tooltipTimer) {
            clearInterval(this.tooltipTimer);
            this.tooltipTimer = null;
        }
        if (this.tooltipEl) {
            this.tooltipEl.style.display = 'none';
            this.tooltipEl.textContent = '';
        }
    }

    private formatVisitTime(ts: number): string {
        const diff = Date.now() - ts;
        if (diff < 60000) {
            return `${Math.max(1, Math.floor(diff / 1000))}秒前打开过`;
        }
        if (diff < 3600000) {
            return `${Math.floor(diff / 60000)}分钟前打开过`;
        }
        if (diff < 86400000) {
            return `${Math.floor(diff / 3600000)}小时前打开过`;
        }
        if (diff < 604800000) {
            return `${Math.floor(diff / 86400000)}天前打开过`;
        }
        return `${this.formatDate(ts)} 打开过`;
    }

    private formatDate(ts: number): string {
        const d = new Date(ts);
        const p = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    }
}
