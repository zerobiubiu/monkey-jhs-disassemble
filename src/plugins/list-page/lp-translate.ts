/**
 * 列表页标题翻译功能模块。
 * 从 list-page-plugin.tsx 提取，逻辑与原实现一致。
 *
 * 含 translate（JavDb 列表项标题就地翻译，带 localStorage["jhs_translate"]
 * 番号→译文缓存 + 串行写入队列）与 revertTranslation（还原译文为原文）。
 * 文本节点替换统一委托 lp-dom.replaceTitleTextNodes（D1）。
 * 翻译缓存（cache）与写入队列（writeQueue）保留为插件实例字段，经 plugin 透传。
 */
import { isJavdbSite } from '../../constants/site';
import { YES } from '../../constants/status';

import { translateText } from '../../core/util/util-translate';

import type { ListPagePlugin } from '../list-page-plugin';
import { replaceTitleTextNodes } from './lp-dom';

/** 翻译 JavDb 列表项标题为中文（带 localStorage 缓存）。对应原 L8934-8997。 */
export async function translate(plugin: ListPagePlugin, $item: JQuery): Promise<void> {
    // 列表页标题就地替换逻辑保留在本方法；TranslatePlugin 负责详情页
    if ((await storageManager.getSetting('translateTitle', YES)) !== YES) {
        return;
    }
    let sourceText = '';
    let carNum = '';
    const videoTitleEl = $item.find('.video-title');
    if (isJavdbSite) {
        sourceText = videoTitleEl
            .contents()
            .filter(
                (_index: number, node: Node & { textContent: string }) =>
                    node.nodeType === 3 && node.textContent.trim() !== ''
            )
            .text()
            .trim();
        carNum = $item.find('.video-title strong').text().trim();
    }
    if (plugin.cache[carNum]) {
        replaceTitleTextNodes(videoTitleEl, plugin.cache[carNum]);
        videoTitleEl.attr('title', plugin.cache[carNum]);
        return;
    }
    translateText(sourceText)
        .then((translation) => {
            if (isJavdbSite) {
                replaceTitleTextNodes(videoTitleEl, translation, carNum);
                videoTitleEl.attr('title', translation);
            }
            plugin.writeQueue = plugin.writeQueue.then(() => {
                plugin.cache[carNum] = translation;
                localStorage.setItem('jhs_translate', JSON.stringify(plugin.cache));
            });
        })
        .catch((err: unknown) => {
            clog.error('翻译失败:', err);
        });
}

/** 还原翻译后的标题为原文。对应原 L8998-9023。 */
export async function revertTranslation(plugin: ListPagePlugin): Promise<void> {
    $(plugin.getSelector().itemSelector)
        .toArray()
        .forEach((itemEl: HTMLElement) => {
            const $item = $(itemEl);
            const originalTitle =
                $item.find('.box').attr('title') ||
                $item.find('.video-title').attr('title') ||
                $item.find('img').attr('data-title');
            const carNum = $item.find('.video-title strong').text().trim();
            const videoTitleEl = $item.find('.video-title');
            replaceTitleTextNodes(videoTitleEl, originalTitle, carNum);
            videoTitleEl.removeAttr('title');
        });
}
