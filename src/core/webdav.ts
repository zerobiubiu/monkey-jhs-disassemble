/**
 * WebDav 客户端 WebDavClient（提取自 archetype/jhs.user.js L9298-9428，原 class De）
 *
 * 基于 Tampermonkey `GM_xmlhttpRequest` 的 WebDav 客户端，提供目录创建 / 文件上传 /
 * 文件列表 / 文件删除 / 文件读取等备份能力。原脚本将 `new De(davUrl, username, password)`
 * 实例挂载到 `unsafeWindow` 作为全局单例，外部以 `backup / getFileList / deleteFile /
 * getBackupList / getFileContent` 形式调用。本模块仅导出 class WebDavClient，全局实例化与
 * 挂载由 legacy 启动流程负责。
 *
 * 重构说明（JS→TS，行为等价）：
 * - class De → 命名导出 class WebDavClient
 * - 单字母变量语义化：e/t/n/a/i/s/o/r/l/c
 *   → davUrl/username/password/method/path/headers/body/responseText/responses/items/...
 * - 全局 `GM_xmlhttpRequest` 由 src/types/globals.d.ts 声明为 any，本模块直接使用
 * - 原代码即用 `console.log` / `console.error` 输出日志，予以保留（未改走 clog）
 * - Babel 编译产物 `var t; ... (t = x) == null ? undefined : t.textContent` 还原为
 *   ES2020 可选链 `x?.textContent`，逻辑等价
 * - `folderName` 保留 `string | null`，deleteFile / getFileContent 沿用原 `+` 拼接
 *   （调用前由 getBackupList 设值，非空断言 `!` 仅消除类型噪声，运行时行为不变）
 */

/** WebDav 文件列表项（getFileList / getBackupList 返回） */
export interface WebDavFileItem {
    fileId: string;
    name: string;
    size: number;
    createTime: string;
}

/** GM_xmlhttpRequest 响应最小字段集（运行时为 GM 完整响应对象） */
interface WebDavResponse {
    status: number;
    statusText: string;
    responseText: string;
}

/** HTTP 请求头映射 */
type HttpHeaders = Record<string, string>;

import { featureFlags } from './feature-flags';

export class WebDavClient {
    davUrl: string;
    username: string;
    password: string;
    folderName: string | null;

    /**
     * @param davUrl   WebDav 服务根地址（末尾 `/` 缺省时补齐）
     * @param username 用户名
     * @param password 密码
     */
    constructor(davUrl: string, username: string, password: string) {
        this.davUrl = davUrl.endsWith('/') ? davUrl : davUrl + '/';
        this.username = username;
        this.password = password;
        this.folderName = null;
    }

    /** 构建 Basic 认证 + Depth:1 头 */
    _getAuthHeaders(): HttpHeaders {
        return {
            Authorization: `Basic ${btoa(`${this.username}:${this.password}`)}`,
            Depth: '1'
        };
    }

    /**
     * 发起 WebDav 请求（统一封装 MKCOL / PUT / PROPFIND / DELETE / GET）。
     * @param method  HTTP 方法
     * @param path    相对 davUrl 的路径
     * @param headers 额外请求头（与认证头合并）
     * @param body    请求体
     * @returns 2xx 响应；非 2xx 或网络错误时 reject
     */
    _sendRequest(
        method: string,
        path: string,
        headers: HttpHeaders = {},
        body?: string
    ): Promise<WebDavResponse> {
        return new Promise((resolve, reject) => {
            const url = this.davUrl + path;
            const requestHeaders: HttpHeaders = {
                ...this._getAuthHeaders(),
                ...headers
            };
            GM_xmlhttpRequest({
                method,
                url,
                headers: requestHeaders,
                data: body,
                onload: (response: WebDavResponse) => {
                    if (response.status >= 200 && response.status < 300) {
                        resolve(response);
                    } else {
                        console.error(response);
                        reject(new Error(`请求失败 ${response.status}: ${response.statusText}`));
                    }
                },
                onerror: (error: unknown) => {
                    console.error('请求WebDav发生错误:', error);
                    reject(new Error('请求WebDav失败, 请检查服务是否启动, 凭证是否正确'));
                }
            });
        });
    }

