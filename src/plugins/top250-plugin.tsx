/**
 * TOP250 插件 Top250Plugin —— 对应原脚本 archetype/jhs.user.js L4467-4725。
 *
 * 榜单以外的页面保留导航栏和旧「猜你喜歡」标签的增强入口，原站榜单整页不接管。
 * 仅在原站高级检索承载页明确开启增强模式时渲染筛选工具栏与分页，拉取排行数据
 * （fetchTopMovies，最多重试 3 次）生成影片列表，并复用 HitShowPlugin 的
 * markDataListHtml / loadScore 渲染封面与评分；未登录移动端接口时弹出登录框
 * （/v1/sessions），令牌写入 localStorage（jhs_appAuthorization）后刷新进入榜单。
 *
 * 单字母局部变量（原 e/t/n/a/i/s/o/r/l/c）已语义化：
 *   handle:            定位增强入口；原站榜单与其分页使用浏览器默认导航
 *   handleTop:         params / handleType / typeValue / page / movieListEl / loadingOverlay /
 *                      success / attempt / response / successFlag / message / action /
 *                      movies / movie / filteredMovies / hitShowPlugin / html / error / resolve
 *   toolBar:           handleType / typeValue / page / yearButtonsHtml / year / html /
 *                      event / cnsubValue / _index / el / hrefEl / url /
 *                      filteredMovies / movie / hitShowPlugin / listHtml
 *   openLoginDialog:   _layero / index / username / password / loadingOverlay /
 *                      username / password / url / headers / response / successFlag / token / error
 * 原构造函数 i(this,"field",val)（Object.defineProperty，[[Define]] 语义）改为
 * class 字段（useDefineForClassFields:true，语义一致）：
 *   has_cnsub → hasCnsub，$contentBox → contentBox，movies → movies。
 * 原 q / U / O 改由 ../constants/api 引入（fetchTopMovies / API_BASE / reBuildSignature）；
 * 原顶层常量 me（"jhs_appAuthorization"，api.ts 内部同名常量未导出）以本文件
 * APP_AUTH_KEY 局部常量保留，避免修改其它文件。
 * $ / loading / layer / show / clog / gmHttp 已由 ../types/globals.d.ts
 * 声明为 any；jQuery .each 回调依赖 this 指向触发元素，按 fold-category-plugin
 * 既有约定以 (this: any) 显式标注，规避 noImplicitThis。
 * handleTop 统一解析当前页，供分页高亮和数据请求共用；缺省为第 1 页。
 * 内联 HTML 已提取为组件（RankingContainers / Top250ToolBar / Top250YearButton /
 * Top250Pagination / Top250NavLink / Top250ErrorMessage）。
 */
import { API_BASE, reBuildSignature, fetchTopMovies, type RankingMovie } from '../constants/api';
import { TOP250_HOST_PATH, top250Href } from '../constants/top250';

import { jsxToString } from '../core/jsx-to-string';
import { siteSelector } from '../core/util/site/selectors';
import { withLoading } from '../core/util/util-async';

import { BasePlugin } from './base-plugin';

import { LoginDialog } from '../components/dialogs/login-dialog';
import { RankingContainers } from '../components/movie/ranking-containers';
import { Top250ErrorMessage, Top250LoadError } from '../components/top250/top250-error-message';
import { Top250NavLink } from '../components/top250/top250-nav-link';
import { Top250Pagination } from '../components/top250/top250-pagination';
import { Top250ToolBar } from '../components/top250/top250-tool-bar';
import { Top250YearButton } from '../components/top250/top250-year-button';

/** localStorage 中移动端 app 授权令牌的键（原顶层 me，对应 api.ts 内部 APP_AUTH_KEY）。 */
const APP_AUTH_KEY = 'jhs_appAuthorization';

export class Top250Plugin extends BasePlugin {
    /** 中字过滤当前值（"1"=含中字 / "0"=无字幕 / ""=全部）。对应原 L4470。 */
    hasCnsub: string = '';
    /** 内容容器 jQuery 对象，榜单/工具栏/分页挂载点。对应原 L4471。 */
    contentBox = $('.section .container');
    /** 最近一次拉取的影片数组，供中字过滤即时重渲染复用。对应原 L4472。 */
    movies: RankingMovie[] = [];

    /** 返回插件名，供 PluginManager 注册去重。对应原 L4474-4476。 */
    getName(): string {
        return 'Top250Plugin';
    }

    /** 只改榜单外的两个入口，不根据目标 URL 模糊匹配整页链接。 */
    async handle(): Promise<void> {
        if (/^\/rankings\/top\/?$/.test(window.location.pathname)) return;

        const href = top250Href();
        $(siteSelector('navRankTop')).attr('href', href);
        for (const tab of document.querySelectorAll(`${siteSelector('mainTabs')} ul li`)) {
            if (tab.textContent?.includes('猜你喜歡')) {
                tab.innerHTML = jsxToString(<Top250NavLink href={href} />);
            }
        }
        await this.handleTop();
    }

    /**
     * 改写榜单页结构：标题改"Top250"、清空占位与既有卡片、移除排序开关，
     * 追加工具栏容器与影片列表容器，再渲染增强榜单自己的分页栏。
     */
    hookPage(page: number): void {
        $('h2.section-title').contents().first().replaceWith('Top250');
        $('.empty-message').remove();
        $('.section .container .box').remove();
        $('#sort-toggle-btn').remove();
        this.contentBox.append(jsxToString(<RankingContainers />));
        this.contentBox.append(
            jsxToString(<Top250Pagination page={page} search={window.location.search} />)
        );
    }

