/**
 * 相关清单插件 RelatedPlugin。
 *
 * 在影片详情页加载并展示 jdforrepam.com 的相关清单数据：JavDb 站点由 ReviewPlugin
 * 在 showReview 后调用本插件 showRelated，以 URL 末段作为影片 ID 拉取 /v1/lists/related。
 * 支持折叠/展开状态持久化（enableLoadRelated 设置）、分页加载更多、失败重试。
 *
 * 对称于 ReviewPlugin（src/plugins/review-plugin.ts）的实现模式：
 * - 折叠面板头部 + 容器/页脚 + 加载中/失败重试/空态/加载更多/结束 组件化（related-*）。
 * - floorIndex/isInit class 字段（原 i(this,"field",val) 改为 class 字段语法，
 *   配合 tsconfig useDefineForClassFields:true，[[Define]] 语义一致）。
 * - 控制流（折叠 click 分支、try/catch/finally、加载更多 page 自增）与 ReviewPlugin 一致。
 *
 * 实现已对照 archetype/jhs.user.js L10585-10708（RelatedPlugin 完整类，commit 66b2fdf）
 * 精确校准：DOM ID、文案、条目字段、HTML 结构/类名/内联 style、折叠头均与 archetype
 * 一致；enableLoadRelated 默认 NO（折叠，与 archetype 默认 C 一致），首次展开才拉取。
 * 保留对 ReviewPlugin 的对称增强（簽名已過期 提示 + clog.error，见 review-plugin.ts）：
 * - DOM ID 沿用原版单数 related 命名：relatedFold / relatedContainer / relatedFooter /
 *   relatedLoading / relatedEnd；重试/加载更多按钮 ID 为 retryFetchRelateds /
 *   loadMoreRelateds（原版命名，relateds 为名词复数）。
 * - 文案沿用原版：头部“相关清单”（无 emoji）、loading“获取清单中...”、失败“获取清单失败”+“重试”、
 *   加载更多“加载更多清单”、结束“已加载全部清单”、空“无清单”。
 * - 条目 HTML 按原版：<div class="item columns is-desktop"> 含 #序号、创建时间、
 *   /lists/{relatedId} 名称链接（color:#2e8abb）、视频个数、收藏次数/被查看次数。
 * - API 调用 K(movieId, page, 20)（K 即 fetchRelatedCollections），返回 RelatedCollection[]
 *   （relatedId/name/movieCount/collectionCount/viewCount/createTime）。
 *
 * 组件（RelatedContainers/RelatedEmpty/RelatedEnd/RelatedError/RelatedHeader/
 * RelatedItem/RelatedLoadMore/RelatedLoading）已转 TSX 原生 React 组件，
 * 调用点改 jsxToString(<Comp {...props} />)；本文件因含 JSX 重命名为 .tsx。
 */
