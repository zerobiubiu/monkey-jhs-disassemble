/**
 * 截图墙插件 ScreenShotPlugin —— 从 javstore.net 获取长缩略图。
 */
import { featureFlags } from '../core/feature-flags';
import { jsxToString } from '../core/jsx-to-string';
import type { PageType } from '../core/page-context';

import { BasePlugin } from './base-plugin';

import { ScreenLoadingPlaceholder } from '../components/screen/screen-loading-placeholder';
import { ScreenReloading } from '../components/screen/screen-reloading';
import { ScreenShotFallback } from '../components/screen/screen-shot-fallback';
import { ScreenShotImage } from '../components/screen/screen-shot-image';

export class ScreenShotPlugin extends BasePlugin {
    getName(): string {
        return 'ScreenShotPlugin';
    }

    /** 仅在详情页激活（doc/140）。 */
    get pageTypes(): PageType[] {
        return ['detail'];
    }

    async handle(): Promise<void> {
        if (!featureFlags.screenShotPlugin) return;
        this.loadScreenShot().then();
    }

    async loadScreenShot(): Promise<void> {
        if (!window.isDetailPage) return;
        const carNum = this.getPageInfo().carNum as string;
        $('.preview-images .tile-item')
            .first()
            .before(
                jsxToString(<ScreenLoadingPlaceholder maxHeight="215px" />)
            );
        try {
            const imgUrl = await this.getScreenshot(carNum);
            this.addImg('缩略图', imgUrl);
            clog.log('加载缩略图:', imgUrl);
        } catch (e) {
            this.showErrorFallback(carNum, e);
        }
    }

    async getScreenshot(carNum: string): Promise<string | null> {
        let cacheData: Record<string, string> = {};
        try {
            const cached = localStorage.getItem('jhs_screenShot');
            if (cached) cacheData = JSON.parse(cached);
        } catch { /* 缓存损坏，回退空对象 */ }
        if (cacheData[carNum]) {
            clog.debug('缓存中存在缩略图:', carNum, cacheData[carNum]);
            return cacheData[carNum];
        }
        let imgUrl: string | null = null;
        try {
            imgUrl = await this.getJavStoreScreenShot(carNum);
        } catch (e) {
            clog.error('获取缩略图资源失败:', imgUrl, e);
            throw e;
        }
        if (!imgUrl) {
            this.showErrorFallback(carNum, null);
            return null;
        }
        const httpsIndex = imgUrl.indexOf('https://');
        if (httpsIndex !== -1) {
            imgUrl = imgUrl.substring(httpsIndex);
        }
        cacheData[carNum] = imgUrl;
        clog.log('缩略图获取成功:', imgUrl);
        localStorage.setItem('jhs_screenShot', JSON.stringify(cacheData));
        return imgUrl;
    }

    async getJavStoreScreenShot(carNum: string): Promise<string | null> {
        const url = `https://javstore.net/search?q=${carNum.toLowerCase().replace('fc2-', '')}`;
        clog.log('正在解析缩略图:', url);
        const html = await gmHttp.get(url);
        const $dom = utils.htmlTo$dom(String(html));
        const tempCarNum = carNum
            .toLowerCase()
            .replace(/fc2-(ppv-)?/g, '')
            .replace(/-/g, '');
        let detailPageUrl: string | null = null;
        const $itemList = $dom.find('main .grid a');
        for (let i = 0; i < $itemList.length; i++) {
            const href = $($itemList[i]).attr('href') || '';
            if (
                href
                    .toLowerCase()
                    .replace(/fc2-(ppv-)?/g, '')
                    .replace(/-/g, '')
                    .includes(tempCarNum)
            ) {
                detailPageUrl = new URL(href, 'https://javstore.net').href;
                break;
            }
        }
        if (!detailPageUrl) {
            clog.error('JavStore, 查询番号失败:', url);
            return null;
        }
        const detailPageHtml = await gmHttp.get(detailPageUrl);
        const $detailPageDom = utils.htmlTo$dom(String(detailPageHtml));
        const imgUrl =
            $detailPageDom.find("a:contains('CLICK HERE')").attr('href') ||
            $detailPageDom.find("img[src*='_s.jpg']").attr('src');
        if (!imgUrl) {
            clog.error('JavStore, 解析预览图失败:', url);
            return null;
        }
        return String(imgUrl).replace('.th', '');
    }

    addImg(title: string, imgUrl: string | null): void {
        if (imgUrl) {
            $('.screen-container').html(
                jsxToString(<ScreenShotImage src={imgUrl} alt={title} />)
            );
            $('.screen-container').on('click', (event: Event) => {
                event.stopPropagation();
                event.preventDefault();
                window.showImageViewer(event.currentTarget as Element);
            });
        }
    }

    showErrorFallback(carNum: string, error: unknown): void {
        clog.error(
            '获取缩略图失败:',
            error instanceof Error ? error.message.substring(0, 100) : String(error)
        );
        $('.screen-container')
            .html(jsxToString(<ScreenShotFallback carNum={carNum} />))
            .off('click', '.retry-link')
            .off('click', '.check-link')
            .on('click', '.retry-link', async (e: Event) => {
                e.stopPropagation();
                e.preventDefault();
                $('.screen-container').html(jsxToString(<ScreenReloading />));
                try {
                    const imgUrl = await this.getScreenshot(carNum);
                    this.addImg('缩略图', imgUrl);
                } catch (err) {
                    this.showErrorFallback(carNum, err);
                }
            })
            .on('click', '.check-link', async (e: Event) => {
                e.stopPropagation();
                e.preventDefault();
                window.open(`https://javstore.net/search?q=${carNum}`, '_blank');
            });
    }
}
