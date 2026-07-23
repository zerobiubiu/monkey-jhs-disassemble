/**
 * 通用工具类 CommonUtil（提取自 archetype/jhs.user.js L1181-1773 的 class J）
 *
 * 单例工具集合，承载 DOM 操作 / 弹窗 / 日期格式化 / 文件下载 / 剪贴板 / Cookie /
 * 排序 / 重试等通用能力。原脚本通过 `J.instance ||= this` 实现单例，外部以
 * `utils.*` 形式调用其方法。
 *
 * 重构说明：各工具函数已按领域拆分至 src/core/util/ 子模块，本类作为薄 facade
 * 保持 `utils.*` 全局调用面不变。ESC 弹层关闭机制因深度依赖实例状态保留于此。
 */

import { MIME_TYPES, download } from './util/util-download';
import { htmlTo$dom, importResource, insertStyle, isHidden, loopDetector, rightClick, smoothScrollToTop } from './util/util-dom';
import { getNowStr, formatDate, getHourDifference, isUnnecessaryCheck } from './util/util-date';
import { closePage, getDefaultArea, getResponsiveArea, q } from './util/util-popup';
import { retry } from './util/util-retry';
import { copyToClipboard } from './util/util-clipboard';
import { addCookie } from './util/util-cookie';
import type { AddCookieOptions } from './util/util-cookie';
import { genericSort } from './util/util-sort';
import type { SortConfig } from './util/util-sort';
import { getUrlParam, isUrl, setHrefParam } from './util/util-url';
import { copyObj, deepFreeze, isMobile, reBuildSignature, simpleId, sleep, time } from './util/util-misc';
import type { TimerEntry } from './util/util-misc';

/**
 * ESC 关闭 layer 的全局硬门，跨所有同源 frame 共享同一把锁。
 *
 * doc/87 根因（最终修复）：
 * - doc/85/86 把 `escLayerGate` 定义为模块级 `const`，每个 frame 各执一份独立实例。
 * - doc/87 第一次修复尝试改挂 `unsafeWindow.__jhsEscGate`，但在 Tampermonkey 中
 *   每个 frame 的 `unsafeWindow` 指向**当前 frame 自己的 window**，并非跨 frame 共享
 *   的 top。实测 top 与同源 iframe 的 `__jhsEscGate` 仍是两个不同对象
 *   （`gateIsTopGate === false`）——锁仍按 frame 隔离，一次 ESC 在 iframe 内触发
 *   父子两个捕获 handler 各用各的锁，都 tryEnter 成功，各关一层。
 *
 * 最终修复：把 gate 挂到 `window.top.__jhsEscGate`。同源前提下，parent 与同源
 * iframe 均可访问同一 `window.top` 对象，gate 真正共享。
 * 跨域 iframe（如 supjav 等非 javdb iframe，本脚本不在其内运行，但保险起见）
 * 访问 `window.top` 抛 SecurityError，try/catch 兜底回退到当前 frame 的
 * `unsafeWindow/window`，那种情况下本就只有当前 frame 一份 handler，无需共享。
 *
 * 共享后：任一 handler `tryEnter` 成功即锁住，另一 handler 立即失败 return；
 * iframe 内若无自身弹层则 `release()`，父 handler 接力关父弹层。
 * 一次物理按键严格只关一层，逐级关闭成立。
 */
const escLayerGate: { locked: boolean; tryEnter(): boolean; release(): void } =
    (() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cross-frame window with custom __jhsEscGate property
        let w: any;
        try {
            // 同源跨 frame 共享：parent 与同源 iframe 都能访问 window.top 同一对象
            w = window.top;
            // 触发访问以验证同源可访问（window.top 存在但读属性可能跨域抛错）
            void (w && w.location);
        } catch {
            // 跨域 iframe：本脚本通常不在其内运行；回退到当前 frame
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- unsafeWindow is untyped global
            w = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window) as any;
        }
        if (!w.__jhsEscGate) {
            w.__jhsEscGate = {
                locked: false,
                tryEnter(): boolean {
                    if (this.locked) return false;
                    this.locked = true;
                    return true;
                },
                release(): void {
                    this.locked = false;
                }
            };
        }
        return w.__jhsEscGate as typeof escLayerGate;
    })();

