/**
 * 演员黑名单插件 BlacklistPlugin —— 对应原脚本 archetype/jhs.user.js L7323-7951。
 *
 * 职责：将演员/分类加入黑名单并递归抓取其全部番号写入鉴定记录；维护一个
 * Tabulator 黑名单弹层（搜索/筛选/状态/删除）；解析"下一页"链接并跨页过滤，
 * JavDb 站点超过 60 页时走 Beyond60Plugin 合并请求。
 *
 * JS→TS 改造要点：
 * - 原脚本无 constructor、无 i(this,"field",val) 注入；本类用到的实例字段
 *   （loadObj / tableObj / nextPageLink / lastPageLink / checkBlacklist_ruleTime /
 *   currentCarCount）均为方法内动态赋值，此处改为 class 字段声明（any 字段
 *   不受 strictPropertyInitialization 约束，语义等价）。
 * - 单字母局部变量（原 e/t/n/a/i/s/r/c/d/h/g/p/m/o/l 等）已语义化：
 *   addBlacklist:          event/position/isAlreadyBlacklisted/blacklistInfo/
 *                          isActress/tagName/confirmMessage/starId/name/allName/
 *                          role/movieType/blacklistUrl/notFirstPageByQuery/
 *                          lock/okShow/error/errorShow
 *   openBlacklistDialog:   dialogHtml
 *   getTableData:          blacklist/blacklistCars/searchValue/statusType/
 *                          $dataTypeSelect/dataType/urlType/totalCount/
 *                          actorCount/actressCount/enrichedList/item/isUnCheck/
 *                          carsByStarId/carItem/starId/finalData/cars/sum/row
 *   loadTableData:         data / 各 formatter 的 cell·rowData·role·roleText·
 *                          movieType·movieTypeText·hasTag·tipText·statusText·
 *                          onRendered·deleteBtn·keywordBtn·event·name·starId·
 *                          prefixCounts·acc·carItem·prefix·sortedPrefixes
 *   getCurrentStarUrl:     url / result / match·seg1·seg2·tail
 *   filterAllVideo:        names/$dom/items/nextPageHref/itemEl/$item/carNum/url/
 *                          publishTime/error/resolve/pageHtml/domParser/$parsed
 *   filterActorVideo:      name/starId/$dom/nextPageLink/nextDom/pageNum/
 *                          beyond60Plugin/html/nextUrl/wrapperHtml/pageHtml
 *   parseAndSaveFilterInfo:$dom/names/starId/items/nextPageHref/
 *                          siteType/itemEl/$item/carNum/url/publishTime/carList/
 *                          lastPublishTime/error
 * - 站点/类别单字母常量 o/r/T/I/B/P/D/A 与动作常量 d 改由 ../constants 引入：
 *   currentHref / isJavdbSite / JAVDB / ACTOR / ACTRESS /
 *   CENSORED / UNCENSORED / FILTER_ACTION。
 * - $ / layer / utils / storageManager / show / clog / gmHttp / Tabulator / loading
 *   已由 ../types/globals.d.ts 声明；refresh 在该文件声明为全局 const（原脚本
 *   window.refresh = fn 挂载，浏览器中 window===globalThis，故直接调用 refresh()
 *   与 window.refresh() 等价且类型安全）。
 * - Tabulator 配置对象传入 any（Tabulator 为 any），其内 formatter /
 *   paginationCounter 回调不受上下文类型推导，故所有回调参数显式标注 any，
 *   未用形参以 _ 前缀规避 noUnusedParameters。
 * - 内联 CSS/HTML（含 Tabulator 列配置、\n 转义与缩进）原样保留，仅替换模板
 *   插值变量名；控制流（分支/for/try-catch-finally/IIFE/fire-and-forget .then()）
 *   与原脚本一致。
 * - Tabulator 列定义/中文 locale 已提取至 ./blacklist/blacklist-tabulator
 *   （buildBlacklistTableOptions，复用 createTabulatorOptions + TABULATOR_ZH_CN）；
 *   递归抓取（filterAllVideo / filterActorVideo / parseAndSaveFilterInfo）提取至
 *   ./blacklist/blacklist-scraper，本类保留同名 thin delegate。
 */
import { currentHref, isJavdbSite, ACTOR, ACTRESS } from '../constants/site';

import { jsxToString } from '../core/jsx-to-string';

import type { CarRecord } from '../core/storage-manager';
import type { ActressInfo } from './base-plugin';
import { BasePlugin } from './base-plugin';
import { buildBlacklistTableOptions } from './blacklist/blacklist-tabulator';
import {
    filterAllVideo as _filterAllVideo,
    filterActorVideo as _filterActorVideo,
    parseAndSaveFilterInfo as _parseAndSaveFilterInfo
} from './blacklist/blacklist-scraper';

