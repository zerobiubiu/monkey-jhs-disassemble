/**
 * 设置插件 GM 私有存储键常量。
 * 提取自 setting-plugin.tsx，供 setting/ 子模块共享引用，避免循环值导入。
 */

/** WebDAV 服务地址。 */
export const GM_KEY_WEBDAV_URL = 'jhs_webdav_url';
/** WebDAV 用户名。 */
export const GM_KEY_WEBDAV_USERNAME = 'jhs_webdav_username';
/** WebDAV 密码。 */
export const GM_KEY_WEBDAV_PASSWORD = 'jhs_webdav_password';
/** 备份加密口令。 */
export const GM_KEY_BACKUP_PASSWORD = 'jhs_backup_password';