export class CommonUtil {
    /** 原单例引用 */
    static instance: CommonUtil | undefined;

    /** 循环探测器句柄表（原 intervalContainer） */
    intervalContainer: Record<string, ReturnType<typeof setInterval>> = {};
    /** 文件扩展名 → MIME 映射（原 mimeTypes） */
    mimeTypes: Record<string, string> = MIME_TYPES;
    /** time 计时器表（原 timers） */
    timers: Map<string, TimerEntry> = new Map();
    /** 已打开 layer 的索引栈，用于 ESC 关闭（原 layerIndexStack） */
    layerIndexStack: number[] = [];
    /** 全局 ESC keydown 处理器绑定引用（原动态赋值 _boundHandler） */
    _boundHandler: ((event: KeyboardEvent) => void) | null = null;
    /** ESC keyup 解锁门闩 */
    _boundEscKeyupHandler: ((event: KeyboardEvent) => void) | null = null;

    /**
     * 单例构造：初始化字段并保证全局唯一实例。
     * @returns 当前唯一 CommonUtil 实例
     */
    constructor() {
        CommonUtil.instance ||= this;
        return CommonUtil.instance!;
    }

    // ===== DOM 工具（委托 util-dom） =====

    insertStyle = (css: string): void => insertStyle(css);

    importResource(url: string): void {
        importResource(url);
    }

    smoothScrollToTop(duration: number = 500): Promise<void> {
        return smoothScrollToTop(duration);
    }

    loopDetector(
        checkFn: () => boolean,
        onSuccess: () => void,
        intervalMs: number = 20,
        timeoutMs: number = 10000,
        callOnTimeout: boolean = true
    ): void {
        loopDetector(this.intervalContainer, checkFn, onSuccess, intervalMs, timeoutMs, callOnTimeout);
    }

