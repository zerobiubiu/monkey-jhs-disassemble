/**
 * 截图墙插件 ScreenShotPlugin —— 从 javstore.net 获取长缩略图。
 */
import { featureFlags } from '../core/feature-flags';
import { BasePlugin } from './base-plugin';

/** 截图只允许来自 javstore.net（含其 CDN 子域）的 HTTPS 资源。 */
function safeHttpsUrl(value: unknown, base = 'https://javstore.net', host = 'javstore.net'): string | null {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    try {
        const parsed = new URL(raw, base);
        const normalizedHost = host.toLowerCase();
        if (
            parsed.hostname !== normalizedHost &&
            !parsed.hostname.endsWith(`.${normalizedHost}`)
        ) {
            return null;
        }
        // JavStore 当前部分图片仍返回 http://img*.javstore.net；仅对已允许的
        // JavStore 子域升级为 HTTPS，其他协议一律拒绝。
        if (parsed.protocol === 'http:') parsed.protocol = 'https:';
        if (parsed.protocol !== 'https:') return null;
        return parsed.href;
    } catch {
        return null;
    }
}

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
        let cacheData: Record<string, string> = {};
        const rawCache = localStorage.getItem('jhs_screenShot');
        if (rawCache) {
            try {
                const parsedCache: unknown = JSON.parse(rawCache);
                if (parsedCache && typeof parsedCache === 'object' && !Array.isArray(parsedCache)) {
                    cacheData = parsedCache as Record<string, string>;
                }
            } catch {
                // 损坏的旧缓存不应阻断当前页面，直接重新请求截图。
                localStorage.removeItem('jhs_screenShot');
            }
        }
        const cachedUrl = safeHttpsUrl(cacheData[carNum]);
        if (cachedUrl) {
            clog.debug('缓存中存在缩略图:', carNum, cachedUrl);
            return cachedUrl;
        }
        let imgUrl: string | null = null;
        try {
            imgUrl = await this.getJavStoreScreenShot(carNum);
        } catch (e) {
            clog.error('获取缩略图资源失败:', imgUrl, e);
            throw e;
        }
        const safeImgUrl = safeHttpsUrl(imgUrl);
        if (!safeImgUrl) {
            this.showErrorFallback(carNum, null);
            return null;
        }
        cacheData[carNum] = safeImgUrl;
        clog.log('缩略图获取成功:', safeImgUrl);
        localStorage.setItem('jhs_screenShot', JSON.stringify(cacheData));
        return safeImgUrl;
    }

    async getJavStoreScreenShot(carNum: string): Promise<string | null> {
        const searchUrl = new URL('https://javstore.net/search');
        searchUrl.searchParams.set('q', carNum.toLowerCase().replace('fc2-', ''));
        const url = searchUrl.href;
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
                detailPageUrl = safeHttpsUrl(href, 'https://javstore.net', 'javstore.net');
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
        return safeHttpsUrl(String(imgUrl).replace('.th', ''), detailPageUrl);
    }

    addImg(title: string, imgUrl: string | null): void {
        const safeImgUrl = safeHttpsUrl(imgUrl);
        if (!safeImgUrl) return;

        $('.screen-container').each((_index: number, element: HTMLElement) => {
            while (element.firstChild) element.removeChild(element.firstChild);
            const image = document.createElement('img');
            image.src = safeImgUrl;
            image.alt = title;
            image.loading = 'lazy';
            image.style.width = '100%';
            element.appendChild(image);
        });
        $('.screen-container')
            .off('click.jhsScreenShot')
            .on('click.jhsScreenShot', (event: any) => {
                event.stopPropagation();
                event.preventDefault();
                (window as any).showImageViewer(event.currentTarget);
            });
    }

    showErrorFallback(carNum: string, error: any): void {
        console.error(
            '获取缩略图失败:',
            error?.message?.substring?.(0, 100) ?? error
        );
        const differentCss = 'margin-top: 50px';
        const searchUrl = new URL('https://javstore.net/search');
        searchUrl.searchParams.set('q', carNum);
        $('.screen-container').each((_index: number, element: HTMLElement) => {
            while (element.firstChild) element.removeChild(element.firstChild);
            const message = document.createElement('div');
            message.style.cssText = `${differentCss}; cursor:auto;color:#000;`;
            message.textContent = '获取缩略图失败';
            const lineBreak = document.createElement('br');
            const retryLink = document.createElement('a');
            retryLink.href = '#';
            retryLink.className = 'retry-link';
            retryLink.textContent = '点击重试';
            const separator = document.createTextNode(' 或 ');
            const checkLink = document.createElement('a');
            checkLink.href = searchUrl.href;
            checkLink.className = 'check-link';
            checkLink.target = '_blank';
            checkLink.rel = 'noopener noreferrer';
            checkLink.textContent = '前往确认';
            element.append(message, lineBreak, retryLink, separator, checkLink);
        });
        $('.screen-container')
            .off('click.jhsScreenShot', '.retry-link')
            .off('click.jhsScreenShot', '.check-link')
            .on('click.jhsScreenShot', '.retry-link', async (e: any) => {
                e.stopPropagation();
                e.preventDefault();
                $('.screen-container').each((_index: number, element: HTMLElement) => {
                    while (element.firstChild) element.removeChild(element.firstChild);
                    const message = document.createElement('div');
                    message.style.cssText = `${differentCss};cursor:auto;color:#000;`;
                    message.textContent = '正在重新加载...';
                    element.appendChild(message);
                });
                try {
                    const imgUrl = await this.getScreenshot(carNum);
                    this.addImg('缩略图', imgUrl);
                } catch (err) {
                    this.showErrorFallback(carNum, err);
                }
            })
            .on('click.jhsScreenShot', '.check-link', async (e: any) => {
                e.stopPropagation();
                e.preventDefault();
                window.open(searchUrl.href, '_blank', 'noopener,noreferrer');
            });
    }
}
