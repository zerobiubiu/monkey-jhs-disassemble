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

import {
    _handleGlobalEscKey as escHandleGlobalEscKey,
    _handleGlobalEscKeyUp as escHandleGlobalEscKeyUp,
    getTopLayerEl as escGetTopLayerEl,
    setupEscClose as escSetupEscClose,
    syncLayerIndexStack as escSyncLayerIndexStack
} from './util/esc-layer';

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
        return escGetTopLayerEl();
    }

    /**
     * 同步 layerIndexStack 与 DOM（剔除已销毁索引）。
     */
    syncLayerIndexStack(): void {
        this.layerIndexStack = escSyncLayerIndexStack(this.layerIndexStack);
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
        escHandleGlobalEscKey(event);
    }

    /** ESC 抬起：解锁门闩，允许下一次物理按键再关一层 */
    _handleGlobalEscKeyUp(event: KeyboardEvent): void {
        escHandleGlobalEscKeyUp(event);
    }

    /**
     * 为指定 layer 索引注册 ESC 关闭监听（原 setupEscClose）。
     * 仅绑定一次 document 捕获阶段 keydown/keyup；iframe 同源 document 同步绑定。
     * @param layerIdx layer.open 返回的索引
     */
    setupEscClose(layerIdx: number): void {
        escSetupEscClose(this, layerIdx);
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
