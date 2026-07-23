/**
 * 导航栏插件 NavBarPlugin —— 对应原脚本 archetype/jhs.user.js L4726-4830。
 *
 * 重构站点导航栏：合并"反饍/ThePornDude"入口到"其它"下拉（mergeNav），注入
 * 自定义检索框（hookSearch，含粘贴/回车自动提交、跳转或新开检索页），克隆
 * 旧版以图识图按钮并改 tooltip（hookOldSearch），并按窗口宽度在自定义检索框
 * 与原检索栏容器间切换显隐（toggleOtherNavItem）；在 /search 页回填关键词与
 * 类型并对标题/演员名中的关键词加高亮红（highlightKeyword）。
 *
 * 单字母局部变量（原 e/t/n）已语义化：
 *   handle:             params / keyword / searchType
 *   highlightKeyword:   trimmed / lower / el
 *   hookSearch:         event / items / index / keyword / searchType
 *   hookOldSearch:      searchImageEl / clonedEl
 *   toggleOtherNavItem: searchBox / searchBarContainer
 * 原方法名 margeNav（"marge"为"merge"笔误）语义化为 mergeNav。
 * 该插件未引用顶层单字母常量（o/r/l/c/T/I/B/P/D/A），故无 ../constants 引入；
 * $ 已由 ../types/globals.d.ts 声明为 any；jQuery .each 回调依赖 this 指向触发
 * 元素，以 (this: HTMLElement) 显式标注，规避 noImplicitThis。
 * handle 原为同步，此处声明 async 以匹配 BasePlugin.handle(): Promise<void>
 * 签名（行为等价，子任务均为同步调用）；内联 HTML 已提取为组件
 * （NavSearchBox / NavOtherDropdown）。
 */
import { featureFlags } from '../core/feature-flags';
import { jsxToString } from '../core/jsx-to-string';

import { BasePlugin } from './base-plugin';

import { NavOtherDropdown } from '../components/nav/nav-other-dropdown';
import { NavSearchBox } from '../components/nav/nav-search-box';

import navBarCssRaw from '../styles/nav-bar-plugin.css?raw';

export class NavBarPlugin extends BasePlugin {
    /** 返回插件名，供 PluginManager 注册去重。对应原 L4727-4729。 */
    getName(): string {
        return 'NavBarPlugin';
    }

    /**
     * 注入高亮关键词的 CSS（.highlight-red：红色加粗）。
     * 对应原 L4730-4732。
     * 无参数；返回含规则的 CSS 字符串（Promise<string>）。
     */
    async initCss(): Promise<string> {
        return navBarCssRaw;
    }

    /**
     * 插件主入口：合并导航、注入检索框、克隆以图识图按钮、按宽度切换检索框显隐，
     * 并在 /search 页回填关键词/类型与高亮。对应原 L4733-4751。
     * 无参数，返回 Promise<void>，不抛出异常。
     */
    async handle(): Promise<void> {
        this.mergeNav();
        this.hookSearch();
        this.hookOldSearch();
        this.toggleOtherNavItem();
        $(window).resize(this.toggleOtherNavItem);
        if (window.location.href.includes('/search')) {
            const params = new URLSearchParams(window.location.search);
            const keyword: string | null = params.get('q');
            const searchType: string | null = params.get('f');
            $('#search-keyword').val(keyword ?? '');
            if (searchType) {
                $('#search-type').val(searchType);
            }
            if (keyword) {
                this.highlightKeyword(keyword);
            }
        }
    }

    /**
     * 对影片标题/演员名中的关键词加 highlight-red 类。
     * 对应原 L4752-4764。
     * @param keyword 检索关键词（原 e）
     */
    highlightKeyword(keyword: string): void {
        const trimmed: string = keyword.trim();
        if (!trimmed) {
            return;
        }
        const lower: string = trimmed.toLowerCase();
        $('.video-title strong, .actor-box strong').each(function (this: HTMLElement) {
            const el = $(this);
            if (el.text().toLowerCase().includes(lower)) {
                el.addClass('highlight-red');
            }
        });
    }

