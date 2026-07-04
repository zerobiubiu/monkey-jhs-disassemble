/**
 * 影片评论插件 ReviewPlugin —— 对应原脚本 archetype/jhs.user.js L7081-7285。
 *
 * 在影片详情页加载并展示 jdforrepam.com 的评论数据：JavDb 站点直接以 URL 末段
 * 作为影片 ID 拉取；JavBus 站点先用页面番号经 /v2/search 反查影片 ID 再拉取。
 * 支持折叠/展开状态持久化、分页加载更多、评论正文内 ed2k/磁力/HTTP 链接渲染、
 * 右键将选中文字加入评论过滤关键词。
 *
 * JS→TS 改造要点：
 * - 构造函数中 i(this,"field",val)（babel 类字段 defineProperty 助手）改为 class 字段，
 *   配合 tsconfig useDefineForClassFields:true，[[Define]] 语义一致。
 * - 单字母局部变量（原 e/t/n/a/i/s/r 等）已语义化命名为 movieId/container/reviews 等。
 * - 站点布尔 r/l、API 基址 U、签名 O、评论请求 R、布尔标识 _/C 改由 ../constants 引入。
 * - window.isDetailPage 为运行时挂载到 window 的全局，以 (window as any).isDetailPage 访问。
 * - 内联 HTML 已提取为组件（ReviewHeader / ReviewContainers / ReviewLoading /
 *   ReviewError / ReviewEmpty / ReviewLoadMore / ReviewEnd / ReviewItem / ReviewLinkContent），
 *   仅替换其中的模板插值变量名。
 * - 控制流（分支、for 循环、IIFE、try/catch/finally、fire-and-forget .then()）与原脚本一致。
 */
import { BasePlugin } from './base-plugin';
import { isJavdbSite, isJavbusSite } from '../constants/site';
import { API_BASE, reBuildSignature, fetchMovieReviews } from '../constants/api';
import { YES, NO } from '../constants/status';
import { ReviewContainers } from '../components/review-containers';
import { ReviewEmpty } from '../components/review-empty';
import { ReviewEnd } from '../components/review-end';
import { ReviewError } from '../components/review-error';
import { ReviewHeader } from '../components/review-header';
import { ReviewItem } from '../components/review-item';
import { ReviewLinkContent } from '../components/review-link-content';
import { ReviewLoadMore } from '../components/review-load-more';
import { ReviewLoading } from '../components/review-loading';
import { jsxToString } from '../core/jsx-to-string';

export class ReviewPlugin extends BasePlugin {
    /** 评论楼层序号（渲染时自增） */
    floorIndex = 1;
    /** 是否已首次拉取评论（避免展开时重复请求） */
    isInit = false;

    /** 构造函数：仅调用父类构造，字段初始化交由 class 字段语法。对应原 L7082-7086。 */
    constructor() {
        super();
    }

    /** 返回插件名，供 PluginManager 注册去重。对应原 L7087-7089。 */
    getName(): string {
        return 'ReviewPlugin';
    }

