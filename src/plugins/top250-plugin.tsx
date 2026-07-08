/**
 * TOP250 插件 Top250Plugin —— 对应原脚本 archetype/jhs.user.js L4467-4725。
 *
 * 在 JavDb "猜你喜歡"入口拦截跳转，改写 advanced_search?handleTop=1 页面为
 * "Top250"榜单：渲染分类/年份/字幕切换工具栏与分页栏，拉取 Top 排行数据
 * （fetchTopMovies，最多重试 3 次）生成影片列表，并复用 HitShowPlugin 的
 * markDataListHtml / loadScore 渲染封面与评分；未登录移动端接口时弹出登录框
 * （/v1/sessions），令牌写入 localStorage（jhs_appAuthorization）后刷新进入榜单。
 *
 * 单字母局部变量（原 e/t/n/a/i/s/o/r/l/c）已语义化：
 *   handle:            event / target / href / queryString / params
 *   renderPagination:  params / page / hasMore / listHtml / i / event / pageNum / targetPage
 *   handleTop:         params / handleType / typeValue / page / movieListEl / loadingOverlay /
 *                      success / attempt / response / successFlag / message / action /
 *                      movies / movie / filteredMovies / hitShowPlugin / html / error / resolve
 *   toolBar:           handleType / typeValue / page / yearButtonsHtml / year / html /
 *                      event / cnsubValue / _index / el / hrefEl / url /
 *                      filteredMovies / movie / hitShowPlugin / listHtml
 *   checkLogin:        event / params / handleType / typeValue / tValue / path
 *   openLoginDialog:   _layero / index / username / password / loadingOverlay /
 *                      username / password / url / headers / response / successFlag / token / error
 * 原构造函数 i(this,"field",val)（Object.defineProperty，[[Define]] 语义）改为
 * class 字段（useDefineForClassFields:true，语义一致）：
 *   has_cnsub → hasCnsub，$contentBox → contentBox，movies → movies。
 * 原 q / U / O 改由 ../constants/api 引入（fetchTopMovies / API_BASE / reBuildSignature）；
 * 原顶层常量 me（"jhs_appAuthorization"，api.ts 内部同名常量未导出）以本文件
 * APP_AUTH_KEY 局部常量保留，避免修改其它文件。
 * $ / loading / layer / show / clog / gmHttp / GM_openInTab 已由 ../types/globals.d.ts
 * 声明为 any；jQuery .each 回调依赖 this 指向触发元素，按 fold-category-plugin
 * 既有约定以 (this: any) 显式标注，规避 noImplicitThis。
 * handleTop 内 page（原 a = e.get("page") || 1，string|number）统一以 parseInt
 * 归一为 number（与 renderPagination 的 page 解析一致），便于 fetchTopMovies 的
 * number 入参；对 page 缺省等边界与原行为等价（均落到第 1 页）。
 * 内联 HTML 已提取为组件（RankingContainers / Top250ToolBar / Top250YearButton /
 * Top250Pagination / Top250NavLink / Top250ErrorMessage）。
 */
import { LoginDialog } from '../components/login-dialog';
import { RankingContainers } from '../components/ranking-containers';
import { jsxToString } from '../core/jsx-to-string';
import { Top250ErrorMessage, Top250LoadError } from '../components/top250-error-message';
import { Top250NavLink } from '../components/top250-nav-link';
import { Top250Pagination } from '../components/top250-pagination';
import { Top250ToolBar } from '../components/top250-tool-bar';
import { Top250YearButton } from '../components/top250-year-button';
import { API_BASE, reBuildSignature, fetchTopMovies } from '../constants/api';
import { BasePlugin } from './base-plugin';

/** localStorage 中移动端 app 授权令牌的键（原顶层 me，对应 api.ts 内部 APP_AUTH_KEY）。 */
const APP_AUTH_KEY = 'jhs_appAuthorization';

export class Top250Plugin extends BasePlugin {
    /** 中字过滤当前值（"1"=含中字 / "0"=无字幕 / ""=全部）。对应原 L4470。 */
    hasCnsub: string = '';
    /** 内容容器 jQuery 对象，榜单/工具栏/分页挂载点。对应原 L4471。 */
    contentBox: any = $('.section .container');
    /** 最近一次拉取的影片数组，供中字过滤即时重渲染复用。对应原 L4472。 */
    movies: any[] = [];

