/**
 * 数据导入/导出操作（提取自 SettingPlugin）。
 *
 * 包含本地 JSON 文件导入/导出、备份 payload 构造，以及
 * VLT 收藏清单 / MissAV 车号状态的导入/导出/同步按钮处理函数。
 */

import { encryptBackupV2, decryptBackupV2, isBackupV2 } from '../../core/backup-crypto';
import {
    collectLocalStorageBackup,
    collectGmStorageBackup,
    stripBackupExtras,
    applyBackupExtras
} from '../../core/backup-extra-storage';
import { getCredentialId, DEFAULT_AUTO_BACKUP_CONFIG } from '../../core/auto-backup';

import { GM_KEY_BACKUP_PASSWORD } from './setting-keys';
import { GM_KEY_CAR_STATUS_DATA } from '../car-status-sync/car-status-config';
import {
    toColumnar,
    gzipToBase64,
    countColumnar,
    columnarToFlat,
    buildJavdbUrl
} from '../car-status-sync/car-status-columnar';
import { importLocalDB, exportLocalDB } from '../car-status-sync/car-status-db';
import { VltDb, type MigrationData } from '../video-lists-tag/vlt-db';
import { showToast } from '../video-lists-tag/vlt-toast';

import type { SettingPlugin } from '../setting-plugin';

/**
 * 触发浏览器下载 JSON 内容（Blob + createObjectURL + anchor）。
 * 与 utils.download 不同：不显示"开始请求下载"toast，与原内联导出行为一致。
 * @param content  JSON 字符串内容
 * @param filename 下载文件名
 */
export function downloadJson(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
}

/**
 * 构造备份 payload：IndexedDB 全量 + 元信息 + localStorage 长期缓存/偏好 + GM 清单数据。
 * 含 __localStorage / __gmStorage，导入时由 applyBackupExtras 写回后剥离，
 * 避免 importData 误写入 forage。
 */
export async function buildBackupPayload(
    settings: Record<string, unknown>
): Promise<Record<string, unknown>> {
    const exportData = await storageManager.exportData();
    exportData.__meta = {
        credentialId: getCredentialId(),
        autoBackupConfig: settings.autoBackupConfig || DEFAULT_AUTO_BACKUP_CONFIG,
        backupTime: utils.getNowStr('_', '_')
    };
    exportData.__localStorage = collectLocalStorageBackup();
    exportData.__gmStorage = collectGmStorageBackup();
    return exportData;
}

/** 从本地 JSON 文件导入数据（覆盖确认 + reload）。对应原 L10245-10291。 */
export function importData(_plugin: SettingPlugin): void {
    try {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.onchange = (event: Event) => {
            const input = event.target as HTMLInputElement;
            const file = input.files?.[0];
            if (!file) {
                return;
            }
            const reader = new FileReader();
            reader.onload = async (loadEvent: ProgressEvent<FileReader>) => {
                try {
                    let fileContent = String(loadEvent.target?.result ?? '');
                    // V2 加密备份检测与解密
                    if (isBackupV2(fileContent)) {
                        const backupPassword = GM_getValue(GM_KEY_BACKUP_PASSWORD, '');
                        if (!backupPassword) {
                            show.error('该备份使用 V2 加密，请先在备份面板设置备份口令');
                            return;
                        }
                        try {
                            fileContent = await decryptBackupV2(fileContent, backupPassword);
                        } catch {
                            show.error('备份口令错误或文件已损坏');
                            return;
                        }
                    }
                    const parsedData = JSON.parse(fileContent);
                    layer.confirm(
                        '确定是否要覆盖导入？',
                        {
                            icon: 3,
                            title: '确认覆盖',
                            btn: ['确定', '取消']
                        },
                        async (layerIndex: number) => {
                            const extras = stripBackupExtras(parsedData);
                            await storageManager.importData(parsedData);
                            applyBackupExtras(extras);
                            show.ok('数据导入成功');
                            layer.close(layerIndex);
                            location.reload();
                        }
                    );
                } catch (err: unknown) {
                    console.error(err);
                    show.error(
                        '导入失败：文件内容不是有效的JSON格式 ' +
                            (err instanceof Error ? err.message : String(err))
                    );
                }
            };
            reader.onerror = () => {
                show.error('读取文件时出错');
            };
            reader.readAsText(file);
        };
        document.body.appendChild(fileInput);
        fileInput.click();
        setTimeout(() => document.body.removeChild(fileInput), 1000);
    } catch (err: unknown) {
        console.error(err);
        show.error('导入数据时出错: ' + (err instanceof Error ? err.message : String(err)));
    }
}

/** 导出本地 JSON 数据文件（含访问记录等 __localStorage，与 WebDav 备份一致）。 */
export async function exportData(_plugin: SettingPlugin): Promise<void> {
    try {
        const settings = await storageManager.getSetting();
        const backupPassword = GM_getValue(GM_KEY_BACKUP_PASSWORD, '');
        let exportText: string;
        if (backupPassword) {
            exportText = await encryptBackupV2(
                JSON.stringify(await buildBackupPayload(settings)),
                backupPassword
            );
        } else {
            exportText = JSON.stringify(await buildBackupPayload(settings));
        }
        const fileName = `${utils.getNowStr('_', '_')}.json`;
        utils.download(exportText, fileName);
        show.ok('数据导出成功');
    } catch (err: unknown) {
        console.error(err);
        show.error('导出数据时出错: ' + (err instanceof Error ? err.message : String(err)));
    }
}

