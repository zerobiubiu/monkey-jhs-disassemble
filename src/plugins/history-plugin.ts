/**
 * 鉴定记录插件 HistoryPlugin —— 对应原脚本 archetype/jhs.user.js L6441-7080。
 *
 * 在导航栏/顶栏注入「鉴定记录」入口，点击弹出 layer 弹窗，以 Tabulator 远程分页
 * 表格展示 storageManager 中的全部番号记录，支持按状态/番号/演员筛选、排序、
 * 单条与批量变更状态（屏蔽/收藏/已观看/移除）、编辑记录、跳转详情页。
 *
 * JS→TS 改造要点：
 * - 构造函数中 i(this,"tableObj",null)（babel 类字段 defineProperty 助手）改为 class 字段，
 *   配合 tsconfig useDefineForClassFields:true，[[Define]] 语义一致。
 * - getDataList 中动态挂载到 this 的 allCount/filterCount/favoriteCount/hasWatchCount
 *   显式声明为 number 类字段，保留原 this.X 读写路径。
 * - 单字母局部变量（原 e/t/n/a/i/s/r/o/c/l/m 等）已语义化命名为 page/size/sort/carList 等。
 * - 站点布尔 r/l 改由 ../constants/site 引入；状态动作 d/h/p 与展示文本/颜色
 *   m/u/f/v/b/w/k/S 改由 ../constants/status 引入。
 * - 内联 HTML/CSS（含 Tabulator 列配置、layer 弹窗 content、initCss 返回的 <style>）
 *   原样保留（含 \n 转义与缩进、闭合标签缺漏），仅替换其中的模板插值变量名为语义常量。
 * - 全局 $/layer/utils/storageManager/show/Tabulator/loading/refresh 已由
 *   src/types/globals.d.ts 声明，按 any 使用；原 window.refresh() 以全局 refresh() 调用。
 * - any 类型 callee（$/layer/Tabulator/utils 等）的回调参数显式标注 : any 以规避 noImplicitAny；
 *   原生 document.addEventListener 的回调由 DOM lib 上下文推断为 MouseEvent，无需标注。
 * - 控制流（分支、switch、try/catch/finally、fire-and-forget .then()、空 async 回调）
 *   与原脚本一致；末尾 case 无 break 合规（无下一分支可穿透）。
 */
import { BasePlugin } from "./base-plugin";
import { EditRecordDialog } from "../components/edit-record-dialog";
import { HistoryDialog } from "../components/history-dialog";
import { isJavdbSite, isJavbusSite } from "../constants/site";
import {
    FILTER_ACTION,
    FAVORITE_ACTION,
    HAS_WATCH_ACTION,
    BLOCK_TEXT,
    BLOCKED_TEXT,
    BLOCK_COLOR,
    FAVORITE_TEXT,
    FAVORITED_TEXT,
    FAVORITE_COLOR,
    WATCHED_TEXT,
    WATCHED_COLOR,
} from "../constants/status";
import historyCssRaw from "../styles/history-plugin.css?raw";

export class HistoryPlugin extends BasePlugin {
    /** Tabulator 表格实例（弹窗关闭时销毁置空） */
    tableObj: any = null;
    /** 全部记录数（getDataList 统计后用于下拉选项文案） */
    allCount: number = 0;
    /** 屏蔽记录数 */
    filterCount: number = 0;
    /** 收藏记录数 */
    favoriteCount: number = 0;
    /** 已观看记录数 */
    hasWatchCount: number = 0;

    /** 构造函数：字段初始化交由 class 字段语法。对应原 L6442-6445。 */
    constructor() {
        super();
    }

    /** 返回插件名，供 PluginManager 注册去重。对应原 L6446-6448。 */
    getName(): string {
        return "HistoryPlugin";
    }

    /**
     * 注入下拉菜单与表格链接相关的内联 CSS。对应原 L6449-6451。
     *
     * @returns 含 <style> 标签的 CSS 字符串（原样保留，含闭合标签缺漏）
     */
    async initCss(): Promise<string> {
        return historyCssRaw;
    }

