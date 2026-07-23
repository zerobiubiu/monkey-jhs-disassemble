import type { OtherSitePlugin } from '../other-site-plugin';

/** localStorage 键名。 */
const ENABLED_SITES_KEY = 'jhs_enabled_sites';

/**
 * 读取已启用的站点 ID 列表。对应原 L5074-5081。
 * localStorage jhs_enabled_sites 存在则解析返回，否则返回全部 siteConfigs 的 id。
 * 无参数，返回 string[]。
 */
export function getEnabledSites(plugin: OtherSitePlugin): string[] {
    const stored = localStorage.getItem(ENABLED_SITES_KEY);
    if (stored) {
        try {
            return JSON.parse(stored) as string[];
        } catch { /* 损坏回退默认 */ }
    }
    return plugin.siteConfigs.map((siteConfig) => siteConfig.id);
}

/**
 * 持久化已启用的站点 ID 列表。对应原 L5082-5084。
 * @param siteIds 站点 ID 数组。
 */
export function saveEnabledSites(siteIds: string[]): void {
    localStorage.setItem(ENABLED_SITES_KEY, JSON.stringify(siteIds));
}
