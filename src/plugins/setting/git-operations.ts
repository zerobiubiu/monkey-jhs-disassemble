/**
 * Git 备份操作（doc/217）—— 镜像 webdav-operations 的手动备份 / 列表查看入口。
 *
 * 凭据读写（输入框优先、GM 存储回退，与 WebDav 凭证同等待遇：不进备份）、
 * 客户端构造、手动备份、备份文件列表弹层（复用 openFileListDialog，
 * 面向 BackupProvider 编程，与 WebDav 通道共享 UI）。
 */

import { withLoading } from '../../core/util/util-async';

import type { SettingPlugin } from '../setting-plugin';
import {
    GitBackupClient,
    DEFAULT_GIT_API_URL,
    DEFAULT_GIT_BRANCH
} from './git-backup-client';
import {
    GM_KEY_GIT_API_URL,
    GM_KEY_GIT_REPO,
    GM_KEY_GIT_BRANCH,
    GM_KEY_GIT_TOKEN
} from './setting-keys';
import { buildBackupPayload } from './data-import-export';
import { openFileListDialog } from './webdav-operations';

/** Git 备份凭据（校验通过后返回）。 */
export interface GitCredentials {
    apiUrl: string;
    repo: string;
    branch: string;
    token: string;
}

/** owner/repo 形状校验（字母/数字/下划线/点/连字符，单斜杠分隔）。 */
const GIT_REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/;

/**
 * 读取并校验 Git 凭据（优先输入框，回退 GM 存储）。
 * 仓库 / Token 为空或仓库形状非法时显示 error toast 并返回 null；
 * API 地址 / 分支缺省时回退默认值（GitHub 官方 / main）。
 * @returns 校验通过的凭据；未通过返回 null
 */
export function getGitCredentials(): GitCredentials | null {
    const apiUrl =
        (($('#gitApiUrl').val() as string) || GM_getValue(GM_KEY_GIT_API_URL, '')).trim() ||
        DEFAULT_GIT_API_URL;
    const repo = (($('#gitRepo').val() as string) || GM_getValue(GM_KEY_GIT_REPO, '')).trim();
    const branch =
        (($('#gitBranch').val() as string) || GM_getValue(GM_KEY_GIT_BRANCH, '')).trim() ||
        DEFAULT_GIT_BRANCH;
    const token = ($('#gitToken').val() as string) || GM_getValue(GM_KEY_GIT_TOKEN, '');
    if (!repo) {
        show.error('请填写 Git 仓库（owner/repo）并保存后, 再试此功能');
        return null;
    }
    if (!GIT_REPO_PATTERN.test(repo)) {
        show.error('Git 仓库格式应为 owner/repo');
        return null;
    }
    if (!token) {
        show.error('请填写 Git Token 并保存后, 再试此功能');
        return null;
    }
    return { apiUrl, repo, branch, token };
}

/**
 * 仅从 GM 存储读取 Git 凭据（无输入框、无 toast）。
 * 供 autoBackup 静默场景使用：仓库或 Token 未配置/非法时返回 null，不打扰用户。
 * @returns 可用凭据；未配置返回 null
 */
export function getGitCredentialsFromGm(): GitCredentials | null {
    const repo = GM_getValue(GM_KEY_GIT_REPO, '').trim();
    const token = GM_getValue(GM_KEY_GIT_TOKEN, '');
    if (!repo || !GIT_REPO_PATTERN.test(repo) || !token) return null;
    return {
        apiUrl: GM_getValue(GM_KEY_GIT_API_URL, '').trim() || DEFAULT_GIT_API_URL,
        repo,
        branch: GM_getValue(GM_KEY_GIT_BRANCH, '').trim() || DEFAULT_GIT_BRANCH,
        token
    };
}

/**
 * 由凭据构造 Git 备份客户端。
 * @param creds 校验通过的凭据
 * @returns GitBackupClient 实例
 */
export function buildGitClient(creds: GitCredentials): GitBackupClient {
    return new GitBackupClient(creds);
}

/**
 * 通过 Git 仓库备份数据（明文上传，与 WebDav 一致；建议私有仓库）。
 * 文件名沿用手动备份约定（`YYYY_MM_DD_HH_mm_ss.json`），每次备份产生一个 commit。
 * @param plugin SettingPlugin 实例（提供备份目录名 folderName）
 */
export async function backupDataByGit(plugin: SettingPlugin): Promise<void> {
    const creds = getGitCredentials();
    if (!creds) return;
    const settings = await storageManager.getSetting();
    const fileName = utils.getNowStr('_', '_') + '.json';
    const exportText = JSON.stringify(await buildBackupPayload(settings));
    try {
        await withLoading(async () => {
            const gitClient = buildGitClient(creds);
            await gitClient.backup(plugin.folderName, fileName, exportText);
            show.ok('备份完成');
        });
    } catch (err: unknown) {
        clog.error(err);
        show.error('备份失败: ' + (err instanceof Error ? err.message : String(err)));
    }
}

/**
 * 通过 Git 仓库查看备份文件列表（Tabulator 弹层，含删除/下载/导入操作）。
 * @param plugin SettingPlugin 实例（提供备份目录名 folderName）
 */
export async function backupListBtnByGit(plugin: SettingPlugin): Promise<void> {
    const creds = getGitCredentials();
    if (!creds) return;
    try {
        await withLoading(async () => {
            const gitClient = buildGitClient(creds);
            const backupList = await gitClient.getBackupList(plugin.folderName);
            openFileListDialog(plugin, backupList, gitClient, 'Git');
        });
    } catch (err: unknown) {
        clog.error(err);
        show.error(`发生错误: ${err instanceof Error ? err.message : String(err)}`);
    }
}