    /** 依导航栏搜索框显隐切换桌面/迷你入口。对应原 L6452-6460。 */
    handleResize(): void {
        if ($(".navbar-search").is(":hidden")) {
            $(".historyBtnBox").show();
            $(".miniHistoryBtnBox").hide();
        } else {
            $(".historyBtnBox").hide();
            $(".miniHistoryBtnBox").show();
        }
    }

    /**
     * 主处理：按站点注入「鉴定记录」入口并绑定点击。对应原 L6461-6496。
     *
     * - JavDb：导航栏注入桌面入口 + 迷你入口，随窗口尺寸切换；
     * - JavBus：轮询 #setting-btn 出现后在顶栏注入入口；
     * 最后统一绑定 .sub-btns 下拉菜单与行内操作按钮的事件委托。
     */
    async handle(): Promise<void> {
        if (isJavdbSite) {
            $(".navbar-end").prepend(
                '<div class="navbar-item has-sub-btns is-hoverable historyBtnBox">\n                    <a id="historyBtn" class="navbar-link nav-btn" style="color: #aade66 !important;padding-right:15px !important;">\n                        鉴定记录\n                    </a>\n                </div>',
            );
            $(".navbar-search")
                .css("margin-left", "0")
                .before(
                    '\n                <div class="navbar-item miniHistoryBtnBox">\n                    <a id="miniHistoryBtn" class="navbar-link nav-btn" style="color: #aade66 !important;padding-left:0 !important;padding-right:0 !important;">\n                        鉴定记录\n                    </a>\n                </div>\n            ',
                );
            this.handleResize();
            $(window).resize(() => {
                this.handleResize();
            });
            $("#historyBtn,#miniHistoryBtn").on("click", () =>
                this.openHistory(),
            );
        }
        if (isJavbusSite) {
            utils.loopDetector(
                () => $("#setting-btn").length,
                () => {
                    $("#top-right-box").append(
                        '\n                    <a id="historyBtn" class="menu-btn main-tab-btn" style="background-color:#b68625 !important;">\n                        鉴定记录\n                    </a>\n               ',
                    );
                    $("#historyBtn,#miniHistoryBtn").on("click", () =>
                        this.openHistory(),
                    );
                },
                1,
                10000,
                false,
            );
        }
        this.bindClick();
    }