import { BlacklistDialog } from '../components/blacklist/blacklist-dialog';
import { BlacklistConfirmMessage } from '../components/blacklist/blacklist-confirm-message';
import { BlacklistDataTypeOptions } from '../components/blacklist/blacklist-data-type-options';

export class BlacklistPlugin extends BasePlugin {
    /** 全屏 loading 句柄（addBlacklist 执行期间显示，结束/出错时关闭）。 */
    loadObj: { close: () => void } | null = null;
    /** Tabulator 表格实例（黑名单弹层内，弹层关闭时 destroy 并置空）。 */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Tabulator 无类型声明
    tableObj: any;
    /** 解析过程中最新一页的"下一页"链接（出错时点击跳转用）。 */
    nextPageLink: string | undefined;
    /** 解析过程中到达的最后一页链接（成功结束时点击跳转用）。 */
    lastPageLink: string | undefined;
    /** 黑名单检测间隔（小时），超过该时长未更新则停止检测；默认 8760（≈1 年）。 */
    checkBlacklist_ruleTime: number = 8760;
    /** 当前黑名单涉及的番号总数（paginationCounter 展示用）。 */
    currentCarCount: number = 0;

    /** 返回插件名，供 PluginManager 注册去重。对应原 L7324-7326。 */
    getName(): string {
        return 'BlacklistPlugin';
    }

    /**
     * 将当前演员/分类加入黑名单，并递归抓取其全部番号。
     * 对应原 L7327-7439。
     * @param event 触发点击的 jQuery 事件（取 clientX/clientY 定位确认弹窗）
     */
    async addBlacklist(event: MouseEvent): Promise<void> {
        const position = {
            clientX: event.clientX,
            clientY: event.clientY + 80
        };
        const isAlreadyBlacklisted = $('#addBlacklistBtn span').text().includes('已加入');
        let blacklistInfo: ActressInfo;
        let isActress: boolean;
        let tagName: string = '';
        if (currentHref.includes('/tags')) {
            const tagUrl = new URL(currentHref);
            tagUrl.searchParams.delete('page');
            tagName = $('#jhs-check-tag').text().trim();
            blacklistInfo = {
                starId: 'no-' + tagName,
                name: '虚拟演员-' + tagName,
                allName: ['虚拟演员'],
                role: '虚拟演员',
                movieType: tagName,
                blacklistUrl: tagUrl.toString()
            };
            isActress = false;
        } else {
            blacklistInfo = this.getActressPageInfo();
            isActress = true;
        }
        const { starId, name, allName, role, movieType, blacklistUrl } = blacklistInfo;
        const notFirstPageByQuery = currentHref.includes('page') && !currentHref.includes('page=1');
        const confirmMessage = jsxToString(
            <BlacklistConfirmMessage
                tagName={tagName}
                name={name}
                isAlreadyBlacklisted={isAlreadyBlacklisted}
                isActress={isActress}
                notFirstPageByQuery={notFirstPageByQuery}
            />
        );
        utils.q(position as unknown as MouseEvent, confirmMessage, async () => {
            navigator.locks
                .request(
                    'checkNewActressActorFilterCar',
                    {
                        ifAvailable: true
                    },
                    async (lock: unknown) => {
                        clog.debug('获取锁', lock);
                        if (lock) {
                            this.loadObj = loading();
                            try {
                                await storageManager.addBlacklistItem({
                                    starId: starId ?? undefined,
                                    name,
                                    allName,
                                    role,
                                    movieType,
                                    url: blacklistUrl ?? undefined
                                });
                                await this.filterActorVideo(name, starId);
                                const okShow = show.ok(
                                    `屏蔽结束,是否跳转到最后一页: ${this.lastPageLink}`,
                                    {
                                        duration: -1,
                                        close: true,
                                        onClick: () => {
                                            okShow.closeShow?.();
                                            window.location.href = this.lastPageLink!;
                                        }
                                    }
                                );
                            } catch (error: unknown) {
                                clog.error(error);
                                const errorShow = show.error(
                                    '发生错误, 是否填转到解析失败的那一页? (点击并跳转)',
                                    {
                                        duration: -1,
                                        close: true,
                                        onClick: () => {
                                            errorShow.closeShow?.();
                                            window.location.href = this.nextPageLink!;
                                        }
                                    }
                                );
                            } finally {
                                this.loadObj!.close();
                            }
                        } else {
                            show.error('当前有定时任务在后台执行中, 无法发起此操作');
                        }
                    }
                )
                .catch((lockError: unknown) => {
                    clog.error('锁任务出现错误:', lockError);
                });
        });
    }

