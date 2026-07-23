/**
 * 列表页 DOM 解析与事件绑定功能模块。
 * 从 list-page-plugin.tsx 提取，逻辑与原实现一致。
 *
 * 含 findCarNumAndHref（番号/链接/标题提取）、replaceHdImg（高清封面替换）、
 * showCarNumBox（取消单卡片隐藏）、bindClick（卡片点击/视频播放/标题点击委托），
 * 以及共享辅助 replaceTitleTextNodes（D1：合并三处重复的标题文本节点替换逻辑）。
 */
import { isJavdbSite } from '../../constants/site';
import { YES } from '../../constants/status';

import { failWithToast } from '../../core/toast';

import type { ListPagePlugin } from '../list-page-plugin';

/**
 * 替换 .video-title 下的文本节点内容（D1：合并三处重复逻辑）。
 * 仅处理 nodeType===3 且 trim 后非空的文本节点；excludeCarNum 非空时
 * 跳过 textContent 含该番号的节点（避免覆盖 <strong> 内的番号文本）。
 * @param $videoTitle jQuery 化的 .video-title 元素
 * @param newText 替换后的文本（两侧补空格，与原实现一致）
 * @param excludeCarNum 需排除的番号（节点文本含此番号时不替换）
 */
export function replaceTitleTextNodes(
    $videoTitle: JQuery,
    newText: string,
    excludeCarNum?: string
): void {
    $videoTitle.contents().each((_index: number, node: Node & { textContent: string }) => {
        if (
            node.nodeType === 3 &&
            node.textContent.trim() !== '' &&
            (excludeCarNum === undefined || !node.textContent.includes(excludeCarNum))
        ) {
            node.textContent = ' ' + newText + ' ';
        }
    });
}

/**
 * 从 .item 卡片提取番号、链接、标题、发行时间。carNum 为空时抛错。
 * 对应原 L8821-8873。
 * @param $item jQuery 化的 .item 元素
 * @returns 番号信息（carNum/aHref/url/title/publishTime）
 */
export function findCarNumAndHref($item: JQuery): {
    carNum: string;
    aHref: string;
    url: string;
    title: string;
    publishTime: string;
} {
    let carNum: string | undefined;
    let title: string | undefined;
    let publishTime: string | undefined;
    const linkEl = $item.find('a');
    const aHref = linkEl.attr('href');
    const videoTitleEl = $item.find('.video-title');
    if (videoTitleEl.length > 0) {
        const strongEl = videoTitleEl.find('strong');
        if (strongEl.length > 0) {
            carNum = strongEl.text().trim();
        }
        title = linkEl.attr('title')
            ? linkEl.attr('title').trim()
            : carNum
              ? videoTitleEl.text().replace(carNum, '').trim()
              : videoTitleEl.text().trim();
        publishTime = $item.find('.meta').text().trim();
    }
    if (!carNum) {
        const imgEl = $item.find('img');
        if (aHref && imgEl.length > 0) {
            title = imgEl.attr('title')?.trim() || imgEl.attr('data-title')?.trim();
        }
        const isDate = (val: string) => /^\d{4}-\d{1,2}-\d{1,2}$/.test(val);
        publishTime = $item
            .find('date')
            .map((_index: number, el: HTMLElement) => $(el).text().trim())
            .get()
            .find(isDate);
        carNum = $item
            .find('date')
            .map((_index: number, el: HTMLElement) => $(el).text().trim())
            .get()
            .find((val: string) => !isDate(val));
    }
    if (!carNum) {
        failWithToast('提取番号信息失败');
    }
    return {
        carNum,
        aHref: aHref || '',
        url: aHref || '',
        title: title || '',
        publishTime: publishTime || ''
    };
}

/**
 * 替换列表封面缩略图为高清图。对应原 L8886-8933。
 * @param plugin ListPagePlugin 实例（取封面选择器）
 * @param imgEls 可选的图片元素集合（jQuery 或 NodeList），缺省取封面选择器
 */
export function replaceHdImg(plugin: ListPagePlugin, imgEls?: JQuery): void {
    if (imgEls && typeof imgEls.jquery == 'string') {
        imgEls = imgEls.toArray();
    }
    imgEls ||= document.querySelectorAll(plugin.getSelector().coverImgSelector);
    if (isJavdbSite) {
        imgEls.forEach((img: HTMLImageElement) => {
            img.src = img.src.replace('thumbs', 'covers');
            img.title = '';
        });
    }

}

/** 显示被隐藏的指定番号卡片（取消 data-hide）。对应原 L8874-8885。 */
export function showCarNumBox(carNum: string): void {
    const matchedEl = $('.movie-list .item')
        .toArray()
        .find((itemEl: HTMLElement) => $(itemEl).find('.video-title strong').text() === carNum);
    if (matchedEl) {
        const $matched = $(matchedEl);
        if ($matched.attr('data-hide') === `${carNum}-hide`) {
            $matched.show();
            $matched.removeAttr('data-hide');
        }
    }
}

/**
 * 绑定列表项点击/视频播放/标题点击。对应原 L8634-8711。
 *
 * 点击委托选择器使用 `.item .cover` 而非原始脚本的 `.item img`：
 * JavDB 封面图使用 `loading="lazy"` 原生懒加载，图片未加载时
 * `<img>` 无尺寸（object-fit:cover 无效），用户实际点中 `.cover`
 * div 而非 `<img>`，导致 `.item img` 不匹配、走 JavDB 原生 `<a>`
 * 跳转。`.cover` 有 CSS min-height/padding-top 撑开面积，始终可点击；
 * 且 `<img>` 在 `.cover` 内，点击 `<img>` 时事件冒泡也能匹配
 * `.item .cover`。
 */
export async function bindClick(plugin: ListPagePlugin): Promise<void> {
    const selectorConfig = plugin.getSelector();
    $(selectorConfig.boxSelector).on('click', '.item .cover', async (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        if ($(event.target).closest('div.meta-buttons').length) {
            return;
        }
        const $item = $(event.target).closest('.item');
        const { carNum, aHref } = plugin.findCarNumAndHref($item);
        const dialogOpenDetail = await storageManager.getSetting('dialogOpenDetail', YES);
        if (carNum.includes('FC2-')) {
            const movieId = plugin.parseMovieId(aHref);
            plugin.getBean('Fc2Plugin')?.openFc2Dialog(movieId, carNum, aHref);
        } else if (dialogOpenDetail === YES) {
            utils.openPage(aHref, carNum, true, event);
        } else {
            window.open(aHref);
        }
    });
    $(selectorConfig.boxSelector).on('click', '.item video', async (event: Event) => {
        const videoEl = event.currentTarget as HTMLVideoElement;
        if (videoEl.paused) {
            videoEl.play().catch((err: unknown) => clog.error('播放失败:', err));
        } else {
            videoEl.pause();
        }
        event.preventDefault();
        event.stopPropagation();
    });
    $(selectorConfig.boxSelector).on('click', '.item .video-title', async (event: MouseEvent) => {
        if ($(event.target).closest('[class^="jhs-match-"]').length) {
            return;
        }
        const $item = $(event.currentTarget).closest('.item');
        const { carNum, aHref } = plugin.findCarNumAndHref($item);
        if (carNum.includes('FC2-')) {
            event.preventDefault();
            const movieId = plugin.parseMovieId(aHref);
            plugin.getBean('Fc2Plugin')?.openFc2Dialog(movieId, carNum, aHref);
        }
    });
}
