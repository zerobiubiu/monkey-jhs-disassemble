/**
 * 新作品检测插件 NewVideoPlugin —— 对应原脚本 archetype/jhs.user.js L11035-11465。
 *
 * 弹出"新作品检测"对话框，按女优类型（全部/无码/有码/未知）过滤收藏女优列表，
 * 以卡片网格展示（头像、名称、别名、上次检测/最后发行时间、停更提示、备注、
 * 最新作品数量角标、无码/有码彩带），支持分页、编辑女优信息、取消收藏，
 * 以及通过 Gfriends 仓库搜索/选择头像、切换头像 CDN 源。
 *
 * 单字母局部变量（原 e/t/n/a/i/s/o/r/l/c/h/g 等）已语义化：
 *   $container / favoriteActresses / typeFilter / sortedActresses / totalCount /
 *   totalPages / startIndex / endIndex / pageActresses / javDbUrl / ruleTimeHours /
 *   cardsHtml / actress / allNameText / actressUrl / isStale / typeLabel / typeColor /
 *   btnStyle / event / starId / uncollectUrl / csrfToken / response / name / avatar /
 *   remark / newVideoText / starId / textareaStyle / actressType / dialogContent /
 *   layerIndex / autoHeight / $allNameArea / $newVideoArea / currentIndex /
 *   radioButtonsHtml / cdnDialogContent / cdnLayerIndex / selectedValue / selectedIndex /
 *   page / paginationHtml / $pagination / rangeStart / rangeEnd / pageNum / targetPage /
 *   $nameInput / $allNameInput / nameText / searchNames / loader / avatarUrls /
 *   imagesHtml / errorCount / $layer / $images / $prompt / $img / wrapperId / $wrapper /
 *   $sizeTag / width / height / remaining / url。
 *
 * 站点类别常量 A/D 改由 ../constants/site 引入（UNCENSORED / CENSORED）；
 * Gfriends CDN 源清单与键名（原 tt/nt/rt）改由 ../resources/gfriends 引入
 * （GFRIENDS_SOURCES / GFRIENDS_CDN_INDEX_KEY / FILETREE_DATA_KEY），均为只读复用。
 * Gfriends 运行时能力（原 gt/at/it/st/ct/dt）改由 ../core/gfriends 正式导入：
 *   loadGfriends（搜索头像）、getCurrentCdnSource（读当前 CDN 源 {json,base,index}）、
 *   clearCache（清内存缓存）。切换 CDN 源时写 localStorage + clearCache() 即生效。
 * IndexedDB 缓存清理（原 lt.set）仍经 (window as any).lt 访问（filetreeDb 已导出，
 * 但按任务约定不在本次替换范围内）。
 * $ / layer / utils / storageManager / show / clog / gmHttp / loading 已由
 * ../types/globals.d.ts 声明（loading 实际接收消息参数，调用处以类型断言补全签名）；
 * jQuery .each / .on 回调按本仓库既有约定改写为箭头形式（(_index, element) /
 * (event) => $(event.currentTarget)），规避 noImplicitThis；
 * 因 $ 为 any，jQuery 链式结果均为 any，故局部常量仅以 :string/:number 等标注意图。
 * 内联 HTML（卡片/分页/弹窗标题模板）已提取为组件（ActressCard / ActressPagination /
 * NewVideoDialogTitle），layer 弹窗 content 仍由既有组件返回；仅替换其中 ${单字母} 插值为语义化命名。
 */
import { UNCENSORED, CENSORED } from "../constants/site";
import {
    GFRIENDS_SOURCES,
    GFRIENDS_CDN_INDEX_KEY,
    FILETREE_DATA_KEY,
} from "../resources/gfriends";
import {
    clearCache,
    getCurrentCdnSource,
    loadGfriends,
} from "../core/gfriends";
import { BasePlugin } from "./base-plugin";
import newVideoCssRaw from "../styles/new-video-plugin.css?raw";
import avatarSelectDialogCssRaw from "../styles/avatar-select-dialog.css?raw";
import { NewVideoDialog } from "../components/new-video-dialog";
import { EditActressDialog } from "../components/edit-actress-dialog";
import { CdnSelectDialog } from "../components/cdn-select-dialog";
import { AvatarSelectDialog } from "../components/avatar-select-dialog";
import { ActressCard } from "../components/actress-card";
import { ActressPagination } from "../components/actress-pagination";
import { NewVideoDialogTitle } from "../components/new-video-dialog-title";