    /**
     * 重新读取黑名单检测间隔设置项（设置保存后由 SettingPlugin 调用）。
     * 对应原 L7440-7445。
     */
    async resetBtnTip(): Promise<void> {
        this.checkBlacklist_ruleTime = await storageManager.getSetting(
            'checkBlacklist_ruleTime',
            8760
        );
    }

    /**
     * 打开演员黑名单弹层（layer + Tabulator），绑定搜索/筛选/重置/外链/删除事件。
     * 对应原 L7446-7502。
     */
    async openBlacklistDialog(): Promise<void> {
        const dialogHtml = jsxToString(<BlacklistDialog showUrlType={isJavdbSite} />);
        layer.open({
            type: 1,
            title: '演员黑名单',
            content: dialogHtml,
            scrollbar: false,
            area: utils.getResponsiveArea(['80%', '90%']),
            anim: -1,
            success: async (_layerEl: unknown) => {
                await this.loadTableData();
                $('.layui-layer-content')
                    .on('click', '#cleanQueryBtn', async (_event: unknown) => {
                        $('#searchValue').val('');
                        $('#dataType').val('');
                        $('#statusType').val('');
                        await this.reloadTable();
                    })
                    .on('focusout keydown', '#searchValue', async (event: Event) => {
                        if (event.type === 'focusout' || (event as KeyboardEvent).key === 'Enter') {
                            if ((event as KeyboardEvent).key === 'Enter') {
                                event.preventDefault();
                            }
                            if (event.type === 'keydown' && (event as KeyboardEvent).key !== 'Enter') {
                                return;
                            }
                            $('#dataType').val('');
                            await this.reloadTable();
                        }
                    })
                    .on('change', '#dataType', async () => {
                        $('#searchValue').val('');
                        await this.reloadTable();
                    })
                    .on('change', '#statusType', async () => {
                        await this.reloadTable();
                    })
                    .on('change', '#urlType', async () => {
                        await this.reloadTable();
                    })
                    .on('click', '.open-url', (event: Event) => {
                        event.preventDefault();
                        const $link = $(event.currentTarget);
                        const url = $link.attr('data-url');
                        const name = $link.attr('data-name');
                        utils.openPage(url ?? '', name ?? '', true, event as MouseEvent);
                    });
            },
            end: () => {
                if (this.tableObj) {
                    this.tableObj.destroy();
                    this.tableObj = null;
                }
                refresh();
            }
        });
    }

    /**
     * 按当前筛选条件重新拉取数据并刷新表格。对应原 L7503-7509。
     * 无表格实例时短路返回。
     */
    async reloadTable(): Promise<void> {
        if (!this.tableObj) {
            return;
        }
        const data = await this.getTableData();
        this.tableObj.setData(data);
    }

    /**
     * 读取黑名单并按搜索/性别/状态/屏蔽类型过滤，附带聚合每个演员的番号列表。
     * 对应原 L7510-7573。
     * @returns 过滤后的行数据数组（每行含 carList/count）
     */
    async getTableData() {
        const blacklist = await storageManager.getBlacklist();
        const blacklistCars = await storageManager.getBlacklistCarList();
        const searchValue = $('#searchValue').val();
        const statusType = $('#statusType').val();
        const $dataTypeSelect = $('#dataType');
        const dataType = $dataTypeSelect.val();
        const urlType = $('#urlType').val();
        const totalCount = blacklist.length;
        let actorCount = 0;
        let actressCount = 0;
        const enrichedList = blacklist
            .map((item) => {
                if (item.role === ACTOR) {
                    actorCount++;
                } else if (item.role === ACTRESS) {
                    actressCount++;
                }
                let isUnCheck = false;
                if (item.lastPublishTime) {
                    isUnCheck = !utils.isUnnecessaryCheck(
                        item.lastPublishTime,
                        this.checkBlacklist_ruleTime
                    );
                }
                return {
                    ...item,
                    isUnCheck
                };
            })
            .filter(
                (item) =>
                    (!searchValue || !!item.name!.includes(searchValue)) &&
                    (statusType !== 'normal' || !item.isUnCheck) &&
                    (statusType !== 'stop' || !!item.isUnCheck) &&
                    (dataType
                        ? item.role === dataType
                        : (urlType !== 'hasT' || !!item.url!.includes('t=')) &&
                          (urlType !== 'noT' || !item.url!.includes('t=')))
            );
        $dataTypeSelect.html(
            jsxToString(
                <BlacklistDataTypeOptions
                    totalCount={totalCount}
                    actorCount={actorCount}
                    actressCount={actressCount}
                />
            )
        );
        $dataTypeSelect.val(dataType as string);
        const carsByStarId = new Map<string | undefined, CarRecord[]>();
        for (const carItem of blacklistCars) {
            const starId = carItem.starId;
            if (!carsByStarId.has(starId)) {
                carsByStarId.set(starId, []);
            }
            carsByStarId.get(starId)!.push(carItem);
        }
        const finalData = enrichedList.map((item) => {
            const starId = item.starId;
            const cars = carsByStarId.get(starId) || [];
            return {
                ...item,
                carList: cars,
                count: cars.length
            };
        });
        this.currentCarCount = finalData.reduce(
            (sum: number, row) => sum + (row.count || 0),
            0
        );
        return finalData;
    }

