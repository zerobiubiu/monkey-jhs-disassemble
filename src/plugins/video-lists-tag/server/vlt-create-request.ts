/** 原生与批量新建清单共用请求；批量路径不执行返回脚本，也不提前提交本地关联。 */
import { getCsrfTokenWithFormFallback } from '../../../core/util/site/csrf';

import { fetchPageHtml } from '../../setting/jhs-sync/sync-common';

export function requestCreateList(
    formData: Record<string, string>, csrfToken: string, origin = 'https://javdb.com'
): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        GM_xmlhttpRequest({
            method: 'POST', url: new URL('/lists/remote_create', origin).href,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                Accept: 'text/javascript, application/javascript, application/ecmascript, application/x-ecmascript, */*;q=0.01',
                'X-CSRF-Token': csrfToken, 'X-Requested-With': 'XMLHttpRequest'
            },
            data: Object.entries(formData).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&'),
            timeout: 15000,
            onload: (response) => response.status >= 200 && response.status < 300
                ? resolve(response.responseText || '')
                : reject(new Error(`HTTP ${response.status}: ${response.responseText?.slice(0, 200) || ''}`)),
            onerror: () => reject(new Error('网络错误')),
            ontimeout: () => reject(new Error('请求超时'))
        });
    });
}

/** 返回值只决定是否允许再次尝试创建；最终成功必须由调用方完整目录回查证明。 */
export async function createListForVideo(
    listName: string, videoId: string, signal?: AbortSignal
): Promise<'created' | 'failed' | 'unknown' | 'stopped'> {
    if (signal?.aborted) return 'stopped';
    let fields: Record<string, string>;
    let csrfToken: string;
    try {
        const html = await fetchPageHtml(new URL(`/v/${encodeURIComponent(videoId)}`, window.location.origin).href);
        if (signal?.aborted) return 'stopped';
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const form = doc.querySelector<HTMLFormElement>('#new_list');
        const name = doc.querySelector<HTMLInputElement>('input[data-list-target="listNewNameInput"]');
        if (!form || !name?.name || /<form[^>]*action=["'][^"']*sign_in/i.test(html)) return 'failed';
        fields = {};
        for (const field of Array.from(form.querySelectorAll<HTMLInputElement>('input, textarea, select'))) {
            if (field.name && !['submit', 'button', 'reset'].includes(field.type)) fields[field.name] = field.value;
        }
        if (fields.video_id !== videoId) return 'failed';
        fields[name.name] = listName;
        csrfToken = getCsrfTokenWithFormFallback(fields);
        if (!csrfToken) return 'failed';
    } catch {
        return signal?.aborted ? 'stopped' : 'failed'; // 创建 POST 尚未发出，可安全重试同一预写名称。
    }
    if (signal?.aborted) return 'stopped';
    try {
        const response = await requestCreateList(fields, csrfToken, window.location.origin);
        if (/\btoastr\s*(?:\.\s*error|\[\s*['"]error['"]\s*\])\s*\(/i.test(response)) return 'failed';
        return /\btoastr\s*(?:\.\s*success|\[\s*['"]success['"]\s*\])\s*\(/i.test(response) ? 'created' : 'unknown';
    } catch {
        return 'unknown'; // 请求可能已经生效，恢复时只能回查，不能重复创建。
    }
}