/**
 * 收藏女优记录结构（storageManager.getFavoriteActressList() 返回元素）。
 * starId/name/avatar 为收藏时必填；其余字段可缺省，由各处 || "" / Array.isArray 兜底。
 */
interface FavoriteActressRecord {
    /** 演员 starId（URL /actors/<id> 末段） */
    starId: string;
    /** 主名称 */
    name: string;
    /** 头像 URL */
    avatar: string;
    /** 全部别名 */
    allName?: string[];
    /** 最新作品番号列表 */
    newVideoList?: string[];
    /** 演员类别：censored / uncensored / 空(未知) */
    actressType?: string;
    /** 备注 */
    remark?: string;
    /** 上次检测时间 */
    lastCheckTime?: string;
    /** 最后发行作品时间 */
    lastPublishTime?: string;
}

export class NewVideoPlugin extends BasePlugin {
    /** 当前分页页码（从 1 开始） */
    currentPage: number = 1;
    /** 每页卡片数 */
    pageSize: number = 30;

    /** 返回插件名，供 PluginManager 注册去重。对应原 L11041-11043。 */
    getName(): string {
        return "NewVideoPlugin";
    }

    /**
     * 注入卡片网格 / 分页 / 按钮等内联样式（原 L11044-11046 的 <style>）。
     * 头像选择弹窗的 gfriends-* 样式不在 initCss 注入，改由 searchAvatar
     * 在 layer.open content 中拼接 avatar-select-dialog.css（原 L11404 的
     * <style> 块 + HTML），与原脚本 content 字符级一致。无参数；返回
     * Promise<string>（CSS 文本）；不抛出异常。
     */
    async initCss(): Promise<string> {
        return newVideoCssRaw;
    }

    /**
     * 主处理入口：刷新新作品计数。对应原 L11047-11049。
     * 无参数；返回 Promise<void>；不抛出异常。
     */
    async handle(): Promise<void> {
        await this.showNewVideoCount();
    }

    /**
     * 统计收藏女优的新作品总数并写入 #newVideoCount。
     * 对应原 L11050-11062。无参数；返回 Promise<void>；不抛出异常。
     */
    async showNewVideoCount(): Promise<void> {
        const totalCount: number = (
            await storageManager.getFavoriteActressList()
        ).reduce((total: number, actress: FavoriteActressRecord) => {
            return total + (actress.newVideoList?.length ?? 0);
        }, 0);
        $("#newVideoCount").text(`${totalCount}`);
    }

    /**
     * 重置按钮提示（占位实现，暂无逻辑）。对应原 L11063。
     * 无参数；返回 Promise<void>；不抛出异常。
     */
    async resetBtnTip(): Promise<void> {}

    /**
     * 打开"新作品检测"对话框并初始化数据加载与事件绑定。
     * 对应原 L11064-11079。无参数；返回 Promise<void>；不抛出异常
     *（success 回调内 loadData/bindClick 异常由调用方兜底）。
     */
    async openDialog(): Promise<void> {
        const dialogContent: string = NewVideoDialog({
            refreshSvg: this.refreshSvg,
        });
        layer.open({
            type: 1,
            title: NewVideoDialogTitle(),
            content: dialogContent,
            scrollbar: false,
            area: utils.getResponsiveArea(["80%", "90%"]),
            anim: -1,
            success: async (_layerEl: any, layerIndex: any) => {
                this.loadData();
                this.bindClick();
                utils.setupEscClose(layerIndex);
            },
        });
    }

