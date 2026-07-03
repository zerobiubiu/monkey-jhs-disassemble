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
 *                          confirmMessage/tagUrl/tagName/starId/name/allName/
 *                          role/movieType/blacklistUrl/lock/okShow/error/errorShow
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
 *   parseAndSaveFilterInfo:$dom/names/starId/items/nextPageHref/isJavbusDom/
 *                          siteType/itemEl/$item/carNum/url/publishTime/carList/
 *                          lastPublishTime/error
 * - 站点/类别单字母常量 o/r/l/T/I/B/P/D/A 与动作常量 d 改由 ../constants 引入：
 *   currentHref / isJavdbSite / isJavbusSite / JAVDB / JAVBUS / ACTOR / ACTRESS /
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
 */
import { BasePlugin, ActressInfo } from "./base-plugin";
import { BlacklistDialog } from "../components/blacklist-dialog";
import {
    currentHref,
    isJavdbSite,
    isJavbusSite,
    JAVDB,
    JAVBUS,
    ACTOR,
    ACTRESS,
    CENSORED,
    UNCENSORED,
} from "../constants/site";
import { FILTER_ACTION } from "../constants/status";

export class BlacklistPlugin extends BasePlugin {
    /** 全屏 loading 句柄（addBlacklist 执行期间显示，结束/出错时关闭）。 */
    loadObj: any;
    /** Tabulator 表格实例（黑名单弹层内，弹层关闭时 destroy 并置空）。 */
    tableObj: any;
    /** 解析过程中最新一页的"下一页"链接（出错时点击跳转用）。 */
    nextPageLink: any;
    /** 解析过程中到达的最后一页链接（成功结束时点击跳转用）。 */
    lastPageLink: any;
    /** 黑名单检测间隔（小时），超过该时长未更新则停止检测；默认 8760（≈1 年）。 */
    checkBlacklist_ruleTime: number = 8760;
    /** 当前黑名单涉及的番号总数（paginationCounter 展示用）。 */
    currentCarCount: number = 0;

    /** 返回插件名，供 PluginManager 注册去重。对应原 L7324-7326。 */
    getName(): string {
        return "BlacklistPlugin";
    }

    /**
     * 将当前演员/分类加入黑名单，并递归抓取其全部番号。
     * 对应原 L7327-7439。
     * @param event 触发点击的 jQuery 事件（取 clientX/clientY 定位确认弹窗）
     */
    async addBlacklist(event: any): Promise<void> {
        const position = {
            clientX: event.clientX,
            clientY: event.clientY + 80,
        };
        const isAlreadyBlacklisted = $("#addBlacklistBtn span")
            .text()
            .includes("已加入");
        let blacklistInfo: ActressInfo;
        let confirmMessage: string;
        if (currentHref.includes("/tags")) {
            const tagUrl = new URL(currentHref);
            tagUrl.searchParams.delete("page");
            const tagName = $("#jhs-check-tag").text().trim();
            blacklistInfo = {
                starId: "no-" + tagName,
                name: "虚拟演员-" + tagName,
                allName: ["虚拟演员"],
                role: "虚拟演员",
                movieType: tagName,
                blacklistUrl: tagUrl.toString(),
            };
            confirmMessage = `是否将分类 <span style="color: #f40">${tagName}</span> 加入到黑名单中?`;
            if (isAlreadyBlacklisted) {
                confirmMessage = `分类 <span style="color: #f40">${tagName}</span> 已在黑名单中, 是否从当前页开始追加屏蔽?`;
            }
        } else {
            blacklistInfo = this.getActressPageInfo();
            confirmMessage = `是否将该演员 <span style="color: #f40">${blacklistInfo.name}</span> 加入到黑名单中?`;
            if (isAlreadyBlacklisted) {
                confirmMessage = `演员 <span style="color: #f40">${blacklistInfo.name}</span> 已在黑名单中, 是否从当前页开始追加屏蔽?`;
            }
        }
        const { starId, name, allName, role, movieType, blacklistUrl } =
            blacklistInfo;
        if (currentHref.includes("page") && !currentHref.includes("page=1")) {
            confirmMessage +=
                "<br/> 注意: 当前页面非第一页, 屏蔽数据将从此页面开始";
        }
        if (isJavbusSite) {
            const starParts = currentHref.split("/star/")[1].split("/");
            if (starParts.length > 1) {
                if (parseInt(starParts[1]) > 1) {
                    confirmMessage +=
                        "<br/> 注意: 当前页面非第一页, 屏蔽数据将从此页面开始";
                }
            }
        }
        utils.q(position, confirmMessage, async () => {
            navigator.locks
                .request(
                    "checkNewActressActorFilterCar",
                    {
                        ifAvailable: true,
                    },
                    async (lock: any) => {
                        clog.debug("获取锁", lock);
                        if (lock) {
                            this.loadObj = loading();
                            try {
                                await storageManager.addBlacklistItem({
                                    starId,
                                    name,
                                    allName,
                                    role,
                                    movieType,
                                    url: blacklistUrl,
                                });
                                await this.filterActorVideo(name, starId);
                                const okShow = show.ok(
                                    `屏蔽结束,是否跳转到最后一页: ${this.lastPageLink}`,
                                    {
                                        duration: -1,
                                        close: true,
                                        onClick: () => {
                                            okShow.closeShow();
                                            window.location.href =
                                                this.lastPageLink;
                                        },
                                    },
                                );
                            } catch (error: any) {
                                clog.error(error);
                                const errorShow = show.error(
                                    "发生错误, 是否填转到解析失败的那一页? (点击并跳转)",
                                    {
                                        duration: -1,
                                        close: true,
                                        onClick: () => {
                                            errorShow.closeShow();
                                            window.location.href =
                                                this.nextPageLink;
                                        },
                                    },
                                );
                            } finally {
                                this.loadObj.close();
                            }
                        } else {
                            show.error(
                                "当前有定时任务在后台执行中, 无法发起此操作",
                            );
                        }
                    },
                )
                .catch((lockError: any) => {
                    console.error("锁任务出现错误:", lockError);
                    clog.error("锁任务出现错误:", lockError);
                });
        });
    }