import { BasePlugin } from "./base-plugin";
import { fetchRelatedCollections as K } from "../constants/api";
import { YES, NO } from "../constants/status";
import { jsxToString } from "../core/jsx-to-string";
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
     * 在指定容器内渲染相关清单区骨架（分隔线 + 折叠开关 + 容器/页脚），并按设置决定是否立即拉取。
     *
     * @param container 清单区挂载点；为空时取 #magnets-content
     * @param movieId 影片 ID（JavDb 为 URL 末段字符串）
     * @returns 无返回值；首次展开或设置已展开时会异步触发 fetchAndDisplayRelateds
     */
    async showRelated(container: any, movieId: any): Promise<void> {
        const isExpanded = await storageManager.getSetting(
            "enableLoadRelated",
            NO,
        );
        const target = container || $("#magnets-content");
        target.append(
            jsxToString(
                <RelatedHeader
                    foldText={isExpanded === YES ? "折叠" : "展开"}
                    iconText={isExpanded === YES ? "▲" : "▼"}
                />,
            ),
        );
        $("#relatedFold").on("click", (event: any) => {
            event.preventDefault();
            event.stopPropagation();
            const toggleText = $("#relatedFold .toggle-text");
            const toggleIcon = $("#relatedFold .toggle-icon");
            const isExpand = toggleText.text() === "展开";
            toggleText.text(isExpand ? "折叠" : "展开");
            toggleIcon.text(isExpand ? "▲" : "▼");
            if (isExpand) {
                $("#relatedContainer").show();
                $("#relatedFooter").show();
                if (!this.isInit) {
                    this.fetchAndDisplayRelateds(movieId);
                    this.isInit = true;
                }
                storageManager.saveSettingItem("enableLoadRelated", YES);
            } else {
                $("#relatedContainer").hide();
                $("#relatedFooter").hide();
                storageManager.saveSettingItem("enableLoadRelated", NO);
            }
        });
        target.append(jsxToString(<RelatedContainers />));
        if (isExpanded === YES) {
            await this.fetchAndDisplayRelateds(movieId);
        }
    }

    /**
     * 拉取并渲染第一页相关清单，按结果展示加载更多/重试/无清单等状态。
     *
     * @param movieId 影片 ID
     * @returns 无返回值；签名过期等异常会被 catch 并提示，不会向外抛出
     */
    async fetchAndDisplayRelateds(movieId: any): Promise<void> {
        const container = $("#relatedContainer");
        const footer = $("#relatedFooter");
        container.append(jsxToString(<RelatedLoading />));
        const limit = 20;
        let list: any = null;
        try {
            list = await K(movieId, 1, limit);
        } catch (err: any) {
            if (err.toString().includes("簽名已過期")) {
                show.error("生成签名失败, 请检查系统时间及时区是否正确!");
            }
            clog.error("获取清单失败:", err);
            console.error("获取清单失败:", err);
        } finally {
            $("#relatedLoading").remove();
        }
        if (!list) {
            container.append(jsxToString(<RelatedError />));
            $("#retryFetchRelateds").on("click", async () => {
                $("#retryFetchRelateds").parent().remove();
                await this.fetchAndDisplayRelateds(movieId);
            });
            return;
        }
        if (list.length === 0) {
            container.append(jsxToString(<RelatedEmpty />));
            return;
        }
        this.displayRelateds(list, container);
        if (list.length === limit) {
            footer.html(jsxToString(<RelatedLoadMore />));
            let page = 1;
            const loadMoreBtn = $("#loadMoreRelateds");
            loadMoreBtn.on("click", async () => {
                let moreList: any;
                loadMoreBtn.text("加载中...").prop("disabled", true);
                page++;
                try {
                    moreList = await K(movieId, page, limit);
                } catch (err: any) {
                    console.error("加载更多清单失败:", err);
                } finally {
                    loadMoreBtn
                        .text("加载失败, 请点击重试")
                        .prop("disabled", false);
                }
                if (moreList) {
                    this.displayRelateds(moreList, container);
                    if (moreList.length < limit) {
                        loadMoreBtn.remove();
                        $("#relatedEnd").show();
                    } else {
                        loadMoreBtn
                            .text("加载更多清单")
                            .prop("disabled", false);
                    }
                }
            });
        } else {
            footer.html(jsxToString(<RelatedEnd />));
        }
    }

    /**
     * 将清单数组渲染为 DOM 追加到容器。
     *
     * @param list 清单数组（来自 fetchRelatedCollections，字段见 RelatedCollection）
     * @param container 清单挂载容器（#relatedContainer）
     */
    displayRelateds(list: any, container: any): void {
        if (list.length) {
            list.forEach((item: any) => {
                const html = jsxToString(
                    <RelatedItem
                        index={this.floorIndex++}
                        relatedId={item.relatedId}
                        name={item.name}
                        movieCount={item.movieCount}
                        collectionCount={item.collectionCount}
                        viewCount={item.viewCount}
                        createTime={item.createTime}
                    />,
                );
                container.append(html);
            });
        }
    }
}