// ===== VLT 收藏清单导入/导出 =====

/** #vlt-import-btn 点击：触发隐藏文件选择框。 */
export function handleVltImportClick(): void {
    $('#vlt-file-input').trigger('click');
}

/** #vlt-file-input change：读取文件并导入 VLT 数据。 */
export async function handleVltFileChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const $status = $('#vlt-status');
    $status.text('⏳ 导入中...').css('color', '#0d6efd');
    try {
        const text = await file.text();
        const data: MigrationData = JSON.parse(text);
        const stats = await VltDb.importData(data);
        $status
            .html(
                `✓ 导入完成：${stats.movies} 部影片, ${stats.inventory} 个清单, ${stats.movieInventory} 条关联`
            )
            .css('color', '#198754');
        showToast(
            `✓ 导入完成：${stats.movies} 部影片, ${stats.inventory} 个清单, ${stats.movieInventory} 条关联`,
            'success'
        );
        setTimeout(() => window.location.reload(), 1500);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        $status.text(`✗ 导入失败：${msg}`).css('color', '#dc3545');
        showToast(`✗ 导入失败：${msg}`, 'error');
    }
    input.value = '';
}

/** #vlt-export-btn 点击：导出 VLT 数据为 JSON 文件。 */
export async function handleVltExportClick(): Promise<void> {
    const $status = $('#vlt-status');
    $status.text('⏳ 导出中...').css('color', '#0d6efd');
    try {
        const data = await VltDb.exportData();
        const json = JSON.stringify(data, null, 2);
        downloadJson(json, `vlt-export-${new Date().toISOString().split('T')[0]}.json`);
        $status
            .html(
                `✓ 导出完成：${Object.keys(data.movies).length} 部影片, ${Object.keys(data.inventory).length} 个清单, ${Object.keys(data.movieInventory).length} 条关联`
            )
            .css('color', '#198754');
        showToast('✓ 导出完成', 'success');
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        $status.text(`✗ 导出失败：${msg}`).css('color', '#dc3545');
        showToast(`✗ 导出失败：${msg}`, 'error');
    }
}

// ===== MissAV 车号状态同步/导入/导出 =====

/** #missav-sync-btn 点击：将 car_list 列存压缩后推送到 GM 存储。 */
export async function handleMissavSync(): Promise<void> {
    const $status = $('#missav-status');
    $status.text('⏳ 同步中...').css('color', '#0d6efd');
    try {
        const carList = await storageManager.getCarList();
        if (carList.length === 0) {
            $status.text('✗ car_list 为空').css('color', '#dc3545');
            return;
        }
        const colRes = toColumnar(carList);
        const count = countColumnar(colRes.byStatus);
        const base64 = await gzipToBase64(colRes.byStatus);
        if (!base64) {
            $status.text('✗ 压缩失败').css('color', '#dc3545');
            return;
        }
        const payload = {
            data: base64,
            hwm: new Date().toISOString(),
            count,
            ts: Date.now()
        };
        GM_setValue(GM_KEY_CAR_STATUS_DATA, payload);
        $status.html(`✓ 同步完成：${count} 条记录已推送到 GM 存储`).css('color', '#198754');
        showToast(`✓ 同步完成：${count} 条`, 'success');
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        $status.text(`✗ 同步失败：${msg}`).css('color', '#dc3545');
        showToast(`✗ 同步失败：${msg}`, 'error');
    }
}

/** #missav-import-btn 点击：触发隐藏文件选择框。 */
export function handleMissavImportClick(): void {
    $('#missav-file-input').trigger('click');
}

/** #missav-file-input change：读取文件并导入 MissAV 车号状态。 */
export async function handleMissavFileChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const $status = $('#missav-status');
    $status.text('⏳ 导入中...').css('color', '#0d6efd');
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        // 兼容后端服务器导出格式（列存 groups）和 missav 本地导出格式（行式 records）
        let records: Array<{ carNum: string; status: string; url: string }>;
        if (Array.isArray(data)) {
            // 行式格式 [{carNum, status, url}]
            records = data;
        } else if (data.records && Array.isArray(data.records)) {
            records = data.records;
        } else {
            // 列存格式（后端导出）：转为行式，并将 url_path 转换为完整 url
            const flat = columnarToFlat(data);
            records = flat.map((r) => ({
                carNum: r.carNum,
                status: r.status,
                url: buildJavdbUrl(r.url_path)
            }));
        }
        const written = await importLocalDB(records);
        $status.html(`✓ 导入完成：${written} 条记录`).css('color', '#198754');
        showToast(`✓ 导入完成：${written} 条`, 'success');
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        $status.text(`✗ 导入失败：${msg}`).css('color', '#dc3545');
        showToast(`✗ 导入失败：${msg}`, 'error');
    }
    input.value = '';
}

/** #missav-export-btn 点击：导出 MissAV 车号状态为 JSON 文件。 */
export async function handleMissavExportClick(): Promise<void> {
    const $status = $('#missav-status');
    $status.text('⏳ 导出中...').css('color', '#0d6efd');
    try {
        const records = await exportLocalDB();
        const json = JSON.stringify(records, null, 2);
        downloadJson(json, `missav-status-${new Date().toISOString().split('T')[0]}.json`);
        $status.html(`✓ 导出完成：${records.length} 条记录`).css('color', '#198754');
        showToast('✓ 导出完成', 'success');
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        $status.text(`✗ 导出失败：${msg}`).css('color', '#dc3545');
        showToast(`✗ 导出失败：${msg}`, 'error');
    }
}
