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

/**
 * 是否为 JavDB 首页路径（`/` 或空）。
 *
 * 抽成函数供早期代码复用（如 main.tsx 拼按页面生效的 CSS，doc/51），
 * 与 `detectPageContext` 用同一份判定，避免两处各写一条规则。
 *
 * @param pathname 当前路径（默认读 location，便于测试注入）
 */
export function isJavdbHomePath(pathname: string = window.location.pathname): boolean {
    return pathname === '/' || pathname === '';
}

/** 页面类型枚举。`home` = JavDB 首页（`/`，站点文档列为影片列表页；列表容器可能未检出）。 */
export type PageType = 'detail' | 'list' | 'fc2' | 'home' | 'unknown';

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
    /**
     * 是否为 JavDB 首页（pathname 为 `/`）。
     *
     * doc/47：站点文档把首页列为影片列表页（影片列表容器 h cols-4 vcols-8），
     * 但首页列表若在 document-idle 时尚未出现，`isListPage` 会为 false ——
     * 此时 `pageType` 记为 `home`，供过滤/筛选组件显式放行（历史行为：原脚本
     * 无页面门控，首页一直展示过滤筛选组件）。
     */
    isHomePage: boolean;
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
    // doc/47：首页（pathname 为空或 `/`）本身就是一个影片列表页（判定见 isJavdbHomePath）
    const pathname = window.location.pathname;
    const isHomePage = isJavdbSite && isJavdbHomePath(pathname);

    const site: SiteType = isJavdbSite ? 'javdb' : isMissavSite ? 'missav' : 'unknown';
    const pageType: PageType = isDetailPage
        ? 'detail'
        : isFc2Page
          ? 'fc2'
          : isListPage
            ? 'list'
            : isHomePage
              ? 'home'
              : 'unknown';

    return {
        site,
        pageType,
        isDetailPage,
        isListPage,
        isFc2Page,
        isHomePage,
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
    isHomePage: false,
    isJavdbSite: false,
    isMissavSite: false
};

/** 初始化全局页面上下文（仅 main.tsx 调用一次）。 */
export function initPageContext(): PageContextResult {
    pageContext = detectPageContext();
    return pageContext;
}

/**
 * 是否为「影片列表语境」—— 过滤/筛选组件（卡片过滤、状态标签芯片栏、清单标签筛选栏）
 * 的共用判定（doc/47）。
 *
 * 与 `window.isListPage`（纯 DOM 检测，首页列表可能迟于 document-idle）的区别：
 * 首页按 URL 确定性放行，避免首页因 `isListPage=false` 整体不执行 ——
 * 历史行为是首页一直展示这些组件（原脚本无页面门控）。
 *
 * @returns 列表页或 JavDB 首页为 true
 */
export function isVideoListContext(): boolean {
    return pageContext.isListPage || pageContext.pageType === 'home';
}
