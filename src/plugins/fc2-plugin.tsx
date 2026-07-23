/**
 * Fc2Plugin —— FC2 番号详情弹窗（提取自未删减版 jhs.user.js L4162-4439）。
 *
 * 项目的 archetype/jhs.user.js 为删减版，移除了 Fc2Plugin 及 MagnetHubPlugin /
 * TranslatePlugin / ScreenShotPlugin / Fc2By123AvPlugin 等
 * 插件，但 list-page-plugin / history-plugin / list-page-button-plugin 仍以
 * `getBean('Fc2Plugin')?.openFc2Dialog(...)` 调用之，导致 FC2 番号列表项点击后
 * preventDefault 阻止了 <a> 默认跳转、又无弹窗，表现为"点不开"。
 *
 * 本模块从未删减版迁移 Fc2Plugin 主体并注册到 PluginManager，恢复 FC2 详情弹窗
 * 功能。缺失的 4 个依赖插件以 `?.` 可选链静默失败（磁力搜索/翻译/截图/
 * 123av 弹窗暂不可用，其余功能正常）。
 *
 * 依赖映射（未删减版单字母 → 项目模块）：
 *   o→currentHref  V→fetchMovieDetail  U→API_BASE  O→reBuildSignature
 *   d→FILTER_ACTION  h→FAVORITE_ACTION  g→HAS_DOWN_ACTION  p→HAS_WATCH_ACTION
 *   f→BLOCK_COLOR  m→BLOCK_TEXT  w→FAVORITE_COLOR  v→FAVORITE_TEXT
 *   x→HAS_DOWN_COLOR  y→HAS_DOWN_TEXT  k→WATCHED_TEXT  S→WATCHED_COLOR
 *   （颜色/文案 8 常量现由 Fc2DetailDialog 组件从 constants/status 导入消费）
 */
import { currentHref } from '../constants/site';
import {
    FILTER_ACTION,
    FAVORITE_ACTION,
    HAS_WATCH_ACTION,
    HAS_DOWN_ACTION
} from '../constants/status';
import { fetchMovieDetail, API_BASE, reBuildSignature } from '../constants/api';

import { jsxToString } from '../core/jsx-to-string';

import { BasePlugin } from './base-plugin';

import { Fc2DetailDialog } from '../components/fc2/fc2-detail-dialog';
import { Fc2MagnetItem } from '../components/fc2/fc2-magnet-item';
import { Fc2MovieDetail } from '../components/fc2/fc2-movie-detail';
import { MovieError } from '../components/movie/movie-error';
import { ScreenLoadingPlaceholder } from '../components/screen/screen-loading-placeholder';

import fc2PluginCssRaw from '../styles/fc2-plugin.css?raw';

/**
 * FC2 详情弹窗插件。
 *
 * 在 javdb 列表页点击 FC2 番号卡片时，由 list-page-plugin.bindClick 调用
 * `getBean('Fc2Plugin').openFc2Dialog(movieId, carNum, url)` 打开详情弹窗，
 * 展示电影信息 / 磁力 / 评论 / 相关 / 第三方资源跳转，并支持收藏/屏蔽/已看/已下载。
 */
export class Fc2Plugin extends BasePlugin {
    getName(): string {
        return 'Fc2Plugin';
    }

    async initCss(): Promise<string> {
        return fc2PluginCssRaw;
    }

    /**
     * FC2 搜索页导航/标题修正 + collection_codes 页自动开弹窗。
     * 对应未删减版 L4169-4187。
     */
    async handle(): Promise<void> {
        const fc2SearchHref = '/advanced_search?type=3&score_min=0&d=1';
        $('.navbar-item:contains("FC2")').attr('href', fc2SearchHref);
        $('.tabs a:contains("FC2")').attr('href', fc2SearchHref);
        if (currentHref.includes('advanced_search?type=3')) {
            $('h2.section-title').contents().first().replaceWith('Fc2PPV');
            $('.section .container > .box').remove();
        }
        if (currentHref.includes('collection_codes?movieId')) {
            $('section').html('');
            const params = new URLSearchParams(window.location.search);
            const movieId = params.get('movieId');
            const carNum = params.get('carNum');
            const url = params.get('url');
            if (movieId && carNum && url) {
                this.openFc2Dialog(movieId, carNum, url);
            }
        }
    }