    /**
     * 初始化黑名单 Tabulator 表格（列定义/分页/中文语言/操作列删除按钮）。
     * 对应原 L7574-7786。列定义/中文 locale 已提取至 blacklist/blacklist-tabulator
     * 的 buildBlacklistTableOptions（含 createTabulatorOptions 基础配置）。
     */
    async loadTableData(): Promise<void> {
        this.checkBlacklist_ruleTime =
            (await storageManager.getSetting('checkBlacklist_ruleTime')) || 8760;
        const data = await this.getTableData();
        this.tableObj = new Tabulator('#table-container', buildBlacklistTableOptions(this, data));
    }

    /**
     * 取当前演员页 URL 的标准化形式：去除 sort_type / page 参数与多余的分页段。
     * 对应原 L7787-7802。
     * @returns 处理后的 URL 字符串
     */
    getCurrentStarUrl(): string {
        let url = window.location.href.replace(/([&?])sort_type=[^&]+(&|$)/, '$1');
        url = url.replace(/[&?]$/, '');
        url = url.replace(/\?&/, '?');
        let result = url;
        result = result.replace(/([&?])page=\d+(&|$)/, '$1');
        result = result.replace(/[&?]$/, '');
        result = result.replace(/\?&/, '?');
        result = result.replace(/\/(\d+)(?:\/(\d+))?(\?|$)/, (match, seg1, seg2, tail) =>
            seg2 !== undefined ? `/${seg1}${tail}` : match
        );
        return result;
    }

    /**
     * 从演员 URL 解析其 ID（pathname 末段，去空段后取最后一段）。
     * 对应原 L7803-7811。
     * @param url 演员 URL；为空时抛错
     * @returns 末段 ID；无末段时为 undefined
     */
    parseUrlId(url: string): string | undefined {
        if (!url) {
            throw new Error('url未传入');
        }
        return new URL(url).pathname
            .split('/')
            .filter((seg: string) => seg.trim() !== '')
            .pop();
    }

    /**
     * 递归遍历演员作品列表页，将每个番号写入鉴定记录（屏蔽动作）。
     * 对应原 L7812-7865。实现提取至 blacklist/blacklist-scraper 的 filterAllVideo。
     * @param names 演员名（写入 saveCar.names）
     * @param $dom 可选的已解析页 DOM；缺省时从当前页选择器取
     */
    async filterAllVideo(names: string, $dom?: JQuery): Promise<void> {
        return _filterAllVideo(this, names, $dom);
    }

    /**
     * 递归抓取演员番号并批量写入黑名单番号列表（用于 addBlacklist 后的屏蔽）。
     * JavDb 站点页码超过 60 时改走 Beyond60Plugin 合并请求。对应原 L7866-7893。
     * 实现提取至 blacklist/blacklist-scraper 的 filterActorVideo。
     * @param name 演员名
     * @param starId 演员 starId
     * @param $dom 可选的已解析页 DOM；缺省时从当前页选择器取
     */
    async filterActorVideo(name: string, starId: string | null, $dom?: JQuery): Promise<void> {
        return _filterActorVideo(this, name, starId, $dom);
    }

    /**
     * 解析一页 DOM 中的番号列表并批量保存到黑名单番号列表，返回下一页链接与
     * 首条发行时间。对应原 L7894-7950。实现提取至 blacklist/blacklist-scraper 的
     * parseAndSaveFilterInfo。
     * @param $dom 已解析页 DOM；缺省时从当前页选择器取
     * @param names 演员名（写入 carList.names）
     * @param starId 演员 starId（写入 carList.starId）
     * @returns nextPageLink 下一页 href（无则为 undefined）；lastPublishTime 首条发行时间
     */
    async parseAndSaveFilterInfo(
        $dom: JQuery | undefined,
        names: string,
        starId: string | null
    ): Promise<{ nextPageLink: string | undefined; lastPublishTime: string | null }> {
        return _parseAndSaveFilterInfo(this, $dom, names, starId);
    }
}