    /** 返回插件名，供 PluginManager 注册去重。对应原 L4474-4476。 */
    getName(): string {
        return 'TOP250Plugin';
    }

    /**
     * 主处理入口：将"猜你喜歡"入口改写为 Top250 链接，拦截其点击跳转
     * （解析 query 后委托 checkLogin 判断登录态），并触发 handleTop 渲染榜单。
     * 对应原 L4477-4491。与父类声明一致为 async（体内无 await，handleTop 为
     * fire-and-forget）；无参数，返回 Promise<void>，不抛出异常。
     */
    async handle(): Promise<void> {
        $('.main-tabs ul li:contains("猜你喜歡")').html(jsxToString(<Top250NavLink />));
        $('a[href*="rankings/top"]').on('click', (event: any) => {
            event.preventDefault();
            event.stopPropagation();
            const target = $(event.target);
            const href = (target.is('a') ? target : target.closest('a')).attr('href');
            const queryString = href.includes('?') ? href.split('?')[1] : href;
            const params = new URLSearchParams(queryString);
            this.checkLogin(event, params);
        });
        this.handleTop().then();
    }

    /**
     * 改写榜单页结构：标题改"Top250"、清空占位与既有卡片、移除排序开关，
     * 追加工具栏容器与影片列表容器，再渲染分页栏。对应原 L4492-4504。
     * 无参数，无返回值。
     */
    hookPage(): void {
        $('h2.section-title').contents().first().replaceWith('Top250');
        $('.empty-message').remove();
        $('.section .container .box').remove();
        $('#sort-toggle-btn').remove();
        this.contentBox.append(jsxToString(<RankingContainers />));
        this.renderPagination();
    }

    /**
     * 渲染分页栏（固定 5 页，当前页高亮 is-current，首/末页隐藏上一页/下一页），
     * 并绑定分页点击：更新 URL page 参数后 pushState 并刷新。对应原 L4505-4533。
     * 无参数，无返回值；page 解析失败或缺省时落到第 1 页。
     */
    renderPagination(): void {
        const params = new URLSearchParams(window.location.search);
        const page = parseInt(params.get('page') ?? '') || 1;
        this.contentBox.append(jsxToString(<Top250Pagination page={page} />));
        this.contentBox.on(
            'click',
            '.pagination-link, .pagination-previous, .pagination-next',
            (event: any) => {
                event.preventDefault();
                const pageNum = parseInt($(event.currentTarget).data('page'));
                if (!isNaN(pageNum) && pageNum > 0) {
                    ((targetPage: number) => {
                        params.set('page', String(targetPage));
                        window.history.pushState({}, '', '?' + params.toString());
                        window.location.reload();
                    })(pageNum);
                }
            }
        );
    }

    /**
     * 处理榜单页：按 handleType/type_value/has_cnsub/page 渲染工具栏与页面结构，
     * 拉取 Top 数据（最多重试 3 次），成功后按中字过滤渲染列表与评分；
     * 失败且 action 为 JWTVerificationError 时清除令牌并重新触发登录检查。
     * 对应原 L4534-4600。仅当 URL 含 handleTop=1 时执行；无参数，返回 Promise<void>，
     * 拉取失败仅 clog.error 不向上抛出；finally 在成功或末次尝试后关闭 loading 覆盖层。
     */
    async handleTop(): Promise<void> {
        if (!window.location.href.includes('handleTop=1')) {
            return;
        }
        const params = new URLSearchParams(window.location.search);
        const handleType = params.get('handleType') || 'all';
        const typeValue = params.get('type_value') || '';
        this.hasCnsub = params.get('has_cnsub') || '';
        const page = parseInt(params.get('page') ?? '') || 1;
        this.toolBar(handleType, typeValue, page);
        this.hookPage();
        const movieListEl = $('.movie-list');
        movieListEl.html('');
        const loadingOverlay = loading();
        let success = false;
        for (let attempt = 1; attempt <= 3 && !success; attempt++) {
            try {
                const response = await fetchTopMovies(handleType, typeValue, page, 50);
                const successFlag = response.success;
                const message = response.message;
                const action = response.action;
                if (successFlag === 1) {
                    const movies = response.data.movies;
                    if (movies.length === 0) {
                        show.error('无数据');
                        loadingOverlay.close();
                        return;
                    }
                    this.movies = movies;
                    const filteredMovies = movies.filter((movie: any) =>
                        this.hasCnsub === '1'
                            ? movie.has_cnsub
                            : this.hasCnsub !== '0' || !movie.has_cnsub
                    );
                    const hitShowPlugin = this.getBean('HitShowPlugin');
                    const html = hitShowPlugin.markDataListHtml(filteredMovies);
                    movieListEl.html(html);
                    hitShowPlugin.loadScore(filteredMovies);
                    success = true;
                } else {
                    console.error(response);
                    movieListEl.html(jsxToString(<Top250ErrorMessage message={message} />));
                    show.error(message);
                    if (action === 'JWTVerificationError') {
                        await localStorage.removeItem(APP_AUTH_KEY);
                        await this.checkLogin(null, new URLSearchParams(window.location.search));
                    }
                    success = true;
                }
            } catch (error: any) {
                if (attempt < 3) {
                    clog.error(`获取Top数据失败 (第 ${attempt} 次重试):`, error);
                    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
                } else {
                    clog.error('所有重试尝试均失败，无法获取Top数据。', error);
                    movieListEl.html(jsxToString(<Top250LoadError />));
                }
            } finally {
                if (success || attempt === 3) {
                    loadingOverlay.close();
                }
            }
        }
    }

