/**
 * 想看/已观看影片导入插件 WantAndWatchedVideosPlugin —— 对应原脚本 archetype/jhs.user.js L10585-10695。
 *
 * 在 javdb 的「想看(/want_watch_videos)」与「已观看(/watched_videos)」列表页注入
 * 「导入至 JHS」按钮，点击后弹出确认对话框（提示先备份数据），随后遍历当前页影片条目，
 * 逐条调用 storageManager.saveCar 写入 JHS 本地库（已存在的番号跳过），并自动 ajax 翻页
 * 递归解析后续页面直到无下一页，最后调用 refresh() 刷新窗口。
 *
 * 动作类型常量 h（"favorite"）/ p（"hasWatch"）改由 ../constants/status 引入
 * （FAVORITE_ACTION / HAS_WATCH_ACTION）；$ / utils / storageManager / show / loading /
 * refresh 已由 ../types/globals.d.ts 声明（$ 为 any，故 jQuery 链式结果均为 any）。
 * 单字母局部变量（原 e/t/n/s/i/a）已语义化：
 *   clickEvent / confirmMessage / loadingOverlay / error / rootEl / itemElements /
 *   nextPageHref / rawItem / $item / href / carNum / metaText / responseHtml /
 *   domParser / $parsedDom / request。
 * 原构造函数 i(this,"type",null)（Object.defineProperty，[[Define]] 语义）改为 class 字段
 * （useDefineForClassFields:true，语义一致）；内联 HTML 已提取为组件
 * （WantWatchedImportButton / WantWatchedHintSpan）。
 * 因 $ 为 any，jQuery 链式结果均为 any，故局部常量仅以 :string 标注意图，不做窄化。
 * importWantWatchVideos 的首参（原 jQuery 点击事件 e）在内部被 let e = loading() 遮蔽、
 * 从未使用，按 TS 惯例加下划线前缀 _clickEvent 以豁免 noUnusedParameters，签名保持不变。
 */
import { FAVORITE_ACTION, HAS_WATCH_ACTION } from '../constants/status';

import { featureFlags } from '../core/feature-flags';
import { jsxToString } from '../core/jsx-to-string';
import { withLoading } from '../core/util/util-async';

import type { CarSaveInput } from '../core/storage-manager';

import { BasePlugin } from './base-plugin';

import { ConfirmWarn } from '../components/misc/confirm-warn';
import { WantWatchedHintSpan } from '../components/want-watched/want-watched-hint-span';
import { WantWatchedImportButton } from '../components/want-watched/want-watched-import-button';

export class WantAndWatchedVideosPlugin extends BasePlugin {
    /** 当前导入动作类型（"favorite" 或 "hasWatch"），由按钮点击时设定。对应原 L10588。 */
    type: string | null = null;
    /** 批量导入当前页码（flag 开时使用） */
    currentPage: number = 1;

    /** 返回插件名，供 PluginManager 注册去重。对应原 L10590-10592。 */
    getName(): string {
        return 'WantAndWatchedVideosPlugin';
    }

    /**
     * 主处理入口：识别「想看」/「已观看」列表页并注入导入按钮与提示文案。
     * 对应原 L10593-10624。
     * 无参数，返回 Promise<void>，不抛异常；按钮点击触发 importWantWatchVideos。
     */
    async handle(): Promise<void> {
        if (window.location.href.includes('/want_watch_videos')) {
            $('h3').append(jsxToString(<WantWatchedImportButton variant="want" />));
            $('h3').append(jsxToString(<WantWatchedHintSpan variant="want" />));
            $('#wantWatchBtn').on('click', (clickEvent: Event) => {
                this.type = FAVORITE_ACTION;
                this.importWantWatchVideos(clickEvent, '是否将 想看的影片 导入到 JHS-收藏?');
            });
        }
        if (window.location.href.includes('/watched_videos')) {
            $('h3').append(jsxToString(<WantWatchedImportButton variant="watched" />));
            $('h3').append(jsxToString(<WantWatchedHintSpan variant="watched" />));
            $('#wantWatchBtn').on('click', (clickEvent: Event) => {
                this.type = HAS_WATCH_ACTION;
                this.importWantWatchVideos(clickEvent, '是否将 看过的影片 导入到 JHS-已观看?');
            });
        }
    }

    /**
     * 弹出确认对话框，确认后执行导入流程：显示 loading 蒙层，调用 parseMovieList 解析
     * 列表并逐条写入 JHS 库，无论成功失败均关闭蒙层。对应原 L10625-10640。
     * @param _clickEvent jQuery 点击事件（原签名保留，内部未使用，仅占位以维持调用约定）。
     * @param confirmMessage 确认对话框正文（带备份数据警告）。
     * 无返回值；不抛异常（parseMovieList 的异常被 try/catch 兜底）。
     */
    importWantWatchVideos(_clickEvent: Event, confirmMessage: string): void {
        utils.q(
            null,
            confirmMessage + ' ' + jsxToString(<ConfirmWarn text="执行此功能前请记得备份数据" />),
            async () => {
                await withLoading(async () => {
                    this.currentPage = 1;
                    await this.parseMovieList();
                }).catch((error) => {
                    clog.error(error);
                });
            }
        );
    }

