// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchPageHtml, postWantToWatch, postWatched } from '../src/plugins/setting/jhs-sync/sync-common';

beforeEach(() => {
    vi.useFakeTimers();
    document.head.innerHTML = '<meta name="csrf-token" content="test-token">';
});
afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('站点评价请求的确认边界', () => {
    it('有效响应可以正常读取，GET 禁用浏览器缓存', async () => {
        const fetchStub = vi.fn(async () => new Response('<div>有效页面</div>'));
        vi.stubGlobal('fetch', fetchStub);
        expect(await fetchPageHtml('/v/A')).toContain('有效页面');
        expect(fetchStub).toHaveBeenCalledWith('/v/A', expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal) }));
    });

    it('登录重定向即使 HTTP 200 也不能确认成功', async () => {
        const response = new Response('<form>login</form>');
        Object.defineProperty(response, 'url', { value: 'https://example.test/users/sign_in' });
        vi.stubGlobal('fetch', vi.fn(async () => response));
        await expect(postWantToWatch('A')).rejects.toThrow('登录已失效');
    });

    it('挑战页即使 HTTP 200 也不能确认成功', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response('<title>Just a moment...</title>')));
        await expect(postWatched('A', 3)).rejects.toThrow('验证拦截');
    });

    it('请求超过15秒会终止而非无限阻塞', async () => {
        vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
            options.signal?.addEventListener('abort', () => reject(new Error('请求已超时')));
        })));
        const request = fetchPageHtml('/v/A');
        const assertion = expect(request).rejects.toThrow('请求已超时');
        await vi.advanceTimersByTimeAsync(15_000);
        await assertion;
    });
});
