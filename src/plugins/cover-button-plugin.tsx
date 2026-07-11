/**
 * 列表页封面悬浮工具栏 CoverButtonPlugin（5 组按钮）。
 *
 * 挂在每张卡片 `.tags` 右侧；显隐由设置项
 * enableScreenSvg / enableVideoSvg / enableHandleSvg / enableSiteSvg / enableCopySvg 控制。
 * 依赖 ⑬ ScreenShotPlugin（长缩略图可选链）。
 */
import { YES, NO, FAVORITE_ACTION, FILTER_ACTION, HAS_WATCH_ACTION } from '../constants/status';
import { featureFlags } from '../core/feature-flags';
import {
    fetchDmmPreviewVideo,
    selectAvailableVideoQuality
} from './preview-video-plugin';
import { BasePlugin } from './base-plugin';

/** 「已下载」兼容状态 */
const HAS_DOWN_STATUS = 'hasDown';

export class CoverButtonPlugin extends BasePlugin {
    getName(): string {
        return 'CoverButtonPlugin';
    }

    async initCss(): Promise<string> {
        return `
            <style>
                .box .tags { justify-content: space-between; }
                .tool-box span { opacity: .3 }
                .tool-box span:hover { opacity: 1 }
                .tool-box svg path { fill: blue; }
                [data-theme="dark"] .tool-box svg path { fill: white; }
                [data-theme="dark"] .tool-box .copySvg .more-tools svg path { fill: black; }
                .elastic-in { animation: elasticIn 0.2s ease-out forwards; }
                .elastic-out { animation: elasticOut 0.2s ease-in forwards; }
                @keyframes elasticIn {
                    0% { opacity: 0; transform: scale(0.8); }
                    50% { opacity: 1; transform: scale(1.1); }
                    70% { transform: scale(0.95); }
                    100% { opacity: 1; transform: scale(1); }
                }
                @keyframes elasticOut {
                    0% { opacity: 1; transform: scale(1); }
                    100% { opacity: 0; transform: scale(0.8); }
                }
                .tool-box .more-tools {
                    display: flex; flex-direction: column; align-items: flex-end;
                }
                .tool-box .menu-btn {
                    display: block; padding: 4px 10px; border-radius: 4px;
                    text-decoration: none; white-space: nowrap; font-size: 12px;
                }
                .loading { opacity: 0.7; filter: blur(1px); }
                .loading-spinner {
                    position: absolute; top: 50%; left: 50%;
                    transform: translate(-50%, -50%);
                    width: 40px; height: 40px;
                    border: 3px solid rgba(255,255,255,.3);
                    border-radius: 50%; border-top-color: #fff;
                    animation: spin 1s ease-in-out infinite; z-index: 20;
                }
                @keyframes spin {
                    to { transform: translate(-50%, -50%) rotate(360deg); }
                }
            </style>
        `;
    }

    async handle(): Promise<void> {
        if (!featureFlags.coverButtonPlugin) return;
        if ((window as any).isListPage) {
            this.addSvgBtn();
            this.bindClick().then();
        }
    }

