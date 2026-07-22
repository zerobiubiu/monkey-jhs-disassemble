/**
 * Fc2By123AvPlugin —— 在 JavDB 嵌入 123Av 站点 FC2 浏览/搜索/详情弹窗。
 */
import { featureFlags } from '../core/feature-flags';
import { javDbApi } from '../constants/api';
import {
    FAVORITE_ACTION,
    FILTER_ACTION,
    HAS_WATCH_ACTION,
    YES
} from '../constants/status';
import { escapeHtmlAttribute, escapeHtmlText } from '../core/jsx-to-string';
import { BasePlugin } from './base-plugin';

const HAS_DOWN_STATUS = 'hasDown';

/** 远端 123Av/FC2 字段只允许作为 HTTPS 资源进入页面。 */
function safeHttpsUrl(value: unknown, base = 'https://123av.com'): string {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    try {
        const parsed = new URL(raw, base);
        return parsed.protocol === 'https:' ? parsed.href : '';
    } catch {
        return '';
    }
}

function safeErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error ?? '未知错误');
}

export class Fc2By123AvPlugin extends BasePlugin {
    $contentBox: any = null;
    urlParams = new URLSearchParams(window.location.search);
    sortVal: string = 'release_date';
    currentPage = 1;
    maxPage: number | null = null;
    keyword: string | null = null;

    constructor() {
        super();
        this.sortVal = this.urlParams.get('sort') || 'release_date';
        this.currentPage = this.urlParams.get('page')
            ? parseInt(this.urlParams.get('page') as string, 10)
            : 1;
        this.keyword = this.urlParams.get('keyword') || null;
    }

    getName(): string {
        return 'Fc2By123AvPlugin';
    }

