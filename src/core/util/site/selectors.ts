/**
 * JavDB / MissAV 站点原生 DOM 选择器注册表。
 *
 * **存在理由**：站点改版（如 `.female` → `.actor-female`）会让散落在各插件里的裸选择器
 * 集体失效，而全树搜索成本极高。本模块把「依赖宿主 DOM 的选择器」收敛为单一出处，
 * 让改版只需改一处，并可被 `bun run check:selectors` 机械门禁守护。
 *
 * **与 `actress-links.ts` 的分工**：`actress-links.ts` 是「选择器 + 新旧兼容读取逻辑」的
 * 先例（含 query API 与单测）；本模块是**扁平的选择器事实表**，供各处直接取用。
 * 演员链接相关的选择器以 `actress-links.ts` 为准，此处只做引用。
 *
 * **范围**：只收 JavDB / MissAV **原生** DOM（宿主自带类名/结构）。
 * **不收**项目自有 UI（`.jhs-*`、`#setting-*`、`#otherSiteBox` 等）——那不是站点依赖。
 *
 * **纯常量**：不读写 DOM、不读写存储、不执行迁移。
 *
 * @module core/util/site/selectors
 */

/** 单个站点选择器：`current` 为当前结构，`legacy` 为改版前结构（可选回退）。 */
export interface SiteSelector {
    /** 当前（新版）站点结构选择器。 */
    readonly current: string;
    /** 改版前的旧结构选择器；仅当站点确实改过版时提供。 */
    readonly legacy?: string;
}

/**
 * 站点原生选择器事实表。
 *
 * 键名按「页面 → 语义」组织；值中的选择器均来自真实页面实测
 * （见 `docs/javdb-site-structure.md` 与 `docs/21-javdb-selector-audit.md`）。
 */