    /**
     * 重新读取黑名单检测间隔设置项（设置保存后由 SettingPlugin 调用）。
     * 对应原 L7440-7445。
     */
    async resetBtnTip(): Promise<void> {
        this.checkBlacklist_ruleTime = await storageManager.getSetting(
            "checkBlacklist_ruleTime",
            8760,
        );
    }

    /**
     * 打开演员黑名单弹层（layer + Tabulator），绑定搜索/筛选/重置/外链/删除事件。
     * 对应原 L7446-7502。
     */
    async openBlacklistDialog(): Promise<void> {
        const dialogHtml = BlacklistDialog({ showUrlType: isJavdbSite });
        layer.open({
            type: 1,
            title: "演员黑名单",
            content: dialogHtml,
            scrollbar: false,
            area: utils.getResponsiveArea(["80%", "90%"]),
            anim: -1,
            success: async (_layerEl: any) => {
                await this.loadTableData();
                $(".layui-layer-content")
                    .on("click", "#cleanQueryBtn", async (_event: any) => {
                        $("#searchValue").val("");
                        $("#dataType").val("");
                        $("#statusType").val("");
                        await this.reloadTable();
                    })
                    .on(
                        "focusout keydown",
                        "#searchValue",
                        async (event: any) => {
                            if (
                                event.type === "focusout" ||
                                event.key === "Enter"
                            ) {
                                if (event.key === "Enter") {
                                    event.preventDefault();
                                }
                                if (
                                    event.type === "keydown" &&
                                    event.key !== "Enter"
                                ) {
                                    return;
                                }
                                $("#dataType").val("");
                                await this.reloadTable();
                            }
                        },
                    )
                    .on("change", "#dataType", async () => {
                        $("#searchValue").val("");
                        await this.reloadTable();
                    })
                    .on("change", "#statusType", async () => {
                        await this.reloadTable();
                    })
                    .on("change", "#urlType", async () => {
                        await this.reloadTable();
                    })
                    .on("click", ".open-url", (event: any) => {
                        event.preventDefault();
                        const $link = $(event.currentTarget);
                        const url = $link.attr("data-url");
                        const name = $link.attr("data-name");
                        utils.openPage(url, name, true, event);
                    });
            },
            end: () => {
                if (this.tableObj) {
                    this.tableObj.destroy();
                    this.tableObj = null;
                }
                refresh();
            },
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
    async getTableData(): Promise<any[]> {
        const blacklist: any[] = await storageManager.getBlacklist();
        const blacklistCars: any[] = await storageManager.getBlacklistCarList();
        const searchValue = $("#searchValue").val();
        const statusType = $("#statusType").val();
        const $dataTypeSelect = $("#dataType");
        const dataType = $dataTypeSelect.val();
        const urlType = $("#urlType").val();
        const totalCount = blacklist.length;
        let actorCount = 0;
        let actressCount = 0;
        const enrichedList = blacklist
            .map((item: any) => {
                if (item.role === ACTOR) {
                    actorCount++;
                } else if (item.role === ACTRESS) {
                    actressCount++;
                }
                let isUnCheck = false;
                if (item.lastPublishTime) {
                    isUnCheck = !utils.isUnnecessaryCheck(
                        item.lastPublishTime,
                        this.checkBlacklist_ruleTime,
                    );
                }
                return {
                    ...item,
                    isUnCheck,
                };
            })
            .filter(
                (item: any) =>
                    (!searchValue || !!item.name.includes(searchValue)) &&
                    (statusType !== "normal" || !item.isUnCheck) &&
                    (statusType !== "stop" || !!item.isUnCheck) &&
                    (dataType
                        ? item.role === dataType
                        : (urlType !== "hasT" || !!item.url.includes("t=")) &&
                          (urlType !== "noT" || !item.url.includes("t="))),
            );
        $dataTypeSelect.html(
            `\n            <option value="">所有 (${totalCount})</option>\n            <option value="actor">男演员 (${actorCount})</option>\n            <option value="actress">女演员 (${actressCount})</option>\n        `,
        );
        $dataTypeSelect.val(dataType);
        const carsByStarId = new Map<any, any>();
        for (const carItem of blacklistCars) {
            const starId = carItem.starId;
            if (!carsByStarId.has(starId)) {
                carsByStarId.set(starId, []);
            }
            carsByStarId.get(starId).push(carItem);
        }
        const finalData = enrichedList.map((item: any) => {
            const starId = item.starId;
            const cars = carsByStarId.get(starId) || [];
            return {
                ...item,
                carList: cars,
                count: cars.length,
            };
        });
        this.currentCarCount = finalData.reduce(
            (sum: number, row: any) => sum + (row.count || 0),
            0,
        );
        return finalData;
    }

    /**
     * 初始化黑名单 Tabulator 表格（列定义/分页/中文语言/操作列删除按钮）。
     * 对应原 L7574-7786。内联列配置与 HTML 原样保留。
     */
    async loadTableData(): Promise<void> {
        this.checkBlacklist_ruleTime =
            (await storageManager.getSetting("checkBlacklist_ruleTime")) ||
            8760;
        const data = await this.getTableData();
        this.tableObj = new Tabulator("#table-container", {
            layout: "fitColumns",
            placeholder: "暂无数据",
            virtualDom: true,
            data,
            pagination: true,
            paginationMode: "local",
            paginationSize: 20,
            paginationSizeSelector: [20, 50, 100, 1000, 99999],
            paginationCounter: (
                _pageSize: any,
                _pageNo: any,
                _maxPage: any,
                actorCount: any,
                _pages: any,
            ) =>
                `演员: ${actorCount} &nbsp;&nbsp;&nbsp;番号总数: ${this.currentCarCount}  <span id="checkBlacklistMsg" style="margin-left: 10px"></span>`,
            responsiveLayout: "collapse",
            responsiveLayoutCollapse: true,
            columnDefaults: {
                headerHozAlign: "center",
                hozAlign: "center",
            },
            index: "starId",
            columns: [
                {
                    title: "演员",
                    field: "name",
                    sorter: "string",
                    minWidth: 100,
                    responsive: 0,
                    headerSort: false,
                    formatter: (
                        cell: any,
                        _formatterParams: any,
                        _onRendered: any,
                    ) => {
                        const rowData = cell.getData();
                        return `<a class="open-url" data-url="${rowData.url}" href="${rowData.url}" data-name="${rowData.name}" target="_blank">${rowData.name}</a>`;
                    },
                },
                {
                    title: "性别角色",
                    field: "role",
                    sorter: "string",
                    width: 120,
                    responsive: 5,
                    formatter: (
                        cell: any,
                        _formatterParams: any,
                        _onRendered: any,
                    ) => {
                        const role = cell.getData().role;
                        let roleText = role;
                        if (role === ACTOR) {
                            roleText = "男演员";
                        } else if (role === ACTRESS) {
                            roleText = "女演员";
                        }
                        return roleText;
                    },
                },
                {
                    title: "影视类别",
                    field: "movieType",
                    sorter: "string",
                    width: 120,
                    responsive: 5,
                    formatter: (
                        cell: any,
                        _formatterParams: any,
                        _onRendered: any,
                    ) => {
                        const movieType = cell.getData().movieType;
                        let movieTypeText = movieType;
                        if (movieType === CENSORED) {
                            movieTypeText = "有码";
                        } else if (movieType === UNCENSORED) {
                            movieTypeText = "无码";
                        }
                        return movieTypeText;
                    },
                },
                {
                    title: "屏蔽类型",
                    field: "url",
                    sorter: "string",
                    minWidth: 120,
                    responsive: 4,
                    visible: isJavdbSite,
                    formatter: (
                        cell: any,
                        _formatterParams: any,
                        _onRendered: any,
                    ) => {
                        const hasTag = cell.getData().url.includes("t=");
                        return `<span style="${hasTag ? "color:#cc4444" : ""}">${hasTag ? "按所选分类屏蔽" : "未筛选分类"}</span>`;
                    },
                },
                {
                    title: "番号数量",
                    field: "count",
                    sorter: "number",
                    width: 170,
                    responsive: 1,
                },
                {
                    title: "创建时间",
                    field: "createTime",
                    sorter: "string",
                    width: 170,
                    responsive: 5,
                },
                {
                    title: "最后发行时间",
                    field: "lastPublishTime",
                    sorter: "string",
                    width: 170,
                    responsive: 1,
                },
                {
                    title: "状态",
                    field: "isUnCheck",
                    sorter: "string",
                    width: 120,
                    responsive: 1,
                    formatter: (
                        cell: any,
                        _formatterParams: any,
                        _onRendered: any,
                    ) => {
                        let tipText = "";
                        let statusText = "正常检测";
                        if (cell.getData().isUnCheck) {
                            tipText = `停更${this.checkBlacklist_ruleTime / 24 / 365}年以上, 下轮任务不再进行检测`;
                            statusText = "停止检测";
                        }
                        return `<span data-tip="${tipText}" style="${tipText ? "color: #cc4444;" : ""}">${statusText}</span>`;
                    },
                },
                {
                    title: "操作",
                    sorter: "string",
                    cssClass: "action-cell-dropdown",
                    minWidth: 150,
                    responsive: 0,
                    headerSort: false,
                    formatter: (
                        cell: any,
                        _formatterParams: any,
                        onRendered: any,
                    ) => {
                        const rowData = cell.getData();
                        onRendered(() => {
                            const deleteBtn: any = cell
                                .getElement()
                                .querySelector(".delete-btn");
                            if (deleteBtn != null) {
                                deleteBtn.addEventListener(
                                    "click",
                                    (event: any) => {
                                        const name = rowData.name;
                                        const starId = rowData.starId;
                                        if (name) {
                                            if (starId) {
                                                utils.q(
                                                    event,
                                                    `是否移除对 ${name} 的屏蔽?`,
                                                    async () => {
                                                        await storageManager.removeBlacklistCarList(
                                                            starId,
                                                        );
                                                        await storageManager.deleteBlacklistItem(
                                                            starId,
                                                        );
                                                        show.info("操作成功");
                                                        this.reloadTable().then();
                                                    },
                                                );
                                            } else {
                                                show.error("获取starId失败");
                                            }
                                        } else {
                                            show.error("获取名称失败");
                                        }
                                    },
                                );
                            }
                            const keywordBtn: any = cell
                                .getElement()
                                .querySelector(".keyword-btn");
                            if (keywordBtn != null) {
                                keywordBtn.addEventListener("click", () => {
                                    const prefixCounts: any =
                                        rowData.carList.reduce(
                                            (acc: any, carItem: any) => {
                                                const prefix =
                                                    carItem.carNum.split(
                                                        "-",
                                                    )[0] + "-";
                                                acc[prefix] =
                                                    (acc[prefix] || 0) + 1;
                                                return acc;
                                            },
                                            {},
                                        );
                                    const sortedPrefixes = Object.entries(
                                        prefixCounts,
                                    )
                                        .map(
                                            ([prefix, count]: [
                                                string,
                                                any,
                                            ]) => ({
                                                prefix,
                                                count,
                                            }),
                                        )
                                        .sort(
                                            (a: any, b: any) =>
                                                b.count - a.count,
                                        );
                                    console.log(sortedPrefixes);
                                });
                            }
                        });
                        return '\n                           <!-- <a class="a-normal keyword-btn"> <span>提取屏蔽词</span> </a>-->\n                            <a class="a-danger delete-btn"> <span>✂️ 删除</span> </a>\n                        ';
                    },
                },
            ],
            initialSort: [
                {
                    column: "createTime",
                    dir: "desc",
                },
            ],
            locale: "zh-cn",
            langs: {
                "zh-cn": {
                    pagination: {
                        first: "首页",
                        first_title: "首页",
                        last: "尾页",
                        last_title: "尾页",
                        prev: "上一页",
                        prev_title: "上一页",
                        next: "下一页",
                        next_title: "下一页",
                        all: "所有",
                        page_size: "每页行数",
                    },
                },
            },
        });
    }

    /**
     * 取当前演员页 URL 的标准化形式：去除 sort_type / page 参数与多余的分页段。
     * 对应原 L7787-7802。
     * @returns 处理后的 URL 字符串
     */
    getCurrentStarUrl(): string {
        let url = window.location.href.replace(
            /([&?])sort_type=[^&]+(&|$)/,
            "$1",
        );
        url = url.replace(/[&?]$/, "");
        url = url.replace(/\?&/, "?");
        let result = url;
        result = result.replace(/([&?])page=\d+(&|$)/, "$1");
        result = result.replace(/[&?]$/, "");
        result = result.replace(/\?&/, "?");
        result = result.replace(
            /\/(\d+)(?:\/(\d+))?(\?|$)/,
            (match, seg1, seg2, tail) =>
                seg2 !== undefined ? `/${seg1}${tail}` : match,
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
            throw new Error("url未传入");
        }
        return new URL(url).pathname
            .split("/")
            .filter((seg: string) => seg.trim() !== "")
            .pop();
    }

    /**
     * 递归遍历演员作品列表页，将每个番号写入鉴定记录（屏蔽动作）。
     * 对应原 L7812-7865。
     * @param names 演员名（写入 saveCar.names）
     * @param $dom 可选的已解析页 DOM；缺省时从当前页选择器取
     */
    async filterAllVideo(names: any, $dom?: any): Promise<void> {
        let items: any[];
        let nextPageHref: any;
        if ($dom) {
            if (isJavbusSite && $dom.find(".avatar-box").length > 0) {
                $dom.find(".avatar-box").parent().remove();
            }
            items = $dom.find(this.getSelector().requestDomItemSelector);
            nextPageHref = $dom
                .find(this.getSelector().nextPageSelector)
                .attr("href");
        } else {
            items = $(this.getSelector().itemSelector);
            nextPageHref = $(this.getSelector().nextPageSelector).attr("href");
        }
        if (nextPageHref && items.length === 0) {
            show.error("解析列表失败");
            throw new Error("解析列表失败");
        }
        for (const itemEl of items) {
            const $item = $(itemEl);
            const { carNum, url, publishTime } =
                this.getBean("ListPagePlugin").findCarNumAndHref($item);
            if (url && carNum) {
                try {
                    if (await storageManager.getCar(carNum)) {
                        continue;
                    }
                    await storageManager.saveCar({
                        carNum,
                        url,
                        names,
                        actionType: FILTER_ACTION,
                        publishTime,
                    });
                    clog.log("屏蔽演员番号", names, carNum);
                } catch (error: any) {
                    console.error(`保存失败 [${carNum}]:`, error);
                }
            }
        }
        if (nextPageHref) {
            show.info("请不要关闭窗口, 正在解析下一页:" + nextPageHref);
            await new Promise<void>((resolve) => setTimeout(resolve, 500));
            const pageHtml = await gmHttp.get(nextPageHref);
            const domParser = new DOMParser();
            const $parsed = $(domParser.parseFromString(pageHtml, "text/html"));
            await this.filterAllVideo(names, $parsed);
        } else {
            show.ok("执行结束!");
            refresh();
        }
    }

    /**
     * 递归抓取演员番号并批量写入黑名单番号列表（用于 addBlacklist 后的屏蔽）。
     * JavDb 站点页码超过 60 时改走 Beyond60Plugin 合并请求。对应原 L7866-7893。
     * @param name 演员名
     * @param starId 演员 starId
     * @param $dom 可选的已解析页 DOM；缺省时从当前页选择器取
     */
    async filterActorVideo(name: any, starId: any, $dom?: any): Promise<void> {
        const { nextPageLink } = await this.parseAndSaveFilterInfo(
            $dom,
            name,
            starId,
        );
        this.nextPageLink = nextPageLink;
        if (nextPageLink) {
            let nextDom: any;
            this.lastPageLink = nextPageLink;
            show.info("请不要关闭窗口, 正在解析下一页:" + nextPageLink);
            const pageNum = utils.getUrlParam(nextPageLink, "page") || 0;
            const beyond60Plugin = this.getBean("Beyond60Plugin");
            if (isJavdbSite && beyond60Plugin && pageNum > 60) {
                const {
                    html,
                    nextUrl,
                    hasMore: _hasMore,
                } = await beyond60Plugin.handleBeyond60(nextPageLink);
                const wrapperHtml = `\n                    <div class ='movie-list'>${html}</div>\n                    ${nextUrl ? `<a class="pagination-next" href="${nextUrl}"></a>` : ""}\n                `;
                nextDom = utils.htmlTo$dom(wrapperHtml);
            } else {
                clog.log("正在请求下一页内容:", nextPageLink);
                const pageHtml = await gmHttp.get(nextPageLink);
                nextDom = utils.htmlTo$dom(pageHtml);
            }
            await this.filterActorVideo(name, starId, nextDom);
        } else {
            show.ok("执行结束!");
            refresh();
        }
    }

    /**
     * 解析一页 DOM 中的番号列表并批量保存到黑名单番号列表，返回下一页链接与
     * 首条发行时间。对应原 L7894-7950。
     * @param $dom 已解析页 DOM；缺省时从当前页选择器取
     * @param names 演员名（写入 carList.names）
     * @param starId 演员 starId（写入 carList.starId）
     * @returns nextPageLink 下一页 href（无则为 null）；lastPublishTime 首条发行时间
     */
    async parseAndSaveFilterInfo(
        $dom: any,
        names: any,
        starId: any,
    ): Promise<{ nextPageLink: any; lastPublishTime: any }> {
        let items: any[];
        let nextPageHref: any;
        if ($dom) {
            let isJavbusDom = false;
            let siteType = JAVDB;
            if ($dom.text().includes(JAVBUS)) {
                isJavbusDom = true;
                siteType = JAVBUS;
            }
            if (isJavbusDom && $dom.find(".avatar-box").length > 0) {
                $dom.find(".avatar-box").parent().remove();
            }
            items = $dom.find(
                this.getSelector(siteType).requestDomItemSelector,
            );
            nextPageHref = $dom
                .find(this.getSelector(siteType).nextPageSelector)
                .attr("href");
        } else {
            items = $(this.getSelector().itemSelector);
            nextPageHref = $(this.getSelector().nextPageSelector).attr("href");
        }
        if (nextPageHref && items.length === 0) {
            return {
                nextPageLink: null,
                lastPublishTime: null,
            };
        }
        let carList: any[] = [];
        let lastPublishTime: any = null;
        for (const itemEl of items) {
            const $item = $(itemEl);
            const { carNum, url, publishTime } =
                this.getBean("ListPagePlugin").findCarNumAndHref($item);
            lastPublishTime ||= publishTime;
            if (url && carNum) {
                carList.push({
                    carNum,
                    url,
                    names,
                    actionType: FILTER_ACTION,
                    starId,
                    publishTime,
                });
            }
        }
        try {
            await storageManager.batchSaveBlacklistCarList(carList);
        } catch (error: any) {
            clog.error("保存失败:", error);
            console.error("保存失败:", error);
        }
        return {
            nextPageLink: nextPageHref,
            lastPublishTime,
        };
    }
}
