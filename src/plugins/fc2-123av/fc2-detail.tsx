/**
 * FC2-123Av 详情弹窗与数据获取（提取自 fc2-by-123av-plugin.tsx）。
 *
 * 职责：open123AvFc2Dialog 弹窗 + 按钮绑定、saveAction 收藏操作、
 * loadData 详情渲染、handleLongImg 长图截图、get123AvVideoInfo /
 * getActressInfo / getImgList 数据抓取。
 */
import {
    FAVORITE_ACTION,
    FILTER_ACTION,
    HAS_WATCH_ACTION
} from '../../constants/status';

import { jsxToString } from '../../core/jsx-to-string';

import type { Fc2By123AvPlugin } from '../fc2-by-123av-plugin';

import { Fc2123avDetailDialog } from '../../components/fc2/fc2-123av-detail-dialog';
import { Fc2123avMovieInfo } from '../../components/fc2/fc2-123av-movie-info';
import { MovieError } from '../../components/movie/movie-error';
import { ScreenLoadingPlaceholder } from '../../components/screen/screen-loading-placeholder';

const HAS_DOWN_STATUS = 'hasDown';

/** 打开 123Av FC2 详情弹窗。对应原 open123AvFc2Dialog。 */
export async function open123AvFc2Dialog(plugin: Fc2By123AvPlugin, carNum: string, href: string): Promise<void> {
    const dialogHtml = jsxToString(<Fc2123avDetailDialog />);
    layer.open({
        type: 1,
        title: carNum,
        content: dialogHtml,
        area: utils.getResponsiveArea(['80%', '90%']),
        success: async () => {
            await loadData(plugin, carNum, href);
            handleLongImg(plugin, carNum.replace(/^FC2-/, ''));
            $('#filterBtn').on('click', () =>
                saveAction(plugin, carNum, href, FILTER_ACTION)
            );
            $('#favoriteBtn').on('click', () =>
                saveAction(plugin, carNum, href, FAVORITE_ACTION)
            );
            $('#hasDownBtn').on('click', () =>
                saveAction(plugin, carNum, href, HAS_DOWN_STATUS)
            );
            $('#hasWatchBtn').on('click', () =>
                saveAction(plugin, carNum, href, HAS_WATCH_ACTION)
            );
            $('#magnetSearchBtn').on('click', () => {
                const magnetHub = plugin.getBean('MagnetHubPlugin');
                if (magnetHub) {
                    $('#magnets-content').empty().append(
                        magnetHub.createMagnetHub(carNum)
                    );
                }
            });
        }
    });
}

/** 保存收藏/想看/已下等操作。对应原 saveAction。 */
export async function saveAction(_plugin: Fc2By123AvPlugin, carNum: string, url: string, actionType: string): Promise<void> {
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

/** 加载详情数据并渲染。对应原 loadData。 */
export async function loadData(plugin: Fc2By123AvPlugin, carNum: string, href: string): Promise<void> {
    try {
        const info = await get123AvVideoInfo(plugin, href);
        const fc2Num = carNum.replace(/^FC2-?(PPV-?)?/i, '');
        const actressInfo = await getActressInfo(plugin, fc2Num).catch(() => null);
        const imgList = await getImgList(plugin, fc2Num).catch(() => [] as string[]);
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
        plugin.getBean('TranslatePlugin')?.translate?.(carNum, false)?.then?.();
    } catch (e: unknown) {
        clog.error(e);
        $('.movie-info-container').html(
            jsxToString(<MovieError message={e instanceof Error ? e.message : String(e)} />)
        );
    }
}

/** 长图截图处理。对应原 handleLongImg。 */
export function handleLongImg(plugin: Fc2By123AvPlugin, carNum: string): void {
    utils.loopDetector(
        () => $('.movie-gallery .image-list').length > 0,
        async () => {
            $('.movie-gallery .image-list').prepend(
                jsxToString(<ScreenLoadingPlaceholder maxHeight="150px" />)
            );
            const screenShot = plugin.getBean('ScreenShotPlugin');
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

/** 获取 123Av 视频详情信息。对应原 get123AvVideoInfo。 */
export async function get123AvVideoInfo(plugin: Fc2By123AvPlugin, href: string): Promise<{
    id: string;
    releaseDate: string;
    title: string;
    poster: string;
}> {
    const fullHref = href.startsWith('http')
        ? href
        : (await plugin.getBaseUrl()) + href;
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

/** 获取女优信息（fc2ppvdb）。对应原 getActressInfo。 */
export async function getActressInfo(
    _plugin: Fc2By123AvPlugin,
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

/** 获取预览图列表（fc2 官方）。对应原 getImgList。 */
export async function getImgList(_plugin: Fc2By123AvPlugin, fc2Num: string): Promise<string[]> {
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