    async addSvgBtn(): Promise<void> {
        if (!featureFlags.coverButtonPlugin) return;
        $(this.getSelector().itemSelector)
            .toArray()
            .forEach((ele: any) => {
                const $box2 = $(ele);
                if ($box2.find('.tool-box').length > 0) return;
                $box2.find('.tags').append(`
                    <div class="tool-box" style="margin-left: auto; display: flex; align-items: center">
                        <span class="screenSvg" title="长缩略图" style="margin-right: 15px;">${this.screenSvg}</span>
                        <span class="videoSvg" title="播放视频" style="margin-right: 15px;">${this.videoSvg}</span>
                        <div class="more-tools-container handleSvg" style="position: relative; margin-right: 15px;">
                            <div title="鉴定处理" style="padding: 5px; margin: -5px;opacity:.3">${this.handleSvg}</div>
                            <div class="more-tools" style="position: absolute; bottom: 33px; right: -30px; display: none; z-index: 10;">
                                <a class="menu-btn hasWatchBtn" style="background-color:#d7a80c;color:white !important;margin-bottom: 5px"><span style="opacity: 1;">🔍 已观看</span></a>
                                <a class="menu-btn hasDownBtn" style="background-color:#7bc73b; color:white !important;margin-bottom: 5px"><span style="opacity: 1;">📥️ 已下载</span></a>
                                <a class="menu-btn favoriteBtn" style="background-color:#25b1dc; color:white !important;margin-bottom: 5px"><span style="opacity: 1;">⭐ 收藏</span></a>
                                <a class="menu-btn filterBtn" style="background-color:#de3333;   color:white !important;margin-bottom: 5px"><span style="opacity: 1;">🚫 屏蔽</span></a>
                            </div>
                        </div>
                        <div class="more-tools-container siteSvg" style="position: relative; margin-right: 15px;">
                            <div title="第三方网站" style="padding: 5px; margin: -5px;opacity:.3">${this.siteSvg}</div>
                            <div class="more-tools" style="position: absolute; bottom: 33px; right: -30px; display: none; z-index: 10;">
                                <a class="menu-btn site-jable" style="background-color:#e91e63;color:white !important;margin-bottom: 5px"><span style="opacity: 1;">Jable</span></a>
                                <a class="menu-btn site-avgle" style="background-color:#9c27b0;color:white !important;margin-bottom: 5px"><span style="opacity: 1;">Avgle</span></a>
                                <a class="menu-btn site-miss-av" style="background-color:#3f51b5;color:white !important;margin-bottom: 5px"><span style="opacity: 1;">MissAV</span></a>
                                <a class="menu-btn site-123-av" style="background-color:#009688;color:white !important;margin-bottom: 5px"><span style="opacity: 1;">123Av</span></a>
                            </div>
                        </div>
                        <div class="more-tools-container copySvg" style="position: relative;">
                            <div title="复制" style="padding: 5px; margin: -5px;opacity:.3">${this.copySvg}</div>
                            <div class="more-tools" style="position: absolute; bottom: 33px; right: -30px; display: none; z-index: 10;">
                                <a class="menu-btn carNumSvg" style="background-color:#607d8b;color:white !important;margin-bottom: 5px"><span style="opacity: 1;">番号</span></a>
                                <a class="menu-btn titleSvg" style="background-color:#795548;color:white !important;margin-bottom: 5px"><span style="opacity: 1;">标题</span></a>
                                <a class="menu-btn downSvg" style="background-color:#ff5722;color:white !important;margin-bottom: 5px"><span style="opacity: 1;">封面</span></a>
                            </div>
                        </div>
                    </div>
                `);
            });
        await this.enableSvgBtn();
    }

    /** 按设置开关控制 5 组图标显隐（默认开启）。 */
    async enableSvgBtn(): Promise<void> {
        const settingObj = await storageManager.getSetting();
        const {
            enableScreenSvg = YES,
            enableVideoSvg = YES,
            enableHandleSvg = YES,
            enableSiteSvg = YES,
            enableCopySvg = YES
        } = settingObj || {};
        [
            { selector: '.screenSvg', enabled: enableScreenSvg },
            { selector: '.videoSvg', enabled: enableVideoSvg },
            { selector: '.handleSvg', enabled: enableHandleSvg },
            { selector: '.siteSvg', enabled: enableSiteSvg },
            { selector: '.copySvg', enabled: enableCopySvg }
        ].forEach(({ selector, enabled }) => {
            $(selector).toggle(enabled === YES || enabled === true);
        });
    }

