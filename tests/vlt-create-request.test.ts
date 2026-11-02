// @vitest-environment jsdom
/** 新建清单运输复用与批量无 DOM 副作用；仅用请求替身，不访问真实网站。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchPageHtml } from '../src/plugins/setting/jhs-sync/sync-common';
import { createListForVideo, requestCreateList } from '../src/plugins/video-lists-tag/server/vlt-create-request';

vi.mock('../src/plugins/setting/jhs-sync/sync-common', () => ({ fetchPageHtml: vi.fn() }));
const form = '<body><div id="modal-save-list"><form id="new_list"><input name="video_id" value="v1"><input name="authenticity_token" value="test-token"><input name="list[name]" data-list-target="listNewNameInput" value=""><input type="submit" name="commit" value="create"></form></div></body>';
let gm: ReturnType<typeof vi.fn>;

beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '<div id="sentinel">保留当前列表</div>';
    document.head.innerHTML = '';
    gm = vi.fn((request) => { request.onload({ status: 200, responseText: 'toastr.success("ok")' }); return {}; });
    vi.stubGlobal('GM_xmlhttpRequest', gm);
    vi.mocked(fetchPageHtml).mockResolvedValue(form);
});
afterEach(() => vi.unstubAllGlobals());

describe('共享清单创建请求', () => {
    it('表单读取期间请求停止，创建POST尚未发送则返回stopped', async () => {
        const controller = new AbortController();
        vi.mocked(fetchPageHtml).mockImplementationOnce(async () => { controller.abort(); return form; });
        expect(await createListForVideo('待看3', 'v1', controller.signal)).toBe('stopped');
        expect(gm).not.toHaveBeenCalled();
    });

    it('创建POST已发出后请求停止，仍正常处理回执，不中止当前网络', async () => {
        const controller = new AbortController();
        gm.mockImplementationOnce((request) => { controller.abort(); request.onload({ status: 200, responseText: 'toastr.success("ok")' }); return {}; });
        expect(await createListForVideo('待看3', 'v1', controller.signal)).toBe('created');
        expect(gm).toHaveBeenCalledTimes(1);
    });
    it('保留原请求字段、编码、头部和15秒超时', async () => {
        await requestCreateList({ video_id: 'v1', 'list[name]': '待看 3' }, 'token');
        expect(gm).toHaveBeenCalledWith(expect.objectContaining({
            method: 'POST', url: 'https://javdb.com/lists/remote_create', timeout: 15000,
            data: 'video_id=v1&list%5Bname%5D=%E5%BE%85%E7%9C%8B%203',
            headers: expect.objectContaining({ 'X-CSRF-Token': 'token', 'X-Requested-With': 'XMLHttpRequest' })
        }));
    });

    it('从目标视频新鲜详情读取真实表单；成功响应也不执行JS或本地完成态', async () => {
        const before = document.body.innerHTML;
        expect(await createListForVideo('待看3', 'v1')).toBe('created');
        expect(fetchPageHtml).toHaveBeenCalledWith(`${window.location.origin}/v/v1`);
        expect(gm.mock.calls[0][0].url).toBe(`${window.location.origin}/lists/remote_create`);
        expect(gm.mock.calls[0][0].data).toContain('video_id=v1');
        expect(gm.mock.calls[0][0].data).not.toContain('commit=');
        expect(document.body.innerHTML).toBe(before);
        expect(document.querySelector('script')).toBeNull();
    });

    it('登录页、缺表单或影片ID不符时POST尚未发出，返回可重试失败', async () => {
        vi.mocked(fetchPageHtml).mockResolvedValueOnce('<body><form action="/users/sign_in"></form></body>');
        expect(await createListForVideo('待看3', 'v1')).toBe('failed');
        vi.mocked(fetchPageHtml).mockResolvedValueOnce(form.replace('value="v1"', 'value="other"'));
        expect(await createListForVideo('待看3', 'v1')).toBe('failed');
        expect(gm).not.toHaveBeenCalled();
    });

    it('请求超时归unknown防重建；明确拒绝归failed允许相同预写名称重试', async () => {
        gm.mockImplementationOnce((request) => { request.ontimeout(); return {}; });
        expect(await createListForVideo('待看3', 'v1')).toBe('unknown');
        gm.mockImplementationOnce((request) => { request.onload({ status: 200, responseText: 'toastr.error("duplicate")' }); return {}; });
        expect(await createListForVideo('待看3', 'v1')).toBe('failed');
    });
});
