/**
 * Git 备份客户端 GitBackupClient —— 基于 Git 托管平台 Contents API 的备份提供方（doc/217）。
 *
 * 首期实现 GitHub 兼容族（GitHub / GitHub Enterprise / Gitea / Forgejo）：
 * 四者共享 `GET/PUT/DELETE {apiBase}/repos/{owner}/{repo}/contents/{path}` 形状，
 * 仅 API 基址不同（GitHub 官方为 https://api.github.com，自建 Gitea 为
 * https://host/api/v1），也可指向自建反代（注意：勿用公共加速镜像，
 * 带 Token 的请求经第三方等于泄露凭据）。
 *
 * 设计要点（与 WebDavClient 对齐，结构满足 BackupProvider）：
 * - 每次 PUT 即一个 git commit，服务端天然保留历史版本；
 * - 更新已有文件先 GET 取 blob sha 作为乐观锁（与 git non-fast-forward 语义一致）；
 * - 目录是隐式的：路径下无文件时列表 GET 返回 404，按空目录处理（无需 MKCOL）；
 * - 列表项备份日期取该文件最近一次 commit 时间（best-effort，失败回退空串）；
 * - 客户端不做持久化，凭据由调用方从 GM 私有存储读取后注入。
 *
 * 已知限制：
 * - 单文件 >1MB 时先回退 raw 媒体类型；若服务仍返回元数据，则按 SHA 读取同一 API 的 blob。
 *   不追随元数据中的下载 URL，避免把 Token 发送至未配置的主机（Gitee/GitLab 不在范围内）。
 * - 与 WebDav 备份一致明文上传，强烈建议使用私有仓库。
 */

import type { BackupFileItem, BackupProvider } from './backup-provider';

/** Git 平台连接配置。 */
export interface GitBackupConfig {
    /** API 基址（空则默认 https://api.github.com；自建 Gitea/Forgejo 填 https://host/api/v1）。 */
    apiUrl: string;
    /** 仓库标识（owner/repo）。 */
    repo: string;
    /** 目标分支（空则默认 main）。 */
    branch: string;
    /** 个人访问令牌（PAT）。 */
    token: string;
}

/** GitHub 官方 API 基址。 */
export const DEFAULT_GIT_API_URL = 'https://api.github.com';

/** 默认分支名。 */
export const DEFAULT_GIT_BRANCH = 'main';

/** GM_xmlhttpRequest 响应最小字段集（运行时为 GM 完整响应对象）。 */
interface GitHttpResponse {
    status: number;
    statusText: string;
    responseText: string;
}

/** contents 单文件元数据（GET 返回的子集）。 */
interface GitFileMeta {
    type?: string;
    sha: string;
    size: number;
}

/** contents 目录列表项（GET 数组元素子集）。 */
interface GitContentsEntry {
    name: string;
    size: number;
    type: string;
}

/**
 * Git API HTTP 错误（携带状态码，供 404 等分支判定）。
 */
export class GitHttpError extends Error {
    /** HTTP 状态码。 */
    readonly status: number;

    /**
     * @param status        HTTP 状态码
     * @param statusText    HTTP 状态文本
     * @param serverMessage 服务端 JSON message 字段（可空）
     */
    constructor(status: number, statusText: string, serverMessage: string) {
        const base = `请求失败 ${status}: ${statusText}`;
        super(serverMessage ? `${base}（${serverMessage}）` : base);
        this.name = 'GitHttpError';
        this.status = status;
    }
}

/**
 * 从非 2xx 响应体提取服务端 message 字段（非 JSON 时返回空串）。
 * @param responseText 响应体文本
 * @returns 服务端错误描述
 */
function extractServerMessage(responseText: string): string {
    try {
        const parsed = JSON.parse(responseText) as { message?: unknown };
        return typeof parsed.message === 'string' ? parsed.message : '';
    } catch {
        return '';
    }
}

/**
 * UTF-8 文本编码为 base64。
 * 分块构造二进制串，避免大数组一次性展开至 String.fromCharCode 爆栈。
 * @param text 原始文本
 * @returns base64 字符串
 */
export function utf8ToBase64(text: string): string {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
}

/**
 * base64 解码为 UTF-8 文本（兼容 GitHub 响应中的换行分隔 base64）。
 * @param base64 base64 字符串（允许空白字符）
 * @returns 解码后的文本
 */
