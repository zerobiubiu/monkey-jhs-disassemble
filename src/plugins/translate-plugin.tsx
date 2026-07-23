/**
 * 标题翻译插件 TranslatePlugin。
 * 独立化自新版 archetype/jhs.3.3.6.027.user.js，覆盖列表页委托 + 详情页自动翻译。
 */
import { YES } from '../constants/status';

import { featureFlags } from '../core/feature-flags';
import { jsxToString } from '../core/jsx-to-string';
import type { PageType } from '../core/page-context';

import { BasePlugin } from './base-plugin';

import { TranslatedTitle } from '../components/misc/translated-title';

import translatePluginCssRaw from '../styles/translate-plugin.css?raw';

async function translateText(
    text: string,
    sourceLang: string = 'ja',
    targetLang: string = 'zh-CN'
): Promise<string> {
    if (!text) {
        throw new Error('翻译文本不能为空');
    }
    const url =
        'https://translate-pa.googleapis.com/v1/translate?' +
        new URLSearchParams({
            'params.client': 'gtx',
            dataTypes: 'TRANSLATION',
            key: 'AIzaSyDLEeFI5OtFBwYBIoK_jj5m32rZK5CkCXA',
            'query.sourceLanguage': sourceLang,
            'query.targetLanguage': targetLang,
            'query.text': text
        });
    // 超时保护：API 无响应时 10s 后中止请求，避免「翻译中...」永久挂起
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
            throw new Error(`${response.status} ${response.statusText}`);
        }
        return (await response.json()).translation;
    } finally {
        clearTimeout(timeoutId);
    }
}

export class TranslatePlugin extends BasePlugin {
    getName(): string {
        return 'TranslatePlugin';
    }

    /** 仅在详情页激活（doc/140）。 */
    get pageTypes(): PageType[] {
        return ['detail'];
    }

    async initCss(): Promise<string> {
        return translatePluginCssRaw;
    }

    async handle(): Promise<void> {
        if (!featureFlags.translatePlugin) return;
        if (window.isDetailPage) {
            this.translate().then();
        }
    }

    /**
     * 翻译标题：详情页注入 .translated-title；列表页可传 carNum 写入缓存。
     * @param carNum 番号（缓存 key）
     * @param showCarNum 是否在译文前显示番号
     */
    async translate(carNum?: string, showCarNum: boolean = true): Promise<void> {
        if ((await storageManager.getSetting('translateTitle', YES)) !== YES) {
            return;
        }
        let $titleElement = $('.origin-title');
        if (!$titleElement.length) $titleElement = $('.current-title');
        if (!$titleElement.length) $titleElement = $('h3');
        // 列表页：若在 .item 上下文，优先 video-title
        if (!$titleElement.length) return;

        const originalText = $titleElement.text().trim();
        if (!originalText) {
            show.error('获取标题失败, 无法进行翻译');
            return;
        }

        // 避免重复注入
        if ($titleElement.next('.translated-title').length) {
            return;
        }

        $titleElement.after(jsxToString(<TranslatedTitle>翻译中...</TranslatedTitle>));
        const $loadingElement = $titleElement.next('.translated-title');
        if (!carNum) {
            try {
                carNum = this.getPageInfo().carNum || '';
            } catch {
                carNum = '';
            }
        }
        const cache: Record<string, string> = localStorage.getItem('jhs_translate')
            ? JSON.parse(localStorage.getItem('jhs_translate') as string)
            : {};
        if (carNum && cache[carNum]) {
            $loadingElement.html(
                showCarNum ? carNum + '&nbsp;&nbsp;&nbsp;' + cache[carNum] : cache[carNum]
            );
            return;
        }
        try {
            const translatedText = await translateText(originalText, 'ja', 'zh-CN');
            $loadingElement.html(
                showCarNum && carNum
                    ? carNum + '&nbsp;&nbsp;&nbsp;' + translatedText
                    : translatedText
            );
            if (carNum) {
                cache[carNum] = translatedText;
                localStorage.setItem('jhs_translate', JSON.stringify(cache));
            }
        } catch (error: unknown) {
            clog.error('翻译失败:', error);
            // 区分超时（AbortError）与其他错误
            const isTimeout = error instanceof DOMException && error.name === 'AbortError';
            const message = isTimeout
                ? '翻译超时，请稍后重试'
                : `翻译失败: ${error instanceof Error ? error.message : String(error)}`;
            $loadingElement.replaceWith(
                jsxToString(<TranslatedTitle error>{message}</TranslatedTitle>)
            );
        }
    }
}
