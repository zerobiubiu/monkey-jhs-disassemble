/**
 * 列表页过滤与状态标签功能模块。
 * 从 list-page-plugin.tsx 提取，逻辑与原实现一致。
 *
 * 含 filterMovieList（依 IndexedDB 收藏/屏蔽/已观看/关键词/演员黑名单数据
 * 对 .item 卡片做显隐过滤并注入 status-tag，末尾经 PageCountTable 汇总日志）
 * 与 renderItemStatusTag（单卡片 status-tag 增量刷新）。
 * 当前页计数（currentPage*）为插件实例字段，经 plugin 透传读写。
 */
import { isJavdbSite, isSearchOrUserPage, ACTOR } from '../../constants/site';
import {
    FILTER_ACTION,
    FAVORITE_ACTION,
    HAS_WATCH_ACTION,
    NO,
    YES
} from '../../constants/status';

import { featureFlags } from '../../core/feature-flags';
import { jsxToString } from '../../core/jsx-to-string';
import {
    STATUS_TAG_CONFIG,
    getStatusTagPositionStyle,
    buildStatusTagHtml,
    injectStatusTag
} from '../../core/util/util-status-tag';
import type { StatusTagConfig } from '../../core/util/util-status-tag';

import type { ListPagePlugin } from '../list-page-plugin';

import { PageCountTable } from '../../components/misc/page-count-table';

/**
 * 增量刷新某个视频卡片的 JHS status-tag。
 * 用于跨 iframe / 跨标签页"想看 / 观看"同步后立刻反映到 series 列表上。
 * 走与 filterMovieList 同源数据（IndexedDB），保证状态真实。
 * @param item jQuery 化的 .item 元素
 * @param carNum 番号
 */
export async function renderItemStatusTag(item: HTMLElement, carNum: string): Promise<void> {
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
 * @param plugin ListPagePlugin 实例（读写当前页计数 + 番号提取 + 翻译）
 * @param itemEls .item 元素数组（jQuery .toArray() 结果）
 */
export async function filterMovieList(plugin: ListPagePlugin, itemEls: HTMLElement[]): Promise<void> {
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
    plugin.currentPageFilterCount = 0;
    plugin.currentPageFavoriteCount = 0;
    plugin.currentPageHasWatchCount = 0;
    plugin.currentPageKeywordFilterCount = 0;
    plugin.currentPageActorFilterCount = 0;
    plugin.currentPageWaitCheckCount = 0;
    plugin.currentPageTotalCount = 0;
    utils.time('处理页面耗时');
    await Promise.all(
        itemEls.map(async (itemEl) => {
            const $item = $(itemEl);
            const { carNum, title } = plugin.findCarNumAndHref($item);
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
                (plugin as unknown as Record<string, number>)[tagConfig.countKey]++;
            }
            plugin.currentPageTotalCount++;
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
            await plugin.translate($item);
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
                filterCount={plugin.currentPageFilterCount}
                favoriteCount={plugin.currentPageFavoriteCount}
                actorFilterCount={plugin.currentPageActorFilterCount}
                keywordFilterCount={plugin.currentPageKeywordFilterCount}
                hasWatchCount={plugin.currentPageHasWatchCount}
                waitCheckCount={plugin.currentPageWaitCheckCount}
                totalCount={plugin.currentPageTotalCount}
            />
        )
    );
}
