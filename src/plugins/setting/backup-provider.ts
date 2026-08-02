/**
 * 备份提供方抽象 —— WebDav / Git 云备份通道的统一接口（doc/217）。
 *
 * 备份数据源统一由 buildBackupPayload 构造，存储目的地从单一 WebDav
 * 扩展为多通道。本接口以 WebDavClient 既有方法形状为基准：
 * - WebDavClient 结构满足（无需修改其实现）；
 * - GitBackupClient 显式实现。
 *
 * 文件列表弹层（openFileListDialog）面向本接口编程，新增通道零 UI 改造。
 */

import type { WebDavFileItem } from '../../core/webdav';

/** 备份文件列表项（沿用 WebDavFileItem 形状：fileId/name/size/createTime）。 */
export type BackupFileItem = WebDavFileItem;

/**
 * 云备份提供方接口。
 *
 * 有状态目录语义（沿用 WebDavClient）：
 * - getBackupList(folder) 设内部「当前目录」；
 * - getFileContent / deleteFile 作用于当前目录下的文件。
 */
export interface BackupProvider {
    /** 将 content 备份为 folder/filename（文件已存在则覆盖更新）。 */
    backup(folder: string, filename: string, content: string): Promise<void>;
    /** 列出 folder 下文件（目录不存在按空处理），并设当前目录。 */
    getBackupList(folder: string): Promise<BackupFileItem[]>;
    /** 读取当前目录下 filename 的文本内容。 */
    getFileContent(filename: string): Promise<string>;
    /** 删除当前目录下 filename。 */
    deleteFile(filename: string): Promise<void>;
}
