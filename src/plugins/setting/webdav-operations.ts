/**
 * WebDAV 备份操作（提取自 SettingPlugin）。
 *
 * 包含凭据校验、数据备份、备份文件列表查看与文件列表弹层
 * （Tabulator 表格，含删除/下载/导入操作）。
 * 5 处 loading()+try/finally 已统一替换为 withLoading。
 */
import { createElement } from 'react';

import { withLoading } from '../../core/util/util-async';
import { isBackupV2, decryptBackupV2 } from '../../core/backup-crypto';
import { stripBackupExtras, applyBackupExtras } from '../../core/backup-extra-storage';
import { jsxToString } from '../../core/jsx-to-string';
import type { WebDavClient, WebDavFileItem } from '../../core/webdav';

import type { SettingPlugin } from '../setting-plugin';
import {
    GM_KEY_WEBDAV_URL,
    GM_KEY_WEBDAV_USERNAME,
    GM_KEY_WEBDAV_PASSWORD,
    GM_KEY_BACKUP_PASSWORD
} from './setting-keys';
import { buildBackupPayload } from './data-import-export';

import { BackupFileDialog } from '../../components/dialogs/backup-file-dialog';
import { BackupActionCell } from '../../components/misc/backup-action-cell';

/** WebDAV 凭据（校验通过后返回）。 */
interface WebDavCredentials {
    url: string;
    username: string;
    password: string;
}

/**
 * 读取并校验 WebDAV 凭据（优先输入框，回退 GM 存储）。
 * 任一字段为空时显示对应 error toast 并返回 null。
 * 合并原 backupDataByWebDav / backupListBtnByWebDav 中 3 处相同的校验块。
 */
export function getWebDavCredentials(): WebDavCredentials | null {
    const url = ($('#webDavUrl').val() as string) || GM_getValue(GM_KEY_WEBDAV_URL, '');
    const username = ($('#webDavUsername').val() as string) || GM_getValue(GM_KEY_WEBDAV_USERNAME, '');
    const password = ($('#webDavPassword').val() as string) || GM_getValue(GM_KEY_WEBDAV_PASSWORD, '');
    if (!url) {
        show.error('请填写webDav服务地址并保存后, 再试此功能');
        return null;
    }
    if (!username) {
        show.error('请填写webDav用户名并保存后, 再试此功能');
        return null;
    }
    if (!password) {
        show.error('请填写webDav密码并保存后, 再试此功能');
        return null;
    }
    return { url, username, password };
}

/**
 * 仅从 GM 存储读取 WebDAV 凭据（无输入框、无 toast）。
 * 供 autoBackup 静默场景使用：未配置时返回 null，不打扰用户。
 */
export function getWebDavCredentialsFromGm(): WebDavCredentials | null {
    const url = GM_getValue(GM_KEY_WEBDAV_URL, '');
    if (!url) return null;
    const username = GM_getValue(GM_KEY_WEBDAV_USERNAME, '');
    const password = GM_getValue(GM_KEY_WEBDAV_PASSWORD, '');
    if (!username || !password) return null;
    return { url, username, password };
}

/** 通过 WebDav 备份数据（明文上传）。对应原 L10292-10323。 */
export async function backupDataByWebDav(plugin: SettingPlugin): Promise<void> {
    const creds = getWebDavCredentials();
    if (!creds) return;
    const settings = await storageManager.getSetting();
    const fileName = utils.getNowStr('_', '_') + '.json';
    const exportText = JSON.stringify(await buildBackupPayload(settings));
    try {
        await withLoading(async () => {
            const webdavClient = new window.WebDavClient(creds.url, creds.username, creds.password);
            await webdavClient.backup(plugin.folderName, fileName, exportText);
            show.ok('备份完成');
        });
    } catch (err: unknown) {
        console.error(err);
        show.error(String(err));
    }
}