    /**
     * 详情页主处理：按当前站点分别拉取并展示评论。对应原 L7090-7132。
     *
     * 仅当运行时 window.isDetailPage 为真时执行：
     * - JavDb 站点：用 URL 末段作影片 ID 直接展示评论；
     * - JavBus 站点：先取页面番号，经 /v2/search 反查影片 ID，命中后展示评论。
     *
     * @returns 无返回值；内部异步拉取失败由各子方法自行 catch 处理。
     */
    async handle(): Promise<void> {
        if ((window as any).isDetailPage) {
            if (isJavdbSite) {
                const movieId = this.parseMovieId(window.location.href);
                await this.showReview(movieId);
                await this.getBean('RelatedPlugin').showRelated($('#magnets-content'), movieId);
            }
            if (isJavbusSite) {
                const carNum = this.getPageInfo().carNum!;
                const searchResults = await (async (query: string) => {
                    const url = `${API_BASE}/v2/search`;
                    const headers = {
                        'user-agent': 'Dart/3.5 (dart:io)',
                        'accept-language': 'zh-TW',
                        host: 'jdforrepam.com',
                        jdsignature: await reBuildSignature()
                    };
                    const params = {
                        q: query,
                        page: 1,
                        type: 'movie',
                        limit: 1,
                        movie_type: 'all',
                        from_recent: 'false',
                        movie_filter_by: 'all',
                        movie_sort_by: 'relevance'
                    };
                    return (await gmHttp.get(url, params, headers)).data.movies;
                })(carNum);
                let movieId: any = null;
                for (let idx = 0; idx < searchResults.length; idx++) {
                    const movie = searchResults[idx];
                    if (movie.number.toLowerCase() === carNum.toLowerCase()) {
                        movieId = movie.id;
                        break;
                    }
                }
                if (!movieId) {
                    return;
                }
                this.showReview(movieId, $('#sample-waterfall')).then();
            }
        }
    }

    /**
     * 在指定容器内渲染评论区骨架（分隔线 + 折叠开关 + 评论/页脚容器），并按设置决定是否立即拉取。
     * 对应原 L7133-7166。
     *
     * @param movieId 影片 ID（JavDb 为 URL 末段字符串，JavBus 为搜索反查得到的数值 ID）
     * @param container 评论区块挂载点；不传则取 #magnets-content
     * @returns 无返回值；首次展开或设置已展开时会异步触发 fetchAndDisplayReviews
     */
    async showReview(movieId: any, container?: any): Promise<void> {
        const isExpanded = await storageManager.getSetting('enableLoadReview', YES);
        const target = container || $('#magnets-content');
        target.append(
            jsxToString(
                <ReviewHeader
                    foldText={isExpanded === YES ? '折叠' : '展开'}
                    iconText={isExpanded === YES ? '▲' : '▼'}
                />
            )
        );
        $('#reviewsFold').on('click', (event: any) => {
            event.preventDefault();
            event.stopPropagation();
            const toggleText = $('#reviewsFold .toggle-text');
            const toggleIcon = $('#reviewsFold .toggle-icon');
            const isExpand = toggleText.text() === '展开';
            toggleText.text(isExpand ? '折叠' : '展开');
            toggleIcon.text(isExpand ? '▲' : '▼');
            if (isExpand) {
                $('#reviewsContainer').show();
                $('#reviewsFooter').show();
                if (!this.isInit) {
                    this.fetchAndDisplayReviews(movieId);
                    this.isInit = true;
                }
                storageManager.saveSettingItem('enableLoadReview', YES);
            } else {
                $('#reviewsContainer').hide();
                $('#reviewsFooter').hide();
                storageManager.saveSettingItem('enableLoadReview', NO);
            }
        });
        target.append(jsxToString(<ReviewContainers />));
        if (isExpanded === YES) {
            await this.fetchAndDisplayReviews(movieId);
        }
    }