export const SITE_SELECTORS = {
    // ───── 全局骨架 ─────
    /** 主内容容器。 */
    section: { current: 'section.section > div.container' },
    /** 主体根（过滤栏回退挂载点）。 */
    sectionRoot: { current: 'body > section > div' },
    /** 主体直接子容器（过滤栏回退挂载点）。 */
    sectionChild: { current: 'body > section > div > div' },
    /** 主导航主菜单。 */
    navHero: { current: '#navbar-menu-hero' },
    /** 主导航左侧区。 */
    navHeroStart: { current: '#navbar-menu-hero .navbar-start' },
    /** 主导航菜单项。 */
    navHeroItem: { current: '#navbar-menu-hero a.navbar-item' },
    /** 用户菜单区。 */
    navUserEnd: { current: '#navbar-menu-user .navbar-end' },
    /** 导航右侧区。 */
    navEnd: { current: '.navbar-end' },
    /** 导航搜索框。 */
    navSearch: { current: '.navbar-search' },
    /** 导航项（FC2 文本入口的候选节点）。 */
    navItem: { current: '.navbar-item' },
    /** 片商入口。 */
    navMakers: { current: 'a.navbar-link[href="/makers"]' },
    /** 反馈入口。 */
    navFeedback: { current: 'a[href*="/feedbacks/new"]' },
    /** 热播榜入口。 */
    navRankPlayback: { current: 'a[href*="rankings/playback"]' },
    /** TOP250 入口。 */
    navRankTop: { current: 'a[href*="rankings/top"]' },
    /** 外站导航链接。 */
    navThePornDude: { current: 'a[href*="theporndude.com"]' },
    /** 导航主容器。 */
    mainNav: { current: '.main-nav' },

    // ───── 详情页 ─────
    /** 详情页根。 */
    detail: { current: '.video-detail' },
    /** 详情页标题。 */
    detailTitle: { current: 'h2.title' },
    /** 详情页原标题。 */
    detailCurrentTitle: { current: 'strong.current-title' },
    /** 详情页原题名（翻译优先目标）。 */
    detailOriginTitle: { current: '.origin-title' },
    /** 番号复制按钮（`data-clipboard-text` 数据源）。 */
    detailCarNumCopy: { current: 'a[title="複製番號"]' },
    /** 详情页信息面板。 */
    detailMetaPanel: { current: '.movie-panel-info' },
    /** 信息面板首行（含番号与复制按钮）。 */
    detailMetaFirstBlock: { current: '.panel-block.first-block' },
    /** VLT 取番号的剪贴板锚点。 */
    detailMetaClipboard: { current: '.panel-block.first-block a[data-clipboard-text]' },
    /** 元数据值容器。 */
    detailMetaValue: { current: '.panel-block .value' },
    /** 元数据内链接。 */
    detailMetaLink: { current: '.panel-block .value a[href]' },
    /** 视频信息面板。 */
    detailVideoMetaPanel: { current: '.video-meta-panel' },
    /** 视频信息面板内链接（外链加 target）。 */
    detailVideoMetaLink: { current: '.video-meta-panel a' },
    /** 发布日期读取（新结构）。 */
    detailPublishTime: {
        current: '.video-meta-panel nav > div:nth-child(2) > span',
        legacy: 'strong:contains("日期:")'
    },
    /** 封面图。 */
    detailCoverImg: { current: '.column-video-cover img' },
    /** 封面列。 */
    detailCoverColumn: { current: '.column-video-cover' },
    /** 剧照容器。 */
    detailPreviewImages: { current: '.preview-images' },
    /** 剧照项。 */
    detailPreviewItem: { current: '.preview-images .tile-item' },
    /** 评价按钮区（原生）。 */
    detailReviewButtons: { current: '.review-buttons' },
    /** 评价区原生操作栏。 */
    detailReviewNav: {
        current:
            'body > section > div > div.video-detail > div.video-meta-panel > div > div:nth-child(2) > nav'
    },
    /** 评价区容器（按钮挂载点）。 */
    detailReviewContainer: {
        current:
            'body > section > div > div.video-detail > div.video-meta-panel > div > div:nth-child(2) > nav > div.review-buttons'
    },
    /** 评价分栏挂载点。 */
    detailReviewColumn: { current: '.review-buttons > div:nth-child(1) > div > div' },
    /** 已看状态芯片。 */
    detailWatchedChip: { current: ".review-buttons a[href='/users/watched_videos'] .tag.is-success.is-light" },
    /** 想看状态芯片。 */
    detailWantChip: { current: ".review-buttons a[href='/users/want_watch_videos'] .tag.is-info.is-light" },
    /** 评分 radio。 */
    detailScoreInput: { current: 'input[name="video_review[score]"]' },
    /** 已选评分 radio。 */
    detailScoreChecked: { current: 'input[name="video_review[score]"][checked]' },
    /** 评价删除链接。 */
    detailReviewDelete: { current: ".review-buttons a[data-method='delete'][href*='/reviews/']" },
    /** 详情页原生 tab 栏。 */
    detailTabs: { current: '.tabs.no-bottom' },

    // ───── 列表页 ─────
    /** 影片列表容器。 */
    list: { current: '.movie-list' },
    /** 首页列表容器（带列数类，供定位）。 */
    listHome: { current: 'body > section > div > div.movie-list.h.cols-4.vcols-8' },
    /** 列表卡片。 */
    listItem: { current: '.movie-list .item' },
    /** 列表卡片链接。 */
    listItemLink: { current: '.movie-list .item a.box' },
    /** 列表卡片标题（番号）。 */
    listTitleStrong: { current: '.video-title strong' },
    /** 列表卡片标题容器。 */
    listTitle: { current: '.video-title' },
    /** 列表卡片封面图。 */
    listCoverImg: { current: '.cover img' },
    /** 列表卡片封面容器。 */
    listCover: { current: '.cover' },
    /** 列表卡片评分。 */
    listScore: { current: '.score' },
    /** 列表卡片日期。 */
    listMeta: { current: '.meta' },
    /** 列表卡片标签组。 */
    listTags: { current: '.tags.has-addons' },
    /** 列表工具栏。 */
    listToolbar: { current: 'body > section > div > div.toolbar' },
    /** 列表工具栏按钮。 */
    listToolbarButton: { current: '.toolbar a.button' },
    /** 主标签栏。 */
    mainTabs: { current: '.main-tabs' },
    /** 筛选标签栏（is-boxed）。 */
    tabsBoxed: { current: 'body > section > div > div.tabs.is-boxed' },
    /** 通用标签栏。 */
    tabs: { current: '.tabs' },
    /** 区块标题。 */
    sectionTitle: { current: 'h2.section-title' },
    /** 榜单/高级检索结果卡片。 */
    sectionBox: { current: '.section .container .box' },
    /** 高级检索结果区。 */
    searchAdvancedBox: { current: 'section > div > div.box' },
    /** 空状态。 */
    emptyMessage: { current: '.empty-message' },
    /** 演员搜索卡片标题。 */
    actorBoxStrong: { current: '.actor-box strong' },

    // ───── 分页 ─────
    /** 分页容器。 */
    pagination: { current: '.pagination' },
    /** 分页 nav。 */
    paginationNav: { current: 'nav.pagination' },
    /** 下一页。 */
    paginationNext: { current: '.pagination-next' },
    /** 键盘翻页的下一页（结构定位）。 */
    paginationNextPath: { current: 'body > section > div > nav > a.pagination-next' },
    /** 上一页。 */
    paginationPrev: { current: '.pagination-previous' },
    /** 键盘翻页的上一页（结构定位）。 */
    paginationPrevPath: { current: 'body > section > div > nav > a.pagination-previous' },
    /** 页码列表。 */
    paginationList: { current: '.pagination-list' },
    /** 页码链接。 */
    paginationLink: { current: '.pagination-list li a' },
    /** 当前页。 */
    paginationCurrent: { current: '.pagination-link.is-current' },
    /** 分页省略号。 */
    paginationEllipsis: { current: '.pagination-ellipsis' },

    // ───── 演员页 ─────
    /** 演员页头像+名称列组。 */
    actorColumns: { current: '.section-columns' },
    /** 演员名（可含别名）。 */
    actorSectionName: { current: '.actor-section-name' },
    /** 演员页元信息（别名/影片数/性别）。 */
    actorSectionMeta: { current: '.section-meta' },
    /** 演员页不含"影片"的元信息（取名称）。 */
    actorSectionMetaName: { current: ".section-meta:not(:contains('影片'))" },
    /** 演员页性别判定（男優）。 */
    actorSectionMetaMale: { current: ".section-meta:contains('男優')" },
    /** 演员页头像。 */
    actorAvatar: { current: '.avatar' },
    /** 演员页标签区。 */
    actorTags: { current: '.actor-tags.tags' },
    /** 演员页标签内容。 */
    actorTagsContent: { current: '.actor-tags .content' },
    /** 演员页标签链接。 */
    actorTagLink: { current: '.tags a.tag' },
    /** 标签展开控件。 */
    tagExpand: { current: '.tag-expand' },
    /** 演员页收藏按钮。 */
    actorCollectButton: { current: '#button-collect-actor' },
    /** 演员页取消收藏按钮。 */
    actorUncollectButton: { current: '#button-uncollect-actor' },

    // ───── 标签页 ─────
    /** 标签页容器。 */
    tags: { current: '#tags' },
    /** 标签分类块。 */
    tagCategory: { current: '#tags .tag-category' },
    /** 标签分类展开控件。 */
    tagCategoryExpand: { current: '#tags .tag-category .tag-expand' },
    /** 标签链接。 */
    tagLink: { current: '#tags a.tag' },
    /** 已选标签。 */
    tagSelected: { current: '#tags dl div.tag.is-info' },

    // ───── 用户清单 ─────
    /** 清单目录容器。 */
    userLists: { current: '#lists' },
    /** 清单目录列表。 */
    userListsUl: { current: '#lists > ul' },
    /** 清单目录项。 */
    userListLi: { current: '#lists > ul > li' },
    /** 清单标题链接。 */
    userListLink: { current: 'div.column.is-10 > a' },
    /** 清单标题文本。 */
    userListName: { current: '.list-name' },
    /** 用户清单分页/加载态。 */
    userListLoader: { current: '.jdb-wf-loader' },

    // ───── 系列页 ─────
    /** 系列/用户列表标题挂载点。 */
    sectionColumnsTitle: { current: 'body > section > div > div.columns.is-mobile.section-columns > div > h2' }
} as const satisfies Record<string, SiteSelector>;

