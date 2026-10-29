/** 真实 Chrome/IndexedDB 的备份恢复验收页，仅在独立临时浏览器配置内运行。 */
import localforage from 'localforage';

const gm = new Map<string, unknown>();
const reports: string[] = [];
const errors: string[] = [];
let confirmAction: (() => Promise<void>) | undefined;
let reportAction: (() => void) | undefined;
let reloads = 0;
let loseGm = false;
let payloadText = '';
const finish = (result: unknown) => { Object.assign(globalThis, { __restoreResult: result }); };
Object.assign(globalThis, {
    localforage, unsafeWindow: globalThis,
    GM_getValue: (key: string, fallback: unknown) => key === 'backupPassword' ? 'probe-password' : gm.has(key) ? structuredClone(gm.get(key)) : fallback,
    GM_setValue: (key: string, value: unknown) => { if (!loseGm) gm.set(key, structuredClone(value)); },
    GM_xmlhttpRequest: () => { throw new Error('验收页禁止请求远端'); },
    clog: { log() {}, warn() {}, debug() {}, error() {} },
    show: { ok() {}, info() {}, error: (text: string) => errors.push(text) },
    loading: () => ({ close() {} }),
    utils: { copyObj: structuredClone, deepFreeze: (value: unknown) => value },
    __testReload: () => { reloads++; },
    layer: {
        open(options: { content: string; success: () => void }) {
            document.querySelector('#fixture')?.remove();
            const root = document.createElement('div'); root.id = 'fixture'; root.innerHTML = options.content;
            document.body.append(root); options.success();
        },
        confirm(_text: string, _options: unknown, yes: (index: number) => Promise<void>) { confirmAction = () => yes(1); },
        alert(text: string, _options: unknown, yes: (index: number) => void) { reports.push(text); reportAction = () => yes(2); },
        close() {}
    },
    Tabulator: class {
        constructor(selector: string, options: { columns: Array<{ formatter?: Function }> }) {
            const body = document.createElement('div'); body.id = 'tabulator-table-body';
            const row = document.createElement('div'); body.append(row);
            for (let i = 0; i < 6; i++) row.append(document.createElement('div'));
            const cell = document.createElement('div'); row.append(cell);
            let rendered = () => {};
            cell.innerHTML = options.columns[options.columns.length - 1].formatter!({
                getData: () => ({ name: 'synthetic.json', fileId: 'synthetic.json' }), getElement: () => cell
            }, {}, (fn: () => void) => { rendered = fn; });
            document.querySelector(selector)!.append(body); rendered();
        }
    }
});
const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };

