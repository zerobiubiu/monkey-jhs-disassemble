// @vitest-environment jsdom
/** 备份三个入口的接线回归（doc/56）：解码器真实执行，网络、存储、刷新均用替身。 */
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { encryptBackupV2 } from '../../src/core/backup-crypto';
import { applyBackupExtras } from '../../src/core/backup-extra-storage';
import { decryptCredential, encryptCredential } from '../../src/core/webdav-crypto';
import type { SettingPlugin } from '../../src/plugins/setting-plugin';
import type { BackupProvider } from '../../src/plugins/setting/backup-provider';
import { importData } from '../../src/plugins/setting/data-import-export';
import { openFileListDialog } from '../../src/plugins/setting/webdav-operations';

vi.mock('../../src/plugins/car-status-sync/car-status-publish', () => ({ publishFullSnapshot: vi.fn() }));
vi.mock('../../src/plugins/car-status-sync/car-status-columnar', () => ({ columnarToFlat: vi.fn(), buildJavdbUrl: vi.fn() }));
vi.mock('../../src/plugins/car-status-sync/car-status-db', () => ({ importLocalDB: vi.fn(), exportLocalDB: vi.fn() }));
vi.mock('../../src/plugins/video-lists-tag/vlt-db', () => ({ VltDb: {} }));
vi.mock('../../src/plugins/video-lists-tag/vlt-toast', () => ({ showToast: vi.fn() }));
vi.mock('../../src/core/backup-extra-storage', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return { ...actual, applyBackupExtras: vi.fn(async () => undefined) };
});

const payload = {
    car_list: [{ carNum: 'TEST-001', score: 4 }],
    __localStorage: { jhs_visit_history: '{"test":1}' },
    __gmStorage: { jhs_lrs_state: '{"test":2}' },
    __persistentData: { visitHistory: { test: 3 } }
};
const plain = JSON.stringify(payload);
const metadata = JSON.stringify({
    name: 'auto_1.json', type: 'file', path: 'bk/auto_1.json', sha: 'a'.repeat(40),
    size: 28445950, content: '', encoding: 'none'
});
const plugin = { folderName: 'bk' } as SettingPlugin;
const row = { name: 'auto_1.json', fileId: 'auto_1.json', size: 28445950, createTime: '' };
const storage = { importData: vi.fn(async (_data: Record<string, unknown>) => undefined) };
const showMock = { error: vi.fn(), ok: vi.fn(), info: vi.fn() };
const reload = vi.fn();
const download = vi.fn();
const layerMock = {
    open: vi.fn(), confirm: vi.fn(), close: vi.fn(), alert: vi.fn()
};
let readers: Array<{ onload: ((event: ProgressEvent<FileReader>) => Promise<void>) | null }>;

beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    readers = [];
    document.body.innerHTML = '';
    storage.importData.mockResolvedValue(undefined);
    vi.stubGlobal('crypto', webcrypto);
    vi.stubGlobal('GM_getValue', vi.fn(() => 'test-password'));
    vi.stubGlobal('storageManager', storage);
    vi.stubGlobal('show', showMock);
    vi.stubGlobal('clog', { error: vi.fn() });
    vi.stubGlobal('utils', { download });
    vi.stubGlobal('loading', () => ({ close: vi.fn() }));
    // 不在测试中触发 jsdom 导航，更不接触真实页面。
    vi.stubGlobal('location', { reload });
    vi.stubGlobal('window', { location: { reload } });
    vi.stubGlobal('layer', layerMock);
    vi.stubGlobal('FileReader', class {
        onload = null;
        constructor() { readers.push(this); }
        readAsText() {}
    });
    layerMock.open.mockImplementation((options: { content: string; success: () => void }) => {
        document.body.innerHTML = options.content;
        options.success();
    });
    vi.stubGlobal('Tabulator', class {
        constructor(selector: string, options: {
            columns: Array<{ formatter?: (cell: unknown, params: unknown, onRendered: (cb: () => void) => void) => string }>;
        }) {
            const cell = document.createElement('div');
            let rendered = () => {};
            const formatter = options.columns[options.columns.length - 1].formatter!;
            cell.innerHTML = formatter({ getData: () => row, getElement: () => cell }, {}, (cb) => { rendered = cb; });
            document.querySelector(selector)!.append(cell);
            rendered();
        }
    });
});

afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
});

async function encode(format: string): Promise<string> {
    if (format === 'V1') return encryptCredential(plain);
    if (format === 'V2') return encryptBackupV2(plain, 'test-password');
    return plain;
}

async function readLocal(text: string): Promise<void> {
    importData(plugin);
    const input = document.querySelector<HTMLInputElement>('input[type=file]')!;
    Object.defineProperty(input, 'files', { value: [new File([''], 'backup.json')] });
    input.dispatchEvent(new Event('change'));
    await readers[0].onload!({ target: { result: text } } as ProgressEvent<FileReader>);
}