/** 注册表键名。 */
export type SiteSelectorKey = keyof typeof SITE_SELECTORS;

/**
 * 取站点选择器字符串（当前结构）。
 *
 * @param key 注册表键名
 * @returns 选择器字符串
 */
export function siteSelector(key: SiteSelectorKey): string {
    return SITE_SELECTORS[key].current;
}

/**
 * 按注册表键查询元素（当前结构）。
 *
 * @param key 注册表键名
 * @param root 查询根，默认当前 document
 * @returns 命中元素数组
 */
export function siteQuery(key: SiteSelectorKey, root: ParentNode = document): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>(siteSelector(key)));
}

/**
 * 按注册表键查询单个元素（当前结构）。
 *
 * @param key 注册表键名
 * @param root 查询根，默认当前 document
 * @returns 首个命中元素，无则 null
 */
export function siteQueryOne(key: SiteSelectorKey, root: ParentNode = document): HTMLElement | null {
    return root.querySelector<HTMLElement>(siteSelector(key));
}

/**
 * 新旧兼容查询：先试 `current`，无命中再试 `legacy`（若有）。
 *
 * @param key 注册表键名
 * @param root 查询根，默认当前 document
 * @returns 命中元素数组（优先新结构）
 */
export function siteQueryCompat(key: SiteSelectorKey, root: ParentNode = document): HTMLElement[] {
    const entry: SiteSelector = SITE_SELECTORS[key];
    const current = Array.from(root.querySelectorAll<HTMLElement>(entry.current));
    if (current.length > 0 || entry.legacy === undefined) {
        return current;
    }
    return Array.from(root.querySelectorAll<HTMLElement>(entry.legacy));
}
