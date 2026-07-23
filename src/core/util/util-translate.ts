/**
 * Google 翻译工具函数（提取自 list-page-plugin / translate-plugin 的重复实现）。
 *
 * 调用 translate-pa.googleapis.com 接口将文本译为目标语言，
 * 内置 10s AbortController 超时保护，避免请求永久挂起。
 */

/**
 * 调用 Google 翻译接口将文本译为目标语言。
 * @param text 待翻译文本
 * @param sourceLang 源语言代码，默认 ja
 * @param targetLang 目标语言代码，默认 zh-CN
 * @returns 翻译结果字符串
 */
export async function translateText(
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
