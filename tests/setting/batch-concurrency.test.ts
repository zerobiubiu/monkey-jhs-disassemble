// @vitest-environment jsdom
/** 基础设置使用真实控件与加载/保存流程，存储替身仅隔离用户数据。 */
import $ from 'jquery';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BasePanel } from '../../src/components/setting-panels/base-panel';
import { DEFAULT_BATCH_OPERATION_CONCURRENCY, normalizeBatchOperationConcurrency } from '../../src/constants/batch-operations';
import { jsxToString } from '../../src/core/jsx-to-string';
import type { SettingPlugin } from '../../src/plugins/setting-plugin';
import { loadForm, saveForm } from '../../src/plugins/setting/setting-form-load';

vi.mock('../../src/plugins/setting/cache-management', () => ({ refreshPreloadCacheStats: vi.fn() }));

let persisted: Record<string, unknown>;
const otherSite = {
    getMissAvUrl: vi.fn(async () => 'https://missav.example'),
    getSupJavUrl: vi.fn(async () => 'https://supjav.example'),
    getEnabledSites: vi.fn(() => []),
    saveEnabledSites: vi.fn()
};
const blacklist = { resetBtnTip: vi.fn(), reloadTable: vi.fn() };
const plugin = {
    getBean: (name: string) => name === 'OtherSitePlugin' ? otherSite : name === 'BlacklistPlugin' ? blacklist : undefined,
    addLabelTag: vi.fn(),
    addKeyword: vi.fn()
} as unknown as SettingPlugin;

async function openBasePanel(): Promise<HTMLInputElement> {
    document.body.innerHTML = jsxToString(createElement(BasePanel, {
        panelName: 'base-panel', qualityOptionsHtml: '', isJavdbSite: true
    }));
    await loadForm(plugin);
    return document.querySelector<HTMLInputElement>('#batchOperationConcurrency')!;
}

beforeEach(() => {
    persisted = {};
    vi.stubGlobal('$', $);
    vi.stubGlobal('GM_getValue', (_key: string, fallback: unknown) => fallback);
    vi.stubGlobal('GM_setValue', vi.fn());
    vi.stubGlobal('storageManager', {
        getSetting: vi.fn(async () => structuredClone(persisted)),
        saveSetting: vi.fn(async (settings: Record<string, unknown>) => { persisted = structuredClone(settings); }),
        getTitleFilterKeyword: vi.fn(async () => []),
        saveTitleFilterKeyword: vi.fn()
    });
    vi.stubGlobal('clog', { show: vi.fn(), hide: vi.fn() });
    vi.stubGlobal('show', { ok: vi.fn() });
    vi.stubGlobal('refresh', vi.fn());
});

afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
});

describe('批量操作并发设置', () => {
    it('缺省为2，允许正整数且不设置业务上限；保存并重开后恢复修改值', async () => {
        const input = await openBasePanel();
        expect(input.value).toBe('2');
        expect(input.type).toBe('number');
        expect(input.min).toBe('1');
        expect(input.step).toBe('1');
        expect(input.max).toBe('');
        expect(input.labels?.length).toBe(1);
        input.value = '7';
        await saveForm(plugin);
        expect(persisted.batchOperationConcurrency).toBe(7);
        document.body.innerHTML = '';
        expect((await openBasePanel()).value).toBe('7');
    });

    it.each(['', '0', '-1', '1.5'])('非法输入 %s 保存为默认值，不把小数截断为整数', async (value) => {
        const input = await openBasePanel();
        input.value = value;
        await saveForm(plugin);
        expect(persisted.batchOperationConcurrency).toBe(DEFAULT_BATCH_OPERATION_CONCURRENCY);
        expect((await openBasePanel()).value).toBe('2');
    });

    it('旧设置为非法值时只在表单回填默认值，不在打开时改写存储', async () => {
        persisted.batchOperationConcurrency = 'invalid';
        expect((await openBasePanel()).value).toBe('2');
        expect(persisted.batchOperationConcurrency).toBe('invalid');
        expect(storageManager.saveSetting).not.toHaveBeenCalled();
    });

    it.each([undefined, null, '', 'bad', '2x', 0, -1, 1.5, '1.5', Number.NaN, Number.POSITIVE_INFINITY, true, {}, []])('设置与执行共享校验，非法值 %s 回退默认值', (value) => {
        expect(normalizeBatchOperationConcurrency(value)).toBe(2);
    });

    it.each([[1, 1], [2, 2], [1000, 1000], ['3', 3], [' 4 ', 4]])('设置与执行共享校验，保留有效值 %s', (value, expected) => {
        expect(normalizeBatchOperationConcurrency(value)).toBe(expected);
    });
});
