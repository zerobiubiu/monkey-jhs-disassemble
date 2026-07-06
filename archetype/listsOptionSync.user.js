// ==UserScript==
// @name         清单操作同步
// @version      1.0
// @description  将视频和清单关系同步至数据库
// @namespace    zerobiubiu.top
// @author       zerobiubiu
// @license      MIT
// @homepageURL  https://github.com/zerobiubiu/javdb-tools
// @include      https://javdb*.com/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @icon         https://cdn.jsdelivr.net/gh/zerobiubiu/Figure-bed/b507c13a-9f4e-41b5-bbbb-129d0a21f97d.png
// ==/UserScript==

(function () {
    const API_BASE = "https://jls.zerobiubiu.top";
    const LOG_PREFIX = "[JavDB]";

    // ── Toast 通知系统（队列式） ────────────────────────

    /**
     * 队列状态
     * - visible: 当前展示中的 toast（最多 MAX_VISIBLE 条），含计时器
     * - overflow: 溢出排队中的 toast（堆叠样式，不计时）
     * - lastAddTime: 上一条 toast 的创建时间，用于判断「同时出现」
     */
    const toastQueue = {
        MAX_VISIBLE: 2,
        SIMULTANEOUS_WINDOW: 500, // ms 内算同时出现
        EXTRA_DURATION: 1000, // 同时出现时第二条延长的秒数
        visible: [], // { el, timerId, createdAt }
        overflow: [], // { el, msg, type, duration }
        lastAddTime: 0,
    };

    /** 注入 toast 样式（只执行一次） */
    function injectToastStyles() {
        if (document.getElementById("jdb-toast-style")) return;
        const css = document.createElement("style");
        css.id = "jdb-toast-style";
        css.textContent = `
            #jdb-toast-container {
                position: fixed;
                top: 20px;
                left: 20px;
                z-index: 99999;
                display: flex;
                flex-direction: column;
                pointer-events: none;
            }
            .jdb-toast {
                display: flex;
                align-items: center;
                gap: 10px;
                min-width: 220px;
                max-width: 380px;
                max-height: 200px;
                padding: 12px 16px;
                border-radius: 8px;
                font-size: 13px;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                color: #fff;
                line-height: 1.4;
                box-shadow: 0 4px 16px rgba(0,0,0,.28);
                backdrop-filter: blur(6px);
                pointer-events: auto;
                overflow: hidden;
                margin-bottom: 8px;
                animation: jdb-toast-in .2s cubic-bezier(.21,1.02,.73,1) forwards;
                transition: opacity .2s, transform .2s, max-height .2s, margin-bottom .2s;
            }
            .jdb-toast:last-child {
                margin-bottom: 0;
            }
            .jdb-toast.removing {
                opacity: 0;
                max-height: 0;
                margin-bottom: 0;
                padding-top: 0;
                padding-bottom: 0;
                transform: translateX(-20px);
            }
            .jdb-toast--stacked {
                max-height: 10px;
                opacity: 0.35;
                transform: translateX(12px);
                margin-bottom: 2px;
                cursor: pointer;
            }
            .jdb-toast--success { background: rgba(22,163,74,.92); }
            .jdb-toast--error   { background: rgba(220,38,38,.92); }
            .jdb-toast--warning { background: rgba(217,119,6,.92); }
            .jdb-toast--info    { background: rgba(37,99,235,.92); }
            .jdb-toast__icon {
                flex-shrink: 0;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                font-weight: 700;
            }
            .jdb-toast__msg {
                flex: 1;
                word-break: break-word;
            }
            @keyframes jdb-toast-in {
                from { opacity: 0; transform: translateX(-30px); }
                to   { opacity: 1; transform: translateX(0); }
            }
        `;
        document.head.appendChild(css);
    }

    /** 获取或创建 toast 容器 */
    function getToastContainer() {
        let el = document.getElementById("jdb-toast-container");
        if (!el) {
            el = document.createElement("div");
            el.id = "jdb-toast-container";
            document.body.appendChild(el);
        }
        return el;
    }

    /**
     * 将溢出队列中的 toast 提升为可见（最多填满到 MAX_VISIBLE）
     * 提升后的 toast 使用正常时长计时，无额外延时
     */
    function promoteOverflow() {
        while (
            toastQueue.overflow.length > 0 &&
            toastQueue.visible.length < toastQueue.MAX_VISIBLE
        ) {
            const stacked = toastQueue.overflow.shift();
            const toast = stacked.el;

            // 移除堆叠样式 → CSS transition 自动展开
            toast.classList.remove("jdb-toast--stacked");

            const toastData = {
                el: toast,
                timerId: null,
                createdAt: Date.now(),
            };
            toastQueue.visible.push(toastData);

            // 点击改为走可见 dismiss 逻辑
            toast.onclick = null;
            toast.addEventListener("click", () => {
                clearTimeout(toastData.timerId);
                dismissToast(toastData);
            });

            // 用原始时长开始计时（无额外延时）
            toastData.timerId = setTimeout(
                () => dismissToast(toastData),
                stacked.duration,
            );
        }
    }

    /**
     * 移除一条可见 toast，触发退出动画，动画结束后从 DOM 删除并尝试提升溢出
     */
    function dismissToast(toastData) {
        const idx = toastQueue.visible.indexOf(toastData);
        if (idx < 0) return;

        clearTimeout(toastData.timerId);
        toastData.el.classList.add("removing");

        const onTransitionEnd = () => {
            toastData.el.removeEventListener("transitionend", onTransitionEnd);
            if (toastData.el.parentNode) toastData.el.remove();
            toastQueue.visible.splice(
                toastQueue.visible.findIndex((d) => d === toastData),
                1,
            );
            promoteOverflow();
        };
        toastData.el.addEventListener("transitionend", onTransitionEnd);

        // 兜底：250ms 后强制清理（transitionend 可能不触发）
        setTimeout(() => {
            if (toastData.el.parentNode) {
                toastData.el.remove();
                const i = toastQueue.visible.findIndex((d) => d === toastData);
                if (i >= 0) toastQueue.visible.splice(i, 1);
                promoteOverflow();
            }
        }, 250);
    }

    /**
     * 显示一条 toast 通知
     * @param {string} msg 消息文本
     * @param {'success'|'error'|'warning'|'info'} type 类型
     * @param {number} duration 自动消失毫秒数（仅对可见 toast 生效）
     */
    function showToast(msg, type = "info", duration = 3000) {
        injectToastStyles();
        const container = getToastContainer();

        const icons = { success: "✓", error: "✗", warning: "!", info: "ℹ" };

        const toast = document.createElement("div");
        toast.className = `jdb-toast jdb-toast--${type}`;
        toast.innerHTML = `
            <span class="jdb-toast__icon">${icons[type] || icons.info}</span>
            <span class="jdb-toast__msg">${msg}</span>
        `;

        const now = Date.now();

        if (toastQueue.visible.length < toastQueue.MAX_VISIBLE) {
            // ── 进入可见队列 ──
            let adjustedDuration = duration;

            // 第二条与第一条「同时出现」则延长 1 秒
            if (
                toastQueue.visible.length === 1 &&
                now - toastQueue.lastAddTime < toastQueue.SIMULTANEOUS_WINDOW
            ) {
                adjustedDuration += toastQueue.EXTRA_DURATION;
            }

            const toastData = { el: toast, timerId: null, createdAt: now };
            toastQueue.visible.push(toastData);
            toastQueue.lastAddTime = now;

            container.appendChild(toast);

            toastData.timerId = setTimeout(
                () => dismissToast(toastData),
                adjustedDuration,
            );

            toast.addEventListener("click", () => {
                clearTimeout(toastData.timerId);
                dismissToast(toastData);
            });
        } else {
            // ── 溢出 → 堆叠样式，不计时 ──
            toast.classList.add("jdb-toast--stacked");
            const stackedData = { el: toast, msg, type, duration };
            toastQueue.overflow.push(stackedData);
            container.appendChild(toast);

            // 点击堆叠 toast 直接移除（不触发 promote）
            toast.addEventListener("click", () => {
                const i = toastQueue.overflow.findIndex(
                    (d) => d === stackedData,
                );
                if (i >= 0) {
                    toastQueue.overflow.splice(i, 1);
                    toast.classList.add("removing");
                    const onEnd = () => {
                        toast.removeEventListener("transitionend", onEnd);
                        toast.remove();
                    };
                    toast.addEventListener("transitionend", onEnd);
                    setTimeout(() => toast.remove(), 250);
                }
            });
        }
    }

    // ── 主逻辑 ────────────────────────────────────────

    /**
     * 将 API 响应解析为人类可读的摘要
     * @param {string} path API 路径
     * @param {number} status HTTP 状态码
     * @param {object|null} data 响应体
     * @returns {string} 可读摘要
     */
    function formatResponse(path, status, data) {
        // 聚合同步接口
        if (path === "/api/sync/movies_lists") {
            if (status === 200 && data) {
                const p = [];
                p.push(`影片:${data.movie || "?"}`);
                p.push(`清单:${data.list || "?"}`);
                p.push(`关联:${data.association || "?"}`);
                return p.join("  ");
            }
            return `✗ 失败(${status})`;
        }
        // 兜底
        if (data) {
            const s = JSON.stringify(data);
            return s.length > 80 ? s.substring(0, 80) + "…" : s;
        }
        return `(${status})`;
    }

    /**
     * GM_xmlhttpRequest POST 封装，控制台输出易读摘要
     * （GM 请求不出现在浏览器 Network 面板，必须控制台输出）
     */
    function gmPost(path, body) {
        const url = API_BASE + path;
        const bodyStr = JSON.stringify(body);
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "POST",
                url: url,
                headers: { "Content-Type": "application/json" },
                data: bodyStr,
                onload: (r) => {
                    let data = null;
                    let rawBody = r.responseText || "";
                    try {
                        data = JSON.parse(r.responseText);
                    } catch (_) {
                        // 保留原始响应体用于错误诊断
                    }
                    console.log(
                        `${LOG_PREFIX} POST ${path} → ${r.status}  ${formatResponse(path, r.status, data)}`,
                    );
                    resolve({ status: r.status, data, rawBody });
                },
                onerror: (err) => {
                    console.error(`${LOG_PREFIX} << 网络错误`, err);
                    reject(err);
                },
            });
        });
    }

    function getSeries(d) {
        if (!d) return d;
        const i = d.indexOf("-");
        return i > 0 ? d.slice(0, i) : d;
    }
    function getCode(d) {
        if (!d) return null;
        const i = d.indexOf("-");
        return i > 0 ? d.slice(i + 1) : null;
    }
    function getScore() {
        const spans = document.querySelectorAll("nav span");
        const found = Array.from(spans).find((s) =>
            s.textContent.trim().endsWith("人評價"),
        );
        if (!found) {
            console.warn(`${LOG_PREFIX} 未找到评分元素，返回 0.0`);
            return 0.0;
        }
        const m = found.innerHTML.match(/(\d+\.\d+)/);
        return m ? parseFloat(m[1]) : 0.0;
    }

    // 评分只计算一次
    let _cachedScore;
    function getScoreCached() {
        if (_cachedScore === undefined) _cachedScore = getScore();
        return _cachedScore;
    }

    function getMovieInfo(video_id) {
        // 先定位视频详情区域，后续查询限定在此范围内
        const detail = document.querySelector(".video-detail");
        if (!detail) {
            console.warn(`${LOG_PREFIX} 未找到 .video-detail，跳过`);
            return null;
        }

        const desEl = detail.querySelector(
            ".panel-block.first-block a[data-clipboard-text]",
        );
        if (!desEl) {
            console.warn(`${LOG_PREFIX} 未找到番号元素，跳过`);
            return null;
        }
        const designation = desEl.dataset.clipboardText;
        if (!designation) {
            console.warn(`${LOG_PREFIX} 番号为空，跳过`);
            return null;
        }
        const href = "https://javdb.com/v/" + video_id;

        const titleEl = detail.querySelector("strong.current-title");
        const title = titleEl ? titleEl.innerHTML : "";

        const dateEl = detail.querySelector(
            ".video-meta-panel nav > div:nth-child(2) > span",
        );
        const release_date = dateEl ? dateEl.innerHTML : "";

        const coverEl = detail.querySelector(".column-video-cover img");
        const cover_src = coverEl ? coverEl.src : "";

        const score = getScoreCached();
        const series = getSeries(designation);
        const code = getCode(designation);

        return {
            designation,
            info: { href, title, release_date, cover_src, score, series, code },
        };
    }

    function getListName(list_id) {
        const input = document.querySelector(
            'input[data-list-id="' + list_id + '"]',
        );
        if (!input) {
            console.warn(`${LOG_PREFIX} 未找到清单 input: ${list_id}`);
            return "";
        }
        const label = input.closest("label");
        if (!label) {
            console.warn(`${LOG_PREFIX} 未找到清单 label: ${list_id}`);
            return "";
        }
        return label.textContent
            .replace(/\(.*?\)/g, "")
            .replace(/\s+/g, " ")
            .trim();
    }

    function getListInfo(list_id) {
        const url = "https://javdb.com/lists/" + list_id + "?locale=zh";
        const name = getListName(list_id);
        return { list_id, info: { url, name } };
    }

    // ── 聚合同步 API ─────────────────────────────────

    /**
     * 单次请求完成 影片 upsert + 清单 upsert + 关联 add/remove
     * 返回服务端的 { movie, list, association } 状态
     */
    async function syncMoviesLists(movieInfo, listInfo, action) {
        const body = {
            designation: movieInfo.designation,
            list_id: listInfo.list_id,
            action: action,
            movie: {
                href: movieInfo.info.href,
                title: movieInfo.info.title,
                cover_src: movieInfo.info.cover_src,
                score: movieInfo.info.score,
                release_date: movieInfo.info.release_date,
                series: movieInfo.info.series,
                code: movieInfo.info.code,
            },
            list: {
                url: listInfo.info.url,
                name: listInfo.info.name,
            },
        };

        console.log(
            `${LOG_PREFIX} 同步: ${movieInfo.designation} → ${listInfo.info.name} (${action})`,
        );
        const { status, data, rawBody } = await gmPost(
            "/api/sync/movies_lists",
            body,
        );

        if (status === 200 && data) {
            return data; // { movie, list, association }
        }

        // 400 / 500：优先提取 JSON 错误字段，否则取原始响应体前 200 字符
        let errMsg = data?.error || data?.detail || data?.message || "";
        if (!errMsg && rawBody) {
            const trimmed = rawBody.trim();
            errMsg =
                trimmed.length > 200
                    ? trimmed.substring(0, 200) + "…"
                    : trimmed;
        }
        if (!errMsg) errMsg = `服务器异常(${status})`;
        throw new Error(errMsg);
    }

    // ── 业务逻辑 ──────────────────────────────────────

    const debounceTimers = new Map();

    /** association → toast 映射 */
    const ASSOC_TOAST = {
        created: (des, lname, created) => {
            const extra =
                created.length > 0 ? `（已登记${created.join("和")}）` : "";
            return {
                msg: `✓ [${des}] 已添加至「${lname}」${extra}`,
                type: "success",
            };
        },
        existed: (des, lname) => ({
            msg: `✓ [${des}] 已在「${lname}」中，数据一致`,
            type: "success",
        }),
        limit_exceeded: (des, lname) => ({
            msg: `✗ [${des}]「${lname}」已达收藏上限（501 条）`,
            type: "error",
        }),
        deleted: (des, lname) => ({
            msg: `✓ [${des}] 已从「${lname}」移除`,
            type: "success",
        }),
        unchanged: (des, lname) => ({
            msg: `✓ [${des}] 未关联「${lname}」，数据一致`,
            type: "success",
        }),
    };

    async function handleCheckboxChange(movieInfo, listInfo, checked) {
        const des = movieInfo.designation;
        const lname = listInfo.info.name;
        const action = checked ? "add" : "remove";

        console.log(
            `${LOG_PREFIX} ═══ ${checked ? "勾选" : "取消"} [${des}] → ${lname} ═══`,
        );

        let result;
        try {
            result = await syncMoviesLists(movieInfo, listInfo, action);
        } catch (err) {
            console.error(`${LOG_PREFIX} 同步失败`, err);
            showToast(
                `✗ [${des}] 同步失败：${err.message || "请检查网络"}`,
                "error",
            );
            return;
        }

        // 收集实际新创建了什么（用于 toast 补充说明）
        const created = [];
        if (result.movie === "created") created.push("影片");
        if (result.list === "created") created.push("清单");

        const entry = ASSOC_TOAST[result.association];
        if (entry) {
            const { msg, type } = entry(des, lname, created);
            showToast(msg, type);
        } else {
            // 未知 association 值
            showToast(`✗ [${des}] 未知响应：${result.association}`, "error");
        }

        console.log(`${LOG_PREFIX} ═══ 完成 ═══`);

        // 广播同步事件（三重机制确保跨脚本/跨标签页联动）
        const syncPayload = {
            designation: des,
            action: action,
            association: result.association,
            time: Date.now(),
        };
        const payloadStr = JSON.stringify(syncPayload);

        // 1) 同脚本跨标签页（GM 原生通道）
        GM_setValue("jdb:last-sync", payloadStr);

        // 2) 跨脚本跨标签页（localStorage 触发 storage 事件）
        localStorage.setItem("jdb:last-sync", payloadStr);

        // 3) 跨脚本同页面（CustomEvent 即时）
        document.dispatchEvent(
            new CustomEvent("jdb:sync-complete", { detail: syncPayload }),
        );
    }

    document.addEventListener(
        "change",
        (e) => {
            const target = e.target;

            if (
                target.tagName !== "INPUT" ||
                target.type !== "checkbox" ||
                target.dataset.action !== "change->list#listCheckboxChanged"
            ) {
                return;
            }

            const movieInfo = getMovieInfo(target.value);
            if (!movieInfo) {
                console.warn(`${LOG_PREFIX} 无法获取影片信息，跳过`);
                return;
            }
            const listInfo = getListInfo(target.dataset.listId);
            if (!listInfo.info.name) {
                console.warn(`${LOG_PREFIX} 无法获取清单名称，跳过`);
                return;
            }
            const checked = target.checked;
            const key = `${movieInfo.designation}::${listInfo.list_id}`;

            clearTimeout(debounceTimers.get(key));
            debounceTimers.set(
                key,
                setTimeout(async () => {
                    debounceTimers.delete(key);
                    await handleCheckboxChange(movieInfo, listInfo, checked);
                }, 150),
            );
        },
        true,
    );
})();
