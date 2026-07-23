/** 第三方站点搜索结果缓存条目（localStorage jhs_other_site 的值结构）。 */
export interface SiteResult {
    type: 'single' | 'multiple';
    url: string;
}

/** 第三方站点探测配置。 */
export interface SiteConfig {
    id: string;
    getBaseUrl: () => Promise<string>;
    itemSelector: string;
    searchPath: (baseUrl: string, carNum: string) => string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jQuery object
    getDetailPageHref: (item: any, baseUrl: string, carNum: string) => string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jQuery object
    findCarNumOrTitle: (item: any) => string;
    sourceCarNum?: unknown;
    condition?: (sourceCarNum: unknown) => boolean;
    initUrl?: (carNum: string) => Promise<string> | string;
    noHandle?: boolean;
    headers?: Record<string, string>;
}