    async getBaseUrl(): Promise<string> {
        const other = this.getBean('OtherSitePlugin');
        // 默认 123av 域名
        const configured = (await other?.getAv123Url?.()) || 'https://123av.com';
        const base = safeHttpsUrl(configured) || 'https://123av.com';
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
                    `<a class="navbar-item" id="navbar-item-123av-fc2" href="${escapeHtmlAttribute(href)}">123Av-Fc2</a>`
                );
            } else {
                // 回退：仅主栏 #navbar-menu-hero 内第一个 .navbar-start，避免命中 #search-box
                $('#navbar-menu-hero .navbar-start')
                    .first()
                    .append(
                        `<a class="navbar-item" id="navbar-item-123av-fc2" href="${escapeHtmlAttribute(href)}">123Av-Fc2</a>`
                    );
            }
        }
        // 列表顶 tabs 中 FC2 后补一项（若存在且尚未注入）
        if (
            $('.tabs li:contains("FC2")').length &&
            !$('.tabs a[href*="advanced_search?type=100"]').length
        ) {
            $('.tabs li:contains("FC2")').after(
                `<li id="tab-123av-fc2"><a href="${escapeHtmlAttribute(href)}"><span>123Av-Fc2</span></a></li>`
            );
        }
    }

    hookPage(): void {
        document.title = '123Av FC2';
        const $box = this.$contentBox;
        if (!$box?.length) return;
        $box.html(`
            <div style="margin-bottom:15px">
                <h2 class="title is-4">123Av FC2 浏览</h2>
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
                    <input id="fc2-123av-keyword" class="input" style="max-width:280px" placeholder="搜索关键词" value="${escapeHtmlAttribute(this.keyword || '')}">
                    <button id="fc2-123av-search" class="button is-info">搜索</button>
                    <select id="fc2-123av-sort" class="select" style="height:2.5em">
                        <option value="release_date">发布日期</option>
                        <option value="recent_update">最近更新</option>
                        <option value="trending">热门</option>
                        <option value="most_viewed_today">今天最多观看</option>
                        <option value="most_viewed_week">本周最多观看</option>
                        <option value="most_viewed_month">本月最多观看</option>
                        <option value="most_viewed">最多观看</option>
                        <option value="most_favourited">最受欢迎</option>
                    </select>
                </div>
                <div id="fc2-123av-list" class="movie-list h cols-4 vcols-8"></div>
                <div id="fc2-123av-pagination" style="margin-top:15px;text-align:center"></div>
            </div>
        `);
        $('#fc2-123av-sort').val(this.sortVal);
        $('#fc2-123av-search').on('click', () => {
            this.keyword = String($('#fc2-123av-keyword').val() || '') || null;
            this.currentPage = 1;
            this.handleQuery();
        });
        $('#fc2-123av-sort').on('change', () => {
            this.sortVal = String($('#fc2-123av-sort').val() || 'release_date');
            this.currentPage = 1;
            this.handleQuery();
        });
    }

    renderPagination(): void {
        const $pg = $('#fc2-123av-pagination');
        if (!this.maxPage || this.maxPage <= 1) {
            $pg.empty();
            return;
        }
        let html = '';
        const cur = this.currentPage;
        const max = this.maxPage;
        const pages: number[] = [];
        for (let i = 1; i <= max; i++) {
            if (i === 1 || i === max || (i >= cur - 2 && i <= cur + 2)) {
                pages.push(i);
            }
        }
        let last = 0;
        for (const p of pages) {
            if (last && p - last > 1) html += '<span style="margin:0 4px">…</span>';
            html += `<a class="button is-small ${p === cur ? 'is-primary' : ''}" data-page="${p}" style="margin:2px">${p}</a>`;
            last = p;
        }
        $pg.html(html);
        $pg.find('a[data-page]').on('click', (e: any) => {
            e.preventDefault();
            this.currentPage = parseInt($(e.currentTarget).attr('data-page') || '1', 10);
            this.handleQuery();
        });
    }

    async handleQuery(): Promise<void> {
        const base = await this.getBaseUrl();
        // 每 2 页合并，maxPage = rawMaxPage / 2
        const fetchPage = async (page: number) => {
            let url: string;
            if (this.keyword) {
                url = `${base}/search?keyword=${encodeURIComponent(this.keyword)}&page=${page}&sort=${this.sortVal}`;
            } else {
                url = `${base}/makers/fc2?page=${page}&sort=${this.sortVal}`;
            }
            const html = await gmHttp.get(url);
            return utils.htmlTo$dom(html);
        };
        try {
            show.info('正在加载 123Av FC2...');
            const pageA = (this.currentPage - 1) * 2 + 1;
            const pageB = pageA + 1;
            const $dom1 = await fetchPage(pageA);
            let movies = this.parseCards($dom1);
            try {
                const $dom2 = await fetchPage(pageB);
                movies = movies.concat(this.parseCards($dom2));
            } catch {
                /* 末页可能无 pageB */
            }
            // 解析最大页
            const lastPageText =
                $dom1.find('.pagination .page-link').last().text() ||
                $dom1.find('.pagination a').last().text();
            const rawMax = parseInt(lastPageText, 10) || 1;
            this.maxPage = Math.max(1, Math.ceil(rawMax / 2));
            const html = featureFlags.javDbApiAggregate
                ? javDbApi.markDataListHtml(movies)
                : this.markDataListHtml(movies);
            $('#fc2-123av-list').html(html || '<p>无结果</p>');
            this.renderPagination();
            $('#fc2-123av-list .item a.box').on('click', (e: any) => {
                e.preventDefault();
                const href = $(e.currentTarget).attr('href') || '';
                const carNum =
                    $(e.currentTarget).find('strong').text().trim() ||
                    href.split('/').pop() ||
                    '';
                this.open123AvFc2Dialog(carNum, href.startsWith('http') ? href : base + href);
            });
        } catch (e: any) {
            console.error(e);
            show.error('加载 123Av FC2 失败: ' + safeErrorMessage(e));
        }
    }

    parseCards($dom: any): any[] {
        const list: any[] = [];
        $dom.find('.card, .movie-list .item, .box').each((_i: number, el: any) => {
            const $el = $(el);
            const $a = $el.find('a').first();
            const href = $a.attr('href') || '';
            const title =
                $a.attr('title') ||
                $el.find('.video-title, .title, h3').text().trim() ||
                '';
            const number =
                $el.find('strong').text().trim() ||
                (title.match(/FC2[-_]?PPV[-_]?(\d+)/i)
                    ? 'FC2-' + title.match(/FC2[-_]?PPV[-_]?(\d+)/i)![1]
                    : title.split(' ')[0]);
            const cover =
                $el.find('img').attr('data-src') ||
                $el.find('img').attr('src') ||
                '';
            const id = href.split('/').filter(Boolean).pop() || number;
            if (number || href) {
                list.push({
                    id,
                    number: number.startsWith('FC2') ? number : `FC2-${number}`,
                    origin_title: title,
                    cover_url: cover,
                    release_date: $el.find('.meta, .date').text().trim() || '',
                    has_cnsub: false,
                    magnets_count: 0,
                    new_magnets: false,
                    _href: href
                });
            }
        });
        return list;
    }

    async open123AvFc2Dialog(carNum: string, href: string): Promise<void> {
        const dialogHtml = `
            <div class="movie-detail-container" style="padding:15px">
                <div class="movie-info-container"><div class="search-loading">加载中...</div></div>
                <div class="movie-panel-info" style="margin-top:15px"><strong>第三方资源: </strong></div>
                <div style="margin: 20px 0">
                    <a id="filterBtn" class="menu-btn" style="background-color:#de3333;color:#fff;padding:6px 12px;margin-right:6px">🚫 屏蔽</a>
                    <a id="favoriteBtn" class="menu-btn" style="background-color:#25b1dc;color:#fff;padding:6px 12px;margin-right:6px">⭐ 收藏</a>
                    <a id="hasDownBtn" class="menu-btn" style="background-color:#7bc73b;color:#fff;padding:6px 12px;margin-right:6px">📥️ 已下载</a>
                    <a id="hasWatchBtn" class="menu-btn" style="background-color:#d7a80c;color:#fff;padding:6px 12px;margin-right:6px">🔍 已观看</a>
                    <a id="magnetSearchBtn" class="menu-btn" style="background:linear-gradient(to right,#f58c01,#54a11d);color:#fff;padding:6px 12px">磁力搜索</a>
                </div>
                <div id="magnets-content" class="magnet-links"></div>
                <div class="movie-gallery" style="margin-top:10px">
                    <strong>剧照: </strong>
                    <div class="image-list"></div>
                </div>
            </div>
        `;
        layer.open({
            type: 1,
            title: carNum,
            content: dialogHtml,
            area: utils.getResponsiveArea(['80%', '90%']),
            success: async () => {
                await this.loadData(carNum, href);
                this.handleLongImg(carNum.replace(/^FC2-/, ''));
                $('#filterBtn').on('click', () =>
                    this.saveAction(carNum, href, FILTER_ACTION)
                );
                $('#favoriteBtn').on('click', () =>
                    this.saveAction(carNum, href, FAVORITE_ACTION)
                );
                $('#hasDownBtn').on('click', () =>
                    this.saveAction(carNum, href, HAS_DOWN_STATUS)
                );
                $('#hasWatchBtn').on('click', () =>
                    this.saveAction(carNum, href, HAS_WATCH_ACTION)
                );
                $('#magnetSearchBtn').on('click', () => {
                    const magnetHub = this.getBean('MagnetHubPlugin');
                    if (magnetHub) {
                        $('#magnets-content').empty().append(
                            magnetHub.createMagnetHub(carNum)
                        );
                    }
                });
            }
        });
    }

    async saveAction(carNum: string, url: string, actionType: string): Promise<void> {
        await storageManager.saveCar({
            carNum,
            url,
            names: null,
            actionType,
            publishTime: $('#data-releaseDate').text() || ''
        });
        show.ok('操作成功');
        refresh();
    }

    async loadData(carNum: string, href: string): Promise<void> {
        try {
            const info = await this.get123AvVideoInfo(href);
            const fc2Num = carNum.replace(/^FC2-?(PPV-?)?/i, '');
            const actressInfo = await this.getActressInfo(fc2Num).catch(() => null);
            const imgList = await this.getImgList(fc2Num).catch(() => [] as string[]);
            let actorsHtml = '';
            if (actressInfo?.actors?.length) {
                actorsHtml = actressInfo.actors
                    .map((a: string) => `<span class="tag" style="margin:2px">${escapeHtmlText(a)}</span>`)
                    .join('');
            }
            const imagesHtml = imgList
                .map(
                    (src) => {
                        const safeSrc = safeHttpsUrl(src);
                        return safeSrc
                            ? `<a class="tile-item" href="${escapeHtmlAttribute(safeSrc)}" target="_blank"><img src="${escapeHtmlAttribute(safeSrc)}" style="max-width:150px;margin:4px" loading="lazy"></a>`
                            : '';
                    }
                )
                .join('');
            const title = String(info.title || carNum);
            const infoId = String(info.id || carNum);
            const releaseDate = String(info.releaseDate || '');
            const poster = safeHttpsUrl(info.poster);
            $('.movie-info-container').html(`
                <div class="movie-title"><strong>${escapeHtmlText(title)}</strong></div>
                <div>番号: ${escapeHtmlText(infoId)}</div>
                <div>发布日: ${escapeHtmlText(releaseDate)}</div>
                ${poster ? `<div style="margin-top:8px"><img src="${escapeHtmlAttribute(poster)}" style="max-width:320px"></div>` : ''}
                <div class="movie-actors" style="margin-top:8px"><strong>主演: </strong>${actorsHtml || '未知'}</div>
                <div id="data-releaseDate" style="display:none">${escapeHtmlText(releaseDate)}</div>
            `);
            $('.movie-gallery .image-list').html(imagesHtml);
            this.getBean('TranslatePlugin')?.translate?.(carNum, false)?.then?.();
        } catch (e: any) {
            console.error(e);
            $('.movie-info-container').html(
                `<div class="movie-error">加载失败: ${escapeHtmlText(safeErrorMessage(e))}</div>`
            );
        }
    }

    handleLongImg(carNum: string): void {
        utils.loopDetector(
            () => $('.movie-gallery .image-list').length > 0,
            async () => {
                $('.movie-gallery .image-list').prepend(
                    ' <a class="tile-item screen-container" style="overflow:hidden;max-height: 150px;max-width:150px; text-align:center;"><div style="margin-top: 50px;color: #000;cursor: auto">正在加载缩略图</div></a> '
                );
                const screenShot = this.getBean('ScreenShotPlugin');
                if (!screenShot) return;
                try {
                    const screenshotUrl = await screenShot.getScreenshot(carNum);
                    if (screenshotUrl) screenShot.addImg('缩略图', screenshotUrl);
                } catch {
                    /* ignore */
                }
            }
        );
    }

    async get123AvVideoInfo(href: string): Promise<{
        id: string;
        releaseDate: string;
        title: string;
        poster: string;
    }> {
        const baseUrl = await this.getBaseUrl();
        const fullHref = safeHttpsUrl(href, baseUrl);
        if (!fullHref) {
            throw new Error('详情页地址不是安全的 HTTPS 地址');
        }
        const html = await gmHttp.get(fullHref);
        const $dom = utils.htmlTo$dom(html);
        const title =
            $dom.find('h1').first().text().trim() ||
            $dom.find('.title').first().text().trim() ||
            '';
        const poster =
            $dom.find('video').attr('poster') ||
            $dom.find('.detail-img img, .cover img').attr('src') ||
            '';
        const releaseDate =
            $dom.find('.detail-item:contains("発売日"), .detail-item:contains("发布")')
                .text()
                .replace(/.*?[:：]/, '')
                .trim() ||
            $dom.find('time').text().trim() ||
            '';
        const id =
            $dom.find('.detail-item:contains("品番"), .detail-item:contains("番号")')
                .text()
                .replace(/.*?[:：]/, '')
                .trim() ||
            title.split(' ')[0] ||
            '';
        return { id, releaseDate, title, poster };
    }

    async getActressInfo(
        fc2Num: string
    ): Promise<{ actors: string[]; seller?: string } | null> {
        try {
            const html = await gmHttp.get(
                `https://fc2ppvdb.com/articles/${encodeURIComponent(fc2Num)}`
            );
            const $dom = utils.htmlTo$dom(html);
            const actors: string[] = [];
            $dom.find('a[href*="/actress"], .actress a, .actors a').each(
                (_i: number, el: any) => {
                    const name = $(el).text().trim();
                    if (name) actors.push(name);
                }
            );
            return { actors };
        } catch {
            return null;
        }
    }

    async getImgList(fc2Num: string): Promise<string[]> {
        try {
            const html = await gmHttp.get(
                `https://adult.contents.fc2.com/article/${encodeURIComponent(fc2Num)}/`
            );
            const $dom = utils.htmlTo$dom(html);
            const imgs: string[] = [];
            $dom.find('img').each((_i: number, el: any) => {
                const src = $(el).attr('src') || $(el).attr('data-src') || '';
                const safeSrc = safeHttpsUrl(src);
                if (safeSrc && /sample|preview|main/i.test(safeSrc)) imgs.push(safeSrc);
            });
            return imgs.slice(0, 20);
        } catch {
            return [];
        }
    }

    markDataListHtml(movies: any[]): string {
        return javDbApi.markDataListHtml(movies);
    }
}

// 防止未使用常量告警
void YES;