    /**
     * 绑定刷新按钮与类型筛选下拉的交互。对应原 L11080-11088。
     * 无参数；无返回值；不抛出异常。
     */
    bindClick(): void {
        $("#reLoad").on("click", (_event: any) => {
            this.loadData();
            $("#checkNewVideoMsg").text("");
        });
        $("#paramActressType").on("change", (_event: any) => {
            this.loadData();
        });
    }

    /**
     * 重置页码并重新渲染卡片。对应原 L11089-11092。
     * 无参数；无返回值；不抛出异常。
     */
    loadData(): void {
        this.currentPage = 1;
        this.renderActressCards().then();
    }

    /**
     * 渲染收藏女优卡片网格：读取收藏列表 → 按类型过滤 → 排序（新作品数、最后发行时间）
     * → 分页切片 → 生成卡片 HTML → 绑定取消收藏/编辑按钮 → 渲染分页。
     * 对应原 L11093-11195。无参数；返回 Promise<void>；不抛出异常
     *（容器不存在时短路返回；移除失败仅 show.error/clog.error）。
     */
    async renderActressCards(): Promise<void> {
        const $container: any = $("#actress-card-container");
        if (!$container.length) {
            return;
        }
        let favoriteActresses: FavoriteActressRecord[] =
            await storageManager.getFavoriteActressList();
        const typeFilter: any = $("#paramActressType").val();
        if (typeFilter !== "all") {
            favoriteActresses = favoriteActresses.filter(
                (actress) => actress.actressType === typeFilter,
            );
        }
        const sortedActresses: FavoriteActressRecord[] = utils.genericSort(
            favoriteActresses,
            [
                {
                    key: (actress: FavoriteActressRecord) =>
                        actress.newVideoList?.length ?? 0,
                    order: "desc",
                },
                {
                    key: "lastPublishTime",
                    order: "desc",
                },
            ],
        );
        const totalCount: number = sortedActresses.length;
        const totalPages: number = Math.ceil(totalCount / this.pageSize);
        const startIndex: number = (this.currentPage - 1) * this.pageSize;
        const endIndex: number = startIndex + this.pageSize;
        const pageActresses: FavoriteActressRecord[] = sortedActresses.slice(
            startIndex,
            endIndex,
        );
        const javDbUrl: string =
            await this.getBean("OtherSitePlugin").getJavDbUrl();
        const ruleTimeHours: number =
            (await storageManager.getSetting("checkNewVideo_ruleTime")) || 8760;
        const cardsHtml: string = pageActresses
            .map((actress: FavoriteActressRecord) => {
                const allNameText: string = Array.isArray(actress.allName)
                    ? actress.allName.join("，")
                    : "";
                // 保留原 no-op 语句（原 L11132-11134，join 结果未使用，控制流不变）
                if (Array.isArray(actress.newVideoList)) {
                    actress.newVideoList.join("，");
                }
                const actressUrl: string = `${javDbUrl}/actors/${actress.starId}?t=d`;
                let isStale: boolean = false;
                if (actress.lastPublishTime) {
                    isStale = !utils.isUnnecessaryCheck(
                        actress.lastPublishTime,
                        ruleTimeHours,
                    );
                }
                let typeLabel: string = "未知";
                let typeColor: string = "#9E9E9E";
                if (actress.actressType === UNCENSORED) {
                    typeLabel = "无码";
                    typeColor = "#4CAF50";
                } else if (actress.actressType === CENSORED) {
                    typeLabel = "有码";
                    typeColor = "#FF9800";
                }
                let btnStyle: string = "";
                if (isStale) {
                    btnStyle =
                        "background: linear-gradient(145deg, #e0e0e0 0%, #cabdbd 100%);box-shadow: none";
                }
                return ActressCard({
                    starId: actress.starId,
                    avatar:
                        actress.avatar ||
                        "https://c0.jdbstatic.com/images/actor_unknow.jpg",
                    name: actress.name,
                    allNameText,
                    actressUrl,
                    lastCheckTime: actress.lastCheckTime || "",
                    lastPublishTime: actress.lastPublishTime || "",
                    isStale,
                    ruleTimeYears: ruleTimeHours / 24 / 365,
                    remark: actress.remark || "",
                    editSvg: this.editSvg,
                    deleteSvg: this.deleteSvg,
                    btnStyle,
                    typeLabel,
                    typeColor,
                    newVideoCount: actress.newVideoList?.length || 0,
                });
            })
            .join("");
        $container.html(cardsHtml);
        $(".btn-delete-actress")
            .off("click")
            .on("click", (event: any) => {
                event.preventDefault();
                const starId: string = $(event.currentTarget).attr(
                    "data-starId",
                );
                const actress = sortedActresses.find(
                    (item) => item.starId === starId,
                );
                utils.q(event, `是否取消收藏 ${actress!.name}?`, async () => {
                    const uncollectUrl: string = `${await this.getBean("OtherSitePlugin").getJavDbUrl()}/actors/${starId}/uncollect`;
                    const csrfToken: string =
                        document
                            .querySelector("meta[name=csrf-token]")
                            ?.getAttribute("content") ?? "";
                    const response: any = await gmHttp.post(
                        uncollectUrl,
                        null,
                        {
                            "x-csrf-token": csrfToken,
                        },
                    );
                    if (response.includes("removeClass")) {
                        await storageManager.removeFavoriteActress(starId);
                        this.loadData();
                    } else {
                        show.error("移除失败");
                        clog.error("移除失败,返回值:", response);
                    }
                });
            });
        $(".btn-edit-actress")
            .off("click")
            .on("click", (event: any) => {
                event.preventDefault();
                const starId: string = $(event.currentTarget).attr(
                    "data-starId",
                );
                const actress = sortedActresses.find(
                    (item) => item.starId === starId,
                );
                if (actress) {
                    this.editActress(actress);
                } else {
                    show.error(`未找到 starId 为 ${starId} 的女优记录。`);
                }
            });
        this.renderPagination(totalCount, totalPages);
        show.ok("加载完成");
    }

