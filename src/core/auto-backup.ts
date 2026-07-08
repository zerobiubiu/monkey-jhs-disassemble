/**
 * 自动备份模块 AutoBackup —— 负责本机凭证 ID 管理与自动备份调度。
 *
 * 设计要点：
 * - **凭证 ID**：每台电脑的每个浏览器一个唯一 ID（UUID v4），第一次打开脚本时
 *   创建，通过 GM_setValue 存浏览器本地（Tampermonkey 持久化），**不进入备份系统**
 *   （不在 storageManager 的 IndexedDB 内，不会被 exportData 导出）。
 * - **备份格式**：备份 JSON 新增 `credentialId` + `autoBackupConfig` 字段，
 *   标识备份来源浏览器与自动备份策略。
 * - **增量滚动更新**：一个浏览器只保留一份备份文件，文件名固定为
 *   `auto_<credentialId>.json`，每次自动备份覆盖该文件（不堆叠历史）。
 * - **自动备份策略**：随备份文件保存（`autoBackupConfig` 字段），便于跨浏览器
 *   识别各浏览器的备份。
 * - **触发时机**：默认每天第一次打开时自动备份（按本机日期判断）。
 */

/** 凭证 ID 在 GM 存储中的键名（不进入备份系统）。 */
const CREDENTIAL_ID_KEY = 'jhs:credential_id';

/** 上次自动备份日期在 GM 存储中的键名（YYYY-MM-DD 格式）。 */
const LAST_AUTO_BACKUP_DATE_KEY = 'jhs:last_auto_backup_date';

/** 自动备份策略类型。 */
export type AutoBackupFrequency = 'daily' | 'everyOpen' | 'disabled';

/** 自动备份配置（随备份文件保存）。 */
export interface AutoBackupConfig {
    /** 是否启用自动备份。 */
    enabled: boolean;
    /** 备份频率。 */
    frequency: AutoBackupFrequency;
}

/** 自动备份配置默认值：启用 + 每天第一次打开。 */
export const DEFAULT_AUTO_BACKUP_CONFIG: AutoBackupConfig = {
    enabled: true,
    frequency: 'daily'
};

/**
 * 生成 UUID v4 字符串（无第三方依赖，用 crypto.getRandomValues）。
 * @returns 36 字符 UUID v4 字符串（含连字符）
 */
function generateUuid(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // 兜底：手动拼装 RFC 4122 v4
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex: string[] = [];
    bytes.forEach((b) => hex.push(b.toString(16).padStart(2, '0')));
    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex
        .slice(6, 8)
        .join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}

/**
 * 获取本机凭证 ID（首次调用时创建并持久化到 GM 存储）。
 *
 * 凭证 ID 唯一标识「一台电脑上的一个浏览器」，不进入备份系统
 * （不在 storageManager 的 IndexedDB 内，不被 exportData 导出）。
 *
 * @returns 36 字符 UUID v4 凭证 ID
 */
export function getCredentialId(): string {
    let id: string | undefined = GM_getValue(CREDENTIAL_ID_KEY, undefined);
    if (!id) {
        id = generateUuid();
        GM_setValue(CREDENTIAL_ID_KEY, id);
    }
    return id;
}

/**
 * 获取当前本机日期（YYYY-MM-DD，基于本地时区）。
 * @returns 日期字符串
 */
function getTodayStr(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 判断是否满足自动备份触发条件。
 *
 * - disabled → 永不触发
 * - daily → 本机日期与上次备份日期不同（每天第一次打开）
 * - everyOpen → 每次打开都触发
 *
 * @param config 自动备份配置
 * @returns 是否应触发自动备份
 */
export function shouldAutoBackup(config: AutoBackupConfig): boolean {
    if (!config.enabled || config.frequency === 'disabled') return false;
    if (config.frequency === 'everyOpen') return true;
    // daily
    const today = getTodayStr();
    const lastDate: string | undefined = GM_getValue(LAST_AUTO_BACKUP_DATE_KEY, undefined);
    return today !== lastDate;
}

/**
 * 标记本次自动备份已完成（记录本机日期）。
 * 在自动备份成功后调用，用于 daily 频率的「每天第一次」判断。
 */
export function markAutoBackupDone(): void {
    GM_setValue(LAST_AUTO_BACKUP_DATE_KEY, getTodayStr());
}

/**
 * 构造自动备份文件名（固定名，增量覆盖）。
 *
 * 文件名格式：`auto_<credentialId>.json`，一个浏览器只保留一份。
 *
 * @returns 备份文件名
 */
export function getAutoBackupFileName(): string {
    return `auto_${getCredentialId()}.json`;
}
