/**
 * Fc2By123AvPlugin —— 在 JavDB 嵌入 123Av 站点 FC2 浏览/搜索/详情弹窗。
 */
import {
    FAVORITE_ACTION,
    FILTER_ACTION,
    HAS_WATCH_ACTION
} from '../constants/status';
import type { RankingMovie } from '../constants/api';

import { featureFlags } from '../core/feature-flags';
import { jsxToString } from '../core/jsx-to-string';

import { BasePlugin } from './base-plugin';

import { Fc2BrowsePage } from '../components/fc2/fc2-browse-page';
import { Fc2123avDetailDialog } from '../components/fc2/fc2-123av-detail-dialog';
import { Fc2123avMovieInfo } from '../components/fc2/fc2-123av-movie-info';
import { HitShowMovieItem } from '../components/hit-show/hit-show-movie-item';
import { MovieError } from '../components/movie/movie-error';
import { ScreenLoadingPlaceholder } from '../components/screen/screen-loading-placeholder';

const HAS_DOWN_STATUS = 'hasDown';

export class Fc2By123AvPlugin extends BasePlugin {
    $contentBox: JQuery | null = null;
    urlParams = new URLSearchParams(window.location.search);
    sortVal: string = 'release_date';
    currentPage = 1;
    maxPage: number | null = null;
    keyword: string | null = null;
    private _querySeq = 0;

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
        document.title = '123Av FC2';
        const $box = this.$contentBox;
        if (!$box?.length) return;
        $box.html(jsxToString(<Fc2BrowsePage keyword={this.keyword ?? undefined} />));
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
            if (last && p - last > 1) {
                html += jsxToString(<span style={{ margin: '0 4px' }}>…</span>);
            }
            html += jsxToString(
                <a
                    className={`button is-small ${p === cur ? 'is-primary' : ''}`}
                    data-page={p}
                    style={{ margin: '2px' }}
                >
                    {p}
                </a>
            );
            last = p;
        }
        $pg.html(html);
        $pg.find('a[data-page]').on('click', (e: Event) => {
            e.preventDefault();
            this.currentPage = parseInt($(e.currentTarget).attr('data-page') || '1', 10);
            this.handleQuery();
        });
    }

    async handleQuery(): Promise<void> {
        const seq = ++this._querySeq;
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
            return utils.htmlTo$dom(String(html));
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
            if (seq !== this._querySeq) return;
            // 解析最大页
            const lastPageText =
                $dom1.find('.pagination .page-link').last().text() ||
                $dom1.find('.pagination a').last().text();
            const rawMax = parseInt(lastPageText, 10) || 1;
            this.maxPage = Math.max(1, Math.ceil(rawMax / 2));
            const html = movies
                .map((movie: RankingMovie) => jsxToString(<HitShowMovieItem movie={movie} />))
                .join('');
            $('#fc2-123av-list').html(html || jsxToString(<p>无结果</p>));
            this.renderPagination();
            $('#fc2-123av-list .item a.box').on('click', (e: Event) => {
                e.preventDefault();
                const href = $(e.currentTarget).attr('href') || '';
                const carNum =
                    $(e.currentTarget).find('strong').text().trim() ||
                    href.split('/').pop() ||
                    '';
                this.open123AvFc2Dialog(carNum, href.startsWith('http') ? href : base + href);
            });
        } catch (e: unknown) {
            clog.error(e);
            show.error('加载 123Av FC2 失败: ' + (e instanceof Error ? e.message : String(e)));
        }
    }

    parseCards($dom: JQuery): RankingMovie[] {
        const list: RankingMovie[] = [];
        $dom.find('.card, .movie-list .item, .box').each((_i: number, el: HTMLElement) => {
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
                } as RankingMovie);
            }
        });
        return list;
    }

    async open123AvFc2Dialog(carNum: string, href: string): Promise<void> {
        const dialogHtml = jsxToString(<Fc2123avDetailDialog />);
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
            names: undefined,
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
            const actresses: string[] = actressInfo?.actors?.length
                ? actressInfo.actors
                : [];
            const imagesHtml = imgList
                .map((src) =>
                    jsxToString(
                        <a className="tile-item" href={src} target="_blank">
                            <img
                                src={src}
                                style={{ maxWidth: '150px', margin: '4px' }}
                                loading="lazy"
                            />
                        </a>
                    )
                )
                .join('');
            $('.movie-info-container').html(
                jsxToString(
                    <Fc2123avMovieInfo info={info} carNum={carNum} actresses={actresses} />
                )
            );
            $('.movie-gallery .image-list').html(imagesHtml);
            this.getBean('TranslatePlugin')?.translate?.(carNum, false)?.then?.();
        } catch (e: unknown) {
            clog.error(e);
            $('.movie-info-container').html(
                jsxToString(<MovieError message={e instanceof Error ? e.message : String(e)} />)
            );
        }
    }

    handleLongImg(carNum: string): void {
        utils.loopDetector(
            () => $('.movie-gallery .image-list').length > 0,
            async () => {
                $('.movie-gallery .image-list').prepend(
                    jsxToString(<ScreenLoadingPlaceholder maxHeight="150px" />)
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
        const fullHref = href.startsWith('http')
            ? href
            : (await this.getBaseUrl()) + href;
        const html = await gmHttp.get(fullHref);
        const $dom = utils.htmlTo$dom(String(html));
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
                `https://fc2ppvdb.com/articles/${fc2Num}`
            );
            const $dom = utils.htmlTo$dom(String(html));
            const actors: string[] = [];
            $dom.find('a[href*="/actress"], .actress a, .actors a').each(
                (_i: number, el: HTMLElement) => {
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
                `https://adult.contents.fc2.com/article/${fc2Num}/`
            );
            const $dom = utils.htmlTo$dom(String(html));
            const imgs: string[] = [];
            $dom.find('img').each((_i: number, el: HTMLElement) => {
                const src = $(el).attr('src') || $(el).attr('data-src') || '';
                if (src && /sample|preview|main/i.test(src)) imgs.push(src);
            });
            return imgs.slice(0, 20);
        } catch {
            return [];
        }
    }
}

