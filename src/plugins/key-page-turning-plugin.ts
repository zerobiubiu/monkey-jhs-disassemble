/**
 * 键盘翻页插件 KeyPageTurningPlugin —— 集成自 archetype/keyPageTurning.user.js
 * （原脚本整体 L1-60，独立油猴脚本 `Javdb 键盘翻页` v1.0）。
 *
 * 功能：对 Javdb 的内容使用左右方向键来翻页（点击分页栏的上一页/下一页链接）。
 *
 * 集成方式：作为 BasePlugin 子类注册到 PluginManager，仅在 javdb 站点注册
 * （main.tsx 的 `if (isJavdbSite)` 块）。原脚本无 GM_* API、无 CSS、无数据源、
 * 无网络请求，纯 DOM 事件监听，直接迁移。
 *
 * 原脚本 `@include https://javdb*.com/*`（所有 javdb 页面）、`@exclude /v/*`
 * （详情页）。本项目所有插件注册在 `if (isJavdbSite)` 块（不区分页面），故在
 * handle() 内加 `if (window.isDetailPage) return;` 守卫等价实现 @exclude。
 *
 * 控制流保留要点：
 * 1. isTyping() 防焦点在输入框/编辑器时拦截方向键
 * 2. safeClick() 优先原生 click()，兜底派发 MouseEvent（isTrusted 无法伪造）
 * 3. lockLeft/lockRight 防长按方向键连发（需 keyup 解锁才接受下一次）
 */
import { BasePlugin } from './base-plugin';

/** 上一页链接选择器（原脚本顶层 SELECTOR_LEFT）。 */
const SELECTOR_LEFT = 'body > section > div > nav > a.pagination-previous';
/** 下一页链接选择器（原脚本顶层 SELECTOR_RIGHT）。 */
const SELECTOR_RIGHT = 'body > section > div > nav > a.pagination-next';

/**
 * 键盘翻页插件主类。
 *
 * 原脚本对应行号：L1-60（整体）。
 */
export class KeyPageTurningPlugin extends BasePlugin {
    /** 左方向键连发锁（需 keyup 解锁才接受下一次）。原脚本 lockLeft。 */
    private lockLeft = false;
    /** 右方向键连发锁（需 keyup 解锁才接受下一次）。原脚本 lockRight。 */
    private lockRight = false;

    /**
     * 返回插件名，供 PluginManager 注册去重。
     *
     * @returns "KeyPageTurningPlugin"
     */
    getName(): string {
        return 'KeyPageTurningPlugin';
    }

    /**
     * 注入插件 CSS。原脚本无 CSS（无 GM_addStyle），返回空串。
     *
     * @returns 空字符串（无样式）
     */
    async initCss(): Promise<string> {
        return '';
    }

    /**
     * 主处理：注册键盘翻页监听。对应原脚本 IIFE L11-58。
     *
     * 原脚本 `@exclude https://javdb*.com/v/*` 排除详情页，本项目在 handle() 内
     * 以 `if (window.isDetailPage) return;` 等价实现。
     *
     * @returns Promise<void>；无显式抛出
     */
    async handle(): Promise<void> {
        if ((window as any).isDetailPage) return;
        window.addEventListener(
            'keydown',
            (e: KeyboardEvent) => {
                if (this.isTyping()) return;
                if (e.key === 'ArrowLeft' && !this.lockLeft) {
                    const a = document.querySelector<HTMLAnchorElement>(SELECTOR_LEFT) || null;
                    if (a) {
                        e.preventDefault();
                        this.safeClick(a);
                        this.lockLeft = true;
                    }
                } else if (e.key === 'ArrowRight' && !this.lockRight) {
                    const a = document.querySelector<HTMLAnchorElement>(SELECTOR_RIGHT) || null;
                    if (a) {
                        e.preventDefault();
                        this.safeClick(a);
                        this.lockRight = true;
                    }
                }
            },
            { passive: false }
        );
        window.addEventListener('keyup', (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') this.lockLeft = false;
            if (e.key === 'ArrowRight') this.lockRight = false;
        });
    }

    /**
     * 检测当前焦点是否在输入框/编辑器，是则不拦截方向键。对应原 L8-15。
     *
     * @returns true 表示焦点在可编辑元素，应跳过拦截
     */
    private isTyping(): boolean {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return false;
        const tag = el.tagName;
        const editable = el.isContentEditable;
        return editable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    }

    /**
     * 安全点击：优先原生 click()，兜底派发 MouseEvent。对应原 L17-25。
     * 注：isTrusted 无法伪造，兜底事件不被部分监听器视为可信交互。
     *
     * @param a 目标锚点元素
     * @returns true 表示已触发点击；false 表示入参为空
     */
    private safeClick(a: HTMLAnchorElement | null): boolean {
        if (!a) return false;
        if (typeof a.click === 'function') {
            a.click();
            return true;
        }
        const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
        return a.dispatchEvent(evt);
    }
}