    /**
     * PROPFIND Depth:0 检测目录是否存在。
     * @param path 目录路径
     * @returns 存在 true；404 false；其它错误抛出
     */
    async checkFolderExists(path: string): Promise<boolean> {
        try {
            await this._sendRequest('PROPFIND', path, { Depth: '0' });
            return true;
        } catch (error: any) {
            const statusMatch = String(error?.message || '').match(/请求失败 (\d+):/);
            if ((statusMatch ? parseInt(statusMatch[1], 10) : 0) === 404) {
                return false;
            }
            throw error;
        }
    }

    /**
     * 幂等创建目录（flag 开时先检查再 MKCOL；flag 关直接 MKCOL）。
     * @param folderName 目录名
     */
    async createFolder(folderName: string): Promise<void> {
                if (!featureFlags.webdavIdempotentMkdir) {
            await this._sendRequest('MKCOL', folderName);
            return;
        }
        try {
            if (!(await this.checkFolderExists(folderName))) {
                clog.log(`目录 ${folderName} 不存在，正在创建...`);
                await this._sendRequest('MKCOL', folderName, { Depth: '0' });
                clog.log(`目录 ${folderName} 创建成功。`);
            }
        } catch (error) {
            clog.error(`创建目录 ${folderName} 时发生错误:`, error);
            throw error;
        }
    }

    /**
     * 在 folder 目录下备份名为 filename 的文件，内容为 content。
     * 先确保目录存在，再 PUT 写入文件。
     * @param folder   目录名
     * @param filename 文件名
     * @param content  文本内容
     */
    async backup(folder: string, filename: string, content: string): Promise<void> {
        await this.createFolder(folder);
        const path = folder + '/' + filename;
        await this._sendRequest('PUT', path, { 'Content-Type': 'text/plain' }, content);
    }

    /**
     * 列出 folder 目录下的文件（跳过首项目录自身，过滤 size=0 的目录项），按时间倒序。
     * @param folder 目录名
     * @returns 文件列表，每项含 fileId / name / size / createTime
     */
    async getFileList(folder: string): Promise<WebDavFileItem[]> {
        const responseText = (
            await this._sendRequest(
                'PROPFIND',
                folder,
                { 'Content-Type': 'application/xml' },
                '<?xml version="1.0"?>\n                <d:propfind xmlns:d="DAV:">\n                    <d:prop>\n                        <d:displayname />\n                        <d:getcontentlength />\n                        <d:creationdate />\n                        <d:getlastmodified />\n                        <d:iscollection />\n                    </d:prop>\n                </d:propfind>\n            '
            )
        ).responseText;
        const responses = new DOMParser()
            .parseFromString(responseText, 'text/xml')
            .getElementsByTagNameNS('DAV:', 'response');
        const items: WebDavFileItem[] = [];
        for (let index = 0; index < responses.length; index++) {
            if (index === 0) {
                continue;
            }
            const responseElement = responses[index];
            console.log(responseElement);
            const displayName =
                responseElement.getElementsByTagNameNS('DAV:', 'displayname')[0]?.textContent || '';
            const contentLength =
                responseElement.getElementsByTagNameNS('DAV:', 'getcontentlength')[0]
                    ?.textContent || '0';
            const createTime =
                responseElement.getElementsByTagNameNS('DAV:', 'creationdate')[0]?.textContent ||
                responseElement.getElementsByTagNameNS('DAV:', 'getlastmodified')[0]?.textContent ||
                '';
            if (contentLength !== '0') {
                items.push({
                    fileId: displayName,
                    name: displayName,
                    size: Number(contentLength),
                    createTime
                });
            }
        }
        items.reverse();
        return items;
    }

    /**
     * 删除当前 folderName 目录下的 filename 文件。
     * @param filename 文件名（会经 encodeURI 编码）
     */
    async deleteFile(filename: string): Promise<void> {
        const path = this.folderName! + '/' + encodeURI(filename);
        await this._sendRequest('DELETE', path, {
            'Cache-Control': 'no-cache'
        });
    }

    /**
     * 设置 folderName 为 folder，确保目录存在，返回目录下备份列表。
     * @param folder 目录名
     * @returns 文件列表
     */
    async getBackupList(folder: string): Promise<WebDavFileItem[]> {
        this.folderName = folder;
        await this.createFolder(folder);
        return this.getFileList(folder);
    }

    /**
     * 读取当前 folderName 目录下 filename 的文本内容。
     * @param filename 文件名
     * @returns 文件文本内容
     */
    async getFileContent(filename: string): Promise<string> {
        const path = this.folderName! + '/' + filename;
        return (
            await this._sendRequest('GET', path, {
                Accept: 'application/octet-stream'
            })
        ).responseText;
    }
}