export function base64ToUtf8(base64: string): string {
    const binary = atob(base64.replace(/\s/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) {
        bytes[index] = binary.charCodeAt(index);
    }
    return new TextDecoder().decode(bytes);
}

/**
 * 拼接 contents API 的路径段（逐段 encodeURIComponent，中文目录名安全）。
 * @param folder   目录名
 * @param filename 文件名（缺省则仅编码目录）
 * @returns `folder` 或 `folder/filename`（各段已百分号编码）
 */
export function buildContentsPath(folder: string, filename?: string): string {
    const parts = [folder];
    if (filename) parts.push(filename);
    return parts.map((part) => encodeURIComponent(part)).join('/');
}

/** Git 备份客户端（GitHub 兼容族：GitHub / GitHub Enterprise / Gitea / Forgejo）。 */
export class GitBackupClient implements BackupProvider {
    /** API 基址（末尾 `/` 自动去除）。 */
    readonly apiUrl: string;
    /** 仓库（owner/repo）。 */
    readonly repo: string;
    /** 目标分支。 */
    readonly branch: string;
    /** 个人访问令牌。 */
    private readonly token: string;
    /** 当前工作目录（getBackupList 设值，getFileContent / deleteFile 沿用）。 */
    folderName: string | null = null;

    constructor(config: GitBackupConfig) {
        const baseUrl = (config.apiUrl || DEFAULT_GIT_API_URL).trim();
        this.apiUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        this.repo = config.repo.trim();
        this.branch = (config.branch || DEFAULT_GIT_BRANCH).trim();
        this.token = config.token;
    }

    /** 构建认证 + 通用请求头。 */
    private buildHeaders(extra: Record<string, string> = {}): Record<string, string> {
        return {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${this.token}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'JavDB-Power-Tools-Backup',
            ...extra
        };
    }

    /**
     * 发起 Git API 请求（统一封装 GET / PUT / DELETE）。
     * @param method       HTTP 方法
     * @param path         `/repos/{owner}/{repo}/...` 起始的路径（含查询参数）
     * @param body         JSON 请求体（序列化后写入 data；缺省不带 body）
     * @param extraHeaders 额外请求头（覆盖同名通用头）
     * @returns 2xx 响应；非 2xx 抛 GitHttpError，网络错误抛 Error
     */
    private sendRequest(
        method: string,
        path: string,
        body?: Record<string, unknown>,
        extraHeaders: Record<string, string> = {}
    ): Promise<GitHttpResponse> {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method,
                url: this.apiUrl + path,
                headers: this.buildHeaders(extraHeaders),
                data: body !== undefined ? JSON.stringify(body) : undefined,
                onload: (response: GitHttpResponse) => {
                    if (response.status >= 200 && response.status < 300) {
                        resolve(response);
                    } else {
                        reject(
                            new GitHttpError(
                                response.status,
                                response.statusText,
                                extractServerMessage(response.responseText)
                            )
                        );
                    }
                },
                onerror: (error: unknown) => {
                    clog.error('请求 Git 备份服务发生错误:', error);
                    reject(new Error('请求 Git 备份服务失败, 请检查网络/代理、API 地址与 Token'));
                }
            });
        });
    }

    /** 构建 contents API 路径（附加 ref 分支参数）。 */
    private contentsPath(folder: string, filename?: string): string {
        return (
            `/repos/${this.repo}/contents/${buildContentsPath(folder, filename)}` +
            `?ref=${encodeURIComponent(this.branch)}`
        );
    }

    /**
     * 获取文件元数据（sha/size）。
     * @param folder   目录名
     * @param filename 文件名
     * @returns 文件存在返回元数据；404 返回 null；其它错误抛出
     */
    private async fetchFileMeta(folder: string, filename: string): Promise<GitFileMeta | null> {
        try {
            const response = await this.sendRequest('GET', this.contentsPath(folder, filename));
            const parsed = JSON.parse(response.responseText) as GitFileMeta;
            if (parsed.type === 'file' && parsed.sha) {
                return parsed;
            }
            throw new Error(`路径 ${folder}/${filename} 不是文件`);
        } catch (error) {
            if (error instanceof GitHttpError && error.status === 404) return null;
            throw error;
        }
    }

    /**
     * 查询文件最近一次 commit 时间（best-effort）。
     * @param folder   目录名
     * @param filename 文件名
     * @returns ISO 时间串；查询失败返回空串（列表日期列回退显示当前时间）
     */
    private async fetchLastCommitDate(folder: string, filename: string): Promise<string> {
        try {
            const path =
                `/repos/${this.repo}/commits?path=${buildContentsPath(folder, filename)}` +
                `&sha=${encodeURIComponent(this.branch)}`;
            const response = await this.sendRequest('GET', path);
            const commits = JSON.parse(response.responseText) as Array<{
                commit?: { committer?: { date?: string }; author?: { date?: string } };
            }>;
            const latest = commits[0];
            return latest?.commit?.committer?.date || latest?.commit?.author?.date || '';
        } catch {
            return '';
        }
    }

    /**
     * 备份文件：存在则更新（携带旧 sha 乐观锁），不存在则创建。
     * 每次写入在服务端产生一个 commit（历史版本天然保留）。
     * @param folder   目录名
     * @param filename 文件名
     * @param content  文本内容
     */
    async backup(folder: string, filename: string, content: string): Promise<void> {
        const meta = await this.fetchFileMeta(folder, filename);
        const body: Record<string, unknown> = {
            message: `jhs-backup: ${filename} ${new Date().toISOString()}`,
            content: utf8ToBase64(content),
            branch: this.branch
        };
        if (meta) body.sha = meta.sha;
        await this.sendRequest('PUT', this.contentsPath(folder, filename), body);
    }

    /**
     * 列出目录下的备份文件（目录不存在按空处理），按文件名倒序。
     * 设内部当前目录，供后续 getFileContent / deleteFile 使用。
     * @param folder 目录名
     * @returns 文件列表（每项 createTime 为最近 commit 时间，查询失败为空串）
     */
    async getBackupList(folder: string): Promise<BackupFileItem[]> {
        this.folderName = folder;
        let entries: GitContentsEntry[];
        try {
            const response = await this.sendRequest('GET', this.contentsPath(folder));
            const parsed: unknown = JSON.parse(response.responseText);
            entries = Array.isArray(parsed) ? (parsed as GitContentsEntry[]) : [];
        } catch (error) {
            if (error instanceof GitHttpError && error.status === 404) return [];
            throw error;
        }
        const files = entries.filter((entry) => entry.type === 'file');
        const items = await Promise.all(
            files.map(async (entry) => ({
                fileId: entry.name,
                name: entry.name,
                size: entry.size,
                createTime: await this.fetchLastCommitDate(folder, entry.name)
            }))
        );
        items.reverse();
        return items;
    }

    /**
     * 读取当前目录下文件的文本内容。
     * 大文件先取 raw；媒体协商被忽略时按原 SHA 取 blob，绝不返回元数据代替正文。
     * @param filename 文件名
     * @returns 文件文本内容
     * @throws 未先调用 getBackupList 设当前目录时抛 Error
     */
    async getFileContent(filename: string): Promise<string> {
        const folder = this.requireFolder();
        const path = this.contentsPath(folder, filename);
        const response = await this.sendRequest('GET', path);
        const parsed = JSON.parse(response.responseText) as {
            content?: string;
            encoding?: string;
            size?: number;
            sha?: string;
        };
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('Git 备份接口未返回文件正文');
        }
        if (typeof parsed.content === 'string' && parsed.content !== '') {
            return parsed.encoding === 'base64' ? base64ToUtf8(parsed.content) : parsed.content;
        }
        if (parsed.size === 0) return '';
        if (typeof parsed.size !== 'number' || !Number.isFinite(parsed.size) || parsed.size < 0) {
            throw new Error('Git 备份接口未返回文件正文或有效的文件大小');
        }
        const rawResponse = await this.sendRequest('GET', path, undefined, {
            Accept: 'application/vnd.github.raw+json'
        });
        let rawData: Record<string, unknown> | null;
        try {
            rawData = JSON.parse(rawResponse.responseText);
        } catch {
            // 旧 Caesar 格式不是 JSON；格式校验交给统一备份解码器。
            return rawResponse.responseText;
        }
        if (!rawData || !(rawData.encoding === 'none' ||
            (rawData.type === 'file' && typeof rawData.path === 'string'))) {
            return rawResponse.responseText;
        }
        if (typeof parsed.sha !== 'string' || !parsed.sha) {
            throw new Error('Git 备份接口只返回元数据且缺少文件 SHA，无法读取正文');
        }
        // 绑定首次元数据的版本；仅使用已配置 API，不访问 download_url/git_url。
        const blobResponse = await this.sendRequest('GET',
            `/repos/${this.repo}/git/blobs/${encodeURIComponent(parsed.sha)}`);
        let blob: { encoding?: unknown; content?: unknown } | null;
        try {
            blob = JSON.parse(blobResponse.responseText);
        } catch {
            throw new Error('Git 备份接口未返回 blob 正文，请检查服务的 Git Blobs API 支持');
        }
        if (!blob || blob.encoding !== 'base64' || typeof blob.content !== 'string' || !blob.content) {
            throw new Error('Git 备份接口未返回 blob 正文，请检查服务的 Git Blobs API 支持');
        }
        return base64ToUtf8(blob.content);
    }

    /**
     * 删除当前目录下的文件（先取 sha 再 DELETE，产生一个删除 commit）。
     * @param filename 文件名
     * @throws 文件不存在（404）或未设当前目录时抛 Error
     */
    async deleteFile(filename: string): Promise<void> {
        const folder = this.requireFolder();
        const meta = await this.fetchFileMeta(folder, filename);
        if (!meta) throw new Error(`文件 ${filename} 不存在或已被删除`);
        await this.sendRequest('DELETE', this.contentsPath(folder, filename), {
            message: `jhs-delete: ${filename} ${new Date().toISOString()}`,
            sha: meta.sha,
            branch: this.branch
        });
    }

    /** 取当前工作目录（须先调用 getBackupList 设值）。 */
    private requireFolder(): string {
        if (!this.folderName) {
            throw new Error('Git 备份目录未初始化（需先调用 getBackupList）');
        }
        return this.folderName;
    }
}