    /**
     * 拉取并渲染第一页评论，按结果展示加载更多/重试/无评论等状态。对应原 L7167-7236。
     *
     * @param movieId 影片 ID
     * @returns 无返回值；签名过期等异常会被 catch 并提示，不会向外抛出
     */
    async fetchAndDisplayReviews(movieId: any): Promise<void> {
        const container = $('#reviewsContainer');
        const footer = $('#reviewsFooter');
        container.append(jsxToString(<ReviewLoading />));
        const limit: number = await storageManager.getSetting('reviewCount', 20);
        let reviews: any = null;
        try {
            reviews = await fetchMovieReviews(movieId, 1, limit);
        } catch (err: any) {
            if (err.toString().includes('簽名已過期')) {
                show.error('生成签名失败, 请检查系统时间及时区是否正确!');
            }
            clog.error('获取评论失败:', err);
            console.error('获取评论失败:', err);
        } finally {
            $('#reviewsLoading').remove();
        }
        if (!reviews) {
            container.append(jsxToString(<ReviewError />));
            $('#retryFetchReviews').on('click', async () => {
                $('#retryFetchReviews').parent().remove();
                await this.fetchAndDisplayReviews(movieId);
            });
            return;
        }
        if (reviews.length === 0) {
            container.append(jsxToString(<ReviewEmpty />));
            return;
        }
        const filterKeywords = await storageManager.getReviewFilterKeywordList();
        this.displayReviews(reviews, container, filterKeywords);
        if (reviews.length === limit) {
            footer.html(jsxToString(<ReviewLoadMore />));
            let page = 1;
            const loadMoreBtn = $('#loadMoreReviews');
            loadMoreBtn.on('click', async () => {
                let moreReviews: any;
                loadMoreBtn.text('加载中...').prop('disabled', true);
                page++;
                try {
                    moreReviews = await fetchMovieReviews(movieId, page, limit);
                } catch (err: any) {
                    console.error('加载更多评论失败:', err);
                } finally {
                    loadMoreBtn.text('加载失败, 请点击重试').prop('disabled', false);
                }
                if (moreReviews) {
                    this.displayReviews(moreReviews, container, filterKeywords);
                    if (moreReviews.length < limit) {
                        loadMoreBtn.remove();
                        $('#reviewsEnd').show();
                    } else {
                        loadMoreBtn.text('加载更多评论').prop('disabled', false);
                    }
                }
            });
        } else {
            footer.html(jsxToString(<ReviewEnd />));
        }
    }

    /**
     * 将评论数组渲染为 DOM 追加到容器，过滤含关键词的评论，并转换正文内的 ed2k/磁力/HTTP 链接。
     * 对应原 L7237-7263。
     *
     * @param reviews 评论数组（来自 fetchMovieReviews）
     * @param container 评论挂载容器（#reviewsContainer）
     * @param filterKeywords 过滤关键词列表；命中任一关键词的评论会被跳过
     * @returns 无返回值；渲染末尾会注册右键过滤
     */
    displayReviews(reviews: any, container: any, filterKeywords: any): void {
        if (reviews.length) {
            reviews.forEach((review: any) => {
                if (filterKeywords.some((keyword: any) => review.content.includes(keyword))) {
                    return;
                }
                const stars = Array(review.score).fill('<i class="icon-star"></i>').join('');
                const content = review.content.replace(
                    /ed2k:\/\/\|file\|[^|]+\|\d+\|[a-fA-F0-9]{32}\|\/|magnet:\?[^\s"'<>`\u4e00-\u9fa5，。？！（）【】]+|https?:\/\/[^\s"'<>`\u4e00-\u9fa5，。？！（）【】]+/g,
                    (match: any) => jsxToString(<ReviewLinkContent match={match} />)
                );
                const html = jsxToString(
                    <ReviewItem
                        floor={this.floorIndex++}
                        username={review.username}
                        stars={stars}
                        time={utils.formatDate(review.created_at)}
                        likesCount={review.likes_count}
                        content={content}
                    />
                );
                container.append(html);
            });
            this.rightClickFilter();
        }
    }

    /**
     * 为 .review-content 注册右键菜单：选中文字后确认加入评论过滤关键词。对应原 L7264-7284。
     *
     * 仅当设置 enableTitleSelectFilter === YES 时启用。
     *
     * @returns 无返回值；右键回调内部异步保存关键词并提示，不阻塞本方法
     */
    async rightClickFilter(): Promise<void> {
        if ((await storageManager.getSetting('enableTitleSelectFilter', YES)) === YES) {
            utils.rightClick(document.body, '.review-content', async (event: any) => {
                const selectedText = window.getSelection()!.toString();
                if (selectedText) {
                    event.preventDefault();
                    await utils.q(event, `是否将 '${selectedText}' 加入评论区关键词?`, async () => {
                        await storageManager.saveReviewFilterKeyword(selectedText);
                        show.ok('操作成功, 刷新页面后生效');
                    });
                }
            });
        }
    }
}
