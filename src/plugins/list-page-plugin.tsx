/**
 * 列表页插件 ListPagePlugin —— 对应原脚本 archetype/jhs.user.js L8279-9069。
 *
 * 列表页（window.isListPage）主插件：监听跨标签页 BroadcastChannel 刷新/清缓存
 * 消息；替换高清封面图、挂载分页跳页控件；
 * 依 IndexedDB 的收藏/屏蔽/已观看/关键词/演员黑名单数据对 .item 卡片做显隐
 * 过滤并注入 status-tag；绑定卡片点击；记忆演员页标签展开态；
 * DOM 变更后自动重过滤；并对 JavDb 标题做 Google 翻译（带 localStorage 缓存）。
 *
 * 单字母局部变量（原 e/t/n/a/i/s/o 等）已语义化；顶层站点/状态常量
 * o/r/c/d/h/p/B/C/_ 改由 ../constants 引入（currentHref/isJavdbSite/
 * isSearchOrUserPage/FILTER_ACTION/FAVORITE_ACTION/
 * HAS_WATCH_ACTION/ACTOR/NO/YES）。原顶层 Te（状态标签配置）改写为模块级
 * STATUS_TAG_CONFIG；原 _e（Google 翻译）改写为模块级 translateText；

 *
 * 注意：原顶层常量 g（"hasDown"，「已下载」动作状态）已在 archetype/doc/
 * 09-remove-hasdown-constants.md 中作为「已删除」定稿移除。filterMovieList
 * 中原 {[g]: new Set()} 的键集合从未被读取（仅 filter/favorite/hasWatch
 * 被解构使用），属残留死代码；已同步原版删除该行，不再还原 HAS_DOWN_ACTION
 * 本地常量（避免运行时 ReferenceError 导致弹窗方式打开页面失效）。
 *
 * 构造函数中 i(this,"field",val)（Object.defineProperty，[[Define]] 语义）
 * 注入的字段改为 class 字段语法（useDefineForClassFields:true，语义一致）。
 * $ / utils / storageManager / show / clog / gmHttp 已由 ../types/globals.d.ts
 * 声明为 any；内联 CSS/HTML 模板字符串原样保留（仅替换 ${} 插值变量名）。
 */
import { currentHref, isJavdbSite, isSearchOrUserPage, ACTOR } from '../constants/site';
import {
    FILTER_ACTION,
    FAVORITE_ACTION,
    HAS_WATCH_ACTION,
    NO,
    YES
} from '../constants/status';
import { featureFlags } from '../core/feature-flags';
import { TaskSupervisor } from '../core/task-supervisor';
import type { PageType } from '../core/page-context';
import { jsxToString } from '../core/jsx-to-string';
import { translateText } from '../core/util/util-translate';
import { failWithToast } from '../core/toast';
import {
    STATUS_TAG_CONFIG,
    getStatusTagPositionStyle,
    buildStatusTagHtml,
    injectStatusTag
} from '../core/util/util-status-tag';
import type { StatusTagConfig } from '../core/util/util-status-tag';

import { BasePlugin } from './base-plugin';

import { JumpPageControl } from '../components/misc/jump-page-control';
import { PageCountTable } from '../components/misc/page-count-table';


export class ListPagePlugin extends BasePlugin {
    // —— 当前页各类计数（原 i(this,"currentPage*",n)） ——
    currentPageFilterCount = 0;
    currentPageFavoriteCount = 0;
    currentPageHasWatchCount = 0;
    currentPageKeywordFilterCount = 0;
    currentPageActorFilterCount = 0;
    currentPageWaitCheckCount = 0;
    currentPageTotalCount = 0;

    /** 统一生命周期管理：MutationObserver 等资源由此 supervisor 管控。 */
    private supervisor = new TaskSupervisor();