    /**
     * 打开 FC2 详情弹窗。对应未删减版 L4188-4300。
     *
     * @param movieId 影片 ID（URL 末段）
     * @param carNum  番号（如 FC2-4802496）
     * @param url     详情页 URL
     */
    openFc2Dialog(movieId: string | number, carNum: string, url: string): void {
        const carNumWithoutPrefix = carNum.replace('FC2-', '');
        // 123av 来源委托给 Fc2By123AvPlugin（项目删减版未迁移，缺失时回退普通弹窗）
        if (url.includes('123av')) {
            const fc2By123Av = this.getBean('Fc2By123AvPlugin');
            if (fc2By123Av) {
                fc2By123Av.open123AvFc2Dialog(carNum, url);
                return;
            }
        }
        const dialogHtml = jsxToString(<Fc2DetailDialog />);
        layer.open({
            type: 1,
            title: carNum,
            content: dialogHtml,
            area: utils.getResponsiveArea(['70%', '90%']),
            skin: 'movie-detail-layer',
            scrollbar: false,
            success: (_layerEl: any, layerIndex: number) => {
                this.loadData(movieId, carNum);
                $('#favoriteBtn').on('click', async () => {
                    const names = $('#data-actress').text();
                    const publishTime = $('#data-releaseDate').text();
                    await storageManager.saveCar({
                        carNum,
                        url,
                        names,
                        actionType: FAVORITE_ACTION,
                        publishTime
                    });
                    window.refresh();
                    layer.closeAll();
                });
                $('#filterBtn').on('click', (event: any) => {
                    utils.q(event, `是否屏蔽${carNum}?`, async () => {
                        const names = $('#data-actress').text();
                        const publishTime = $('#data-releaseDate').text();
                        await storageManager.saveCar({
                            carNum,
                            url,
                            names,
                            actionType: FILTER_ACTION,
                            publishTime
                        });
                        window.refresh();
                        layer.closeAll();
                        if (window.location.href.includes('collection_codes?movieId')) {
                            utils.closePage();
                        }
                    });
                });
                $('#hasDownBtn').on('click', async () => {
                    const names = $('#data-actress').text();
                    const publishTime = $('#data-releaseDate').text();
                    await storageManager.saveCar({
                        carNum,
                        url,
                        names,
                        actionType: HAS_DOWN_ACTION,
                        publishTime
                    });
                    window.refresh();
                    layer.closeAll();
                });
                $('#hasWatchBtn').on('click', async () => {
                    const names = $('#data-actress').text();
                    const publishTime = $('#data-releaseDate').text();
                    await storageManager.saveCar({
                        carNum,
                        url,
                        names,
                        actionType: HAS_WATCH_ACTION,
                        publishTime
                    });
                    window.refresh();
                    layer.closeAll();
                });
                $('#search-subtitle-btn').on('click', (event: any) =>
                    utils.openPage(
                        `https://subtitlecat.com/index.php?search=${carNum}`,
                        carNum,
                        false,
                        event
                    )
                );
                $('#xunLeiSubtitleBtn').on('click', () =>
                    this.getBean('DetailPageButtonPlugin')?.searchXunLeiSubtitle(carNum)
                );
                $('#magnetSearchBtn').on('click', () => {
                    // MagnetHubPlugin 项目未迁移，缺失时静默失败
                    const magnetHub = this.getBean('MagnetHubPlugin');
                    if (!magnetHub) return;
                    const magnetHubHtml = magnetHub.createMagnetHub(carNum);
                    layer.open({
                        type: 1,
                        title: '磁力搜索',
                        content: jsxToString(<div id="magnetHubBox" />),
                        area: utils.getResponsiveArea(['60%', '80%']),
                        scrollbar: false,
                        success: () => {
                            $('#magnetHubBox').append(magnetHubHtml);
                        }
                    });
                });
                this.getBean('OtherSitePlugin')?.loadOtherSite(carNumWithoutPrefix, carNum).then();
                utils.setupEscClose(layerIndex);
            },
            end() {
                if (window.location.href.includes('collection_codes?movieId')) {
                    utils.closePage();
                }
            }
        });
    }