    /**
     * 在导航栏注入自定义检索框（类型下拉 + 关键词输入 + 进阶检索 + 检索按钮），
     * 绑定粘贴/回车自动提交与点击跳转逻辑。对应原 L4765-4799。
     * 无参数，无返回值，不抛出异常。
     */
    hookSearch(): void {
        $('#navbar-menu-hero').after(jsxToString(<NavSearchBox />));
        const $keyword = $('#search-keyword');
        if (!featureFlags.navBarNoPaste) {
            $keyword.on('paste', (event: Event) => {
                // jQuery wraps the native event; originalEvent is the underlying ClipboardEvent
                const clipEvent = event as unknown as { originalEvent: ClipboardEvent };
                const items = clipEvent.originalEvent.clipboardData!.items;
                for (let index = 0; index < items.length; index++) {
                    if (items[index].type.indexOf('image') !== -1) {
                        return;
                    }
                }
                setTimeout(() => {
                    $('#search-btn').click();
                }, 0);
            });
        }
        $keyword.on('keypress', (event: KeyboardEvent) => {
            if (event.key === 'Enter') {
                setTimeout(() => {
                    $('#search-btn').click();
                }, 0);
            }
        });
        $('#search-btn').on('click', (_event: Event) => {
            const keyword = String($('#search-keyword').val() ?? '');
            const searchType = String($('#search-type option:selected').val() ?? '');
            if (keyword !== '') {
                if (window.location.href.includes('/search')) {
                    window.location.href = '/search?q=' + keyword + '&f=' + searchType;
                } else {
                    window.open('/search?q=' + keyword + '&f=' + searchType);
                }
            }
        });
        // 自定义检索框内的「识图」按钮（NavSearchBox 内 #search-img-btn）
        if (featureFlags.imageRecognitionPlugin) {
            $('#search-img-btn').on('click', (e: Event) => {
                e.preventDefault();
                this.getBean('ImageRecognitionPlugin')?.open?.();
            });
        } else {
            $('#search-img-btn').hide();
        }
    }

    /**
     * 克隆旧版以图识图按钮以解绑其原有事件，并改 tooltip 为"以图识图"；
     * flag 开时点击走 ImageRecognitionPlugin。
     * 对应原 L4800-4808 / 新版 rebind .search-image。
     * 无参数，无返回值；无 .search-image 元素时短路返回。
     */
    hookOldSearch(): void {
        const searchImageEl: Element | null = document.querySelector('.search-image');
        if (!searchImageEl) {
            return;
        }
        const clonedEl: Node = searchImageEl.cloneNode(true);
        searchImageEl.parentNode!.replaceChild(clonedEl, searchImageEl);
        $('#button-search-image').attr('data-tooltip', '以图识图');
        if (featureFlags.imageRecognitionPlugin) {
            $('.search-image').on('click', (event: Event) => {
                event.preventDefault();
                event.stopPropagation();
                this.getBean('ImageRecognitionPlugin')?.open?.();
            });
        }
    }

    /**
     * 合并导航：移除散落的"反饍/ThePornDude"链接，在"片商"后注入"其它"下拉
     * 容纳二者。对应原 L4809-4817（原方法名 margeNav）。
     * 无参数，无返回值，不抛出异常。
     */
    mergeNav(): void {
        $('a[href*="/feedbacks/new"]').remove();
        $('a[href*="theporndude.com"]').remove();
        $('a.navbar-link[href="/makers"]')
            .parent()
            .after(jsxToString(<NavOtherDropdown />));
    }

    /**
     * 桌面宽度（>1023）统一显示已绑定处理的自定义检索框 #search-box 并隐藏插件未绑定
     * 的站点检索栏 #search-bar-container；≤1023 交给 Bulma 折叠导航，本方法不干预。
     * 对应原 L4818-4829 的按宽度切换已废弃，因站点原检索栏在当前 javdb 已无可用绑定。
     * 无参数，无返回值；作为 resize 回调被调用时不依赖 this。
     */
    toggleOtherNavItem(): void {
        const searchBox = $('#search-box');
        const searchBarContainer = $('#search-bar-container');
        // 自定义检索框 #search-box 是唯一绑定了 #search-btn 点击/粘贴/回车处理的
        // 搜索 UI；站点原检索栏 #search-bar-container 插件从未绑定任何处理。原按宽度
        // 在二者间切换显隐，会在 1024-1599px 显示未绑定的站点检索栏，用户看到的「检索」
        // 按钮因此无响应。桌面宽度（>1023）统一显示已绑定的自定义检索框。
        if (($(window).width() ?? 0) > 1023) {
            searchBox.show();
            searchBarContainer.hide();
        }
    }
}
