/**
 * 评分显示工具集 —— 对应 archetype/jhsRatingDisplay.user.js L50-131 `Utils`。
 *
 * 提供 DOMParser、调试日志、防抖、并发限流、URL 规范化、番号提取等基础能力，
 * 供 rating-cache / rating-net / rating-renderer / rating-display-plugin 复用。
 *
 * 原对象字面量 `Utils.xxx` 改为模块级独立导出函数；`this.normalizeCode` /
 * `this.getCode` 等内部 this 引用改为直接函数调用，控制流不变。
 */
import { RATING_CONFIG } from './rating-config';

/** 共享 DOMParser 实例（原 Utils.parser）。 */
const parser: DOMParser = new DOMParser();

/**
 * 调试日志（DEBUG_MODE 开启时输出带样式前缀的控制台日志）。对应原 L53-61。
 * @param action 日志标记（如 CACHE / FETCH_ERROR / INIT_SYNC）
 * @param args   附加日志参数
 */
function log(action: string, ...args: unknown[]): void {
    if (RATING_CONFIG.DEBUG_MODE) {
        console.log(
            `%c[JHS-Rating][${action}]`,
            'color:#fff;background:#ffc107;padding:2px 4px;border-radius:2px;',
            ...args
        );
    }
}

/** 防抖函数类型（保留原 this 上下文与参数透传）。 */
type DebouncedFn<A extends unknown[]> = (...args: A) => void;

/**
 * 防抖：延迟 wait ms 执行 fn，期间再次调用会重置计时器。对应原 L63-69。
 * @typeParam A 被防抖函数的参数元组
 * @param fn   目标函数
 * @param wait 延迟毫秒
 * @returns 防抖后的函数（保留 this 与参数）
 */
function debounce<A extends unknown[]>(fn: (...args: A) => void, wait: number): DebouncedFn<A> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    return function (this: unknown, ...args: A): void {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), wait);
    };
}

/** 并发限流器实例。 */
interface Limiter {
    /** 提交任务，返回其结果 Promise；超过并发上限时排队。 */
    run<T>(fn: () => Promise<T>): Promise<T>;
}

/**
 * 创建并发限流器（最大 max 并发，超出排队 FIFO）。对应原 L71-95。
 * @param max 最大并发数
 * @returns 限流器实例
 */
function createLimiter(max: number): Limiter {
    let active = 0;
    const queue: Array<{
        fn: () => Promise<unknown>;
        resolve: (value: unknown) => void;
        reject: (error: unknown) => void;
    }> = [];
    const runNext = (): void => {
        if (active >= max || queue.length === 0) return;
        active++;
        const job = queue.shift()!;
        Promise.resolve()
            .then(job.fn)
            .then(job.resolve)
            .catch(job.reject)
            .finally(() => {
                active--;
                runNext();
            });
    };
    return {
        run<T>(fn: () => Promise<T>): Promise<T> {
            return new Promise<T>((resolve, reject) => {
                queue.push({
                    fn: fn as () => Promise<unknown>,
                    resolve: resolve as (value: unknown) => void,
                    reject: reject as (error: unknown) => void
                });
                runNext();
            });
        }
    };
}

/**
 * 将可能为相对/协议相对的 URL 规范化为完整 https URL。对应原 L97-106。
 * 解析失败时原样返回（不抛出）。
 * @param url  原始 URL
 * @param base 基准 origin，默认当前页 origin
 * @returns 规范化后的 URL 字符串；空入参返回空串
 */
function getSafeUrl(url: string, base: string = window.location.origin): string {
    if (!url) return '';
    try {
        if (url.startsWith('http')) return url;
        if (url.startsWith('//')) return 'https:' + url;
        return new URL(url, base).href;
    } catch {
        return url;
    }
}

/**
 * 番号规范化：trim + 大写 + 空白转连字符。对应原 L108-111。
 * @param raw 原始番号文本
 * @returns 规范化番号；空入参返回空串
 */
function normalizeCode(raw: string | null | undefined): string {
    if (!raw) return '';
    return raw.trim().toUpperCase().replace(/\s+/g, '-');
}

/**
 * 从卡片提取番号（优先 .video-title strong，回退 meta 文本）。
 * 提取结果缓存到 item.dataset.code 避免重复 DOM 查询。对应原 L116-123。
 * @param item 列表页卡片元素
 * @returns 规范化番号；提取失败返回空串
 */
function getCode(item: HTMLElement): string {
    if (item.dataset.code) return item.dataset.code;
    const raw = item.querySelector('.video-title strong')?.textContent || '';
    const code = normalizeCode(raw);
    if (code) item.dataset.code = code;
    return code;
}

/**
 * 从卡片提取详情页锚点（a.box 或 .box a）。对应原 L128-130。
 * @param item 列表页卡片元素；可为 null
 * @returns 锚点元素或 null
 */
function getAnchor(item: HTMLElement | null): Element | null {
    return item?.querySelector('a.box, .box a') ?? null;
}

/** 评分显示工具集导出（保持原 Utils 命名空间风格的聚合导出）。 */
export const RatingUtils = {
    parser,
    log,
    debounce,
    createLimiter,
    getSafeUrl,
    normalizeCode,
    getCode,
    getAnchor
};