function openCloud(text: string): void {
    const provider: BackupProvider = {
        backup: vi.fn(), getBackupList: vi.fn(), deleteFile: vi.fn(),
        getFileContent: vi.fn(async () => text)
    };
    openFileListDialog(plugin, [row], provider, 'Git');
}

async function confirmImport(): Promise<void> {
    const callback = layerMock.confirm.mock.calls[0][2] as (index: number) => Promise<void>;
    await callback(1);
}

function expectRestored(): void {
    expect(storage.importData).toHaveBeenCalledExactlyOnceWith({ car_list: payload.car_list });
    expect(applyBackupExtras).toHaveBeenCalledExactlyOnceWith({
        ls: payload.__localStorage, gm: payload.__gmStorage, persistent: payload.__persistentData
    });
    expect(layerMock.alert).toHaveBeenCalledWith(expect.stringMatching(/恢复并校验成功/), expect.any(Object), expect.any(Function));
    expect(reload).not.toHaveBeenCalled();
    (layerMock.alert.mock.calls[0][2] as (index: number) => void)(2);
    expect(reload).toHaveBeenCalledOnce();
    expect(showMock.error).not.toHaveBeenCalled();
}

describe('本地备份导入', () => {
    it.each(['明文', 'V1', 'V2'])('%s：确认前不写库，确认后恢复正文和附加存储', async (format) => {
        await readLocal(await encode(format));
        expect(layerMock.confirm).toHaveBeenCalledOnce();
        expect(storage.importData).not.toHaveBeenCalled();
        expect(applyBackupExtras).not.toHaveBeenCalled();
        await confirmImport();
        expectRestored();
    });

    it.each([metadata, decryptCredential(metadata)])('元数据或旧错误下载文件：不弹覆盖确认、不写库', async (text) => {
        await readLocal(text);
        expect(layerMock.confirm).not.toHaveBeenCalled();
        expect(storage.importData).not.toHaveBeenCalled();
        expect(applyBackupExtras).not.toHaveBeenCalled();
        expect(showMock.error).toHaveBeenCalledWith(expect.stringMatching(/重新下载/));
    });

    it('主存储失败时不写附加存储、不刷新', async () => {
        storage.importData.mockRejectedValueOnce(new Error('存储不可用'));
        await readLocal(plain);
        await confirmImport();
        expect(applyBackupExtras).not.toHaveBeenCalled();
        expect(reload).not.toHaveBeenCalled();
        expect(showMock.error).toHaveBeenCalledWith(expect.stringContaining('存储不可用'));
        expect(layerMock.alert).not.toHaveBeenCalled();
    });
});

describe('云端备份导入与下载', () => {
    it.each(['明文', 'V1', 'V2'])('%s：下载返回可再次导入的真实 JSON，不二次解密明文', async (format) => {
        openCloud(await encode(format));
        document.querySelector<HTMLElement>('.a-primary')!.click();
        await vi.waitFor(() => expect(download).toHaveBeenCalledExactlyOnceWith(plain, row.name));
        expect(storage.importData).not.toHaveBeenCalled();
        expect(showMock.error).not.toHaveBeenCalled();
    });

    it.each(['明文', 'V1', 'V2'])('%s：云端确认后恢复正文与附加存储', async (format) => {
        openCloud(await encode(format));
        document.querySelector<HTMLElement>('.a-success')!.click();
        expect(storage.importData).not.toHaveBeenCalled();
        await confirmImport();
        expectRestored();
    });

    it.each(['.a-primary', '.a-success'])('只拿到元数据时，%s 不下载、不写库', async (selector) => {
        openCloud(metadata);
        document.querySelector<HTMLElement>(selector)!.click();
        if (selector === '.a-success') await confirmImport();
        await vi.waitFor(() => expect(showMock.error).toHaveBeenCalledWith(expect.stringMatching(/Git.*元数据/)));
        expect(download).not.toHaveBeenCalled();
        expect(storage.importData).not.toHaveBeenCalled();
        expect(applyBackupExtras).not.toHaveBeenCalled();
        expect(reload).not.toHaveBeenCalled();
    });

    it('云端主存储失败时不写附加存储、不刷新', async () => {
        storage.importData.mockRejectedValueOnce(new Error('存储不可用'));
        openCloud(plain);
        document.querySelector<HTMLElement>('.a-success')!.click();
        await confirmImport();
        expect(applyBackupExtras).not.toHaveBeenCalled();
        expect(reload).not.toHaveBeenCalled();
        expect(showMock.error).toHaveBeenCalledWith(expect.stringContaining('存储不可用'));
        expect(layerMock.alert).not.toHaveBeenCalled();
    });


    it('附加存储失败时不显示成功或刷新', async () => {
        vi.mocked(applyBackupExtras).mockRejectedValueOnce(new Error('附加存储校验失败'));
        openCloud(plain);
        document.querySelector<HTMLElement>('.a-success')!.click();
        await confirmImport();
        expect(layerMock.alert).not.toHaveBeenCalled();
        expect(reload).not.toHaveBeenCalled();
        expect(showMock.error).toHaveBeenCalledWith(expect.stringContaining('附加存储校验失败'));
    });
});
