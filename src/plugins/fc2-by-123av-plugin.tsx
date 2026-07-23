/**
 * Fc2By123AvPlugin —— 在 JavDB 嵌入 123Av 站点 FC2 浏览/搜索/详情弹窗。
 *
 * 已提取模块：
 *   - fc2-123av/fc2-browse.tsx：hookPage + handleQuery + parseCards + renderPagination
 *   - fc2-123av/fc2-detail.tsx：open123AvFc2Dialog + saveAction + loadData + handleLongImg + get123AvVideoInfo + getActressInfo + getImgList
 */
import { featureFlags } from '../core/feature-flags';
import { jsxToString } from '../core/jsx-to-string';

import { BasePlugin } from './base-plugin';

import {
    hookPage as browseHookPage,
    handleQuery as browseHandleQuery,
    renderPagination as browseRenderPagination,
    parseCards as browseParseCards
} from './fc2-123av/fc2-browse';
import {
    open123AvFc2Dialog as detailOpenDialog,
    saveAction as detailSaveAction,
    loadData as detailLoadData,
    handleLongImg as detailHandleLongImg,
    get123AvVideoInfo as detailGetVideoInfo,
    getActressInfo as detailGetActressInfo,
    getImgList as detailGetImgList
} from './fc2-123av/fc2-detail';

import type { RankingMovie } from '../constants/api';

export class Fc2By123AvPlugin extends BasePlugin {
    $contentBox: JQuery | null = null;
    urlParams = new URLSearchParams(window.location.search);
    sortVal: string = 'release_date';
    currentPage = 1;
    maxPage: number | null = null;
    keyword: string | null = null;
    _querySeq = 0;

    constructor() {
        super();
        this.sortVal = this.urlParams.get('sort') || 'release_date';
        this.currentPage = parseInt(this.urlParams.get('page') || '', 10) || 1;
        this.keyword = this.urlParams.get('keyword') || null;
    }

    getName(): string {
        return 'Fc2By123AvPlugin';
    }

    async getBaseUrl(): Promise<string> {
        // getAv123Url 从未在 OtherSitePlugin 上实现，始终使用默认域名
        const base = 'https://123av.com';
        return base.replace(/\/$/, '') + '/ja';
    }

    async handle(): Promise<void> {
        if (!featureFlags.fc2By123AvPlugin) return;
        this.injectNavEntry();
        if (window.location.href.includes('/advanced_search?type=100')) {
            this.$contentBox = $('.section .container');
            this.hookPage();
            await this.handleQuery();
        }
    }

    /**
     * 注入 123Av-Fc2 导航入口（与 jhs.3.3.6.027 一致：挂在主栏 FC2 旁 + tabs 里 FC2 后）。
     * 禁止对全局 `.navbar-start` append——自定义检索框也有 `.navbar-start`，会导致双份。
     */
    injectNavEntry(): void {
        const href = '/advanced_search?type=100&released_start=2099-09';
        if ($('#navbar-item-123av-fc2').length === 0) {
            // 主站导航：优先插在文字为 FC2 的 navbar-item 后（单点插入）
            const $fc2Nav = $('#navbar-menu-hero a.navbar-item')
                .filter((_i: number, el: HTMLElement) => {
                    const text = $(el).text().trim();
                    const link = $(el).attr('href') || '';
                    return text === 'FC2' || link.includes('advanced_search?type=3');
                })
                .first();
            if ($fc2Nav.length) {
                $fc2Nav.after(
                    jsxToString(
                        <a className="navbar-item" id="navbar-item-123av-fc2" href={href}>
                            123Av-Fc2
                        </a>
                    )
                );
            } else {
                // 回退：仅主栏 #navbar-menu-hero 内第一个 .navbar-start，避免命中 #search-box
                $('#navbar-menu-hero .navbar-start')
                    .first()
                    .append(
                        jsxToString(
                            <a className="navbar-item" id="navbar-item-123av-fc2" href={href}>
                                123Av-Fc2
                            </a>
                        )
                    );
            }
        }
        // 列表顶 tabs 中 FC2 后补一项（若存在且尚未注入）
        if (
            $('.tabs li:contains("FC2")').length &&
            !$('.tabs a[href*="advanced_search?type=100"]').length
        ) {
            $('.tabs li:contains("FC2")').after(
                jsxToString(
                    <li id="tab-123av-fc2">
                        <a href={href}>
                            <span>123Av-Fc2</span>
                        </a>
                    </li>
                )
            );
        }
    }

    hookPage(): void {
        browseHookPage(this);
    }

    renderPagination(): void {
        browseRenderPagination(this);
    }

    async handleQuery(): Promise<void> {
        await browseHandleQuery(this);
    }

    parseCards($dom: JQuery): RankingMovie[] {
        return browseParseCards(this, $dom);
    }

    async open123AvFc2Dialog(carNum: string, href: string): Promise<void> {
        await detailOpenDialog(this, carNum, href);
    }

    async saveAction(carNum: string, url: string, actionType: string): Promise<void> {
        await detailSaveAction(this, carNum, url, actionType);
    }

    async loadData(carNum: string, href: string): Promise<void> {
        await detailLoadData(this, carNum, href);
    }

    handleLongImg(carNum: string): void {
        detailHandleLongImg(this, carNum);
    }

    async get123AvVideoInfo(href: string): Promise<{
        id: string;
        releaseDate: string;
        title: string;
        poster: string;
    }> {
        return detailGetVideoInfo(this, href);
    }

    async getActressInfo(
        fc2Num: string
    ): Promise<{ actors: string[]; seller?: string } | null> {
        return detailGetActressInfo(this, fc2Num);
    }

    async getImgList(fc2Num: string): Promise<string[]> {
        return detailGetImgList(this, fc2Num);
    }
}
