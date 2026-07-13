/**
 * 截图墙插件 ScreenShotPlugin —— 从 javstore.net 获取长缩略图。
 */
import { featureFlags } from '../core/feature-flags';
import { BasePlugin } from './base-plugin';

export class ScreenShotPlugin extends BasePlugin {
    getName(): string {
        return 'ScreenShotPlugin';
    }

    async handle(): Promise<void> {
        if (!featureFlags.screenShotPlugin) return;
        this.loadScreenShot().then();
    }

    async loadScreenShot(): Promise<void> {
        if (!(window as any).isDetailPage) return;
        const carNum = this.getPageInfo().carNum as string;
        $('.preview-images .tile-item')
            .first()
            .before(
                ' <a class="tile-item screen-container" style="overflow:hidden;max-height: 215px;text-align:center;"><div style="margin-top: 50px;color: #000;cursor: auto">正在加载缩略图</div></a> '
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
        const cacheData: Record<string, string> = localStorage.getItem('jhs_screenShot')
            ? JSON.parse(localStorage.getItem('jhs_screenShot') as string)
            : {};
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
        const $dom = utils.htmlTo$dom(html);
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
        const $detailPageDom = utils.htmlTo$dom(detailPageHtml);
        let imgUrl =
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
                `<img src="${imgUrl}" alt="${title}" loading="lazy" style="width: 100%;">`
            );
            $('.screen-container').on('click', (event: any) => {
                event.stopPropagation();
                event.preventDefault();
                (window as any).showImageViewer(event.currentTarget);
            });
        }
    }

    showErrorFallback(carNum: string, error: any): void {
        console.error(
            '获取缩略图失败:',
            error?.message?.substring?.(0, 100) ?? error
        );
        const differentCss = 'margin-top: 50px';
        $('.screen-container')
            .html(
                `<div style="${differentCss}; cursor:auto;color:#000;">获取缩略图失败</div><br/><a href='#' class='retry-link'>点击重试</a> 或 <a class="check-link" href='https://javstore.net/search?q=${carNum}' target='_blank'>前往确认</a>`
            )
            .off('click', '.retry-link')
            .off('click', '.check-link')
            .on('click', '.retry-link', async (e: any) => {
                e.stopPropagation();
                e.preventDefault();
                $('.screen-container').html(
                    `<div style="${differentCss};cursor:auto;color:#000;">正在重新加载...</div>`
                );
                try {
                    const imgUrl = await this.getScreenshot(carNum);
                    this.addImg('缩略图', imgUrl);
                } catch (err) {
                    this.showErrorFallback(carNum, err);
                }
            })
            .on('click', '.check-link', async (e: any) => {
                e.stopPropagation();
                e.preventDefault();
                window.open(`https://javstore.net/search?q=${carNum}`, '_blank');
            });
    }
}