    /**
     * 打开编辑女优弹窗：预填头像/名称/别名/类别/最新作品/备注，支持搜索头像、
     * 切换 CDN 源、自动调整 textarea 高度，保存时回写 storageManager。
     * 对应原 L11196-11321。
     * @param actress 待编辑的收藏女优记录。
     * 返回 Promise<void>；不抛出异常（保存失败仅 show.error）。
     */
    async editActress(actress: FavoriteActressRecord): Promise<void> {
        const name: string = actress.name;
        const avatar: string = actress.avatar;
        const remark: string = actress.remark || "";
        const allNameText: string = Array.isArray(actress.allName)
            ? actress.allName.join("，")
            : "";
        const newVideoText: string = Array.isArray(actress.newVideoList)
            ? actress.newVideoList.join("，")
            : "";
        const starId: string = actress.starId;
        const textareaStyle: string =
            "width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; min-height: 60px; overflow-y: hidden;";
        const actressType: string = actress.actressType || "";
        const dialogContent: string = EditActressDialog({
            avatar,
            name,
            textareaStyle,
            allNameText,
            actressType,
            newVideoText,
            remark,
        });
        layer.open({
            type: 1,
            title: `编辑女优: ${name} (${starId})`,
            area: ["500px", "750px"],
            content: dialogContent,
            btn: ["保存", "取消"],
            success: (_layerEl: any, layerIndex: any) => {
                const autoHeight = ($textarea: any) => {
                    $textarea.css("height", "auto");
                    $textarea.css(
                        "height",
                        $textarea[0].scrollHeight + 15 + "px",
                    );
                };
                $("#edit-actress-avatar").on("input", (event: any) => {
                    const val: string = $(event.currentTarget).val();
                    $("#edit-avatar-preview").attr("src", val);
                });
                const $allNameArea: any = $("#edit-actress-allname");
                $allNameArea.on("input", (event: any) => {
                    autoHeight($(event.currentTarget));
                });
                autoHeight($allNameArea);
                const $newVideoArea: any = $("#edit-actress-newvideolist");
                $newVideoArea.on("input", (event: any) => {
                    autoHeight($(event.currentTarget));
                });
                autoHeight($newVideoArea);
                $("#search-avatar-btn").on("click", async () => {
                    await this.searchAvatar();
                });
                $("#select-cdn-btn").on("click", async () => {
                    const currentIndex: number = getCurrentCdnSource().index;
                    const cdnDialogContent: string = CdnSelectDialog({
                        sources: GFRIENDS_SOURCES,
                        currentIndex,
                    });
                    layer.open({
                        type: 1,
                        title: "选择 CDN 源",
                        area: ["400px", "auto"],
                        content: cdnDialogContent,
                        btn: ["确定", "取消"],
                        success: (_cdnLayerEl: any, cdnLayerIndex: any) => {
                            utils.setupEscClose(cdnLayerIndex);
                        },
                        yes: async (cdnLayerIndex: any) => {
                            const selectedValue: any = $(
                                'input[name="cdn-source"]:checked',
                            ).val();
                            const selectedIndex: number = parseInt(
                                selectedValue,
                                10,
                            );
                            if (selectedIndex !== currentIndex) {
                                localStorage.setItem(
                                    GFRIENDS_CDN_INDEX_KEY,
                                    selectedIndex.toString(),
                                );
                                clearCache();
                                try {
                                    await (window as any).lt.set(
                                        FILETREE_DATA_KEY,
                                        null,
                                    );
                                } catch (error: any) {
                                    clog.error(
                                        "清除 IndexedDB 缓存失败:",
                                        error,
                                    );
                                }
                                show.ok(
                                    `CDN 源已切换为: ${GFRIENDS_SOURCES[selectedIndex].name}`,
                                );
                                layer.close(cdnLayerIndex);
                            } else {
                                layer.close(cdnLayerIndex);
                            }
                        },
                    });
                });
                utils.setupEscClose(layerIndex);
            },
            yes: async (layerIndex: any) => {
                const avatar: string = $("#edit-actress-avatar").val().trim();
                const name: string = $("#edit-actress-name").val().trim();
                const allNameText: string = $("#edit-actress-allname")
                    .val()
                    .trim();
                const newVideoText: string = $("#edit-actress-newvideolist")
                    .val()
                    .trim();
                const remark: string = $("#edit-remark").val().trim();
                const actressType: string = $("#actressType").val();
                if (!name) {
                    show.error("主名称不能为空");
                    return false;
                }
                const allNameArray: string[] = allNameText
                    .split(/[\uff0c,]/)
                    .map((part) => part.trim())
                    .filter((part) => part.length > 0);
                const newVideoArray: string[] = newVideoText
                    .split(/[\uff0c,]/)
                    .map((part) => part.trim())
                    .filter((part) => part.length > 0);
                actress.avatar = avatar;
                actress.name = name;
                actress.allName = allNameArray;
                actress.newVideoList = newVideoArray;
                actress.actressType = actressType;
                actress.remark = remark;
                if (await storageManager.updateFavoriteActress(actress)) {
                    show.error("修改失败");
                } else {
                    this.renderActressCards().then();
                    show.ok(`女优 ${name} 信息已更新`);
                    layer.close(layerIndex);
                }
            },
        });
    }

