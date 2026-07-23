/**
 * DOM 操作工具（提取自 CommonUtil）。
 * 依赖全局 $（jQuery）、clog、styleBlockHtml。
 */
import { styleBlockHtml } from '../../components/misc/style-block';

/**
 * 注入 <style> 到 head（原 insertStyle）。
 * @param css CSS 文本，不含 <style> 标签时自动包裹
 */
export function insertStyle(css: string): void {
    if (css) {
        if (css.indexOf('<style>') === -1) {
            css = styleBlockHtml(css);
        }
        $('head').append(css);
    }
}

/**
 * 动态注入 CSS/JS 资源到 documentElement（原 importResource）。
 * @param url 资源地址；含 "css" 走 link[rel=stylesheet]，否则走 script
 */
export function importResource(url: string): void {
    let el: HTMLElement;
    if (url.indexOf('css') >= 0) {
        const link = document.createElement('link');
        link.setAttribute('rel', 'stylesheet');
        link.href = url;
        el = link;
    } else {
        const script = document.createElement('script');
        script.setAttribute('type', 'text/javascript');
        script.src = url;
        el = script;
    }
    document.documentElement.appendChild(el);
}

/**
 * 平滑滚动到顶部（原 smoothScrollToTop）。
 * @param duration 动画时长，默认 500ms
 * @returns 滚动完成的 Promise
 */
export function smoothScrollToTop(duration: number = 500): Promise<void> {
    return new Promise<void>((resolve) => {
        const startTime = performance.now();
        const startY = window.pageYOffset;
        window.requestAnimationFrame(function step(now: number) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased =
                progress < 0.5
                    ? progress * 4 * progress * progress
                    : 1 - Math.pow(progress * -2 + 2, 3) / 2;
            window.scrollTo(0, startY * (1 - eased));
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                resolve();
            }
        });
    });
}

/**
 * 轮询探测器：每隔 intervalMs 检查 checkFn，命中或超时后回调（原 loopDetector）。
 * @param container       定时器句柄表（实例状态，由调用方传入）
 * @param checkFn         命中条件，返回 true 即完成
 * @param onSuccess       完成回调
 * @param intervalMs      轮询间隔，默认 20ms
 * @param timeoutMs       超时阈值，默认 10000ms
 * @param callOnTimeout   超时是否触发 onSuccess，默认 true
 */
export function loopDetector(
    container: Record<string, ReturnType<typeof setInterval>>,
    checkFn: () => boolean,
    onSuccess: () => void,
    intervalMs: number = 20,
    timeoutMs: number = 10000,
    callOnTimeout: boolean = true
): void {
    const token = String(Math.random());
    const startTime = new Date().getTime();
    const finish = (triggered: boolean) => {
        clearInterval(container[token]);
        if (triggered && onSuccess) {
            onSuccess();
        }
        delete container[token];
    };
    container[token] = setInterval(() => {
        const elapsed = new Date().getTime() - startTime;
        if (checkFn()) {
            finish(true);
        } else if (elapsed >= timeoutMs) {
            finish(callOnTimeout);
        }
    }, intervalMs);
}

/**
 * 委托式右键菜单：在 container 上监听 contextmenu，命中 targetSelector 才回调（原 rightClick）。
 * @param container      容器选择器或 HTMLElement，无效时回退 document.body
 * @param targetSelector 命中目标选择器（必填）
 * @param handler        命中回调 (event, target)
 */
export function rightClick(
    container: string | HTMLElement,
    targetSelector: string,
    handler: (event: MouseEvent, target: any) => void
): void {
    let el: any;
    if (typeof container === 'string') {
        el = document.querySelector(container);
    } else if (container instanceof HTMLElement) {
        el = container;
    }
    if (!el) {
        clog.warn('rightClick(), 容器无效或未提供，将使用 document.body 进行全局委托。');
        el = document.body;
    }
    if (typeof targetSelector === 'string' && targetSelector.trim() !== '') {
        el.addEventListener('contextmenu', (event: MouseEvent) => {
            const target = (event.target as HTMLElement).closest(targetSelector);
            if (target) {
                handler(event, target);
            }
        });
    } else {
        clog.error('rightClick(), 必须提供有效的 targetSelector。');
    }
}

/**
 * 将 HTML 字符串解析为 jQuery 包装的文档（原 htmlTo$dom）。
 * @param html HTML 字符串
 * @returns $(DOMParser 解析的 Document)，类型 any
 */
export function htmlTo$dom(html: string): any {
    const parser = new DOMParser();
    return $(parser.parseFromString(html, 'text/html'));
}

/**
 * 判断元素是否隐藏（原 isHidden）：jQuery 或 DOM 元素，零尺寸或 display:none 视为隐藏。
 * @param el jQuery 对象或 HTMLElement
 * @returns 隐藏则 true
 */
export function isHidden(el: any): boolean {
    const node = el.jquery ? el[0] : el;
    return (
        !node ||
        (node.offsetWidth <= 0 && node.offsetHeight <= 0) ||
        window.getComputedStyle(node).display === 'none'
    );
}
