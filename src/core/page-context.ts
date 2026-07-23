/**
 * PageContext — 集中式页面类型检测（Runtime V2 基础设施）。
 *
 * 将原 main.tsx 启动序列中散落的页面判定逻辑（isDetailPage/isListPage/isFc2Page）
 * 提取为独立模块，在 processCss 之前执行，使插件的 initCss/handle 均可访问。
 *
 * 设计原则：
 * - 纯函数检测，无副作用，不修改 window
 * - main.tsx 调用 detect() 后将结果挂载到 window（保持向后兼容）
 * - 插件可直接 import { pageContext } 获取检测结果（无需 window 全局）
 */
import { isJavdbSite, isMissavSite } from '../constants/site';

/** 页面类型枚举。 */
export type PageType = 'detail' | 'list' | 'fc2' | 'unknown';

/** 站点类型枚举。 */
export type SiteType = 'javdb' | 'missav' | 'unknown';

/** 页面上下文检测结果。 */
export interface PageContextResult {
    /** 站点类型 */
    site: SiteType;
    /** 页面类型 */
    pageType: PageType;
    /** 是否为详情页（/v/xxx） */
    isDetailPage: boolean;
    /** 是否为列表页（.movie-list 存在或 advanced_search） */
    isListPage: boolean;
    /** 是否为 FC2 页面（advanced_search?type=3 或 type=100） */
    isFc2Page: boolean;
    /** 是否为 javdb 站点 */
    isJavdbSite: boolean;
    /** 是否为 missav 站点 */
    isMissavSite: boolean;
}

/**
 * 检测当前页面上下文。
 * 必须在 DOM 就绪后调用（isListPage 依赖 .movie-list 元素检测）。
 */
export function detectPageContext(): PageContextResult {
    const href = window.location.href;
    const isDetailPage = href.split('?')[0].includes('/v/');
    // isListPage 依赖 DOM（.movie-list），需在 document-idle 后调用
    const isListPage =
        typeof $ !== 'undefined' &&
        (($('.movie-list').length > 0) || href.includes('advanced_search'));
    const isFc2Page =
        href.includes('advanced_search?type=3') || href.includes('advanced_search?type=100');

    const site: SiteType = isJavdbSite ? 'javdb' : isMissavSite ? 'missav' : 'unknown';
    const pageType: PageType = isDetailPage
        ? 'detail'
        : isFc2Page
          ? 'fc2'
          : isListPage
            ? 'list'
            : 'unknown';

    return {
        site,
        pageType,
        isDetailPage,
        isListPage,
        isFc2Page,
        isJavdbSite,
        isMissavSite
    };
}

/**
 * 全局页面上下文单例。
 * main.tsx 启动时调用 detectPageContext() 赋值，之后只读。
 */
export let pageContext: PageContextResult = {
    site: 'unknown',
    pageType: 'unknown',
    isDetailPage: false,
    isListPage: false,
    isFc2Page: false,
    isJavdbSite: false,
    isMissavSite: false
};

/** 初始化全局页面上下文（仅 main.tsx 调用一次）。 */
export function initPageContext(): PageContextResult {
    pageContext = detectPageContext();
    return pageContext;
}