    rightClick(
        container: string | HTMLElement,
        targetSelector: string,
        handler: (event: MouseEvent, target: Element) => void
    ): void {
        rightClick(container, targetSelector, handler);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jQuery object return from untyped $
    htmlTo$dom(html: string): any {
        return htmlTo$dom(html);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- polymorphic: jQuery object or HTMLElement
    isHidden(el: any): boolean {
        return isHidden(el);
    }

    // ===== 弹窗工具（委托 util-popup） =====

    q(
        event: MouseEvent | null,
        content: string,
        onConfirm?: () => void,
        onCancel?: () => void
    ): void {
        q(event, content, onConfirm, onCancel);
    }

    getDefaultArea(): [string, string] {
        return getDefaultArea();
    }

    getResponsiveArea(area?: [string, string]): [string, string] {
        return getResponsiveArea(area);
    }

    closePage(): void {
        closePage();
    }

    // ===== 弹窗 + ESC 关闭（openPage 依赖实例状态，保留于类上） =====

    /**
     * 打开页面：Ctrl/Cmd+点击在新标签打开，否则用 layer iframe 弹层打开（原 openPage）。
     * @param url        目标地址
     * @param title      弹层标题
     * @param shadeClose 是否点击遮罩关闭，默认 true
     * @param event      触发事件（含 ctrlKey/metaKey 判定新标签打开）
     */
    openPage(url: string, title: string, shadeClose?: boolean, event?: MouseEvent): void {
        shadeClose = shadeClose ?? true;
        if (event && (event.ctrlKey || event.metaKey)) {
            GM_openInTab(url.includes('http') ? url : window.location.origin + url, {
                insert: false
            });
            return;
        }
        let content = url;
        if (!url.includes('/actors/') && !url.includes('/star/')) {
            content = url.includes('?') ? `${url}&hideNav=1` : `${url}?hideNav=1`;
        }
        layer.open({
            type: 2,
            title,
            content,
            scrollbar: false,
            shadeClose,
            area: getResponsiveArea(['85%', '90%']),
            isOutAnim: false,
            anim: -1,
            success: (_layerEl: HTMLElement, layerIdx: number) => {
                this.setupEscClose(layerIdx);
            }
        });
    }

    /**
     * 从 DOM 解析当前最顶层可 ESC 关闭的 layer（按 z-index）。
     * 跳过 loading/tips、已标记关闭中、display:none 的节点。
     */
    getTopLayerEl(): HTMLElement | null {
        const nodes = document.querySelectorAll('.layui-layer[times]');
        let topEl: HTMLElement | null = null;
        let topZ = -Infinity;
        for (let i = 0; i < nodes.length; i++) {
            const el = nodes[i] as HTMLElement;
            const type = el.getAttribute('type') || '';
            if (type === 'loading' || type === 'tips') continue;
            if (el.getAttribute('data-jhs-esc-closing') === '1') continue;
            const cs = window.getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') continue;
            const z = parseInt(cs.zIndex, 10);
            const zVal = Number.isFinite(z) ? z : i;
            const times = Number(el.getAttribute('times'));
            if (!Number.isFinite(times)) continue;
            if (zVal >= topZ) {
                topZ = zVal;
                topEl = el;
            }
        }
        return topEl;
    }

    /**
     * 同步 layerIndexStack 与 DOM（剔除已销毁索引）。
     */
    syncLayerIndexStack(): void {
        this.layerIndexStack = this.layerIndexStack.filter(
            (idx) => document.getElementById(`layui-layer${idx}`) != null
        );
    }

    /**
     * 全局 ESC：只关闭当前最顶层 layer（逐级）。
     *
     * 关键点（doc/86）：
     * - 模块级时间门 `escLayerGate`：一次按键 / 500ms 内最多关一层（不依赖实例字段）
     * - 关闭前立即 display:none + data-jhs-esc-closing，避免 layer 关闭动画 200ms
     *   内 DOM 仍在导致第二次 getTop 仍命中同一层或连关下层
     * - 忽略 event.repeat
     */
    _handleGlobalEscKey(event: KeyboardEvent): void {
        if (event.key !== 'Escape' && event.keyCode !== 27) {
            return;
        }
        const maybeJqEvent = event as KeyboardEvent & { originalEvent?: KeyboardEvent };
        const native = maybeJqEvent.originalEvent ?? event;
        if (native.repeat) {
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }
        // 模块级硬门：防止同键连发 / 多 listener / keyup 过早解锁
        if (!escLayerGate.tryEnter()) {
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }

        const topEl = this.getTopLayerEl();
        if (!topEl) {
            escLayerGate.release();
            return;
        }
        const layerIdx = Number(topEl.getAttribute('times'));
        if (!Number.isFinite(layerIdx)) {
            escLayerGate.release();
            return;
        }

        // 预览器打开时交给 viewer
        const $layerEl = $(topEl);
        let hasViewer = $layerEl.find('.viewer-container').length > 0;
        // doc/87 真根因修复：顶层是 type=iframe 弹层时，检查 iframe 内是否有更内层的弹层
        // （如 iframe 详情弹层内又开了磁力搜索二级弹层）。
        // 若有，ESC 应优先关 iframe 内最内层弹层，不应直接关外层 iframe 弹层
        // （否则 iframe 销毁连带内层弹层全没了，体感"一次关全部"）。
        // 若 iframe 内也有弹层，释放 gate 让 iframe 内 handler 处理。
        let hasInnerLayer = false;
        if (!hasViewer) {
            const iframeEl = topEl.querySelector(
                `#layui-layer-iframe${layerIdx}`
            ) as HTMLIFrameElement | null;
            if (iframeEl?.contentDocument) {
                try {
                    if (
                        iframeEl.contentDocument.querySelector('.viewer-container')
                    ) {
                        hasViewer = true;
                    }
                    // 检查 iframe 内是否有可关闭的弹层（非 loading/tips、非关闭中、可见）
                    if (!hasViewer) {
                        const iframeLayers = iframeEl.contentDocument.querySelectorAll('.layui-layer[times]');
                        for (const il of Array.from(iframeLayers)) {
                            const ilType = il.getAttribute('type') || '';
                            if (ilType === 'loading' || ilType === 'tips') continue;
                            if (il.getAttribute('data-jhs-esc-closing') === '1') continue;
                            const ilCs = window.getComputedStyle(il);
                            if (ilCs.display === 'none' || ilCs.visibility === 'hidden') continue;
                            hasInnerLayer = true;
                            break;
                        }
                    }
                } catch {
                    clog.warn('无法检查跨域 iframe 内的 .viewer-container');
                }
            }
        }
        if (hasViewer) {
            escLayerGate.release();
            return;
        }
        // doc/87：iframe 内有弹层时，外层 handler 不应关外层 iframe 弹层（否则
        // iframe 销毁连带内层弹层全没了）。但 iframe document 不会自动收到父
        // document 的 keydown 事件，所以外层 handler 需要主动向 iframe document
        // dispatch 一个 ESC keydown，让 iframe 内的 handler 关闭内层弹层。
        if (hasInnerLayer) {
            const iframeEl = topEl.querySelector(
                `#layui-layer-iframe${layerIdx}`
            ) as HTMLIFrameElement | null;
            if (iframeEl?.contentDocument) {
                try {
                    // 不释放 gate：iframe 内 handler 共享同一把 gate（window.top），
                    // tryEnter 会成功（外层 handler 已 lock），但外层 handler 在
                    // dispatch 前释放 gate，让 iframe handler 拿到锁
                    escLayerGate.release();
                    const innerEvt = new KeyboardEvent('keydown', {
                        key: 'Escape',
                        keyCode: 27,
                        which: 27,
                        bubbles: true,
                        cancelable: true,
                        composed: true
                    });
                    iframeEl.contentDocument.dispatchEvent(innerEvt);
                    // iframe handler 若成功关闭内层弹层会自己 setTimeout 释放 gate
                    // 若 iframe handler 也没关到东西，800ms 后 gate 仍被锁 → 800ms 后
                    // 由 iframe handler 的 setTimeout 兑底释放
                    // 但如果 iframe handler 没被调用（跨域或未绑），释放 gate
                    window.setTimeout(() => escLayerGate.release(), 100);
                    return;
                } catch {
                    // 跨域 iframe 无法 dispatch，释放 gate
                    escLayerGate.release();
                    return;
                }
            }
            escLayerGate.release();
            return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();

        // 立即从"可选顶层"中摘掉（layer 关闭动画期间 DOM 仍在）
        topEl.setAttribute('data-jhs-esc-closing', '1');
        topEl.style.display = 'none';
        const shade = document.getElementById(`layui-layer-shade${layerIdx}`);
        if (shade) {
            shade.setAttribute('data-jhs-esc-closing', '1');
            shade.style.display = 'none';
        }

        // 只关这一层；包装会同步栈
        layer.close(layerIdx);
        // 兜底：若 keyup 丢失，800ms 后强制解锁
        window.setTimeout(() => escLayerGate.release(), 800);
    }

    /** ESC 抬起：解锁门闩，允许下一次物理按键再关一层 */
    _handleGlobalEscKeyUp(event: KeyboardEvent): void {
        if (event.key === 'Escape' || event.keyCode === 27) {
            escLayerGate.release();
        }
    }

    /**
     * 为指定 layer 索引注册 ESC 关闭监听（原 setupEscClose）。
     * 仅绑定一次 document 捕获阶段 keydown/keyup；iframe 同源 document 同步绑定。
     * @param layerIdx layer.open 返回的索引
     */
    setupEscClose(layerIdx: number): void {
        if (!this._boundHandler) {
            this._boundHandler = this._handleGlobalEscKey.bind(this);
            this._boundEscKeyupHandler = this._handleGlobalEscKeyUp.bind(this);
            $(document).off('keydown.globalLayerEsc keyup.globalLayerEsc');
            document.removeEventListener('keydown', this._boundHandler, true);
            document.removeEventListener('keyup', this._boundEscKeyupHandler, true);
            document.addEventListener('keydown', this._boundHandler, true);
            document.addEventListener('keyup', this._boundEscKeyupHandler, true);
        }
        const numIdx = Number(layerIdx);
        if (Number.isFinite(numIdx) && this.layerIndexStack.indexOf(numIdx) === -1) {
            this.layerIndexStack.push(numIdx);
        }
        // 延迟绑定 iframe（type=2 的 success 在 load 后才调，此时 contentDocument 可用）
        const iframeEl = document.getElementById(
            `layui-layer-iframe${layerIdx}`
        ) as HTMLIFrameElement | null;
        if (iframeEl && iframeEl.getAttribute('data-esc-bound') !== 'yes') {
            const bindIframe = () => {
                try {
                    const doc = iframeEl.contentDocument;
                    if (!doc || !this._boundHandler || !this._boundEscKeyupHandler) return;
                    doc.removeEventListener('keydown', this._boundHandler, true);
                    doc.removeEventListener('keyup', this._boundEscKeyupHandler, true);
                    doc.addEventListener('keydown', this._boundHandler, true);
                    doc.addEventListener('keyup', this._boundEscKeyupHandler, true);
                    iframeEl.setAttribute('data-esc-bound', 'yes');
                } catch (err) {
                    clog.error('iframe监听失败 (跨域或未加载完毕):', err);
                }
            };
            if (iframeEl.contentDocument?.readyState === 'complete') {
                bindIframe();
            } else {
                iframeEl.addEventListener('load', bindIframe, { once: true });
            }
        }
    }

    // ===== 日期工具（委托 util-date） =====

    getNowStr(
        dateSep: string = '-',
        timeSep: string = ':',
        timestamp: number | null = null
    ): string {
        return getNowStr(dateSep, timeSep, timestamp);
    }

    formatDate(input: Date | string, dateSep: string = '-', timeSep: string = ':'): string {
        return formatDate(input, dateSep, timeSep);
    }

    getHourDifference(start: Date, end: Date): number {
        return getHourDifference(start, end);
    }

    isUnnecessaryCheck(timeStr: string, checkIntervalTime: string | number): boolean {
        return isUnnecessaryCheck(timeStr, checkIntervalTime);
    }

    // ===== 下载工具（委托 util-download） =====

    download(data: BlobPart, filename: string): void {
        download(data, filename);
    }

    // ===== 重试工具（委托 util-retry） =====

    async retry<T>(fn: () => T | Promise<T>, maxRetries: number = 3): Promise<T | undefined> {
        return retry(fn, maxRetries);
    }

    // ===== 剪贴板工具（委托 util-clipboard） =====

    copyToClipboard(label: string, text: string): void {
        copyToClipboard(label, text);
    }

    // ===== Cookie 工具（委托 util-cookie） =====

    addCookie(cookieStr: string, options: AddCookieOptions = {}): void {
        addCookie(cookieStr, options);
    }

    // ===== 排序工具（委托 util-sort） =====

    genericSort<T>(data: T[], sortConfigs: SortConfig<T>[], nullsFirst: boolean = true): T[] {
        return genericSort(data, sortConfigs, nullsFirst);
    }

    // ===== URL 工具（委托 util-url） =====

    isUrl(str: string): boolean {
        return isUrl(str);
    }

    setHrefParam(key: string, value: string): void {
        setHrefParam(key, value);
    }

    getUrlParam(url: string, param: string): string | number | boolean | null {
        return getUrlParam(url, param);
    }

    // ===== 杂项工具（委托 util-misc） =====

    isMobile(): boolean {
        return isMobile();
    }

    simpleId(): string {
        return simpleId();
    }

    sleep(ms: number = 1000): Promise<void> {
        return sleep(ms);
    }

    copyObj<T>(data: T): T {
        return copyObj(data);
    }

    deepFreeze<T extends object>(obj: T): T {
        return deepFreeze(obj);
    }

    reBuildSignature(): string | null {
        return reBuildSignature();
    }

    time(label: string = 'default', unit: string = 's', precision: number = 2): string | undefined {
        return time(this.timers, label, unit, precision);
    }
}
