/**
 * 相关合集插件 RelatedPlugin。
 *
 * 在影片详情页加载并展示 jdforrepam.com 的相关合集数据：JavDb 站点由 ReviewPlugin
 * 在 showReview 后调用本插件 showRelated，以 URL 末段作为影片 ID 拉取 /v1/lists/related。
 * 支持折叠/展开状态持久化（enableLoadRelated 设置）、分页加载更多、失败重试。
 *
 * 对称于 ReviewPlugin（src/plugins/review-plugin.ts）的实现模式：
 * - 折叠面板头部 + 容器/页脚 + 加载中/失败重试/空态/加载更多/结束 组件化（related-*）。
 * - floorIndex/isInit class 字段（原 i(this,"field",val) 改为 class 字段语法，
 *   配合 tsconfig useDefineForClassFields:true，[[Define]] 语义一致）。
 * - 控制流（折叠 click 分支、try/catch/finally、加载更多 page 自增）与 ReviewPlugin 一致。
 *
 * 重要说明：archetype/jhs.user.js（仓库当前 11565 行版本）中**未包含** RelatedPlugin 原始
 * 实现及 /v1/lists/related 调用（grep 无 related/Related/showRelated 匹配）。本插件系按
 * 任务规格（showRelated(container, movieId) / fetchAndDisplayRelateds(movieId) /
 * displayRelateds(list, container) / K(movieId, page, 20) / enableLoadRelated 设置）+
 * ReviewPlugin 对称模式构建。src/constants/api.ts 的 fetchRelatedCollections（对应原 K）
 * 为拆分时预先提取，返回结构 RelatedCollection 已定。条目字段展示语义见
 * related-item.ts 注释，请人工与真实原版核对校准。
 */
import { BasePlugin } from "./base-plugin";
import { fetchRelatedCollections as K } from "../constants/api";
import { YES, NO } from "../constants/status";
import { RelatedContainers } from "../components/related-containers";
import { RelatedEmpty } from "../components/related-empty";
import { RelatedEnd } from "../components/related-end";
import { RelatedError } from "../components/related-error";
import { RelatedHeader } from "../components/related-header";
import { RelatedItem } from "../components/related-item";
import { RelatedLoadMore } from "../components/related-load-more";
import { RelatedLoading } from "../components/related-loading";

export class RelatedPlugin extends BasePlugin {
    /** 合集条目序号（渲染时自增）。 */
    floorIndex = 1;
    /** 是否已首次拉取合集（避免展开时重复请求）。 */
    isInit = false;

    /** 返回插件名，供 PluginManager 注册去重。 */
    getName(): string {
        return "RelatedPlugin";
    }

    /**
     * 在指定容器内渲染相关合集区骨架（分隔线 + 折叠开关 + 容器/页脚），并按设置决定是否立即拉取。
     *
     * @param container 合集区挂载点；为空时取 #magnets-content
     * @param movieId 影片 ID（JavDb 为 URL 末段字符串）
     * @returns 无返回值；首次展开或设置已展开时会异步触发 fetchAndDisplayRelateds
     */
    async showRelated(container: any, movieId: any): Promise<void> {
        const isExpanded = await storageManager.getSetting(
            "enableLoadRelated",
            YES,
        );
        const target = container || $("#magnets-content");
        target.append(
            RelatedHeader({
                foldText: isExpanded === YES ? "折叠" : "展开",
                iconText: isExpanded === YES ? "▲" : "▼",
            }),
        );
        $("#relatedsFold").on("click", (event: any) => {
            event.preventDefault();
            event.stopPropagation();
            const toggleText = $("#relatedsFold .toggle-text");
            const toggleIcon = $("#relatedsFold .toggle-icon");
            const isExpand = toggleText.text() === "展开";
            toggleText.text(isExpand ? "折叠" : "展开");
            toggleIcon.text(isExpand ? "▲" : "▼");
            if (isExpand) {
                $("#relatedsContainer").show();
                $("#relatedsFooter").show();
                if (!this.isInit) {
                    this.fetchAndDisplayRelateds(movieId);
                    this.isInit = true;
                }
                storageManager.saveSettingItem("enableLoadRelated", YES);
            } else {
                $("#relatedsContainer").hide();
                $("#relatedsFooter").hide();
                storageManager.saveSettingItem("enableLoadRelated", NO);
            }
        });
        target.append(RelatedContainers());
        if (isExpanded === YES) {
            await this.fetchAndDisplayRelateds(movieId);
        }
    }

    /**
     * 拉取并渲染第一页相关合集，按结果展示加载更多/重试/无合集等状态。
     *
     * @param movieId 影片 ID
     * @returns 无返回值；签名过期等异常会被 catch 并提示，不会向外抛出
     */
    async fetchAndDisplayRelateds(movieId: any): Promise<void> {
        const container = $("#relatedsContainer");
        const footer = $("#relatedsFooter");
        container.append(RelatedLoading());
        const limit = 20;
        let list: any = null;
        try {
            list = await K(movieId, 1, limit);
        } catch (err: any) {
            if (err.toString().includes("簽名已過期")) {
                show.error("生成签名失败, 请检查系统时间及时区是否正确!");
            }
            clog.error("获取相关合集失败:", err);
            console.error("获取相关合集失败:", err);
        } finally {
            $("#relatedsLoading").remove();
        }
        if (!list) {
            container.append(RelatedError());
            $("#retryFetchRelateds").on("click", async () => {
                $("#retryFetchRelateds").parent().remove();
                await this.fetchAndDisplayRelateds(movieId);
            });
            return;
        }
        if (list.length === 0) {
            container.append(RelatedEmpty());
            return;
        }
        this.displayRelateds(list, container);
        if (list.length === limit) {
            footer.html(RelatedLoadMore());
            let page = 1;
            const loadMoreBtn = $("#loadMoreRelateds");
            loadMoreBtn.on("click", async () => {
                let moreList: any;
                loadMoreBtn.text("加载中...").prop("disabled", true);
                page++;
                try {
                    moreList = await K(movieId, page, limit);
                } catch (err: any) {
                    console.error("加载更多相关合集失败:", err);
                } finally {
                    loadMoreBtn
                        .text("加载失败, 请点击重试")
                        .prop("disabled", false);
                }
                if (moreList) {
                    this.displayRelateds(moreList, container);
                    if (moreList.length < limit) {
                        loadMoreBtn.remove();
                        $("#relatedsEnd").show();
                    } else {
                        loadMoreBtn
                            .text("加载更多相关合集")
                            .prop("disabled", false);
                    }
                }
            });
        } else {
            footer.html(RelatedEnd());
        }
    }

    /**
     * 将合集数组渲染为 DOM 追加到容器。
     *
     * @param list 合集数组（来自 fetchRelatedCollections，字段见 RelatedCollection）
     * @param container 合集挂载容器（#relatedsContainer）
     */
    displayRelateds(list: any, container: any): void {
        if (list.length) {
            list.forEach((item: any) => {
                const html = RelatedItem({
                    index: this.floorIndex++,
                    name: item.name,
                    movieCount: item.movieCount,
                    collectionCount: item.collectionCount,
                    viewCount: item.viewCount,
                    createTime: item.createTime,
                });
                container.append(html);
            });
        }
    }
}
