/**
 * 备份附加存储清单 —— 除 IndexedDB（storageManager.exportData）外，
 * 需随 WebDav / 本地 JSON 备份的 localStorage 与 GM 存储键。
 *
 * 原则：用户长期数据 / 可再生但成本高的缓存全部备份；
 * 瞬时同步通道、API 签名、本机凭证 ID 等不备份。
 */

/** 随备份的 localStorage 键（长期缓存 + 偏好 + 访问记录）。 */
export const BACKUP_LOCAL_STORAGE_KEYS: readonly string[] = [
    // —— 长期业务缓存（缓存管理面板 + 截图/预加载伴生）——
    'jhs_other_site', // missav/supjav 预加载命中
    'jhs_other_site_dmm', // DMM 预览伴生
    'jhs_dmm_video', // 预览视频画质 URL
    'jhs_translate', // 标题翻译
    'jhs_actress_info', // 演员维基信息
    'jhs_score_info', // Top250/热播评分 HTML
    'jhs_screenShot', // javstore 截图墙
    'jhs_visit_history', // 访问记录
    'jdb:rating_cache_v2', // 列表评分缓存（永久）

    // —— 用户偏好（跨设备希望保留）——
    'jhs_enabled_sites', // 第三方站点启用列表
    'jhs_foldCategory', // 分类折叠
    'jhs_sortMethod', // 列表排序方式
    'jhs_fancyboxThumbs', // 详情页缩略图条
    'jhs_upgrade_flags', // 升级特性开关
    'jhs_videoMuted', // 预览视频静音
    'jhs_magnetHub_selectedEngine', // 磁链引擎选择
    'jhs_appAuthorization' // Top250 等 app 授权 token
];

/**
 * 随备份的 GM 存储键（Tampermonkey 跨标签/清单插件主数据）。
 * listReadingStatus 的 IDB 寄生键 listReadingStatus_data 已在 IndexedDB 导出内；
 * GM 为主源，导入后写回 GM，与插件启动时 IDB↔GM 合并逻辑兼容。
 */
export const BACKUP_GM_KEYS: readonly string[] = [
    'jdb:list-reading-status',
    'jdb:list-rating',
    'jdb:list-last-uri',
    'jdb:list-sort',
    'jdb:list-filter-read',
    'jdb:list-filter-rating',
    'jdb:list-waterfall-enabled'
];

/**
 * 不备份的键（文档备忘，勿加入上面列表）：
 * - jhs_review_ts / jhs_review_sign / jhs_jdsignature：API 签名短缓存
 * - jdb:want-watched-sync / jhsrd:last-sync-digest / jdb:last-sync 等：跨标签广播
 * - GM credentialId / lastAutoBackupDate：本机凭证与备份日戳（auto-backup 模块）
 * - clog UI expand/filter：控制台 UI 状态
 */

/** 采集 localStorage 备份对象（仅含有值的键）。 */
export function collectLocalStorageBackup(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const key of BACKUP_LOCAL_STORAGE_KEYS) {
        try {
            const v = localStorage.getItem(key);
            if (v != null && v !== '') out[key] = v;
        } catch {
            /* 忽略单键失败 */
        }
    }
    return out;
}

/** 采集 GM 备份对象（仅含有定义的键）。 */
export function collectGmStorageBackup(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const key of BACKUP_GM_KEYS) {
        try {
            const v = GM_getValue(key, undefined);
            if (v !== undefined) out[key] = v;
        } catch {
            /* 忽略单键失败 */
        }
    }
    return out;
}

/**
 * 从备份恢复 localStorage + GM，并从 data 剥离 `__localStorage` / `__gmStorage`。
 * 覆盖策略：备份中有非空值则覆盖本地；缺失则不动（兼容旧备份）。
 */
export function applyBackupExtras(data: Record<string, any>): void {
    const ls = data.__localStorage;
    if (ls && typeof ls === 'object') {
        for (const key of Object.keys(ls)) {
            const raw = ls[key];
            if (raw == null || raw === '') continue;
            try {
                localStorage.setItem(key, typeof raw === 'string' ? raw : JSON.stringify(raw));
            } catch (err: any) {
                console.warn(`[JHS 备份] 恢复 localStorage.${key} 失败:`, err?.message || err);
            }
        }
    }
    delete data.__localStorage;

    const gm = data.__gmStorage;
    if (gm && typeof gm === 'object') {
        for (const key of Object.keys(gm)) {
            try {
                GM_setValue(key, gm[key]);
            } catch (err: any) {
                console.warn(`[JHS 备份] 恢复 GM.${key} 失败:`, err?.message || err);
            }
        }
    }
    delete data.__gmStorage;
}