    /**
     * 处理榜单页：按 handleType/type_value/has_cnsub/page 渲染工具栏与页面结构，
     * 拉取 Top 数据（最多重试 3 次），成功后按中字过滤渲染列表与评分；
     * 失败且 action 为 JWTVerificationError 时清除令牌并重新触发登录检查。
     * 只在明确的增强榜单路由工作，不能把其他页面的查询值或片段误认作路由开关。
     */
    async handleTop(): Promise<void> {
        if (window.location.pathname.replace(/\/$/, '') !== TOP250_HOST_PATH) {
            return;
        }
        const params = new URLSearchParams(window.location.search);
        if (params.get('handleTop') !== '1') return;
        if (!this.contentBox.length) {
            show.error('当前页面缺少榜单容器，无法加载增强榜单');
            return;
        }
        if (!localStorage.getItem(APP_AUTH_KEY)) {
            this.openLoginDialog();
            return;
        }
        const handleType = params.get('handleType') || 'all';
        const typeValue = params.get('type_value') || '';
        this.hasCnsub = params.get('has_cnsub') || '';
        const page = parseInt(params.get('page') ?? '') || 1;
        this.toolBar(handleType, typeValue, page);
        this.hookPage(page);
        const movieListEl = $('.movie-list');
        movieListEl.html('');
        await withLoading(async () => {
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
                            return;
                        }
                        this.movies = movies;
                        const filteredMovies = movies.filter((movie) =>
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
                            localStorage.removeItem(APP_AUTH_KEY);
                            this.openLoginDialog();
                        }
                        success = true;
                    }
                } catch (error: unknown) {
                    if (attempt < 3) {
                        clog.error(`获取Top数据失败 (第 ${attempt} 次重试):`, error);
                        await new Promise<void>((resolve) => setTimeout(resolve, 1000));
                    } else {
                        clog.error('所有重试尝试均失败，无法获取Top数据。', error);
                        movieListEl.html(jsxToString(<Top250LoadError />));
                    }
                }
            }
        });
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
        $('.pagination-list li a').each(function (this: HTMLElement) {
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
        const toolbar = $(
            jsxToString(
                <Top250ToolBar
                    handleType={handleType}
                    typeValue={typeValue}
                    hasCnsub={this.hasCnsub}
                    yearButtonsHtml={yearButtonsHtml}
                />
            )
        ).appendTo(this.contentBox);
        const subtitleButtons = toolbar.find('a[data-cnsub-value]');
        subtitleButtons.on('click', (event: Event) => {
            const cnsubValue = (event.currentTarget as HTMLAnchorElement).dataset.cnsubValue!;
            this.hasCnsub = cnsubValue;
            subtitleButtons.removeClass('is-info');
            $(event.currentTarget).addClass('is-info');
            toolbar.find('a[href]').add(this.contentBox.find('.jhs-top250-pages a[href]'))
                .each((_index: number, link: HTMLAnchorElement) => {
                    const url = new URL(link.href);
                    url.searchParams.set('has_cnsub', cnsubValue);
                    link.href = url.href;
                });
            const filteredMovies = this.movies.filter((movie) =>
                this.hasCnsub === '1' ? movie.has_cnsub : this.hasCnsub !== '0' || !movie.has_cnsub
            );
            const hitShowPlugin = this.getBean('HitShowPlugin');
            const listHtml = hitShowPlugin.markDataListHtml(filteredMovies);
            $('.movie-list').html(listHtml);
            hitShowPlugin.loadScore(filteredMovies);
        });
    }

    /**
     * 弹出移动端登录对话框（用户名/密码），提交后调用 /v1/sessions 获取令牌
     * 成功后刷新当前增强榜单，保留用户选择的分类和页码。只在增强页调用。
     */
    openLoginDialog(): void {
        show.error('该类别依赖移动端接口，请先完成登录');
        layer.open({
            type: 1,
            title: 'JavDB',
            closeBtn: 1,
            area: ['360px', 'auto'],
            shadeClose: false,
            content: jsxToString(<LoginDialog />),
            success: (_layero: unknown, index: number) => {
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
                    withLoading(async () => {
                        const response = await (async (username: string, password: string) => {
                            const url = `${API_BASE}/v1/sessions?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&device_uuid=04b9534d-5118-53de-9f87-2ddded77111e&device_name=iPhone&device_model=iPhone&platform=ios&system_version=17.4&app_version=official&app_version_number=1.9.29&app_channel=official`;
                            const headers = {
                                'user-agent': 'Dart/3.5 (dart:io)',
                                'accept-language': 'zh-TW',
                                'content-type':
                                    'multipart/form-data; boundary=--dio-boundary-2210433284',
                                jdsignature: await reBuildSignature()
                            };
                            return (await gmHttp.post(url, undefined, headers)) as { success: number; message: string; data: { token: string } };
                        })(username, password);
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
                                window.location.reload();
                            }
                        }
                    }).catch((error: unknown) => {
                        clog.error('登录异常:', error);
                        show.error(error instanceof Error ? error.message : String(error));
                    });
                });
            }
        });
    }
}