    async bindClick(): Promise<void> {
        const listPagePlugin = this.getBean('ListPagePlugin');
        $(document).on('click', '.more-tools-container', (event: any) => {
            event.preventDefault();
            const $currentTools = $(event.target)
                .closest('.more-tools-container')
                .find('.more-tools');
            $('.more-tools')
                .not($currentTools)
                .stop(true, true)
                .removeClass('elastic-in')
                .addClass('elastic-out')
                .hide();
            if ($currentTools.is(':visible')) {
                $currentTools
                    .stop(true, true)
                    .removeClass('elastic-in')
                    .addClass('elastic-out')
                    .hide();
            } else {
                $currentTools
                    .stop(true, true)
                    .removeClass('elastic-out')
                    .addClass('elastic-in')
                    .show();
            }
        });
        $(document).on('click', (event: any) => {
            if (!$(event.target).closest('.more-tools-container').length) {
                $('.more-tools')
                    .stop(true, true)
                    .removeClass('elastic-in')
                    .addClass('elastic-out')
                    .hide();
            }
        });
        $(document).on('click', '.videoSvg', (event: any) => {
            event.preventDefault();
            $(".videoSvg[title!='播放视频']").each((_index: number, element: any) => {
                const $otherSvgElement = $(element);
                const $otherBox = $otherSvgElement.closest('.item');
                const $otherImg = $otherBox.find('img');
                const { carNum: carNum2 } = this.getBoxCarInfo($otherBox);
                this.showImg($otherSvgElement, $otherImg, carNum2 as string);
                $otherSvgElement.html(this.videoSvg).attr('title', '播放视频');
            });
            const $currentBox = $(event.target).closest('.item');
            const $svgElement = $currentBox.find('.videoSvg');
            if ($svgElement.attr('title') === '播放视频') {
                $svgElement.html(this.recoveryVideoSvg).attr('title', '切回封面');
                const { carNum: carNum2 } = this.getBoxCarInfo($currentBox);
                const $img = $currentBox.find('img');
                if (!$img.length) {
                    show.error('没有找到图片');
                    return;
                }
                this.showVideo($svgElement, $img, carNum2 as string).then();
            }
        });
        $(document).on('click', '.screenSvg', async (event: any) => {
            event.preventDefault();
            const loadObj = loading();
            try {
                const $box2 = $(event.currentTarget).closest('.item');
                let { carNum: carNum2 } = this.getBoxCarInfo($box2);
                carNum2 = (carNum2 as string).replace('FC2-', '');
                const imgUrl = await this.getBean('ScreenShotPlugin')?.getScreenshot?.(carNum2);
                loadObj.close();
                if (imgUrl) (window as any).showImageViewer(imgUrl);
            } catch (error) {
                console.error('图片预览出错:', error);
                show.error('图片预览出错:' + error);
            } finally {
                loadObj.close();
            }
        });
        $(document).on(
            'click',
            '.filterBtn, .favoriteBtn, .hasDownBtn, .hasWatchBtn',
            (event: any) => {
                event.preventDefault();
                event.stopPropagation();
                const $btn = $(event.target).closest('.menu-btn');
                const $box2 = $btn.closest('.item');
                const { carNum: carNum2, url, publishTime } = this.getBoxCarInfo($box2);
                const handleAction = async (status: string) => {
                    let actress: string | null = null;
                    try {
                        actress = await listPagePlugin?.parseActressName?.(url);
                    } catch {
                        /* ignore */
                    }
                    await storageManager.saveCar({
                        carNum: carNum2,
                        url,
                        names: actress,
                        actionType: status,
                        publishTime
                    });
                    refresh();
                    show.ok('操作成功');
                };
                if ($btn.hasClass('filterBtn')) {
                    utils.q(event, `是否屏蔽${carNum2}?`, () => handleAction(FILTER_ACTION));
                } else if ($btn.hasClass('favoriteBtn')) {
                    handleAction(FAVORITE_ACTION).then();
                } else if ($btn.hasClass('hasDownBtn')) {
                    handleAction(HAS_DOWN_STATUS).then();
                } else if ($btn.hasClass('hasWatchBtn')) {
                    handleAction(HAS_WATCH_ACTION).then();
                }
                $('.more-tools')
                    .stop(true, true)
                    .removeClass('elastic-in')
                    .addClass('elastic-out')
                    .hide();
            }
        );
        const otherSitePlugin = this.getBean('OtherSitePlugin');
        const missAvUrl = (await otherSitePlugin?.getMissAvUrl?.()) || 'https://missav.ws';
        const jableUrl = 'https://jable.tv';
        const avgleUrl = 'https://avgle.com';
        const av123Url = 'https://123av.com';
        $(document).on(
            'click',
            '.site-jable, .site-avgle, .site-miss-av, .site-123-av',
            (event: any) => {
                event.preventDefault();
                event.stopPropagation();
                const $currentTarget = $(event.currentTarget);
                const $box2 = $currentTarget.closest('.item');
                const { carNum: carNum2 } = this.getBoxCarInfo($box2);
                let url: string | null = null;
                if ($currentTarget.hasClass('site-jable')) {
                    url = `${jableUrl}/search/${carNum2}/`;
                } else if ($currentTarget.hasClass('site-avgle')) {
                    url = `${avgleUrl}/vod/search.html?wd=${carNum2}`;
                } else if ($currentTarget.hasClass('site-miss-av')) {
                    url = `${missAvUrl}/search/${carNum2}`;
                } else if ($currentTarget.hasClass('site-123-av')) {
                    url = `${av123Url}/ja/search?keyword=${carNum2}`;
                }
                if (!url) return;
                if (event.ctrlKey || event.metaKey) {
                    GM_openInTab(url, { insert: 0 });
                } else {
                    window.open(url);
                }
            }
        );
        $(document).on('click', '.titleSvg, .carNumSvg, .downSvg', (event: any) => {
            event.preventDefault();
            event.stopPropagation();
            const $box2 = $(event.currentTarget).closest('.item');
            const { carNum: carNum2, title } = this.getBoxCarInfo($box2);
            const $img = $box2.find('.cover img');
            if ($(event.currentTarget).hasClass('titleSvg')) {
                utils.copyToClipboard('标题', title);
            } else if ($(event.currentTarget).hasClass('carNumSvg')) {
                utils.copyToClipboard('番号', carNum2);
            } else if ($(event.currentTarget).hasClass('downSvg')) {
                fetch($img.attr('src'))
                    .then((response) => response.blob())
                    .then((blob) => {
                        utils.download(blob, carNum2 + ' ' + title + '.jpg');
                    });
            }
        });
        void NO;
    }