    /**
     * 加载电影详情/长图/磁力/评论/相关。对应未删减版 L4301-4312。
     */
    loadData(movieId: string | number, carNum: string): void {
        const carNumWithoutPrefix = carNum.replace('FC2-', '');
        this.handleMovieDetail(movieId);
        this.handleLongImg(carNumWithoutPrefix);
        this.handleMagnets(movieId);
        this.getBean('ReviewPlugin')?.showReview(movieId, $('#reviews-content')).then();
        this.getBean('RelatedPlugin')?.showRelated($('#related-content'), movieId).then();
    }

    /**
     * 拉取并渲染电影详情。对应未删减版 L4313-4355。
     */
    handleMovieDetail(movieId: string | number): void {
        fetchMovieDetail(movieId)
            .then((detail: any) => {
                const actors = detail.actors || [];
                const imgList = detail.imgList || [];
                let actressNames = '';
                for (let i = 0; i < actors.length; i++) {
                    const actor = actors[i];
                    if (actor.gender === 0) {
                        actressNames += actor.name + ' ';
                    }
                }
                if (actressNames) {
                    $('#data-actress').text(actressNames);
                }
                $('.movie-info-container').html(
                    jsxToString(
                        <Fc2MovieDetail detail={detail} actors={actors} imgList={imgList} />
                    )
                );
                // TranslatePlugin 项目未迁移，缺失时静默失败
                this.getBean('TranslatePlugin')?.translate(detail.carNum, false)?.then();
            })
            .catch((err: any) => {
                clog.error(err);
                $('.movie-info-container').html(
                    jsxToString(<MovieError message={err.message} />)
                );
            });
    }

    /**
     * 加载长图缩略图。对应未删减版 L4356-4370。
     * ScreenShotPlugin 项目未迁移，缺失时静默失败。
     */
    handleLongImg(carNumWithoutPrefix: string): void {
        utils.loopDetector(
            () => $('.movie-gallery .image-list').length > 0,
            async () => {
                $('.movie-gallery .image-list').prepend(
                    jsxToString(<ScreenLoadingPlaceholder maxHeight="150px" />)
                );
                const screenShot = this.getBean('ScreenShotPlugin');
                if (!screenShot) return;
                const screenshotUrl = await screenShot.getScreenshot(carNumWithoutPrefix);
                if (screenshotUrl) {
                    await screenShot.addImg('缩略图', screenshotUrl);
                }
            }
        );
    }

    /**
     * 拉取并渲染磁力列表。对应未删减版 L4371-4431。
     */
    handleMagnets(movieId: string | number): void {
        (async () => {
            const url = `${API_BASE}/v1/movies/${movieId}/magnets`;
            const headers = { jdSignature: await reBuildSignature() };
            return (await gmHttp.get(url, undefined, headers)).data.magnets;
        })()
            .then((magnets: any[]) => {
                let magnetsHtml = '';
                if (magnets.length > 0) {
                    for (let i = 0; i < magnets.length; i++) {
                        const magnet = magnets[i];
                        let rowClass = '';
                        if (i % 2 === 0) {
                            rowClass = 'odd';
                        }
                        magnetsHtml += jsxToString(
                            <Fc2MagnetItem magnet={magnet} rowClass={rowClass} />
                        );
                    }
                } else {
                    magnetsHtml = jsxToString(<span className="no-data">暂无磁力信息</span>);
                }
                $('#magnets-content').html(magnetsHtml);
            })
            .catch((err: any) => {
                clog.error(err);
                $('#magnets-content').html(
                    jsxToString(<MovieError message={err.message} />)
                );
            });
    }

    /**
     * 在新标签打开 collection_codes 页面（供跨标签触发 openFc2Dialog）。
     * 对应未删减版 L4432-4438。
     */
    async openFc2Page(movieId: string | number, carNum: string, url: string): Promise<void> {
        const otherSite = this.getBean('OtherSitePlugin');
        const javdbUrl = await otherSite?.getJavDbUrl();
        window.open(
            `${javdbUrl}/users/collection_codes?movieId=${movieId}&carNum=${carNum}&url=${url}`
        );
    }
}