    /**
     * 打开「鉴定记录」弹窗：渲染筛选区/批量操作区/表格容器，并初始化 Tabulator。
     * 对应原 L6497-6544。弹窗关闭时销毁表格实例并触发页面刷新。
     */
    openHistory(): void {
        layer.open({
            type: 1,
            title: "鉴定记录",
            content: HistoryDialog({
                blockedText: BLOCKED_TEXT,
                favoritedText: FAVORITED_TEXT,
                watchedText: WATCHED_TEXT,
                watchedColor: WATCHED_COLOR,
                favoriteColor: FAVORITE_COLOR,
                favoriteText: FAVORITE_TEXT,
                blockColor: BLOCK_COLOR,
                blockText: BLOCK_TEXT,
            }),
            scrollbar: false,
            shadeClose: true,
            area: utils.getResponsiveArea(["70%", "90%"]),
            anim: -1,
            success: async () => {
                await this.loadTableData();
                $(".layui-layer-content")
                    .on("click", "#clearSearchbtn", async () => {
                        $("#searchCarNum").val("");
                        $("#dataType").val("all");
                        await this.reloadTable();
                        $("#allSelectBox").hide();
                    })
                    .on("focusout keydown", "#searchCarNum", async (event: any) => {
                        if (event.type === "focusout" || event.key === "Enter") {
                            if (event.key === "Enter") {
                                event.preventDefault();
                            }
                            if (event.type === "keydown" && event.key !== "Enter") {
                                return;
                            }
                            await this.reloadTable();
                        }
                    })
                    .on("click", ".table-link-param", async (event: any) => {
                        const link = $(event.currentTarget);
                        $("#searchCarNum").val(link.text());
                        await this.reloadTable();
                    })
                    .on("change", "#dataType", async () => {
                        await this.reloadTable();
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

    /** 重置表格分页（取消选择并回到第一页）。对应原 L6545-6548。 */
    async reloadTable(): Promise<void> {
        this.tableObj.deselectRow();
        this.tableObj.setPage(1);
    }

    /**
     * 绑定 .sub-btns 下拉菜单的展开/收起，以及行内/批量操作按钮的事件委托。
     * 对应原 L6549-6666。
     */
    bindClick(): void {
        document.addEventListener("click", function (event) {
            const target = event.target as HTMLElement;
            if (target.closest(".sub-btns-toggle")) {
                const menu = target.closest(".sub-btns")!.querySelector(".sub-btns-menu")!;
                document
                    .querySelectorAll(".sub-btns-menu.show")
                    .forEach((el) => {
                        if (el !== menu) {
                            el.classList.remove("show");
                        }
                    });
                menu.classList.toggle("show");
            } else {
                document
                    .querySelectorAll(".sub-btns-menu.show")
                    .forEach((el) => {
                        el.classList.remove("show");
                    });
            }
        });
        $(document).on(
            "click",
            ".history-deleteBtn, .history-filterBtn, .history-favoriteBtn, .history-hasWatchBtn, .history-detailBtn",
            (event: any) => {
                event.preventDefault();
                event.stopPropagation();
                const btn = $(event.currentTarget);
                const actionBtns = btn.closest(".action-btns");
                const carNum = actionBtns.attr("data-car-num");
                const href = actionBtns.attr("data-href");
                const applyAction = async (actionType: any) => {
                    await storageManager.saveCar({
                        carNum: carNum,
                        url: href,
                        names: null,
                        actionType: actionType,
                    });
                    refresh();
                    await this.reloadTable();
                };
                if (btn.hasClass("history-filterBtn")) {
                    utils.q(event, `是否屏蔽${carNum}?`, () =>
                        applyAction(FILTER_ACTION),
                    );
                } else if (btn.hasClass("history-favoriteBtn")) {
                    applyAction(FAVORITE_ACTION).then();
                } else if (btn.hasClass("history-hasWatchBtn")) {
                    applyAction(HAS_WATCH_ACTION).then();
                } else if (btn.hasClass("history-deleteBtn")) {
                    this.handleDelete(event, carNum);
                } else if (btn.hasClass("history-detailBtn")) {
                    this.handleClickDetail(event, {
                        carNum: carNum,
                        url: href,
                    }).then();
                }
            },
        );
        $(document).on(
            "click",
            ".multiple-history-deleteBtn, .multiple-history-filterBtn, .multiple-history-favoriteBtn, .multiple-history-hasWatchBtn",
            (event: any) => {
                event.preventDefault();
                event.stopPropagation();
                const btn = $(event.currentTarget);
                const selectedRows = this.tableObj.getSelectedData();
                let actionLabel = "";
                let actionType = "";
                if (btn.hasClass("multiple-history-filterBtn")) {
                    actionLabel = "屏蔽";
                    actionType = FILTER_ACTION;
                } else if (btn.hasClass("multiple-history-favoriteBtn")) {
                    actionLabel = "收藏";
                    actionType = FAVORITE_ACTION;
                } else if (btn.hasClass("multiple-history-hasWatchBtn")) {
                    actionLabel = "已观看";
                    actionType = HAS_WATCH_ACTION;
                } else if (btn.hasClass("multiple-history-deleteBtn")) {
                    actionLabel = "移除";
                    actionType = "delete";
                }
                utils.q(
                    event,
                    `当前已勾选${selectedRows.length}条数据, 是否全标记为 ${actionLabel}?`,
                    async () => {
                        const loader = loading();
                        try {
                            if (actionType === "delete") {
                                const carNums = selectedRows.map(
                                    (row: any) => row.carNum,
                                );
                                const removed =
                                    await storageManager.batchRemoveCars(carNums);
                                if (removed > 0) {
                                    show.ok(`已成功删除 ${removed} 个番号`);
                                } else if (removed === false) {
                                    show.error(
                                        "提供的番号中没有一个存在于列表中。",
                                    );
                                }
                            } else {
                                const updates = JSON.parse(
                                    JSON.stringify(selectedRows),
                                );
                                updates.forEach((item: any) => {
                                    item.actionType = actionType;
                                });
                                await storageManager.saveCarList(updates);
                                show.ok("操作成功");
                            }
                            this.tableObj.deselectRow();
                            this.reloadTable().then();
                        } catch (err: any) {
                            console.error(err);
                        } finally {
                            loader.close();
                        }
                    },
                );
            },
        );
    }

    /**
     * 按状态/搜索词/排序从 storageManager 拉取并切片当前页数据。对应原 L6667-6752。
     *
     * @param page 当前页码（从 1 起）
     * @param size 每页条数
     * @param sort 排序参数数组（取首项的 field/dir）
     * @returns { maxPage, dataList, totalCount } 供 Tabulator 远程分页使用
     */
    async getDataList(
        page: number,
        size: number,
        sort: any,
    ): Promise<{ maxPage: number; dataList: any[]; totalCount: number }> {
        const carList = await storageManager.getCarList();
        this.allCount = carList.length;
        this.filterCount = 0;
        this.favoriteCount = 0;
        this.hasWatchCount = 0;
        carList.forEach((car: any) => {
            switch (car.status) {
                case FILTER_ACTION:
                    this.filterCount++;
                    break;
                case FAVORITE_ACTION:
                    this.favoriteCount++;
                    break;
                case HAS_WATCH_ACTION:
                    this.hasWatchCount++;
            }
        });
        $('#dataType option[value="all"]').text(`所有 (${this.allCount})`);
        $('#dataType option[value="filter"]').text(
            `${BLOCKED_TEXT} (${this.filterCount})`,
        );
        $('#dataType option[value="favorite"]').text(
            `${FAVORITED_TEXT} (${this.favoriteCount})`,
        );
        $('#dataType option[value="hasWatch"]').text(
            `${WATCHED_TEXT} (${this.hasWatchCount})`,
        );
        const selectedType = $("#dataType").val();
        let filtered: any[] =
            selectedType === "all"
                ? carList
                : carList.filter((car: any) => car.status === selectedType);
        const searchText = $("#searchCarNum").val().trim();
        if (searchText) {
            const normalizedSearch = searchText
                .toLowerCase()
                .replace("-c", "")
                .replace("-uc", "")
                .replace("-4k", "");
            filtered = filtered.filter((row: any) => {
                const matchCar = row.carNum.toLowerCase().includes(normalizedSearch);
                const matchName = (row.names ? row.names : "")
                    .toLowerCase()
                    .includes(normalizedSearch);
                return matchCar || matchName;
            });
        }
        if (sort && sort.length > 0) {
            const sortConfig = sort[0];
            const field = sortConfig.field;
            const dir = sortConfig.dir;
            filtered.sort((rowA: any, rowB: any) => {
                const valA = rowA[field];
                const valB = rowB[field];
                const isEmptyA = valA == null || valA === "";
                const isEmptyB = valB == null || valB === "";
                if (isEmptyA && !isEmptyB) {
                    return 1;
                } else if (!isEmptyA && isEmptyB) {
                    return -1;
                } else if (isEmptyA && isEmptyB) {
                    return 0;
                } else if (valA < valB) {
                    if (dir === "asc") {
                        return -1;
                    } else {
                        return 1;
                    }
                } else if (valA > valB) {
                    if (dir === "asc") {
                        return 1;
                    } else {
                        return -1;
                    }
                } else {
                    return 0;
                }
            });
        }
        const totalCount = filtered.length;
        const maxPage = Math.ceil(totalCount / size);
        const start = (page - 1) * size;
        const end = start + size;
        filtered = filtered.slice(start, end);
        return {
            maxPage,
            dataList: filtered,
            totalCount,
        };
    }

    /**
     * 初始化 Tabulator 表格：远程分页/排序、列定义、行选择联动、双击切换选中。
     * 对应原 L6753-6975。内联列配置与中文 locale 原样保留。
     */
    async loadTableData(): Promise<void> {
        this.tableObj = new Tabulator("#table-container", {
            layout: "fitColumns",
            placeholder: "暂无数据",
            virtualDom: true,
            pagination: true,
            paginationMode: "remote",
            sortMode: "remote",
            ajaxURL: "queryRealm",
            dataLoader: false,
            ajaxRequestFunc: async (_url: any, _config: any, params: any) => {
                const page = params.page;
                const size = params.size;
                const sort = params.sort;
                return await this.getDataList(page, size, sort);
            },
            dataReceiveParams: {
                last_page: "maxPage",
                last_row: "totalCount",
                data: "dataList",
            },
            paginationSize: 50,
            paginationSizeSelector: [50, 100, 1000, 99999],
            paginationCounter: (
                _pageNumber: any,
                _pageSize: any,
                _totalPages: any,
                recordCount: any,
                _data: any,
            ) => `共 ${recordCount} 条记录`,
            responsiveLayout: "collapse",
            responsiveLayoutCollapse: true,
            columnDefaults: {
                headerHozAlign: "center",
                hozAlign: "center",
            },
            selectableRowsPersistence: false,
            index: "carNum",
            columns: [
                {
                    formatter: "rowSelection",
                    titleFormatter: "rowSelection",
                    hozAlign: "center",
                    headerSort: false,
                    responsive: 0,
                    width: 40,
                    titleFormatterParams: {
                        rowRange: "active",
                    },
                    cellClick: (_event: any, cell: any) => {
                        cell.getRow().toggleSelect();
                    },
                },
                {
                    title: "番号",
                    field: "carNum",
                    width: 120,
                    sorter: "string",
                    responsive: 0,
                    formatter: (cell: any, _formatterParams: any, _onRendered: any) => {
                        const carNum = cell.getData().carNum;
                        const dashIndex = carNum.indexOf("-");
                        if (dashIndex === -1) {
                            return carNum;
                        }
                        return `<a class="table-link-param">${carNum.substring(0, dashIndex + 1)}</a>${carNum.substring(dashIndex + 1)}`;
                    },
                },
                {
                    title: "演员",
                    field: "names",
                    minWidth: 200,
                    sorter: "string",
                    responsive: 5,
                    headerSort: true,
                    formatter: (cell: any, _formatterParams: any, _onRendered: any) =>
                        (cell.getData().names || "")
                            .split(" ")
                            .filter((part: any) => part.trim() !== "")
                            .map((part: any) => `<a class="table-link-param">${part}</a>`)
                            .join(" "),
                },
                {
                    title: "创建时间",
                    field: "createDate",
                    width: 170,
                    sorter: "string",
                    responsive: 4,
                },
                {
                    title: "修改时间",
                    field: "updateDate",
                    width: 170,
                    sorter: "string",
                    responsive: 4,
                },
                {
                    title: "发行时间",
                    field: "publishTime",
                    width: 170,
                    sorter: "string",
                    responsive: 4,
                },
                {
                    title: "来源",
                    field: "url",
                    width: 80,
                    sorter: "string",
                    responsive: 5,
                    hozAlign: "left",
                    formatter: (cell: any, _formatterParams: any, _onRendered: any) => {
                        let url = cell.getData().url;
                        if (url) {
                            if (url.includes("javdb")) {
                                return '<span style="color:#d34f9e">Javdb</span>';
                            } else if (url.includes("javbus")) {
                                return '<span style="color:#eaa813">JavBus</span>';
                            } else if (url.includes("123av")) {
                                return '<span style="color:#eaa813">123Av</span>';
                            } else {
                                return `<span style="color:#050505">${url}</span>`;
                            }
                        } else {
                            return "";
                        }
                    },
                },
                {
                    title: "状态",
                    field: "status",
                    width: 100,
                    sorter: "string",
                    responsive: 1,
                    headerSort: false,
                    formatter: (cell: any, _formatterParams: any, _onRendered: any) => {
                        const status = cell.getData().status;
                        let color = "";
                        let text = "";
                        switch (status) {
                            case "filter":
                                color = BLOCK_COLOR;
                                text = BLOCK_TEXT;
                                break;
                            case "favorite":
                                color = FAVORITE_COLOR;
                                text = FAVORITE_TEXT;
                                break;
                            case "hasWatch":
                                color = WATCHED_COLOR;
                                text = WATCHED_TEXT;
                                break;
                            default:
                                text = status;
                        }
                        return `<span style="color:${color}">${text}</span>`;
                    },
                },
                {
                    title: "备注",
                    field: "remark",
                    width: 100,
                    sorter: "string",
                    responsive: 6,
                },
                {
                    title: "操作",
                    sorter: "string",
                    minWidth: 150,
                    cssClass: "action-cell-dropdown",
                    responsive: 0,
                    headerSort: false,
                    formatter: (cell: any, _formatterParams: any, onRendered: any) => {
                        const data = cell.getData();
                        onRendered(() => {
                            const editBtn = cell
                                .getElement()
                                .querySelector(".history-editBtn");
                            if (editBtn != null) {
                                editBtn.addEventListener("click", () => {
                                    this.editRecord(data);
                                });
                            }
                        });
                        return `\n                            <div class="action-btns" style="display: flex; gap: 5px;justify-content:center" data-car-num="${data.carNum}" data-href="${data.url ? data.url : ""}">\n                                <div class="sub-btns">\n                                    <a class="menu-btn sub-btns-toggle" style="background-color:#c59d36; color:white; margin-bottom: 5px;">\n                                        <span>✏️ 变更</span>\n                                    </a>\n                                    <div class="sub-btns-menu">\n                                        <a class="menu-btn history-editBtn" style="background-color:#007bff; color:white; margin-bottom: 5px;"> <span>✏️ 编辑</span> </a>\n                                        <a class="menu-btn history-deleteBtn" style="background-color:#8c8080; color:white; margin-bottom: 5px;"> <span>✂️ 移除</span> </a>\n                                        <a class="menu-btn history-hasWatchBtn" style="background-color:${WATCHED_COLOR};margin-bottom: 5px">${WATCHED_TEXT}</a>\n                                        <a class="menu-btn history-favoriteBtn" style="background-color:${FAVORITE_COLOR};margin-bottom: 5px">${FAVORITE_TEXT}</a>\n                                        <a class="menu-btn history-filterBtn" style="background-color:${BLOCK_COLOR};margin-bottom: 5px">${BLOCK_TEXT}</a>\n                                    </div>\n                                </div>\n                                \n                                <a class="menu-btn history-detailBtn" style="background-color:#3397de; color:white; margin-bottom: 5px;"> <span>📄 详情页</span> </a>\n                                \n                            </div>\n                        `;
                    },
                },
            ],
            initialSort: [
                {
                    column: "updateDate",
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
        this.tableObj.on(
            "rowSelectionChanged",
            (rows: any, _deselectedRows: any, _selected: any, _deselected: any) => {
                const selectBox = $("#allSelectBox");
                const filterBox = $("#filterBox");
                if (rows && rows.length > 0) {
                    filterBox.hide();
                    selectBox.show();
                } else {
                    filterBox.show();
                    selectBox.hide();
                }
            },
        );
        this.tableObj.on("rowDblClick", (_event: any, row: any) => {
            row.toggleSelect();
        });
        this.tableObj.on("tableBuilt", async () => {});
    }

    /**
     * 确认后移除单条记录并刷新列表页番号盒。对应原 L6976-6982。
     *
     * @param event 触发事件（用于 utils.q 定位确认框）
     * @param carNum 待移除番号
     */
    handleDelete(event: any, carNum: any): void {
        utils.q(event, `是否移除${carNum}?`, async () => {
            await storageManager.removeCar(carNum);
            this.getBean("ListPagePlugin").showCarNumBox(carNum);
            this.reloadTable().then();
        });
    }

    /**
     * 跳转影片详情页（FC2 走弹窗/子页，其余直接打开）。对应原 L6983-7013。
     *
     * @param event 触发事件（透传给 utils.openPage）
     * @param carInfo { carNum, url } 影片信息
     */
    async handleClickDetail(event: any, carInfo: any): Promise<void> {
        if (isJavdbSite) {
            if (carInfo.carNum.includes("FC2-")) {
                const movieId = this.parseMovieId(carInfo.url);
                this.getBean("Fc2Plugin")?.openFc2Dialog(movieId, carInfo.carNum, carInfo.url);
            } else {
                if (!carInfo.url) {
                    window.open("/search?q=" + carInfo.carNum, "_blank");
                    return;
                }
                utils.openPage(carInfo.url, carInfo.carNum, false, event);
            }
        }
        if (isJavbusSite) {
            let url = carInfo.url;
            if (url.includes("javdb")) {
                if (carInfo.carNum.includes("FC2-")) {
                    const movieId = this.parseMovieId(url);
                    await this.getBean("Fc2Plugin")?.openFc2Page(
                        movieId,
                        carInfo.carNum,
                        url,
                    );
                } else {
                    window.open(url, "_blank");
                }
            } else {
                utils.openPage(carInfo.url, carInfo.carNum, false, event);
            }
        }
    }

    /**
     * 弹窗编辑单条记录（番号只读，可改演员/状态/链接/备注）。对应原 L7014-7079。
     *
     * @param record 待编辑记录（含 carNum/names/url/status/remark 等）
     */
    async editRecord(record: any): Promise<void> {
        const carNum = record.carNum;
        const names = record.names || "";
        const url = record.url || "";
        const status = record.status;
        const remark = record.remark || "";
        const textareaStyle =
            "width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; min-height: 60px; overflow-y: hidden;";
        const inputStyle =
            "width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;";
        const statusOptions = [
            {
                value: FILTER_ACTION,
                text: BLOCK_TEXT,
            },
            {
                value: FAVORITE_ACTION,
                text: FAVORITE_TEXT,
            },
            {
                value: HAS_WATCH_ACTION,
                text: WATCHED_TEXT,
            },
        ];
        console.log(statusOptions);
        layer.open({
            type: 1,
            title: `编辑记录: ${carNum}`,
            area: ["500px", "650px"],
            content: EditRecordDialog({
                carNum,
                names,
                status,
                url,
                remark,
                inputStyle,
                textareaStyle,
                statusOptions,
            }),
            btn: ["保存", "取消"],
            success: () => {
                const autoResize = (el: any) => {
                    el.css("height", "auto");
                    el.css("height", el[0].scrollHeight + 15 + "px");
                };
                const namesInput = $("#edit-names");
                namesInput.on("input", (event: any) =>
                    autoResize($(event.currentTarget)),
                );
                autoResize(namesInput);
                const remarkInput = $("#edit-remark");
                remarkInput.on("input", (event: any) =>
                    autoResize($(event.currentTarget)),
                );
                autoResize(remarkInput);
            },
            yes: async (index: any) => {
                const names = $("#edit-names").val().trim();
                const status = $("#edit-status").val();
                const url = $("#edit-url").val().trim();
                const remark = $("#edit-remark").val().trim();
                const updated = {
                    ...record,
                    names: names,
                    actionType: status,
                    url: url,
                    remark: remark,
                };
                await storageManager.updateCarInfo(updated);
                this.tableObj.setData();
                layer.close(index);
            },
        });
    }
}