    /**
     * 渲染分类（全部/有码/无码/欧美/Fc2）/年份（当前年→2008）/中字切换工具栏，
     * 当前选项高亮（is-info）；并绑定中字按钮点击：即时更新各链接 has_cnsub 参数、
     * 切换高亮、按新中字值重新过滤已缓存影片并重渲染列表与评分。对应原 L4601-4640。
     * @param handleType 当前分类类型（"all"/"video_type"/"year"）。
     * @param typeValue 当前分类值（"0".."3" 或年份字符串）。
     * @param page 当前页码（5 时移除下一页按钮）。
     */
    toolBar(handleType: string, typeValue: string, page: number): void {
        if (page.toString() === '5') {
            $('.pagination-next').remove();
        }
        $('.pagination-ellipsis').closest('li').remove();
        $('.pagination-list li a').each(function (this: any) {
            if (parseInt($(this).text()) > 5) {
                $(this).closest('li').remove();
            }
        });
        let yearButtonsHtml = '';
        for (let year = new Date().getFullYear(); year >= 2008; year--) {
            yearButtonsHtml += jsxToString(
                <Top250YearButton year={year} typeValue={typeValue} hasCnsub={this.hasCnsub} />
            );
        }
        this.contentBox.append(
            jsxToString(
                <Top250ToolBar
                    handleType={handleType}
                    typeValue={typeValue}
                    hasCnsub={this.hasCnsub}
                    yearButtonsHtml={yearButtonsHtml}
                />
            )
        );
        $('a[data-cnsub-value]').on('click', (event: any) => {
            const cnsubValue = $(event.currentTarget).data('cnsub-value');
            this.hasCnsub = cnsubValue.toString();
            $('a[data-cnsub-value]').removeClass('is-info');
            $(event.currentTarget).addClass('is-info');
            $('.toolbar a.button')
                .not('[data-cnsub-value]')
                .each((_index: number, el: any) => {
                    const hrefEl = $(el);
                    const url = new URL(hrefEl.attr('href'), window.location.origin);
                    url.searchParams.set('has_cnsub', cnsubValue);
                    hrefEl.attr('href', url.toString());
                });
            const filteredMovies = this.movies.filter((movie: any) =>
                this.hasCnsub === '1' ? movie.has_cnsub : this.hasCnsub !== '0' || !movie.has_cnsub
            );
            const hitShowPlugin = this.getBean('HitShowPlugin');
            const listHtml = hitShowPlugin.markDataListHtml(filteredMovies);
            $('.movie-list').html(listHtml);
            hitShowPlugin.loadScore(filteredMovies);
        });
    }