try {
    const { StorageManager } = await import('../../src/core/storage-manager');
    const { openFileListDialog } = await import('../../src/plugins/setting/webdav-operations');
    const { importData } = await import('../../src/plugins/setting/data-import-export');
    const { encryptBackupV2 } = await import('../../src/core/backup-crypto');
    const { encryptCredential } = await import('../../src/core/webdav-crypto');
    const { backupValuesEqual } = await import('../../src/core/storage/backup-restore');
    const { persistentDataStore } = await import('../../src/core/storage/persistent-data-store');
    const { IndexedDbBackend } = await import('../../src/core/storage/persistent-data-backend');
    const { GM_KEY_BACKUP_PASSWORD } = await import('../../src/plugins/setting/setting-keys');
    const getGm = globalThis.GM_getValue;
    Object.assign(globalThis, { GM_getValue: (key: string, fallback: unknown) =>
        key === GM_KEY_BACKUP_PASSWORD ? 'probe-password' : getGm(key, fallback) });
    await persistentDataStore.initialize(); persistentDataStore.activate();
    const main = localforage.createInstance({ driver: localforage.INDEXEDDB, name: 'JAV-JHS', storeName: 'appData' });
    await main.ready();
    const manager = new StorageManager(main);
    Object.assign(globalThis, { storageManager: manager });
    const originalSet = main.setItem.bind(main);
    const cases = [
        { name: '云端明文多键', via: 'cloud', format: 'plain' },
        { name: '云端旧格式多键', via: 'cloud', format: 'V1' },
        { name: '云端 AES 多键', via: 'cloud', format: 'V2' },
        { name: '本地多键', via: 'local', format: 'plain' },
        { name: '主库静默丢写', via: 'cloud', format: 'plain', loseMain: true },
        { name: 'GM 静默丢写', via: 'cloud', format: 'plain', loseGm: true },
        { name: '28.4MB 完整恢复', via: 'cloud', format: 'plain', large: true }
    ];
    const results = [];
    for (const scenario of cases) {
        main.setItem = originalSet;
        await main.clear();
        const old = { __jhs_schema_version: 6, car_list: [{ carNum: 'OLD-001' }], setting: { old: true } };
        for (const [key, value] of Object.entries(old)) await main.setItem(key, value);
        localStorage.clear(); gm.clear(); reports.length = 0; errors.length = 0; reloads = 0;
        confirmAction = undefined; reportAction = undefined; loseGm = !!scenario.loseGm;
        const payload: Record<string, unknown> = {
            __jhs_schema_version: 6, __meta: { backupTime: 'probe' },
            car_list: [{ carNum: 'NEW-001', score: 5, status: '已读' }],
            blacklist: [{ starId: 'actor-1' }], favorite_actresses: [{ starId: 'favorite-1' }],
            setting: { restored: true },
            __localStorage: { jhs_sortMethod: 'score', jhs_visit_history: '{"stale":1}' },
            __gmStorage: { 'jdb:list-rating': { list1: 5 } },
            __persistentData: { visitHistory: { '/v/probe': 123 } }
        };
        if (scenario.large) {
            payload.large_cache = '';
            const overhead = new TextEncoder().encode(JSON.stringify(payload)).length;
            payload.large_cache = 'x'.repeat(28445950 - overhead);
        }
        const plain = JSON.stringify(payload);
        payloadText = scenario.format === 'V1' ? encryptCredential(plain)
            : scenario.format === 'V2' ? await encryptBackupV2(plain, 'probe-password') : plain;
        if (scenario.loseMain) {
            main.setItem = ((key: string, value: unknown) => key === 'blacklist'
                ? Promise.resolve(value) : originalSet(key, value)) as typeof main.setItem;
        }
        if (scenario.via === 'local') {
            importData({} as never);
            const input = document.querySelector<HTMLInputElement>('input[type=file]')!;
            const transfer = new DataTransfer(); transfer.items.add(new File([payloadText], 'probe.json'));
            input.files = transfer.files; input.dispatchEvent(new Event('change'));
            for (let i = 0; !confirmAction && !errors.length && i < 100; i++) await new Promise((resolve) => setTimeout(resolve, 20));
        } else {
            openFileListDialog({ folderName: 'probe' } as never, [], {
                getFileContent: async () => payloadText, getBackupList: async () => [],
                backup: async () => {}, deleteFile: async () => {}
            }, '隔离验收');
            document.querySelector<HTMLElement>('#tabulator-table-body > div:nth-child(1) > div:nth-child(7) > a.a-success')!.click();
        }
        assert(confirmAction, '入口没有触发覆盖确认');
        await confirmAction!();
        assert(reloads === 0, '结果确认前不应立即刷新');
        if (scenario.loseMain || scenario.loseGm) {
            assert(reports.length === 0 && errors.length === 1, '失败不能报告成功');
            if (scenario.loseMain) assert(backupValuesEqual(await manager.exportData(), old), '主数据校验失败应补偿旧值');
            results.push({ name: scenario.name, passed: true, successReport: false, error: errors[0] });
            continue;
        }
        const expected = Object.fromEntries(Object.entries(payload).filter(([key]) => !['__localStorage', '__gmStorage', '__persistentData'].includes(key)));
        const actual = await manager.exportData();
        assert(backupValuesEqual(actual, expected), '主库逐键对比失败');
        assert(localStorage.getItem('jhs_sortMethod') === 'score', 'localStorage 未恢复');
        assert(backupValuesEqual(gm.get('jdb:list-rating'), { list1: 5 }), 'GM 未恢复');
        const records = await new IndexedDbBackend().loadRecords();
        assert(records.some((record) => record.namespace === 'visitHistory' && record.entryKey === '/v/probe' && record.value === 123), '新连接回读持久数据失败');
        assert(!records.some((record) => record.namespace === 'visitHistory' && record.entryKey === 'stale'), '旧副本不应覆盖新版 namespace');
        assert(reports.length === 1 && reports[0].includes('恢复并校验成功'), '缺少可见的校验成功结果');
        reportAction!(); assert(reloads === 1, '确认结果后才刷新');
        results.push({ name: scenario.name, passed: true, mainKeys: Object.keys(expected).length,
            jsonBytes: new TextEncoder().encode(plain).length, driver: main.driver(), attachmentsVerified: true, reportAcknowledged: true });
    }
    finish({ passed: true, cases: results });
} catch (error) {
    finish({ passed: false, error: String(error), stack: error instanceof Error ? error.stack : '' });
}
