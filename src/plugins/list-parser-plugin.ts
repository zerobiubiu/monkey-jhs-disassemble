/**
 * 清单解析器插件 ListParserPlugin —— 集成自
 * archetype/listParser.user.js
 * （原脚本整体 L1-75，独立油猴脚本 `清单解析器` v1.0）。
 *
 * 功能：在清单详情页（/lists/*）的演员名称 span 后插入"唤醒解析器"按钮，
 * 点击通过 `lists://?url=<URL>` 自定义协议唤醒外部解析器应用。
 *
 * 集成方式：作为 BasePlugin 子类注册到 PluginManager，仅在 javdb 站点注册
 * （main.tsx 的 `if (isJavdbSite)` 块）。原脚本无 GM_* API、无 CSS（内联
 * style）、无数据源、无网络请求，纯 DOM 操作 + setInterval 轮询，直接迁移。
 *
 * === 与主项目的兼容性（无冲突，独立运行） ===
 * `.actor-section-name` 在 jhs 主项目中被多插件读取（ActressInfoPlugin/
 * FavoriteActressesPlugin/ListPageButtonPlugin/ListPagePlugin/BasePlugin），
 * 但都是读取 `.text()` 提取演员名，不修改 DOM 结构。本插件只在 span 后
 * `insertAdjacentElement('afterend', btn)` 追加兄弟节点，不修改 span 本身，
 * 不影响 jhs 的读取。
 *
 * 与 `ListReadingStatusPlugin`（doc/40）的协同：两者都在清单详情页 h2 标题区
 * 操作，但本插件插入到 `span.actor-section-name` 的 afterend，ListReadingStatus
 * 插入到 `h2` 的 prepend——不同插入点，不互相覆盖。
 *
 * 原脚本 `@include javdb*.com/lists/*`（清单详情页），本项目在 handle() 内
 * 加路径守卫 `/lists/` 等价实现。原脚本用 setInterval 轮询等待 span 出现
 * （50 次 × 200ms = 10s），保留此逻辑（清单详情页可能异步渲染）。
 *
 * 控制流保留要点：
 * 1. SPAN_SELECTOR 精确选择清单详情页的演员名称 span
 * 2. 防重复插入（getElementById 检查）
 * 3. 内联 Bootstrap btn-primary 风格（页面无 Bootstrap CSS）
 * 4. click 通过 location.href 跳转 lists:// 自定义协议
 * 5. setInterval 轮询等待 span 出现（50 次 × 200ms）
 */
import { BasePlugin } from './base-plugin';

/** 演员名称 span 选择器（清单详情页标题区）。 */
const SPAN_SELECTOR =
    'div.columns.is-mobile.section-columns span.actor-section-name';

/** 轮询等待 span 出现的最大重试次数。 */
const MAX_RETRIES = 50;

/** 轮询间隔（ms）。 */
const RETRY_INTERVAL = 200;

/**
 * 清单解析器插件主类。
 *
 * 原脚本对应行号：L1-75（整体）。原脚本用 IIFE + setInterval 轮询，
 * 此处转为 handle() 内调用 waitForAndInsert()。
 */
export class ListParserPlugin extends BasePlugin {
    /**
     * 返回插件名，供 PluginManager 注册去重。
     *
     * @returns "ListParserPlugin"
     */
    getName(): string {
        return 'ListParserPlugin';
    }

    /**
     * 注入插件 CSS。原脚本无 CSS（内联 style），返回空串。
     *
     * @returns 空字符串（无样式）
     */
    async initCss(): Promise<string> {
        return '';
    }

    /**
     * 主处理：清单详情页时轮询插入唤醒按钮。对应原 L70-75。
     *
     * 原脚本 `@include javdb*.com/lists/*`（清单详情页），本项目在 handle()
     * 内加 `if (!location.pathname.startsWith('/lists/')) return` 守卫。
     * 排除 `/users/lists`（清单列表页，listReadingStatus 处理），仅清单详情页。
     *
     * @returns Promise<void>；无显式抛出
     */
    async handle(): Promise<void> {
        // 仅清单详情页（/lists/{id}），排除清单列表页（/users/lists）
        if (!location.pathname.startsWith('/lists/')) return;
        if (location.pathname.startsWith('/users/')) return;
        this.waitForAndInsert();
    }

    /**
     * 轮询等待 span 出现并插入按钮。对应原 L64-68。
     * setInterval 轮询（50 次 × 200ms = 10s），成功或超时后清除。
     *
     * @param retries 最大重试次数，默认 50
     * @param interval 轮询间隔 ms，默认 200
     */
    private waitForAndInsert(retries: number = MAX_RETRIES, interval: number = RETRY_INTERVAL): void {
        let attempts = 0;
        const id = setInterval(() => {
            if (this.insertWakeButton() || ++attempts >= retries) {
                clearInterval(id);
            }
        }, interval);
    }

    /**
     * 插入唤醒解析器按钮。对应原 L19-68。
     * 在 `span.actor-section-name` 后插入 Bootstrap 风格按钮，点击通过
     * `lists://?url=<URL>` 自定义协议唤醒外部解析器。
     *
     * @returns 是否成功插入（span 存在且未重复插入）
     */
    private insertWakeButton(): boolean {
        const span = document.querySelector(SPAN_SELECTOR);
        if (!span) return false;

        // 防止重复插入
        if (document.getElementById('lists-protocol-wake-btn')) return true;

        const btn = document.createElement('button');
        btn.id = 'lists-protocol-wake-btn';
        btn.type = 'button';
        btn.textContent = '唤醒解析器';
        // 内联还原 Bootstrap btn btn-sm btn-primary 风格（页面无 Bootstrap CSS）
        btn.style.marginLeft = '8px';
        btn.style.verticalAlign = 'middle';
        btn.style.display = 'inline-block';
        btn.style.fontWeight = '400';
        btn.style.lineHeight = '1.5';
        btn.style.textAlign = 'center';
        btn.style.whiteSpace = 'nowrap';
        btn.style.userSelect = 'none';
        btn.style.border = '1px solid #0d6efd';
        btn.style.padding = '0.25rem 0.5rem';
        btn.style.fontSize = '0.875rem';
        btn.style.borderRadius = '0.25rem';
        btn.style.backgroundColor = '#0d6efd';
        btn.style.color = '#fff';
        btn.style.cursor = 'pointer';
        btn.style.transition =
            'color .15s ease-in-out, background-color .15s ease-in-out, border-color .15s ease-in-out, box-shadow .15s ease-in-out';
        btn.addEventListener('mouseenter', () => {
            btn.style.backgroundColor = '#0b5ed7';
            btn.style.borderColor = '#0a58ca';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.backgroundColor = '#0d6efd';
            btn.style.borderColor = '#0d6efd';
        });

        btn.addEventListener('click', (e: Event) => {
            e.preventDefault();
            // 完整 URL（origin + pathname），去除查询参数和 hash
            const fullUrl = location.origin + location.pathname;
            const protocolUrl = 'lists://?url=' + encodeURIComponent(fullUrl);
            // 通过 location 跳转唤醒自定义协议
            location.href = protocolUrl;
        });

        // 插入到 actor-section-name 后，这通常在 <h2> 的第一行，保持内联显示
        span.insertAdjacentElement('afterend', btn);
        return true;
    }
}