    /**
     * 登录态检查：未登录（localStorage 无 app 授权令牌）时提示并弹出登录框；
     * 已登录则依 URL 的 t 参数（yXXXX=年份 / 其它=video_type）构造榜单跳转地址，
     * Ctrl/Cmd+点击新标签打开，否则当前页跳转。对应原 L4641-4665。
     * @param event 触发事件（可为 null，JWT 失败重试时传 null），用于识别 Ctrl/Cmd 点击。
     * @param params 当前 URL 查询参数，读取 t 字段。
     * @returns Promise<void>；未登录时提前 return。
     */
    async checkLogin(event: any, params: URLSearchParams): Promise<void> {
        if (!localStorage.getItem(APP_AUTH_KEY)) {
            show.error('该类别依赖移动端接口，请先完成登录');
            this.openLoginDialog();
            return;
        }
        let handleType = 'all';
        let typeValue = '';
        const tValue = params.get('t') || '';
        if (/^y\d+$/.test(tValue)) {
            handleType = 'year';
            typeValue = tValue.substring(1);
        } else if (tValue !== '') {
            handleType = 'video_type';
            typeValue = tValue;
        }
        const path = `/advanced_search?handleTop=1&handleType=${handleType}&type_value=${typeValue}`;
        if (event && (event.ctrlKey || event.metaKey)) {
            GM_openInTab(window.location.origin + path, {
                insert: 0
            });
        } else {
            window.location.href = path;
        }
    }

    /**
     * 弹出移动端登录对话框（用户名/密码），提交后调用 /v1/sessions 获取令牌
     * （请求头含 Dart UA、jdsignature 签名），成功写入 localStorage 后跳转
     * 日榜页；失败/异常仅提示不中断。对应原 L4666-4724。无参数，无返回值。
     * 内部链路：click → IIFE(POST /v1/sessions) → then(存令牌+跳转) →
     * catch(提示) → finally(关 loading)；finally 始终关闭 loading 覆盖层。
     */
    openLoginDialog(): void {
        layer.open({
            type: 1,
            title: 'JavDB',
            closeBtn: 1,
            area: ['360px', 'auto'],
            shadeClose: false,
            content: jsxToString(<LoginDialog />),
            success: (_layero: any, index: any) => {
                // 补回原版内联 onfocus/onblur/onmouseover/onmouseout 视觉装饰
                // （jsxToString 忽略 on* 事件属性，组件只保留静态结构）。
                // jQuery `on` 回调内 `this` 为 DOM 元素，须用 function 非 arrow。
                $('#username, #password')
                    .on('focus', function (this: HTMLElement) {
                        this.style.borderColor = '#4a8bfc';
                        this.style.background = '#fff';
                    })
                    .on('blur', function (this: HTMLElement) {
                        this.style.borderColor = '#e0e0e0';
                        this.style.background = '#f9f9f9';
                    });
                $('#loginBtn')
                    .on('mouseover', function (this: HTMLElement) {
                        this.style.background = '#3a7be0';
                    })
                    .on('mouseout', function (this: HTMLElement) {
                        this.style.background = '#4a8bfc';
                    });
                $('#loginBtn').click(function () {
                    const username = $('#username').val();
                    const password = $('#password').val();
                    if (!username || !password) {
                        show.error('请输入用户名和密码');
                        return;
                    }
                    const loadingOverlay = loading();
                    (async (username: any, password: any) => {
                        const url = `${API_BASE}/v1/sessions?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&device_uuid=04b9534d-5118-53de-9f87-2ddded77111e&device_name=iPhone&device_model=iPhone&platform=ios&system_version=17.4&app_version=official&app_version_number=1.9.29&app_channel=official`;
                        const headers = {
                            'user-agent': 'Dart/3.5 (dart:io)',
                            'accept-language': 'zh-TW',
                            'content-type':
                                'multipart/form-data; boundary=--dio-boundary-2210433284',
                            jdsignature: await reBuildSignature()
                        };
                        return await gmHttp.post(url, null, headers);
                    })(username, password)
                        .then(async (response: any) => {
                            const successFlag = response.success;
                            if (successFlag === 0) {
                                show.error(response.message);
                            } else {
                                if (successFlag !== 1) {
                                    clog.error('登录失败', response);
                                    throw new Error(response.message);
                                }
                                {
                                    const token = response.data.token;
                                    await localStorage.setItem(APP_AUTH_KEY, token);
                                    show.ok('登录成功');
                                    layer.close(index);
                                    window.location.href =
                                        '/advanced_search?handleTop=1&period=daily';
                                }
                            }
                        })
                        .catch((error: any) => {
                            clog.error('登录异常:', error);
                            show.error(error.message);
                        })
                        .finally(() => {
                            loadingOverlay.close();
                        });
                });
            }
        });
    }
}