    /**
     * 渲染分页条（首页/上一页/页码/下一页/尾页/记录数），并绑定页码点击。
     * 对应原 L11322-11366。
     * @param totalCount 记录总数。
     * @param totalPages 总页数。
     * 无返回值；不抛出异常（totalPages 为 0 时仅显示"共 0 条记录"后返回）。
     */
    renderPagination(totalCount: number, totalPages: number): void {
        const page: number = this.currentPage;
        const $pagination: any = $("#actress-pagination");
        $pagination.html(ActressPagination({ totalCount, totalPages, page }));
        $(".pagination-btn")
            .off("click")
            .on("click", (event: any) => {
                if ($(event.currentTarget).is("[disabled]")) {
                    return;
                }
                const targetPage: number = parseInt(
                    $(event.currentTarget).data("page"),
                );
                if (
                    targetPage >= 1 &&
                    targetPage <= totalPages &&
                    targetPage !== this.currentPage
                ) {
                    this.currentPage = targetPage;
                    this.renderActressCards();
                }
            });
    }

    /**
     * 调用 Gfriends 仓库按女优名称搜索头像，弹出图片选择网格（含尺寸标签、
     * 加载/出错处理），选中后回填编辑弹窗的头像链接与预览。
     * 对应原 L11367-11464。无参数；返回 Promise<void>；不抛出异常
     *（搜索失败/无结果/链接全失效均仅 show.error 后返回）。
     */
    async searchAvatar(): Promise<void> {
        const $nameInput: any = $("#edit-actress-name");
        const $allNameInput: any = $("#edit-actress-allname");
        const nameText: string = $nameInput.val().trim();
        const searchNames: string[] = $allNameInput
            .val()
            .trim()
            .split(/[\uff0c,]/)
            .map((name: any) => name.trim())
            .filter((name: any) => name.length > 0);
        if (nameText) {
            searchNames.unshift(nameText);
        }
        if (searchNames.length === 0) {
            show.error("请先填写女优主名称或别名进行搜索。");
            return;
        }
        const loader = (
            loading as (message: string) => {
                close: () => void;
            }
        )("正在搜索头像...");
        let avatarUrls: string[] = [];
        try {
            avatarUrls = await loadGfriends(searchNames);
        } catch (error: any) {
            show.error(`头像数据加载或搜索失败: ${error.message || error}`);
            return;
        } finally {
            loader.close();
        }
        if (avatarUrls.length === 0) {
            show.error(
                `未找到与 '${searchNames.join("、")}' 相关的头像。请检查名称。`,
            );
            return;
        }
        // content = 原 searchAvatar 的 r 模板：<style> 块（avatar-select-dialog.css）
        // + HTML（AvatarSelectDialog），与原 content 字符级一致。
        const dialogContent: string =
            "<style>" +
            avatarSelectDialogCssRaw +
            "</style>" +
            AvatarSelectDialog({
                avatarUrls,
            });
        let errorCount: number = 0;
        layer.open({
            type: 1,
            title: `选择女优头像 (${avatarUrls.length} 张)`,
            area: utils.getResponsiveArea(["900px", "85%"]),
            content: dialogContent,
            btn: ["关闭"],
            success: (layerEl: any, layerIndex: any) => {
                const $layer: any = $(layerEl);
                const $images: any = $layer.find(".gfriends-selectable-img");
                const $prompt: any = $layer.find("#gfriends-prompt");
                $images.each((_index: number, element: any) => {
                    const $img: any = $(element);
                    const wrapperId: any = $img.data("wrapper-id");
                    const $wrapper: any = $layer.find(`#${wrapperId}`);
                    const $sizeTag: any = $layer.find(
                        `.gfriends-size-tag[data-size-for="${wrapperId}"]`,
                    );
                    $img.on("load", () => {
                        const width: number = element.naturalWidth;
                        const height: number = element.naturalHeight;
                        $sizeTag.text(`${width} x ${height}`);
                    });
                    $img.on("error", () => {
                        $wrapper.remove();
                        errorCount++;
                        const remaining: number =
                            avatarUrls.length - errorCount;
                        $prompt.text(
                            `点击图片即可选择（已移除 ${errorCount} 张错误图片，剩余 ${remaining} 张）`,
                        );
                        if (remaining === 0) {
                            show.error(
                                "所有搜索到的头像链接均已失效，无法选择。",
                            );
                            layer.close(layerIndex);
                        }
                    });
                    if (element.complete) {
                        if (element.naturalWidth > 0) {
                            $img.trigger("load");
                        } else {
                            $img.trigger("error");
                        }
                    }
                });
                $images.on("click", (event: any) => {
                    const $img: any = $(event.currentTarget);
                    const url: any = $img.data("url");
                    $("#edit-actress-avatar").val(url);
                    $("#edit-avatar-preview").attr("src", url);
                    $images.removeClass("is-selected");
                    $img.addClass("is-selected");
                    setTimeout(() => {
                        layer.close(layerIndex);
                    }, 150);
                });
                utils.setupEscClose(layerIndex);
            },
        });
    }
}