    showImg($svgElement: any, $img: any, carNum2: string): void {
        $svgElement.html(this.videoSvg).attr('title', '播放视频');
        const $video = $(`#${carNum2}_preview_video`);
        if ($video.length > 0) {
            $video[0].pause();
            $video.parent().hide();
        }
        $img.show();
        $img.removeClass('loading');
        $img.next('.loading-spinner').remove();
    }

    async showVideo($svgElement: any, $img: any, carNum2: string): Promise<void> {
        const id = `${carNum2}_preview_video`;
        let $video = $(`#${id}`);
        if ($video.length > 0) {
            $video.parent().show();
            $video[0].play();
            $img.hide();
            return;
        }
        $img.addClass('loading');
        $img.after('<div class="loading-spinner"></div>');
        const poster = $img.attr('src');
        const dmmVideoMap = await fetchDmmPreviewVideo(carNum2, false);
        if (!dmmVideoMap) {
            show.error('未解析到视频');
            this.showImg($svgElement, $img, carNum2);
            return;
        }
        let defaultVideoQuality = await storageManager.getSetting('videoQuality');
        defaultVideoQuality =
            selectAvailableVideoQuality(Object.keys(dmmVideoMap), defaultVideoQuality) ||
            Object.keys(dmmVideoMap)[0];
        const videoUrl = dmmVideoMap[defaultVideoQuality];
        const videoHtml = `
            <div style="display: flex; justify-content: center; align-items: center; position: absolute; top:0; left:0; height: 100%; width: 100%; z-index: 10; overflow: hidden">
                <video
                    src="${videoUrl}"
                    poster="${poster}"
                    id="${id}"
                    controls
                    loop
                    muted
                    playsinline
                    style="max-height: 100%; max-width: 100%; object-fit: contain"
                ></video>
            </div>
        `;
        $img.parent().append(videoHtml);
        $img.hide();
        $img.removeClass('loading');
        $img.next('.loading-spinner').remove();
        $video = $(`#${id}`);
        const videoElement = $video[0];
        videoElement.load();
        videoElement.muted = false;
        videoElement.play();
        $video.trigger('focus');
    }
}
