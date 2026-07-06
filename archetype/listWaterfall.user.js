// ==UserScript==
// @name         JavDB 清单瀑布流
// @version      0.1.0
// @description  为「我的清单」和「收藏的清单」页面启用瀑布流自动翻页，滚动接近底部自动加载下一页
// @namespace    zerobiubiu.top
// @author       zerobiubiu
// @license      MIT
// @homepageURL  https://github.com/zerobiubiu/javdb-tools
// @icon         https://cdn.jsdelivr.net/gh/zerobiubiu/Figure-bed/b507c13a-9f4e-41b5-bbbb-129d0a21f97d.png
// @include      https://javdb*.com/users/lists*
// @include      https://javdb*.com/users/favorite_lists*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @connect      javdb.com
// @connect      *
// @run-at       document-end
// ==/UserScript==

(function () {
    "use strict";

    const LOG_PREFIX = "[listWaterfall]";
    /** 瀑布流开关持久化键（GM_setValue） */
    const ENABLED_KEY = "jdb:list-waterfall-enabled";
    /** 预加载距离：loader 距视口底部多少像素时触发加载下一页 */
    const PRELOAD_DISTANCE = 800;
    /** 最大页数保护，防止异常情况无限加载 */
    const MAX_PAGES = 200;

    /** 路径白名单（@include 较宽松，需在脚本内精确校验） */
    const ALLOWED_PATHS = new Set(["/users/lists", "/users/favorite_lists"]);

    /** 选择器配置 */
    const SEL = {
        /** 清单列表容器 */
        box: "#lists > ul",
        /** 单个清单项 */
        item: "#lists > ul > li",
        /** 下一页链接（JavDB 全站通用） */
        nextLink: "a.pagination-next",
        /** 分页 nav 容器 */
        paginationNav: "nav.pagination",
        /** 清单项内的主链接（清单标题） */
        itemLink: "div.column.is-10 > a",
    };

    /**
     * 读取瀑布流开关（默认开启）
     * @returns {boolean}
     */
    function isEnabled() {
        return GM_getValue(ENABLED_KEY, true);
    }

    /**
     * 切换开关状态并提示刷新
     */
    function toggleEnabled() {
        const next = !isEnabled();
        GM_setValue(ENABLED_KEY, next);
        console.log(`${LOG_PREFIX} 瀑布流开关: ${next ? "开启" : "关闭"}`);
        if (
            window.confirm(
                `清单瀑布流自动翻页已${next ? "开启" : "关闭"}，是否刷新页面应用？`,
            )
        ) {
            window.location.reload();
        }
    }

    GM_registerMenuCommand(
        `${isEnabled() ? "✓" : "✗"} 清单瀑布流自动翻页`,
        toggleEnabled,
    );

    // 样式注入：状态条三态（loading/error/no-more）
    GM_addStyle(`
        .jdb-wf-loader {
            text-align: center;
            padding: 24px 0 40px;
            font-size: 0.9rem;
            color: #6c757d;
            min-height: 44px;
            box-sizing: border-box;
        }
        .jdb-wf-loader.loading { color: #485fc7; }
        .jdb-wf-loader.loading::before {
            content: "";
            display: inline-block;
            width: 14px;
            height: 14px;
            margin-right: 8px;
            border: 2px solid currentColor;
            border-top-color: transparent;
            border-radius: 50%;
            vertical-align: -2px;
            animation: jdb-wf-spin 0.8s linear infinite;
        }
        .jdb-wf-loader.error {
            color: #f44336;
            cursor: pointer;
            text-decoration: underline;
        }
        .jdb-wf-loader.no-more { color: #4CAF50; }
        @keyframes jdb-wf-spin { to { transform: rotate(360deg); } }

        /* 回到顶部按钮 */
        #jdb-wf-back-to-top {
            position: fixed;
            bottom: 40px;
            right: 40px;
            width: 44px;
            height: 44px;
            background-color: rgba(30, 30, 30, 0.9);
            backdrop-filter: blur(4px);
            color: #e0e0e0;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 9999;
            opacity: 0;
            visibility: hidden;
            transform: translateY(20px) scale(0.9);
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.05);
            user-select: none;
        }
        #jdb-wf-back-to-top:hover {
            background-color: #ff8400;
            color: #fff;
            transform: translateY(0) scale(1);
            box-shadow: 0 8px 20px rgba(255, 132, 0, 0.3);
            border-color: #ff8400;
        }
        #jdb-wf-back-to-top.show {
            opacity: 1;
            visibility: visible;
            transform: translateY(0) scale(1);
        }
        #jdb-wf-back-to-top svg {
            width: 22px;
            height: 22px;
            fill: currentColor;
            stroke: currentColor;
            stroke-width: 0;
        }
    `);

    // 路径与开关校验：@include 通配较宽松，需精确校验 pathname
    if (!ALLOWED_PATHS.has(location.pathname)) {
        return;
    }
    if (!isEnabled()) {
        console.log(`${LOG_PREFIX} 瀑布流已关闭，退出`);
        return;
    }

    // ---------- 工具函数 ----------

    /**
     * 从当前 URL 提取初始页码
     * @returns {number} 页码，默认 1
     */
    function getInitialPage() {
        const m = location.search.match(/[?&]page=(\d+)/);
        return m ? parseInt(m[1], 10) : 1;
    }

    /**
     * 在文档/节点中查找下一页链接 href
     * @param {Document|Element} doc
     * @returns {string|null} 下一页 href（相对或绝对），无则 null
     */
    function findNextUrl(doc) {
        const a = doc.querySelector(SEL.nextLink);
        return a ? a.getAttribute("href") : null;
    }

    /**
     * 将相对 href 转为绝对 URL
     * @param {string} href
     * @returns {string}
     */
    function toAbsolute(href) {
        return new URL(href, location.href).href;
    }

    /**
     * 对新追加的 li 应用链接重写（与 modMyListOpenWay 行为保持一致）
     * - 设置 target="_blank"（新窗口打开）
     * - /users/list_detail?id=xxx → /lists/xxx（短地址）
     * - /lists/xxx 保持不变
     * @param {Element} container - 含新 li 的容器节点
     */
    function rewriteItemLinks(container) {
        container.querySelectorAll(SEL.itemLink).forEach((a) => {
            a.target = "_blank";
            const href = a.getAttribute("href") || "";
            // 已是 /lists/xxx 短地址，无需重写
            if (/^\/lists\/[^/]+$/.test(href)) return;
            // /users/list_detail?id=xxx → /lists/xxx
            const m = href.match(/[?&]id=([^&]+)/);
            if (m) {
                a.href = `/lists/${m[1]}`;
            }
        });
    }

    /**
     * 发起 GM_xmlhttpRequest GET 请求
     * @param {string} url
     * @returns {Promise<string>} responseText
     */
    function gmGet(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "GET",
                url,
                timeout: 30000,
                onload: (resp) => {
                    if (resp.status >= 200 && resp.status < 300) {
                        resolve(resp.responseText);
                    } else {
                        reject(new Error(`HTTP ${resp.status}`));
                    }
                },
                onerror: () => reject(new Error("network error")),
                ontimeout: () => reject(new Error("timeout")),
            });
        });
    }

    // ---------- 瀑布流主类 ----------

    /**
     * 清单瀑布流控制器
     * 负责滚动监听、下一页请求、节点追加、分页同步、状态展示
     */
    class ListWaterfall {
        constructor() {
            /** 当前页码 */
            this.currentPage = getInitialPage();
            /** 下一页绝对 URL（无则表示已到底） */
            this.nextUrl = null;
            /** 是否还有更多页 */
            this.hasMore = false;
            /** 加载中标志，防重入 */
            this.isLoading = false;
            /** 状态条 DOM 节点 */
            this.loader = null;
            /** 清单列表容器（#lists > ul） */
            this.container = null;
            /** 已加载的 li id 集合，用于去重检测 */
            this.loadedIds = new Set();
            /** 每页滚动位置记录 [{page, top, url}]，用于滚动时同步地址栏 */
            this.pageItems = [];
            /** scroll 事件处理器引用，便于卸载 */
            this._onScroll = null;
            /** 回到顶部按钮 DOM 节点 */
            this.backToTopBtn = null;
            /** rAF 节流标志，用于回到顶部按钮的滚动监听 */
            this._ticking = false;
        }

        /**
         * 初始化瀑布流：查找容器、记录首屏、创建状态条、绑定滚动
         */
        init() {
            this.container = document.querySelector(SEL.box);
            if (!this.container) {
                console.warn(`${LOG_PREFIX} 未找到容器 ${SEL.box}，退出`);
                return;
            }

            // 记录首屏所有 li 的 id，用于后续去重
            this.container.querySelectorAll(SEL.item).forEach((li) => {
                if (li.id) this.loadedIds.add(li.id);
            });

            // 创建状态条并插入到容器之后
            this.loader = document.createElement("div");
            this.loader.className = "jdb-wf-loader";
            this.container.parentNode.insertBefore(
                this.loader,
                this.container.nextSibling,
            );

            // 点击错误状态重试
            this.loader.addEventListener("click", () => {
                if (this.loader.classList.contains("error")) {
                    this.loadNextPage();
                }
            });

            // 记录首页信息
            this.nextUrl = findNextUrl(document)
                ? toAbsolute(findNextUrl(document))
                : null;
            this.hasMore = !!this.nextUrl;

            this.pageItems.push({
                page: this.currentPage,
                top: 0,
                url: window.location.href,
            });

            // 创建回到顶部按钮
            this.createBackToTopBtn();

            // 绑定滚动监听（passive，不阻止滚动）
            this._onScroll = () => {
                this.checkLoad();
                this.updateCurrentPageFromScroll();
                this.updateBackToTopBtn();
            };
            window.addEventListener("scroll", this._onScroll, {
                passive: true,
            });

            // 启动后立即检查一次（可能首屏内容不足以填满视口）
            setTimeout(() => this.checkLoad(), 500);

            if (!this.hasMore) {
                this.setState("no-more", "已经到底了");
            } else {
                this.setState("", "");
            }
        }

        /**
         * 加载下一页：请求 HTML → 解析 → 追加 li → 更新分页
         */
        async loadNextPage() {
            if (this.isLoading || !this.nextUrl || !this.hasMore) return;
            if (this.currentPage >= MAX_PAGES) {
                this.setState("no-more", `已达最大页数 ${MAX_PAGES}，停止加载`);
                this.hasMore = false;
                return;
            }
            this.isLoading = true;
            this.setState("loading", "加载中...");

            try {
                const html = await gmGet(this.nextUrl);
                const doc = new DOMParser().parseFromString(html, "text/html");

                const remoteUl = doc.querySelector(SEL.box);
                if (!remoteUl) {
                    throw new Error("下一页未找到列表容器");
                }

                // 抽取下一页所有 li
                const newLis = Array.from(remoteUl.children).filter(
                    (li) => li.tagName === "LI",
                );

                // 去重检查：若下一页第一个 li 的 id 已存在于当前页，视为重复，停止
                if (
                    newLis.length > 0 &&
                    newLis[0].id &&
                    this.loadedIds.has(newLis[0].id)
                ) {
                    this.hasMore = false;
                    this.nextUrl = null;
                    this.setState("no-more", "已经到底了");
                    console.log(`${LOG_PREFIX} 检测到重复数据，停止瀑布流`);
                    return;
                }

                // 记录追加前的容器高度，用于 pageItems 滚动定位
                const topBefore = this.container.scrollHeight;

                // 追加新 li 到当前容器
                const fragment = document.createDocumentFragment();
                newLis.forEach((li) => {
                    if (li.id) this.loadedIds.add(li.id);
                    fragment.appendChild(li);
                });
                this.container.appendChild(fragment);

                // 对新追加的 li 应用链接重写（target=_blank + 短地址）
                rewriteItemLinks(this.container);

                // 记录本页滚动定位
                this.currentPage += 1;
                this.pageItems.push({
                    page: this.currentPage,
                    top: topBefore,
                    url: this.nextUrl,
                });

                // 更新下一页链接
                const nextHref = findNextUrl(doc);
                this.nextUrl = nextHref ? toAbsolute(nextHref) : null;
                this.hasMore = !!this.nextUrl;

                // 替换页面上的分页 nav（保持与当前页同步）
                const remoteNav = doc.querySelector(SEL.paginationNav);
                if (remoteNav) {
                    const currentNav = document.querySelector(
                        SEL.paginationNav,
                    );
                    if (currentNav) {
                        currentNav.replaceWith(remoteNav);
                    }
                }

                this.setState("", "");
                if (!this.hasMore) {
                    this.setState("no-more", "已经到底了");
                }
                console.log(
                    `${LOG_PREFIX} 已加载第 ${this.currentPage} 页，追加 ${newLis.length} 项`,
                );
            } catch (err) {
                console.error(`${LOG_PREFIX} 加载失败:`, err);
                this.setState("error", "加载失败，点击重试");
            } finally {
                this.isLoading = false;
            }
        }

        /**
         * 检查是否需要触发加载（loader 接近视口底部时）
         */
        checkLoad() {
            if (!this.loader || !this.hasMore) return;
            const rect = this.loader.getBoundingClientRect();
            if (rect.top < window.innerHeight + PRELOAD_DISTANCE) {
                this.loadNextPage();
            }
        }

        /**
         * 根据滚动位置更新当前页码与地址栏 URL（replaceState）
         */
        updateCurrentPageFromScroll() {
            const y = window.scrollY;
            for (let i = this.pageItems.length - 1; i >= 0; i--) {
                const item = this.pageItems[i];
                if (y >= item.top) {
                    if (this.currentPage !== item.page) {
                        this.currentPage = item.page;
                        // 同步地址栏 URL（不触发跳转）
                        window.history.replaceState({}, "", item.url);
                    }
                    break;
                }
            }
        }

        /**
         * 设置状态条样式与文本
         * @param {string} cls - 状态类名：loading/error/no-more/空
         * @param {string} text - 显示文本
         */
        setState(cls, text) {
            if (!this.loader) return;
            this.loader.className = `jdb-wf-loader ${cls}`.trim();
            this.loader.textContent = text;
        }

        /**
         * 创建回到顶部按钮并绑定点击事件
         * 固定右下角，滚动超过 300px 时淡入显示，点击平滑回顶
         */
        createBackToTopBtn() {
            const btn = document.createElement("div");
            btn.id = "jdb-wf-back-to-top";
            btn.title = "回到顶部";
            btn.innerHTML =
                '<svg viewBox="0 0 24 24"><path d="M12 4l-8 8h6v8h4v-8h6z"></path></svg>';
            document.body.appendChild(btn);
            btn.addEventListener("click", () => {
                window.scrollTo({ top: 0, behavior: "smooth" });
            });
            this.backToTopBtn = btn;
        }

        /**
         * 根据滚动位置更新回到顶部按钮的显示状态
         * 使用 requestAnimationFrame 节流，避免滚动卡顿
         */
        updateBackToTopBtn() {
            if (!this.backToTopBtn || this._ticking) return;
            this._ticking = true;
            window.requestAnimationFrame(() => {
                if (window.scrollY > 300) {
                    this.backToTopBtn.classList.add("show");
                } else {
                    this.backToTopBtn.classList.remove("show");
                }
                this._ticking = false;
            });
        }
    }

    // ---------- 入口 ----------

    const waterfall = new ListWaterfall();
    waterfall.init();

    console.log(`${LOG_PREFIX} 已启动 (页码 ${waterfall.currentPage})`);
})();
