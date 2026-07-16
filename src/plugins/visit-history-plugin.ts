/**
 * 访问记录插件 VisitHistoryPlugin —— 记录所有打开过的 javdb 页面，并在影片
 * 详情页的元数据面板（番號/導演/片商/系列/類別/演員 等可跳转链接）上悬浮显示
 * 「最近打开时间」，且悬浮期间**实时跳动**（秒级刷新）。
 *
 * - 记录：每次页面加载 + pageshow(bfcache 恢复) 记录当前页 path → 时间戳到
 *   localStorage `jhs_visit_history`。
 * - 显示：详情页元数据链接绑 mouseenter/mouseleave；**每次 hover 重新读
 *   localStorage** 取最新 ts；有记录按时间分级配色（近=安全→远=危险）；
 *   无记录显示白底「无访问记录」。
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

/** 时间分级（与 formatVisitTime 阈值一致）。 */
type VisitTier = 'none' | 'sec' | 'min' | 'hour' | 'day' | 'old';

const TIER_CLASS: Record<VisitTier, string> = {
    none: 'jhs-visit-tooltip--none',
    sec: 'jhs-visit-tooltip--sec',
    min: 'jhs-visit-tooltip--min',
    hour: 'jhs-visit-tooltip--hour',
    day: 'jhs-visit-tooltip--day',
    old: 'jhs-visit-tooltip--old'
};

const ALL_TIER_CLASSES = Object.values(TIER_CLASS).join(' ');

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
            this.recordVisit();
            if (event.persisted && (window as any).isDetailPage) {
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
     * hover 时再读 localStorage；无记录也显示「无访问记录」。
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
            if (el.__jhsVisitEnter && !forceRebind) return;
            const onEnter = (): void => {
                this.activePath = path;
                this.showVisitTooltip(el);
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

    private applyTier(el: HTMLElement, tier: VisitTier): void {
        el.classList.remove(...ALL_TIER_CLASSES.split(' '));
        el.classList.add(TIER_CLASS[tier]);
    }

    /**
     * 显示 tooltip 并每 TICK_MS 刷新：
     * 1) 重读 localStorage 该 path 的 ts（跨标签访问后立即反映）
     * 2) 重算相对时间文案 + 分级配色；无记录则「无访问记录」白底
     */
    private showVisitTooltip(link: HTMLElement): void {
        const el = this.ensureTooltipEl();
        const update = (): void => {
            let ts: number | undefined;
            if (this.activePath) {
                ts = this.readHistory()[this.activePath];
            }
            if (!ts) {
                this.applyTier(el, 'none');
                el.textContent = '无访问记录';
            } else {
                const { text, tier } = this.formatVisitTime(ts);
                this.applyTier(el, tier);
                el.textContent = text;
            }
            const rect = link.getBoundingClientRect();
            const tw = el.offsetWidth;
            let left = rect.left + rect.width / 2 - tw / 2;
            if (left < 8) left = 8;
            if (left + tw > window.innerWidth - 8) left = window.innerWidth - tw - 8;
            el.style.left = `${Math.round(left)}px`;
        };
        el.style.display = 'block';
        update();
        const rect = link.getBoundingClientRect();
        const th = el.offsetHeight;
        let top = rect.top - th - 6;
        if (top < 8) top = rect.bottom + 6;
        el.style.top = `${Math.round(top)}px`;
        // 首帧量宽后再夹紧水平（update 已设 left，文案变长时定时器会再调）
        update();
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
            this.tooltipEl.classList.remove(...ALL_TIER_CLASSES.split(' '));
        }
    }

    /**
     * 相对时间文案 + 分级（阈值与文案规则一致）。
     * sec / min / hour / day / old → 安全→危险配色。
     */
    private formatVisitTime(ts: number): { text: string; tier: VisitTier } {
        const diff = Date.now() - ts;
        if (diff < 60000) {
            return {
                text: `${Math.max(1, Math.floor(diff / 1000))}秒前打开过`,
                tier: 'sec'
            };
        }
        if (diff < 3600000) {
            return {
                text: `${Math.floor(diff / 60000)}分钟前打开过`,
                tier: 'min'
            };
        }
        if (diff < 86400000) {
            return {
                text: `${Math.floor(diff / 3600000)}小时前打开过`,
                tier: 'hour'
            };
        }
        if (diff < 604800000) {
            return {
                text: `${Math.floor(diff / 86400000)}天前打开过`,
                tier: 'day'
            };
        }
        return {
            text: `${this.formatDate(ts)} 打开过`,
            tier: 'old'
        };
    }

    private formatDate(ts: number): string {
        const d = new Date(ts);
        const p = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    }
}