    /** 翻译缓存（localStorage["jhs_translate"]，番号→译文）。 */
    cache: Record<string, string> = (() => {
        try {
            const raw = localStorage.getItem('jhs_translate');
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    })();

    /** 翻译写入队列，串行化 localStorage 写入。 */
    writeQueue: Promise<void> = Promise.resolve();

    /** 返回插件名，供 PluginManager 注册去重。对应原 L8298-8300。 */
    getName(): string {
        return 'ListPagePlugin';
    }

    /** 销毁插件，清理 supervisor 管理的所有资源（MutationObserver 等）。 */
    destroy(): void {
        this.supervisor.abort();
    }

    /** 仅在列表页激活（doc/140）。 */
    get pageTypes(): PageType[] {
        return ['list'];
    }

    /** 列表页主处理。对应原 L8301-8339。 */
    async handle(): Promise<void> {
        new BroadcastChannel('channel-refresh').addEventListener(
            'message',
            async (event: MessageEvent) => {
                const msgType = event.data.type;
                if (msgType === 'refresh') {
                    storageManager.clearCarListCache();
                    await this.doFilter();
                    const historyPlugin = this.getBean('HistoryPlugin');
                    if (historyPlugin.tableObj) {
                        historyPlugin.tableObj.setData();
                    }
                    const newVideoPlugin = this.getBean('NewVideoPlugin');
                    if (newVideoPlugin) {
                        newVideoPlugin.showNewVideoCount().then();
                        newVideoPlugin.loadData();
                    }
                } else if (msgType === 'cleanCache_filter_actor_actress_car_list') {
                    storageManager.clearFilterActorActressCarListCache();
                } else if (msgType === 'clean_cacheSettingObj') {
                    storageManager.clearSettingCache();
                }
            }
        );
        this.replaceHdImg();
        this.addJumpPageControl();
        await this.doFilter();
        this.bindClick().then();
        this.rememberTagExpand();
        $(this.getSelector().itemSelector + ' a').attr('target', '_blank');
        this.checkDom();
        // 列表页挂载"想看/观看"同步监听器，刷新本页 .item 卡片 status-tag
        this.getBean('DetailPageButtonPlugin').setupWantWatchedSyncListener();
    }

    /** 记忆演员页标签展开态（localStorage["jhs_tag_expand"]）。对应原 L8340-8359。 */
    rememberTagExpand(): void {
        if (!window.location.href.includes('actors')) {
            return;
        }
        const expandBtn = $('.tag-expand');
        if (expandBtn.length === 0) {
            return;
        }
        const storageKey = 'jhs_tag_expand';
        const wasExpanded = localStorage.getItem(storageKey) === 'true';
        const contentEl = $('.actor-tags .content');
        if (wasExpanded && contentEl.hasClass('collapse')) {
            expandBtn[0].click();
        }
        expandBtn.on('click', function () {
            const isExpanded = !contentEl.hasClass('collapse');
            localStorage.setItem(storageKey, isExpanded.toString());
        });
    }

    /** 监听列表容器 DOM 变更并自动重过滤/重排序。对应原 L8360-8392。 */
    checkDom(): void {
        if (!window.isListPage) {
            return;
        }
        const selectorConfig = this.getSelector();
        const containerEl = document.querySelector(selectorConfig.boxSelector);
        if (!containerEl) {
            clog.error('没有找到容器节点!');
            return;
        }
        const observerOptions: MutationObserverInit = {
            childList: true,
            subtree: false
        };
        const observer = this.supervisor.observe(containerEl, async () => {
            observer.disconnect();
            try {
                this.replaceHdImg();
                this.addJumpPageControl();
                await this.doFilter();
                await this.getBean('ListPageButtonPlugin').sortItems();
                $(this.getSelector().itemSelector + ' a').attr('target', '_blank');
                this.getBean('AutoPagePlugin').checkLoad();
            } finally {
                observer.observe(containerEl, observerOptions);
            }
        }, observerOptions);
    }

    /** 触发列表过滤。对应原 L8432-8440。 */
    async doFilter(): Promise<void> {
        if (!window.isListPage) {
            return;
        }
        const itemEls = $(this.getSelector().itemSelector).toArray();
        if (itemEls.length) {
            await this.filterMovieList(itemEls);
        }
    }

    /**
     * 增量刷新某个视频卡片的 JHS status-tag。
     * 用于跨 iframe / 跨标签页"想看 / 观看"同步后立刻反映到 series 列表上。
     * 走与 filterMovieList 同源数据（IndexedDB），保证状态真实。
     * @param item jQuery 化的 .item 元素
     * @param carNum 番号
     */
    async renderItemStatusTag(item: HTMLElement, carNum: string): Promise<void> {
        try {
            const $item = $(item);
            const carInfo = await storageManager.getCar(carNum);
            const status = carInfo ? carInfo.status : '';
            // 移除旧 status-tag
            $item.find('.status-tag').remove();
            // 根据 JHS 状态决定新 tag
            let tagConfig: StatusTagConfig | null = null;
            if (status === FAVORITE_ACTION) {
                tagConfig = STATUS_TAG_CONFIG.IS_FAVORITE;
            } else if (status === HAS_WATCH_ACTION) {
                tagConfig = STATUS_TAG_CONFIG.IS_HAS_WATCH;
            } else if (status === FILTER_ACTION) {
                tagConfig = STATUS_TAG_CONFIG.IS_FILTERED;
            }
            if (!tagConfig || !tagConfig.text) {
                return;
            }
            // 与 filterMovieList 中保持一致的注入逻辑
            const tagPosition = (await storageManager.getSetting()).tagPosition || 'rightTop';
            const positionStyle = getStatusTagPositionStyle(tagPosition);
            const tagHtml = buildStatusTagHtml(
                'render',
                tagConfig.text,
                tagConfig.color,
                tagConfig.reasonType,
                positionStyle
            );
            injectStatusTag($item, tagHtml);
        } catch (err) {
            clog.error('[JHS-想看/观看] renderItemStatusTag 失败', err);
        }
    }

    /**
     * 读取数据并依收藏/屏蔽/已观看/关键词/演员黑名单过滤列表项并注入 status-tag。
     * 对应原 L8484-8633。
     * @param itemEls .item 元素数组（jQuery .toArray() 结果）
     */
    async filterMovieList(itemEls: HTMLElement[]): Promise<void> {
        utils.time('累计耗费时间');
        utils.time('读取数据耗时');
        const [carList, titleFilterKeywords, blacklist, blacklistCarList, setting] =
            await Promise.all([
                storageManager.getCarList(),
                storageManager.getTitleFilterKeyword(),
                storageManager.getBlacklist(),
                storageManager.getBlacklistCarList(),
                storageManager.getSetting()
            ]);
        const readDataTime = utils.time('读取数据耗时');
        const useLower = featureFlags.caseInsensitiveCarNum;
        const statusCarSets: Record<string, Set<string>> = carList.reduce(
            (acc: Record<string, Set<string>>, car) => {
                const status = car.status ?? '';
                if (acc.hasOwnProperty(status)) {
                    acc[status].add(useLower ? car.carNum.toLowerCase() : car.carNum);
                }
                return acc;
            },
            {
                [FILTER_ACTION]: new Set<string>(),
                [FAVORITE_ACTION]: new Set<string>(),
                [HAS_WATCH_ACTION]: new Set<string>()
            }
        );
        utils.time('组装数据耗时');
        const blacklistRoleMap = new Map(
            blacklist.map((item) => [item.starId, item.role])
        );
        const { actorCarNumToNameMap, actressCarNumToNameMap } = blacklistCarList.reduce(
            (
                acc: {
                    actorCarNumToNameMap: Map<string, string | undefined>;
                    actressCarNumToNameMap: Map<string, string | undefined>;
                },
                item
            ) => {
                const role = blacklistRoleMap.get(item.starId);
                if (!role) {
                    clog.error('黑名单数据源丢失演员信息', item);
                    return acc;
                }
                const targetMap =
                    role === ACTOR ? acc.actorCarNumToNameMap : acc.actressCarNumToNameMap;
                if (!targetMap.has(item.carNum)) {
                    targetMap.set(item.carNum, item.names);
                }
                return acc;
            },
            {
                actorCarNumToNameMap: new Map<string, string | undefined>(),
                actressCarNumToNameMap: new Map<string, string | undefined>()
            }
        );
        const assembleDataTime = utils.time('组装数据耗时');
        const showFilterItem = setting?.showFilterItem ?? NO;
        const showFilterActorItem = setting?.showFilterActorItem ?? NO;
        const showFilterKeywordItem = setting?.showFilterKeywordItem ?? NO;
        const showFavoriteItem = setting?.showFavoriteItem ?? YES;
        const showHasWatchItem = setting?.showHasWatchItem ?? YES;
        const showAllItem = setting?.showAllItem ?? NO;
        const tagPosition = setting?.tagPosition || 'rightTop';
        const movieShowType =
            featureFlags.movieShowTypeVisibility
                ? setting?.movieShowType || 'hide'
                : 'hide';
        this.currentPageFilterCount = 0;
        this.currentPageFavoriteCount = 0;
        this.currentPageHasWatchCount = 0;
        this.currentPageKeywordFilterCount = 0;
        this.currentPageActorFilterCount = 0;
        this.currentPageWaitCheckCount = 0;
        this.currentPageTotalCount = 0;
        utils.time('处理页面耗时');
        await Promise.all(
            itemEls.map(async (itemEl) => {
                const $item = $(itemEl);
                const { carNum, title } = this.findCarNumAndHref($item);
                const {
                    filter: filterSet,
                    favorite: favoriteSet,
                    hasWatch: hasWatchSet
                } = statusCarSets;
                const lookupCarNum = useLower ? carNum.toLowerCase() : carNum;
                const lowerTitle = useLower ? (title || '').toLowerCase() : title || '';
                const isFavorite = favoriteSet.has(lookupCarNum);
                const isHasWatch = hasWatchSet.has(lookupCarNum);
                const isFiltered = filterSet.has(lookupCarNum);
                const isActorBlacklist = actorCarNumToNameMap.has(carNum);
                const isActressBlacklist = actressCarNumToNameMap.has(carNum);
                const isBlacklistActor = isActorBlacklist || isActressBlacklist;
                const matchedKeyword = titleFilterKeywords.find((keyword: string) => {
                    if (useLower) {
                        return (
                            lowerTitle.includes(keyword.toLowerCase()) ||
                            lookupCarNum.startsWith(keyword.toLowerCase())
                        );
                    }
                    return title.includes(keyword) || carNum.startsWith(keyword);
                });
                const hasKeywordMatch = !!matchedKeyword;
                if (!isSearchOrUserPage) {
                    let shouldHide =
                        (showFavoriteItem === NO && isFavorite) ||
                        (showHasWatchItem === NO && isHasWatch) ||
                        (showFilterItem === NO && isFiltered && !isFavorite && !isHasWatch) ||
                        (showFilterActorItem === NO && isBlacklistActor) ||
                        (showFilterKeywordItem === NO && hasKeywordMatch);
                    if ($item.attr('data-movieShowType') !== movieShowType) {
                        $item.css('border', '');
                        $item.children().css('visibility', '');
                        $item.removeAttr('data-hide');
                        $item.show();
                    }
                    const isHidden = $item.attr('data-hide') === YES;
                    if (showAllItem === YES) {
                        shouldHide = false;
                    }
                    if (shouldHide !== isHidden) {
                        if (shouldHide) {
                            $item.attr('data-hide', YES);
                        } else {
                            $item.removeAttr('data-hide');
                        }
                        if (movieShowType === 'hide') {
                            if (shouldHide) {
                                $item.hide();
                            } else {
                                $item.show();
                            }
                        } else if (movieShowType === 'visibility') {
                            const borderStyle = shouldHide
                                ? '1px solid rgb(192 176 176)'
                                : 'none';
                            const visibilityValue = shouldHide ? 'hidden' : 'visible';
                            $item.css('border', borderStyle);
                            $item.children().css('visibility', visibilityValue);
                        } else {
                            throw new Error('movieShowType值有误:' + movieShowType);
                        }
                        if ($item.attr('data-movieShowType') !== movieShowType) {
                            $item.attr('data-movieShowType', movieShowType);
                        }
                    }
                }
                let tagConfig: StatusTagConfig = STATUS_TAG_CONFIG.IS_WAIT_CHECK;
                let reasonText: string | null = null;
                if (isFiltered) {
                    tagConfig = STATUS_TAG_CONFIG.IS_FILTERED;
                } else if (isFavorite) {
                    tagConfig = STATUS_TAG_CONFIG.IS_FAVORITE;
                } else if (isHasWatch) {
                    tagConfig = STATUS_TAG_CONFIG.IS_HAS_WATCH;
                } else if (hasKeywordMatch) {
                    tagConfig = STATUS_TAG_CONFIG.IS_KEYWORD_FILTER;
                    reasonText = matchedKeyword || '未知';
                } else if (isActorBlacklist) {
                    tagConfig = STATUS_TAG_CONFIG.IS_ACTOR_FILTER;
                    reasonText = actorCarNumToNameMap.get(carNum) || '';
                } else if (isActressBlacklist) {
                    tagConfig = STATUS_TAG_CONFIG.IS_ACTRESS_FILTER;
                    reasonText = actressCarNumToNameMap.get(carNum) || '';
                }
                reasonText ||= tagConfig.reasonType;
                if (tagConfig.isCounted) {
                    (this as unknown as Record<string, number>)[tagConfig.countKey]++;
                }
                this.currentPageTotalCount++;
                $item.find('.status-tag').remove();
                const positionStyle = getStatusTagPositionStyle(tagPosition);
                if (tagConfig.text) {
                    const tagHtml = buildStatusTagHtml(
                        'filter',
                        tagConfig.text,
                        tagConfig.color,
                        reasonText as string,
                        positionStyle
                    );
                    if (isJavdbSite) {
                        $item.find('.tags').append(tagHtml);
                    }
                }
                await this.translate($item);
            })
        );
        const processPageTime = utils.time('处理页面耗时');
        const totalTime = utils.time('累计耗费时间');
        $('#waitDownBtn span').text(`打开已收藏 (${statusCarSets.favorite.size})`);
        clog.log(
            jsxToString(
                <PageCountTable
                    readDataTime={readDataTime ?? ''}
                    assembleDataTime={assembleDataTime ?? ''}
                    processPageTime={processPageTime ?? ''}
                    totalTime={totalTime ?? ''}
                    filterCount={this.currentPageFilterCount}
                    favoriteCount={this.currentPageFavoriteCount}
                    actorFilterCount={this.currentPageActorFilterCount}
                    keywordFilterCount={this.currentPageKeywordFilterCount}
                    hasWatchCount={this.currentPageHasWatchCount}
                    waitCheckCount={this.currentPageWaitCheckCount}
                    totalCount={this.currentPageTotalCount}
                />
            )
        );
    }

    /**
     * 绑定列表项点击/视频播放/标题点击。对应原 L8634-8711。
     *
     * 点击委托选择器使用 `.item .cover` 而非原始脚本的 `.item img`：
     * JavDB 封面图使用 `loading="lazy"` 原生懒加载，图片未加载时
     * `<img>` 无尺寸（object-fit:cover 无效），用户实际点中 `.cover`
     * div 而非 `<img>`，导致 `.item img` 不匹配、走 JavDB 原生 `<a>`
     * 跳转。`.cover` 有 CSS min-height/padding-top 撑开面积，始终可点击；
     * 且 `<img>` 在 `.cover` 内，点击 `<img>` 时事件冒泡也能匹配
     * `.item .cover`。
     */
    async bindClick(): Promise<void> {
        const selectorConfig = this.getSelector();
        $(selectorConfig.boxSelector).on('click', '.item .cover', async (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
            if ($(event.target).closest('div.meta-buttons').length) {
                return;
            }
            const $item = $(event.target).closest('.item');
            const { carNum, aHref } = this.findCarNumAndHref($item);
            const dialogOpenDetail = await storageManager.getSetting('dialogOpenDetail', YES);
            if (carNum.includes('FC2-')) {
                const movieId = this.parseMovieId(aHref);
                this.getBean('Fc2Plugin')?.openFc2Dialog(movieId, carNum, aHref);
            } else if (dialogOpenDetail === YES) {
                utils.openPage(aHref, carNum, true, event);
            } else {
                window.open(aHref);
            }
        });
        $(selectorConfig.boxSelector).on('click', '.item video', async (event: Event) => {
            const videoEl = event.currentTarget as HTMLVideoElement;
            if (videoEl.paused) {
                videoEl.play().catch((err: unknown) => clog.error('播放失败:', err));
            } else {
                videoEl.pause();
            }
            event.preventDefault();
            event.stopPropagation();
        });
        $(selectorConfig.boxSelector).on('click', '.item .video-title', async (event: MouseEvent) => {
            if ($(event.target).closest('[class^="jhs-match-"]').length) {
                return;
            }
            const $item = $(event.currentTarget).closest('.item');
            const { carNum, aHref } = this.findCarNumAndHref($item);
            if (carNum.includes('FC2-')) {
                event.preventDefault();
                const movieId = this.parseMovieId(aHref);
                this.getBean('Fc2Plugin')?.openFc2Dialog(movieId, carNum, aHref);
            }
        });
    }

    /** 解析详情页女演员名称（若启用补录）。对应原 L8712-8739。 */
    async parseActressName(url: string): Promise<string | null> {
        let actressName: string | null = null;
        if ((await storageManager.getSetting('enableSaveActressCarInfo', NO)) === YES) {
            clog.debug('鉴定补录演员信息-已启用, 开始解析详情页');
            clog.debug('开始解析演员详情页', url);
            const html = await gmHttp.get(url);
            const $dom = utils.htmlTo$dom(String(html));
            if (isJavdbSite) {
                actressName = $dom
                    .find('.female')
                    .prev()
                    .map((_index: number, el: HTMLElement) => $(el).text())
                    .get()
                    .join(' ');
            }
            clog.debug('解析到名称:', actressName);
        }
        return actressName;
    }

    /**
     * 从 .item 卡片提取番号、链接、标题、发行时间。carNum 为空时抛错。
     * 对应原 L8821-8873。
     * @param $item jQuery 化的 .item 元素
     * @returns 番号信息（carNum/aHref/url/title/publishTime）
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jQuery object, $ is any-typed
    findCarNumAndHref($item: any): {
        carNum: string;
        aHref: string;
        url: string;
        title: string;
        publishTime: string;
    } {
        let carNum: string | undefined;
        let title: string | undefined;
        let publishTime: string | undefined;
        const linkEl = $item.find('a');
        const aHref = linkEl.attr('href');
        const videoTitleEl = $item.find('.video-title');
        if (videoTitleEl.length > 0) {
            const strongEl = videoTitleEl.find('strong');
            if (strongEl.length > 0) {
                carNum = strongEl.text().trim();
            }
            title = linkEl.attr('title')
                ? linkEl.attr('title').trim()
                : carNum
                  ? videoTitleEl.text().replace(carNum, '').trim()
                  : videoTitleEl.text().trim();
            publishTime = $item.find('.meta').text().trim();
        }
        if (!carNum) {
            const imgEl = $item.find('img');
            if (aHref && imgEl.length > 0) {
                title = imgEl.attr('title')?.trim() || imgEl.attr('data-title')?.trim();
            }
            const isDate = (val: string) => /^\d{4}-\d{1,2}-\d{1,2}$/.test(val);
            publishTime = $item
                .find('date')
                .map((_index: number, el: HTMLElement) => $(el).text().trim())
                .get()
                .find(isDate);
            carNum = $item
                .find('date')
                .map((_index: number, el: HTMLElement) => $(el).text().trim())
                .get()
                .find((val: string) => !isDate(val));
        }
        if (!carNum) {
            failWithToast('提取番号信息失败');
        }
        return {
            carNum,
            aHref: aHref || '',
            url: aHref || '',
            title: title || '',
            publishTime: publishTime || ''
        };
    }

    /** 显示被隐藏的指定番号卡片（取消 data-hide）。对应原 L8874-8885。 */
    showCarNumBox(carNum: string): void {
        const matchedEl = $('.movie-list .item')
            .toArray()
            .find((itemEl: HTMLElement) => $(itemEl).find('.video-title strong').text() === carNum);
        if (matchedEl) {
            const $matched = $(matchedEl);
            if ($matched.attr('data-hide') === `${carNum}-hide`) {
                $matched.show();
                $matched.removeAttr('data-hide');
            }
        }
    }

    /**
     * 替换列表封面缩略图为高清图。对应原 L8886-8933。
     * @param imgEls 可选的图片元素集合（jQuery 或 NodeList），缺省取封面选择器
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accepts jQuery | NodeList | array
    replaceHdImg(imgEls?: any): void {
        if (imgEls && typeof imgEls.jquery == 'string') {
            imgEls = imgEls.toArray();
        }
        imgEls ||= document.querySelectorAll(this.getSelector().coverImgSelector);
        if (isJavdbSite) {
            imgEls.forEach((img: HTMLImageElement) => {
                img.src = img.src.replace('thumbs', 'covers');
                img.title = '';
            });
        }

    }

    /** 翻译 JavDb 列表项标题为中文（带 localStorage 缓存）。对应原 L8934-8997。 */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jQuery object, $ is any-typed
    async translate($item: any): Promise<void> {
        // 列表页标题就地替换逻辑保留在本方法；TranslatePlugin 负责详情页
        if ((await storageManager.getSetting('translateTitle', YES)) !== YES) {
            return;
        }
        let sourceText = '';
        let carNum = '';
        const videoTitleEl = $item.find('.video-title');
        if (isJavdbSite) {
            sourceText = videoTitleEl
                .contents()
                .filter(
                    (_index: number, node: Node & { textContent: string }) =>
                        node.nodeType === 3 && node.textContent.trim() !== ''
                )
                .text()
                .trim();
            carNum = $item.find('.video-title strong').text().trim();
        }
        if (this.cache[carNum]) {
            videoTitleEl.contents().each((_index: number, node: Node & { textContent: string }) => {
                if (node.nodeType === 3 && node.textContent.trim() !== '') {
                    node.textContent = ' ' + this.cache[carNum] + ' ';
                }
            });
            videoTitleEl.attr('title', this.cache[carNum]);
            return;
        }
        translateText(sourceText)
            .then((translation) => {
                if (isJavdbSite) {
                    videoTitleEl.contents().each((_index: number, node: Node & { textContent: string }) => {
                        if (
                            node.nodeType === 3 &&
                            node.textContent.trim() !== '' &&
                            !node.textContent.includes(carNum)
                        ) {
                            node.textContent = ' ' + translation + ' ';
                        }
                    });
                    videoTitleEl.attr('title', translation);
                }
                this.writeQueue = this.writeQueue.then(() => {
                    this.cache[carNum] = translation;
                    localStorage.setItem('jhs_translate', JSON.stringify(this.cache));
                });
            })
            .catch((err: unknown) => {
                clog.error('翻译失败:', err);
            });
    }

    /** 还原翻译后的标题为原文。对应原 L8998-9023。 */
    async revertTranslation(): Promise<void> {
        $(this.getSelector().itemSelector)
            .toArray()
            .forEach((itemEl: HTMLElement) => {
                const $item = $(itemEl);
                const originalTitle =
                    $item.find('.box').attr('title') ||
                    $item.find('.video-title').attr('title') ||
                    $item.find('img').attr('data-title');
                const carNum = $item.find('.video-title strong').text().trim();
                const videoTitleEl = $item.find('.video-title');
                videoTitleEl.contents().each((_index: number, node: Node & { textContent: string }) => {
                    if (
                        node.nodeType === 3 &&
                        node.textContent.trim() !== '' &&
                        !node.textContent.includes(carNum)
                    ) {
                        node.textContent = ' ' + originalTitle + ' ';
                    }
                });
                videoTitleEl.removeAttr('title');
            });
    }

    /** 在分页栏挂载"跳转到指定页"控件。对应原 L9024-9068。 */
    addJumpPageControl(): void {
        const controlId = 'gemini-jump-page-control';
        if ($('#' + controlId).length > 0) {
            return;
        }
        if ($('.pagination-link.is-current').length === 0) {
            return;
        }
        const currentPage = utils.getUrlParam(currentHref, 'page') || 1;
        const $li = $(
            jsxToString(<JumpPageControl controlId={controlId} value={Number(currentPage) + 1} />)
        );
        $('.pagination-list').append($li);
        const $pageInput = $li.find('#jumpPageInput');
        const $jumpBtn = $li.find('button');
        const jumpToPage = () => {
            const pageNum = parseInt(String($pageInput.val()), 10);
            if (isNaN(pageNum) || pageNum < 1) {
                $pageInput.focus();
                return;
            }
            const url = new URL(window.location.href);
            url.searchParams.set('page', pageNum.toString());
            window.location.href = url.toString();
        };
        $jumpBtn.on('click', jumpToPage);
        $pageInput.on('keypress', (event: { which: number; preventDefault(): void }) => {
            if (event.which === 13) {
                jumpToPage();
                event.preventDefault();
            }
        });
    }
}