/** 通过 WebDav 查看备份文件列表。对应原 L10324-10352。 */
export async function backupListBtnByWebDav(plugin: SettingPlugin): Promise<void> {
    const creds = getWebDavCredentials();
    if (!creds) return;
    try {
        await withLoading(async () => {
            const webdavClient = new window.WebDavClient(creds.url, creds.username, creds.password);
            const backupList = await webdavClient.getBackupList(plugin.folderName);
            openFileListDialog(plugin, backupList, webdavClient, 'WebDav');
        });
    } catch (err: unknown) {
        console.error(err);
        show.error(`发生错误: ${err instanceof Error ? err.message : String(err)}`);
    }
}

/** Tabulator 行数据（备份文件列表项）。 */
interface BackupFileRow {
    name: string;
    size: number;
    createTime: string;
    fileId: string;
}

/** Tabulator 单元格最小接口（全局 Tabulator 无类型声明）。 */
interface TabulatorCell {
    getData(): BackupFileRow;
    getElement(): HTMLElement;
}

/** 打开备份文件列表弹层（Tabulator 表格，含删除/下载/导入操作）。对应原 L10353-10552。 */
export function openFileListDialog(
    plugin: SettingPlugin,
    backupList: WebDavFileItem[],
    webdavClient: WebDavClient,
    titlePrefix: string
): void {
    layer.open({
        type: 1,
        title: titlePrefix + '备份文件',
        content: jsxToString(createElement(BackupFileDialog)),
        area: ['800px', '70%'],
        anim: -1,
        success: () => {
            const table = new Tabulator('#table-container', {
                layout: 'fitColumns',
                placeholder: '暂无数据',
                virtualDom: true,
                data: backupList,
                responsiveLayout: 'collapse',
                responsiveLayoutCollapse: true,
                columnDefaults: {
                    headerHozAlign: 'center',
                    hozAlign: 'center'
                },
                columns: [
                    {
                        title: '文件名',
                        field: 'name',
                        width: 200,
                        headerSort: false,
                        responsive: 0
                    },
                    {
                        title: '文件大小',
                        field: 'size',
                        responsive: 1,
                        headerSort: false,
                        formatter: (cell: TabulatorCell) => {
                            const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
                            let unitIndex = 0;
                            let size = cell.getData().size;
                            while (size >= 1024 && unitIndex < units.length - 1) {
                                size /= 1024;
                                unitIndex++;
                            }
                            return `${size % 1 == 0 ? size.toFixed(0) : size.toFixed(2)} ${units[unitIndex]}`;
                        }
                    },
                    {
                        title: '备份日期',
                        field: 'createTime',
                        responsive: 2,
                        headerSort: false,
                        formatter: (cell: TabulatorCell) => {
                            const data = cell.getData();
                            // 原实现将 ISO 日期串传入 getNowStr 的 number 形参，运行时
                            // 经 new Date(string) 解析为备份创建时间；空串则回退当前时间。
                            // 此处先转毫秒时间戳以满足 number 形参，行为与原脚本一致。
                            return `${utils.getNowStr('-', ':', new Date(data.createTime).getTime())}`;
                        }
                    },
                    {
                        title: '操作',
                        minWidth: 250,
                        responsive: 0,
                        headerSort: false,
                        formatter: (
                            cell: TabulatorCell,
                            _params: unknown,
                            onRendered: (cb: () => void) => void
                        ) => {
                            const rowData = cell.getData();
                            onRendered(() => {
                                const $dangerBtn = cell.getElement().querySelector('.a-danger');
                                const $primaryBtn = cell.getElement().querySelector('.a-primary');
                                const $successBtn = cell.getElement().querySelector('.a-success');
                                if ($dangerBtn) {
                                    $dangerBtn.addEventListener('click', () => {
                                        layer.confirm(
                                            `是否删除 ${rowData.name} ?`,
                                            {
                                                icon: 3,
                                                title: '提示',
                                                btn: ['确定', '取消']
                                            },
                                            async (layerIndex: number) => {
                                                layer.close(layerIndex);
                                                try {
                                                    await withLoading(async () => {
                                                        await webdavClient.deleteFile(rowData.fileId);
                                                        const newList = await webdavClient.getBackupList(
                                                            plugin.folderName
                                                        );
                                                        table.replaceData(newList);
                                                        layer.alert('删除成功');
                                                    });
                                                } catch (err: unknown) {
                                                    console.error(err);
                                                    show.error(
                                                        `发生错误: ${err instanceof Error ? err.message : String(err)}`
                                                    );
                                                }
                                            }
                                        );
                                    });
                                }
                                if ($primaryBtn) {
                                    $primaryBtn.addEventListener('click', async () => {
                                        try {
                                            await withLoading(async () => {
                                                const fileContent = await webdavClient.getFileContent(
                                                    rowData.fileId
                                                );
                                                const backupPassword = GM_getValue(
                                                    GM_KEY_BACKUP_PASSWORD,
                                                    ''
                                                );
                                                let decrypted: string;
                                                if (isBackupV2(fileContent)) {
                                                    if (!backupPassword) {
                                                        show.error('该备份使用 V2 加密，请先设置备份口令');
                                                        return;
                                                    }
                                                    decrypted = await decryptBackupV2(
                                                        fileContent,
                                                        backupPassword
                                                    );
                                                } else {
                                                    // V1 兼容：旧 Caesar 格式
                                                    decrypted = window.decryptCredential(fileContent);
                                                }
                                                utils.download(decrypted, rowData.name);
                                            });
                                        } catch (err: unknown) {
                                            clog.error(err);
                                            show.error(
                                                '下载失败: ' +
                                                    (err instanceof Error ? err.message : String(err))
                                            );
                                        }
                                    });
                                }
                                if ($successBtn) {
                                    $successBtn.addEventListener('click', () => {
                                        layer.confirm(
                                            `是否将该云备份数据 ${rowData.name} 导入?`,
                                            {
                                                icon: 3,
                                                title: '提示',
                                                btn: ['确定', '取消']
                                            },
                                            async (layerIndex: number) => {
                                                layer.close(layerIndex);
                                                try {
                                                    await withLoading(async () => {
                                                        let fileContent =
                                                            await webdavClient.getFileContent(
                                                                rowData.fileId
                                                            );
                                                        show.info('解密文件内容...');
                                                        const backupPassword = GM_getValue(
                                                            GM_KEY_BACKUP_PASSWORD,
                                                            ''
                                                        );
                                                        if (isBackupV2(fileContent)) {
                                                            if (!backupPassword) {
                                                                show.error(
                                                                    '该备份使用 V2 加密，请先设置备份口令'
                                                                );
                                                                return;
                                                            }
                                                            fileContent = await decryptBackupV2(
                                                                fileContent,
                                                                backupPassword
                                                            );
                                                        } else {
                                                            // V1 兼容：旧 Caesar 格式
                                                            fileContent =
                                                                window.decryptCredential(fileContent);
                                                        }
                                                        show.info('解密完成, 开始导入...');
                                                        const parsedData = JSON.parse(fileContent);
                                                        const extras = stripBackupExtras(parsedData);
                                                        await storageManager.importData(parsedData);
                                                        applyBackupExtras(extras);
                                                        show.ok('导入成功!');
                                                        window.location.reload();
                                                    });
                                                } catch (err: unknown) {
                                                    console.error(err);
                                                    show.error(String(err));
                                                }
                                            }
                                        );
                                    });
                                }
                            });
                            return jsxToString(createElement(BackupActionCell));
                        }
                    }
                ],
                locale: 'zh-cn',
                langs: {
                    'zh-cn': {
                        pagination: {
                            first: '首页',
                            first_title: '首页',
                            last: '尾页',
                            last_title: '尾页',
                            prev: '上一页',
                            prev_title: '上一页',
                            next: '下一页',
                            next_title: '下一页',
                            all: '所有',
                            page_size: '每页行数'
                        }
                    }
                }
            });
        }
    });
}
