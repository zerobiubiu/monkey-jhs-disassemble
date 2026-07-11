/**
 * 标题翻译插件 TranslatePlugin。
 * 独立化自新版 archetype/jhs.3.3.6.027.user.js，覆盖列表页委托 + 详情页自动翻译。
 */
import { YES } from '../constants/status';
import { featureFlags } from '../core/feature-flags';
import { BasePlugin } from './base-plugin';

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
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
    }
    return (await response.json()).translation;
}

export class TranslatePlugin extends BasePlugin {
    getName(): string {
        return 'TranslatePlugin';
    }

    async initCss(): Promise<string> {
        return `
            <style>
                .translated-title {
                    margin-top: 8px;
                    padding: 12px;
                    border-radius: 5px;
                    border-left: 4px solid rgb(76, 175, 80);
                    background: linear-gradient(135deg, rgb(255, 255, 255) 0%, rgb(245, 245, 245) 100%);
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);
                    font-size: 20px;
                }
            </style>
        `;
    }

    async handle(): Promise<void> {
        if (!featureFlags.translatePlugin) return;
        if ((window as any).isDetailPage) {
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

        $titleElement.after('<div class="translated-title">翻译中...</div>');
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
        } catch (error: any) {
            console.error('翻译失败:', error);
            $loadingElement.replaceWith(
                `<div class="translated-title" style="color: red;">翻译失败: ${error.message}</div>`
            );
        }
    }
}
