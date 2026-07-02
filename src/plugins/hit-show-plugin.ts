/**
 * 热播插件 HitShowPlugin —— 对应原脚本 archetype/jhs.user.js L4328-4465。
 *
 * 在 JavDb "播放排行"入口拦截跳转，改写 advanced_search?handlePlayback=1 页面为
 * "热播"榜单：渲染日/周/月榜切换工具栏，拉取播放排行数据（fetchPlaybackRanking，
 * 最多重试 3 次）生成影片列表，并为每个可见影片拉取评分（fetchMovieDetail）渲染
 * 星级与评价人数；评分结果按影片 ID 缓存到 localStorage（jhs_score_info）。
 *
 * 单字母局部变量（原 e/t/n/a/i/s/o/r/l）已语义化：
 *   period / movieListEl / loadingOverlay / success / attempt / movies / html /
 *   error / movieId / storageKey / rawCache / cache / cachedHtml / detail /
 *   score / watchedCount / scoreHtml / scoreEl / titleEl / event。
 * 原构造函数 i(this,"$contentBox",...)（Object.defineProperty，[[Define]] 语义）
 * 改为 class 字段 contentBox（useDefineForClassFields:true，语义一致）；
 * 原 W/V 请求函数改由 ../constants/api 引入（fetchPlaybackRanking / fetchMovieDetail）；
 * $ / loading / clog 已由 ../types/globals.d.ts 声明为 any；
 * jQuery 回调中 this 按 fold-category-plugin 既有约定标注 (this: any)，规避 noImplicitThis；
 * handlePlayback 内重试块的 loadingOverlay 与 movies（原均为 n）按作用域拆分命名，
 * 保留 finally 关闭 loading 覆盖层、try 内拉取数据的原始控制流；内联 CSS/HTML 原样保留。
 */
import { fetchPlaybackRanking, fetchMovieDetail } from "../constants/api";
import { BasePlugin } from "./base-plugin";

export class HitShowPlugin extends BasePlugin {
    /** 内容容器 jQuery 对象，热播榜单与工具栏挂载点。对应原 L4331。 */
    contentBox: any = $(".section .container");

    /** 返回插件名，供 PluginManager 注册去重。对应原 L4333-4335。 */
    getName(): string {
        return "HitShowPlugin";
    }

    /**
     * 主处理入口：拦截"播放排行"链接跳转到热播页，并触发热播数据处理。
     * 对应原 L4336-4344。
     * 与父类声明一致为 async（体内无 await，handlePlayback 为 fire-and-forget）；
     * 无参数，返回 Promise<void>，不会抛出异常。
     */
    async handle(): Promise<void> {
        $('a[href*="rankings/playback"]').on("click", (event: any) => {
            event.preventDefault();
            event.stopPropagation();
            window.location.href =
                "/advanced_search?handlePlayback=1&period=daily";
        });
        this.handlePlayback().then();
    }

    /**
     * 改写热播页结构：标题改"热播"、清空占位与既有卡片、移除排序开关，
     * 追加工具栏容器与影片列表容器。对应原 L4345-4358。
     * 无参数，无返回值。
     */
    hookPage(): void {
        const titleEl = $("h2.section-title");
        titleEl.contents().first().replaceWith("热播");
        titleEl.css("marginBottom", "0");
        $(".empty-message").remove();
        $(".section .container .box").remove();
        $("#sort-toggle-btn").remove();
        this.contentBox.append(
            '<div class="tool-box" style="margin-top: 10px"></div>',
        );
        this.contentBox.append(
            '<div class="movie-list h cols-4 vcols-8" style="margin-top: 10px"></div>',
        );
    }

    /**
     * 处理热播页：按 period 渲染日/周/月榜工具栏，改写页面结构，拉取热播数据
     * （最多重试 3 次）并渲染列表与评分。对应原 L4359-4390。
     * 仅当 URL 含 handlePlayback=1 时执行；无参数，返回 Promise<void>，
     * 拉取失败仅 clog.error 不向上抛出；finally 在成功或末次尝试后关闭 loading 覆盖层。
     */
    async handlePlayback(): Promise<void> {
        if (!window.location.href.includes("handlePlayback=1")) {
            return;
        }
        const period = new URLSearchParams(window.location.search).get("period");
        this.toolBar(period);
        this.hookPage();
        const movieListEl = $(".movie-list");
        movieListEl.html("");
        const loadingOverlay = loading();
        let success = false;
        for (let attempt = 1; attempt <= 3 && !success; attempt++) {
            try {
                const movies = await fetchPlaybackRanking(period ?? "daily");
                const html = this.markDataListHtml(movies);
                movieListEl.html(html);
                this.loadScore(movies);
                success = true;
            } catch (error) {
                if (attempt < 3) {
                    clog.error(`获取热播数据失败 (第 ${attempt} 次重试)`, error);
                    await new Promise<void>((resolve) =>
                        setTimeout(resolve, 1000),
                    );
                } else {
                    clog.error("所有重试尝试均失败，无法获取数据。", error);
                }
            } finally {
                if (success || attempt === 3) {
                    loadingOverlay.close();
                }
            }
        }
    }