    /**
     * 解析影片列表页：遍历条目提取番号/链接/发布时间并写入 JHS 库。
     * flag 开：Set 查重 + 批量 saveCarList + 200ms 间隔；
     * flag 关：逐条 getCar/saveCar + 1000ms ajax 翻页。
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jQuery object from $ / utils.htmlTo$dom
    async parseMovieList(rootEl?: any): Promise<void> {
        if (featureFlags.wantWatchBatchImport) {
            await this.parseMovieListBatch(rootEl);
            return;
        }
        let itemElements;
        let nextPageHref: string;
        if (rootEl) {
            itemElements = rootEl.find(this.getSelector().itemSelector);
            nextPageHref = rootEl.find('.pagination-next').attr('href') ?? '';
        } else {
            itemElements = $(this.getSelector().itemSelector);
            nextPageHref = $('.pagination-next').attr('href') ?? '';
        }
        for (const rawItem of itemElements) {
            const $item = $(rawItem);
            const href: string = $item.find('a').attr('href') ?? '';
            const carNum: string = $item.find('.video-title strong').text().trim();
            const metaText: string = $item.find('.meta').text().trim();
            if (href && carNum) {
                try {
                    if (await storageManager.getCar(carNum)) {
                        show.info(`${carNum} 已存在, 跳过`);
                        continue;
                    }
                    await storageManager.saveCar({
                        carNum: carNum,
                        url: href,
                        names: undefined,
                        actionType: this.type!,
                        publishTime: metaText ?? undefined
                    });
                } catch (error) {
                    clog.error(`保存失败 [${carNum}]:`, error);
                }
            }
        }
        if (nextPageHref) {
            show.info('发现下一页，正在解析:', nextPageHref);
            await new Promise<void>((resolve) => setTimeout(resolve, 1000));
            $.ajax({
                url: nextPageHref,
                method: 'GET',
                success: (responseHtml: string) => {
                    const domParser = new DOMParser();
                    const $parsedDom = $(domParser.parseFromString(responseHtml, 'text/html'));
                    this.parseMovieList($parsedDom);
                },
                error: function (request: { message?: string }) {
                    clog.error(request);
                    show.error('加载下一页失败:' + request.message);
                }
            });
        } else {
            show.ok('导入结束!');
            refresh();
        }
    }

    /** 批量导入优化路径（Set 查重 + saveCarList + gmHttp 翻页）。 */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jQuery object from $ / utils.htmlTo$dom
    async parseMovieListBatch(rootEl?: any): Promise<void> {
        const container = rootEl || $('body');
        const movieList = container.find(this.getSelector().itemSelector);
        const nextPageLink = container.find('.pagination-next').attr('href');
        if (movieList.length === 0) {
            show.ok('导入结束!');
            refresh();
            return;
        }
        show.info(`正在处理第 ${this.currentPage} 页...`);
        const allLocalCars = await storageManager.getCarList();
        const carNumCache = new Set(
            allLocalCars.map((c: { carNum: string }) =>
                featureFlags.caseInsensitiveCarNum ? c.carNum.toLowerCase() : c.carNum
            )
        );
        const currentPageRecords: Record<string, unknown>[] = [];
        movieList.each((_i: number, element: HTMLElement) => {
            const item = $(element);
            const carNum2 = item.find('.video-title strong').text().trim();
            const href = item.find('a').attr('href');
            const publishTime = item.find('.meta').text().trim();
            const key = featureFlags.caseInsensitiveCarNum
                ? carNum2.toLowerCase()
                : carNum2;
            if (carNum2 && href && !carNumCache.has(key)) {
                currentPageRecords.push({
                    carNum: carNum2,
                    url: href,
                    names: null,
                    actionType: this.type,
                    publishTime
                });
                carNumCache.add(key);
            }
        });
        if (currentPageRecords.length > 0) {
            try {
                await storageManager.saveCarList(currentPageRecords as unknown as CarSaveInput[]);
                clog.log(
                    `第 ${this.currentPage} 页：成功写入 ${currentPageRecords.length} 条`
                );
            } catch (e) {
                clog.error('批量保存失败:', e);
            }
        }
        this.currentPage++;
        if (!nextPageLink) {
            show.ok('导入结束!');
            refresh();
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
        try {
            const html = await gmHttp.get(nextPageLink);
            const next$dom = utils.htmlTo$dom(String(html));
            await this.parseMovieListBatch(next$dom);
        } catch (e) {
            clog.error('请求下一页失败', e);
            show.error('加载下一页失败');
        }
    }
}