    /**
     * 渲染日/周/月榜切换工具栏，当前 period 对应按钮高亮（is-info）。
     * 对应原 L4391-4394。
     * @param period 时间段（"daily"/"weekly"/"monthly"），URL 缺省时为 null。
     */
    toolBar(period: string | null): void {
        const html = `\n            <div class="button-group" style="margin-top:18px">\n                <div class="buttons has-addons" id="conditionBox">\n                    <a style="padding:18px 18px !important;" class="button is-small ${period === "daily" ? "is-info" : ""}" href="/advanced_search?handlePlayback=1&period=daily">日榜</a>\n                    <a style="padding:18px 18px !important;" class="button is-small ${period === "weekly" ? "is-info" : ""}" href="/advanced_search?handlePlayback=1&period=weekly">周榜</a>\n                    <a style="padding:18px 18px !important;" class="button is-small ${period === "monthly" ? "is-info" : ""}" href="/advanced_search?handlePlayback=1&period=monthly">月榜</a>\n                </div>\n            </div>\n        `;
        this.contentBox.append(html);
    }

    /**
     * 由分数生成 5 颗星的 HTML（满星 icon-star，空星 icon-star gray）。
     * 对应原 L4395-4405。
     * @param score 评分（取整后为满星数，0-5）。
     * @returns 星级 HTML 字符串。
     */
    getStarRating(score: number): string {
        let html = "";
        const fullStars = Math.floor(score);
        for (let i = 0; i < fullStars; i++) {
            html += '<i class="icon-star"></i>';
        }
        for (let i = 0; i < 5 - fullStars; i++) {
            html += '<i class="icon-star gray"></i>';
        }
        return html;
    }

    /**
     * 为列表中每个可见影片拉取评分（fetchMovieDetail）并渲染到 #score_<id>；
     * 结果按影片 ID 缓存到 localStorage（jhs_score_info）。页面失焦时阻塞等待聚焦。
     * 对应原 L4406-4449。fire-and-forget（IIFE），无参数，无返回值；
     * 单条解析失败仅 clog.error 并继续下一条，不向上抛出；
     * 遇 #score_<id> 缺失时 return 终止整个 IIFE（保留原控制流）。
     */
    loadScore(movies: any[]): void {
        if (movies.length === 0) {
            return;
        }
        (async () => {
            const storageKey = "jhs_score_info";
            for (const movie of movies) {
                try {
                    const movieId = movie.id;
                    if (!$(`#score_${movieId}`).length) {
                        return;
                    }
                    if ($(`#${movieId}`).is(":hidden")) {
                        continue;
                    }
                    const rawCache: string | null =
                        localStorage.getItem(storageKey);
                    const cache: Record<string, string | undefined> = rawCache
                        ? JSON.parse(rawCache)
                        : {};
                    const cachedHtml = cache[movieId];
                    if (cachedHtml) {
                        this.appendScoreHtml(movieId, cachedHtml);
                        continue;
                    }
                    while (!document.hasFocus()) {
                        await new Promise<void>((resolve) =>
                            setTimeout(resolve, 500),
                        );
                    }
                    const detail = await fetchMovieDetail(movieId);
                    const score = detail.score;
                    const watchedCount = detail.watchedCount;
                    const scoreHtml = `\n                        <span class="value">\n                            <span class="score-stars">${this.getStarRating(score)}</span> \n                            &nbsp; ${score}分，由${watchedCount}人評價\n                        </span>\n                    `;
                    this.appendScoreHtml(movieId, scoreHtml);
                    cache[movieId] = scoreHtml;
                    localStorage.setItem(storageKey, JSON.stringify(cache));
                    await new Promise<void>((resolve) =>
                        setTimeout(resolve, 500),
                    );
                } catch (error: any) {
                    clog.error(
                        `🚨 解析评分数据失败 | 编号: ${movie.number}\n`,
                        `错误详情: ${error.message}\n`,
                        error.stack ? `调用栈:\n${error.stack}` : "",
                    );
                }
            }
        })();
    }

    /**
     * 将评分 HTML 写入 #score_<id>：仅当容器存在且为空时，先 slideUp(0) 隐藏再
     * 填充并 slideDown(500) 展开。对应原 L4450-4457。
     * @param movieId 影片 ID。
     * @param html 评分 HTML。
     */
    appendScoreHtml(movieId: any, html: string): void {
        const scoreEl = $(`#score_${movieId}`);
        if (scoreEl.length && scoreEl.html().trim() === "") {
            scoreEl.slideUp(0, function (this: any) {
                $(this).html(html).slideDown(500);
            });
        }
    }

    /**
     * 由热播影片数组生成影片列表 HTML：封面（替换 CDN 域名）、番号+标题、评分占位、
     * 发布日期、磁链标签（含中字/含磁链/无磁链/今日新種）。对应原 L4458-4464。
     * @param movies 热播影片数组。
     * @returns 列表 HTML 字符串。
     */
    markDataListHtml(movies: any[]): string {
        let html = "";
        movies.forEach((movie: any) => {
            html += `\n                <div class="item" id="${movie.id}">\n                    <a href="/v/${movie.id}" class="box" title="${movie.origin_title}">\n                        <div class="cover ">\n                            <img loading="lazy" src="${movie.cover_url.replace("https://tp-iu.cmastd.com/rhe951l4q", "https://c0.jdbstatic.com")}" alt="">\n                        </div>\n                        <div class="video-title"><strong>${movie.number}</strong> ${movie.origin_title}</div>\n                        <div class="score" id="score_${movie.id}">\n                        </div>\n                        <div class="meta">\n                            ${movie.release_date}\n                        </div>\n                        <div class="tags has-addons">\n                           ${movie.has_cnsub ? '<span class="tag is-warning">含中字磁鏈</span>' : movie.magnets_count > 0 ? '<span class="tag is-success">含磁鏈</span>' : '<span class="tag is-info">无磁鏈</span>'}\n                           ${movie.new_magnets ? '<span class="tag is-info">今日新種</span>' : ""}\n                        </div>\n                    </a>\n                </div>\n            `;
        });
        return html;
    }
}
