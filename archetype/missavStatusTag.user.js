// ==UserScript==
// @name         MissAV 状态标签增强
// @namespace    zerobiubiu.top
// @version      1.0
// @description  在 MissAV 视频卡片上显示 JHS 鉴定状态标签（已收藏/已观看/已屏蔽），数据自动从云端增量同步到本地 IndexedDB
// @author       zerobiubiu
// @license      MIT
// @homepageURL  https://github.com/zerobiubiu/javdb-tools
// @match        https://missav.ws/*
// @icon         https://cdn.jsdelivr.net/gh/zerobiubiu/Figure-bed/b507c13a-9f4e-41b5-bbbb-129d0a21f97d.png
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      jvsts.zerobiubiu.top
// ==/UserScript==

(function () {
    "use strict";

    // ══════════════════════════════════════════════════
    // 配置
    // ══════════════════════════════════════════════════

    const CONFIG = {
        /** 后端 API Base URL */
        apiBase: "https://jvsts.zerobiubiu.top",
        /** API 鉴权密钥 */
        apiKey: "ZzxHS4czR2vu-hlvh78HGprAP9V16tvAZ9vvqztOvAg",
        /** 增量拉取端点 */
        endpointSync: "/api/cars/sync",
        /** 水位线端点（用于判断是否需要同步） */
        endpointHwm: "/api/sync/hwm",
        /** 请求超时（毫秒） */
        timeout: 120000,
        /** 本地 IndexedDB 数据库名 */
        dbName: "MissAV-CarStatus",
        /** 本地 IndexedDB 对象仓库名 */
        storeName: "cars",
        /** 上次同步水位线（ISO8601 字符串）的 GM 存储 key */
        lastSyncHwmKey: "missav_last_sync_hwm",
        /** 上次同步完成时刻（毫秒时间戳）的 GM 存储 key，用于冷却期判断 */
        lastSyncTsKey: "missav_last_sync_ts",
        /** 同步冷却期（毫秒），避免多标签页重复请求 */
        syncCooldownMs: 5 * 60 * 1000,
    };

    /**
     * 状态 → 标签映射
     * 值与 jhs.user.js / cars 表的 status 枚举一致
     */
    const STATUS_CONFIG = {
        favorite: { label: "⭐ 已收藏", color: "#25b1dc" },
        hasWatch: { label: "🔍 已观看", color: "#d7a80c" },
        filter: { label: "🚫 已屏蔽", color: "#de3333" },
        hasDown: { label: "💾 已下载", color: "#1f7a3d" },
    };

    // ══════════════════════════════════════════════════
    // 工具函数
    // ══════════════════════════════════════════════════

    /**
     * GM_xmlhttpRequest 的 Promise 包装
     * @param {object} opts - 与 GM_xmlhttpRequest 入参一致
     * @returns {Promise<{status:number, responseText:string}>}
     */
    function gmXHR(opts) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                timeout: CONFIG.timeout,
                ...opts,
                onload: (r) =>
                    resolve({
                        status: r.status,
                        responseText: r.responseText,
                        response: r.response,
                    }),
                onerror: () =>
                    reject(
                        new Error(
                            `网络错误：${opts.method || "GET"} ${opts.url}`,
                        ),
                    ),
                ontimeout: () =>
                    reject(
                        new Error(
                            `请求超时：${opts.method || "GET"} ${opts.url}`,
                        ),
                    ),
            });
        });
    }

    /**
     * 日志输出（带统一前缀 [MissAV]）
     */
    const logger = {
        _prefix: "[MissAV]",
        info(msg, ...args) {
            console.log(
                `%c${this._prefix}%c ${msg}`,
                "color:#25b1dc;font-weight:bold;",
                "",
                ...args,
            );
        },
        ok(msg, ...args) {
            console.log(
                `%c${this._prefix} ✓%c ${msg}`,
                "color:#1f7a3d;font-weight:bold;",
                "",
                ...args,
            );
        },
        warn(msg, ...args) {
            console.warn(
                `%c${this._prefix} ⚠%c ${msg}`,
                "color:#d7a80c;font-weight:bold;",
                "",
                ...args,
            );
        },
        err(msg, ...args) {
            console.error(
                `%c${this._prefix} ✗%c ${msg}`,
                "color:#de3333;font-weight:bold;",
                "",
                ...args,
            );
        },
    };

    /**
     * 将服务端返回的 url_path 还原为完整 javdb URL
     * @param {string} urlPath - vid 短码（如 "ZGY1J"）或以 "/" 开头的路径（如 "/actors/12"）
     * @returns {string} 完整 URL
     */
    function buildJavdbUrl(urlPath) {
        if (!urlPath) return "https://javdb.com";
        if (urlPath.startsWith("/")) {
            return "https://javdb.com" + urlPath;
        }
        return "https://javdb.com/v/" + urlPath;
    }

    // ══════════════════════════════════════════════════
    // 本地 IndexedDB 操作
    // ══════════════════════════════════════════════════

    /**
     * 打开本地 IndexedDB（不存在则创建）
     * @returns {Promise<IDBDatabase>}
     */
    function openLocalDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(CONFIG.dbName, 1);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(CONFIG.storeName)) {
                    // 以 carNum 为主键，同一番号在多个 status 下的记录只保留最新写入
                    db.createObjectStore(CONFIG.storeName, {
                        keyPath: "carNum",
                    });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            request.onblocked = () =>
                reject(new Error("数据库被阻塞，请关闭其他标签页后刷新"));
        });
    }

    /**
     * 将同步到的记录分批写入本地 IndexedDB（每批 3000 条，避免单事务过大被浏览器中止）
     * 写入时自动将 carNum 转为大写，确保与查询侧 normalizeCarNum 的输出一致
     * @param {IDBDatabase} db - 已打开的数据库连接
     * @param {Array} records - 服务端返回的记录数组 [{carNum, status, url_path}]
     * @returns {Promise<number>} 实际写入条数
     */
    function upsertLocalCars(db, records) {
        const BATCH_SIZE = 3000;
        let totalWritten = 0;

        function writeBatch(batch) {
            return new Promise((resolveBatch, rejectBatch) => {
                const tx = db.transaction(CONFIG.storeName, "readwrite");
                const store = tx.objectStore(CONFIG.storeName);
                let count = 0;

                for (const rec of batch) {
                    if (
                        !rec.carNum ||
                        !rec.status ||
                        rec.url_path === undefined
                    )
                        continue;
                    const req = store.put({
                        carNum: rec.carNum.toUpperCase(),
                        status: rec.status,
                        url: buildJavdbUrl(rec.url_path),
                        updateDate: rec.updateDate || "",
                    });
                    req.onsuccess = () => {
                        count++;
                    };
                    req.onerror = () =>
                        logger.warn("写入失败", rec.carNum, req.error);
                }

                tx.oncomplete = () => resolveBatch(count);
                tx.onerror = () =>
                    rejectBatch(tx.error || new Error("事务失败"));
                tx.onabort = () =>
                    rejectBatch(tx.error || new Error("事务中止"));
            });
        }

        async function writeAll() {
            for (let i = 0; i < records.length; i += BATCH_SIZE) {
                const batch = records.slice(i, i + BATCH_SIZE);
                const written = await writeBatch(batch);
                totalWritten += written;
            }
            return totalWritten;
        }

        return writeAll();
    }

    /**
     * 从本地 IndexedDB 批量查询番号对应的记录
     * @param {string[]} carNums - 番号数组
     * @returns {Promise<Map<string, {status:string, url:string}>>} carNum → 记录映射
     */
    async function queryLocalCars(carNums) {
        if (!carNums || carNums.length === 0) return new Map();
        const db = await openLocalDB();
        try {
            return await new Promise((resolve, reject) => {
                const tx = db.transaction(CONFIG.storeName, "readonly");
                const store = tx.objectStore(CONFIG.storeName);
                const result = new Map();
                let pending = carNums.length;

                if (pending === 0) {
                    resolve(result);
                    return;
                }

                for (const cn of carNums) {
                    const req = store.get(cn);
                    req.onsuccess = () => {
                        if (req.result) {
                            result.set(cn, {
                                status: req.result.status,
                                url: req.result.url,
                            });
                        }
                        pending--;
                        if (pending === 0) resolve(result);
                    };
                    req.onerror = () => {
                        pending--;
                        if (pending === 0) resolve(result);
                    };
                }
            });
        } finally {
            db.close();
        }
    }

    // ══════════════════════════════════════════════════
    // 云端同步逻辑
    // ══════════════════════════════════════════════════

    /**
     * 获取服务端水位线
     * @returns {Promise<{high_water_mark:string|null, count_total:number}>}
     */
    async function fetchHwm() {
        const r = await gmXHR({
            method: "GET",
            url: CONFIG.apiBase + CONFIG.endpointHwm,
            headers: {
                "X-Api-Key": CONFIG.apiKey,
                Accept: "application/json",
            },
        });
        if (r.status === 401) throw new Error("API Key 无效（401）");
        if (r.status !== 200) {
            throw new Error(`hwm 请求失败 ${r.status}: ${r.responseText}`);
        }
        const body = JSON.parse(r.responseText);
        return {
            high_water_mark: body.high_water_mark ?? null,
            count_total: body.count_total ?? 0,
        };
    }

    /**
     * 将服务端返回的列存格式转换为本地存储所需的行式数组
     * 列存: {filter:{carNums:[],urls:[]}, favorite:{...}, ...}
     * 行式: [{carNum, status, url_path}, ...]
     * @param {object} response - 服务端返回的完整响应对象
     * @returns {{records:Array, high_water_mark:string|null, count_total:number}}
     */
    function columnarToFlat(response) {
        const records = [];
        const STATUS_KEYS = ["filter", "favorite", "hasDown", "hasWatch"];
        for (const status of STATUS_KEYS) {
            const group = response[status];
            if (!group || !group.carNums || !group.urls) continue;
            const { carNums, urls } = group;
            for (let i = 0; i < carNums.length; i++) {
                records.push({
                    carNum: carNums[i],
                    status: status,
                    url_path: urls[i],
                });
            }
        }
        return {
            records,
            high_water_mark: response.high_water_mark ?? null,
            count_total: response.count_total ?? 0,
        };
    }

    /**
     * 从服务端增量拉取记录（仅返回 update_date > since 的数据）
     * @param {string} since - ISO8601+08:00 时间戳，首次传 "1970-01-01T00:00:00.000+08:00"
     * @returns {Promise<{records:Array, high_water_mark:string|null, count_total:number}>}
     */
    async function fetchCarsSince(since) {
        const url = `${CONFIG.apiBase}${CONFIG.endpointSync}?since=${encodeURIComponent(since)}`;
        const r = await gmXHR({
            method: "GET",
            url,
            responseType: "arraybuffer",
            headers: {
                "X-Api-Key": CONFIG.apiKey,
                Accept: "application/json",
            },
        });
        if (r.status === 401) throw new Error("API Key 无效（401）");
        if (r.status !== 200) {
            throw new Error(`增量拉取失败 ${r.status}: ${r.responseText}`);
        }
        // 服务端返回 gzip 列存，GM_xhr 不自动解压，手动 DecompressionStream
        let jsonText;
        if (r.response && r.response.byteLength > 0) {
            const ds = new DecompressionStream("gzip");
            const stream = new Blob([r.response]).stream().pipeThrough(ds);
            jsonText = await new Response(stream).text();
        } else {
            jsonText = r.responseText;
        }
        const response = JSON.parse(jsonText);
        return columnarToFlat(response);
    }

    /** 同步锁，防止并发触发 */
    let isSyncing = false;

    /**
     * 执行增量同步：查询服务端 HWM → 与本地时间比较 → 拉取增量 → 写入本地 IndexedDB
     * @param {{force?:boolean}} opts - force=true 跳过冷却期
     */
    async function syncData({ force = false } = {}) {
        // 冷却期检查（使用独立的时间戳 key，不与 HWM 字符串混用）
        if (!force) {
            const lastSyncTs = await GM_getValue(CONFIG.lastSyncTsKey, 0);
            if (Date.now() - lastSyncTs < CONFIG.syncCooldownMs) {
                logger.info("同步跳过", "冷却期内，距上次同步不足 5 分钟");
                return;
            }
        }

        if (isSyncing) {
            logger.warn("同步跳过", "已有同步任务在进行中");
            return;
        }
        isSyncing = true;

        try {
            logger.info("同步开始", force ? "(强制)" : "(自动)");

            // 1) 获取服务端 HWM
            const hwm = await fetchHwm();
            logger.info(
                "服务端 HWM",
                hwm.high_water_mark || "null",
                `总记录数: ${hwm.count_total}`,
            );

            // 2) 读取本地上次同步水位线（ISO8601 字符串）
            const localSince = await GM_getValue(
                CONFIG.lastSyncHwmKey,
                "1970-01-01T00:00:00.000+08:00",
            );

            // 3) 比较：如果服务端 HWM ≤ 本地时间，说明无新数据
            if (
                hwm.high_water_mark &&
                typeof localSince === "string" &&
                localSince.length > 10
            ) {
                if (hwm.high_water_mark <= localSince) {
                    logger.ok("同步跳过", "服务端数据未更新，无需同步");
                    // 更新冷却时间戳，存储服务端 HWM 供下次比较
                    await GM_setValue(CONFIG.lastSyncTsKey, Date.now());
                    await GM_setValue(
                        CONFIG.lastSyncHwmKey,
                        hwm.high_water_mark,
                    );
                    return;
                }
            }

            // 4) 单次拉取增量数据（全量约 5.5 万条 / ~2MB，一次传完）
            const sinceParam =
                typeof localSince === "string" && localSince.length > 10
                    ? localSince
                    : "1970-01-01T00:00:00.000+08:00";

            logger.info("拉取增量", `since = ${sinceParam}`);
            const result = await fetchCarsSince(sinceParam);

            if (!result.records || result.records.length === 0) {
                logger.ok("同步完成", "无增量记录");
                await GM_setValue(
                    CONFIG.lastSyncHwmKey,
                    result.high_water_mark || new Date().toISOString(),
                );
                return;
            }

            logger.info("收到记录", `${result.records.length} 条`);

            // 5) 写入本地 IndexedDB
            const db = await openLocalDB();
            let written;
            try {
                written = await upsertLocalCars(db, result.records);
            } finally {
                db.close();
            }

            // 6) 持久化本次同步的 HWM 与冷却时间戳
            const newHwm = result.high_water_mark || new Date().toISOString();
            await GM_setValue(CONFIG.lastSyncHwmKey, newHwm);
            await GM_setValue(CONFIG.lastSyncTsKey, Date.now());

            logger.ok("同步完成", `写入 ${written} 条`, `新水位线: ${newHwm}`);
        } catch (err) {
            logger.err("同步失败", err.message || String(err));
        } finally {
            isSyncing = false;
        }
    }

    // ══════════════════════════════════════════════════
    // 标签渲染
    // ══════════════════════════════════════════════════

    /**
     * 创建一个状态标签（<a> 元素，确保在 Alpine.js 事件层中可点击跳转）
     * @param {string} status - 状态值（favorite/hasWatch/filter/hasDown）
     * @param {string} url - 点击跳转的 javdb URL
     * @returns {HTMLAnchorElement}
     */
    function createBadge(status, url) {
        const cfg = STATUS_CONFIG[status];
        if (!cfg) return null;

        const a = document.createElement("a");
        a.className = "missav-status-tag";
        a.textContent = cfg.label;
        a.href = url || "javascript:;";
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.title = "点击跳转到 javdb 详情页";
        a.style.cssText = [
            "border-radius:10px",
            "position:absolute",
            "z-index:10",
            "right:5px",
            "top:5px",
            "left:auto",
            "-webkit-font-smoothing:antialiased",
            "text-rendering:optimizelegibility",
            'font-family:"Helvetica Neue","Luxi Sans","DejaVu Sans",Tahoma,"Hiragino Sans GB","Microsoft Yahei",sans-serif',
            "cursor:pointer",
            "align-items:center",
            "display:inline-flex",
            "font-size:0.75rem",
            "height:2em",
            "justify-content:center",
            "line-height:1.5",
            "white-space:nowrap",
            "color:rgb(255,255,255)",
            "pointer-events:auto",
            `background-color:${cfg.color} !important`,
            "width:80px",
            "text-decoration:none",
        ].join(";");

        return a;
    }

    /**
     * 向容器中的每个缩略图挂载状态标签
     * @param {HTMLElement} container - 包含缩略图的父容器
     * @param {function(HTMLElement): {carNum:string, thumbDiv:HTMLElement}} extractor - 从每个子项提取番号和缩略图容器
     * @param {Map<string, {status:string, url:string}>} carMap - carNum → {status, url} 映射
     */
    function renderBadges(container, carMap) {
        if (!container || carMap.size === 0) return { total: 0, matched: 0 };

        const items = container.querySelectorAll(".thumbnail.group");
        let total = 0;
        let matched = 0;

        for (const item of items) {
            // 防御：已处理过的跳过（放在 total++ 之前，不计入 total）
            if (item.querySelector(".missav-status-tag")) continue;
            total++;

            // 查找带有 alt 属性的 <a> 标签获取番号
            const link = item.querySelector("a[alt]");
            if (!link) continue;

            const carNum = link.getAttribute("alt");
            if (!carNum) continue;

            // 归一化番号后查库
            const normalized = normalizeCarNum(carNum);
            const record = carMap.get(normalized);
            if (!record) continue;

            // 找到缩略图容器（.relative 元素，用来定位标签）
            const thumbDiv = item.querySelector("div.relative");
            if (!thumbDiv) continue;

            // 确保容器可定位
            if (window.getComputedStyle(thumbDiv).position === "static") {
                thumbDiv.style.position = "relative";
            }

            // 创建并挂载标签
            const badge = createBadge(record.status, record.url);
            if (badge) {
                thumbDiv.appendChild(badge);
                matched++;
            }
        }

        return { total, matched };
    }

    // ══════════════════════════════════════════════════
    // 番号归一化
    // ══════════════════════════════════════════════════

    /**
     * 将 missav.ws 页面上的番号归一化为 JHS 数据库中的标准格式
     * - hmn-095-uncensored-leak → HMN-095
     * - ebod-857 → EBOD-857
     * - fc2-ppv-4771232 → FC2-PPV-4771232
     * - 112325_01 → 112325-01
     * @param {string} raw - 页面 a[alt] 的原始值
     * @returns {string} 归一化后的番号
     */
    function normalizeCarNum(raw) {
        if (!raw) return "";
        // 1) 取最后一段（去掉路径前缀）
        const filename = raw.split("/").pop();
        // 2) FC2 系列特殊处理
        if (/^FC2-PPV-\d+$/i.test(filename)) return filename.toUpperCase();
        // 3) 按下划线或横线拆分，取前两段拼回
        const sep = filename.includes("_") ? "_" : "-";
        const parts = filename.split(sep);
        const code = parts.length >= 2 ? parts[0] + "-" + parts[1] : filename;
        return code.toUpperCase();
    }

    // ══════════════════════════════════════════════════
    // 页面处理
    // ══════════════════════════════════════════════════

    /**
     * 检测当前页面是否为视频播放页
     * @returns {boolean}
     */
    function isVideoPage() {
        return document.querySelector("#sprite-plyr") !== null;
    }

    /**
     * 收集页面所有番号，去重后批量查库，再统一渲染
     * @param {Map<string,{status:string, url:string}>} carMap
     */
    function processPage(carMap) {
        if (isVideoPage()) {
            processVideoPage(carMap);
        } else {
            processListPage(carMap);
        }
    }

    /**
     * 处理视频播放页：底部推荐网格 + 侧边推荐列表
     * @param {Map<string,{status:string, url:string}>} carMap
     */
    function processVideoPage(carMap) {
        // ── 区域 1：底部推荐网格 ──
        const bottomGrid = document.querySelector(
            "body > div:nth-child(3) > div.sm\\:container.mx-auto.px-4.content-without-search.pb-12 > div > div.flex-1.order-first > div.relative.overflow-hidden > div.grid.grid-cols-2.md\\:grid-cols-3.xl\\:grid-cols-4.gap-5",
        );
        if (bottomGrid) {
            // 收集此区域内所有番号
            const carNums = new Set();
            const thumbs = bottomGrid.querySelectorAll(".thumbnail.group");
            for (const thumb of thumbs) {
                const link = thumb.querySelector("a[alt]");
                if (link) {
                    const cn = link.getAttribute("alt");
                    if (cn) carNums.add(cn);
                }
            }
            // 批量查询后渲染
            queryAndRender(
                bottomGrid,
                carMap.size > 0 ? carMap : null,
                "视频页-底部推荐",
            );
        }

        // ── 区域 2：侧边栏推荐列表 ──
        const sideContainer = document.querySelector(
            "body > div:nth-child(3) > div.sm\\:container.mx-auto.px-4.content-without-search.pb-12 > div > div.hidden.lg\\:flex.h-full.ml-6.order-last > div",
        );
        if (sideContainer) {
            // 收集番号
            const carNums = new Set();
            const sideItems = sideContainer.querySelectorAll(".flex.mb-6");
            for (const item of sideItems) {
                const link = item.querySelector("a[alt]");
                if (link) {
                    const cn = link.getAttribute("alt");
                    if (cn) carNums.add(cn);
                }
            }
            queryAndRender(
                sideContainer,
                carMap.size > 0 ? carMap : null,
                "视频页-侧边推荐",
            );
        }
    }

    /**
     * 处理列表页：视频卡片网格
     * @param {Map<string,{status:string, url:string}>} carMap
     */
    function processListPage(carMap) {
        // 搜索页/列表页：用 document.body 作容器，renderBadges 会遍历所有 .thumbnail.group
        // 已挂载标签的会被跳过，无需担心重复
        queryAndRender(
            document.body,
            carMap.size > 0 ? carMap : null,
            "列表页",
        );
    }

    /**
     * 统一的"查询 + 渲染"流程
     * 1. 收集容器内所有番号
     * 2. 如果 carMap 已经有数据则直接用，否则去 IndexedDB 批量查
     * 3. 渲染标签
     * @param {HTMLElement} container - DOM 容器
     * @param {Map|null} existingMap - 已有的查询结果（避免重复查库）
     * @param {string} label - 日志标签
     */
    async function queryAndRender(container, existingMap, label) {
        if (!container) return;

        let map = existingMap;
        if (!map || map.size === 0) {
            // 兜底：收集番号后单独查库
            const carNums = new Set();
            const thumbs = container.querySelectorAll(".thumbnail.group");
            for (const thumb of thumbs) {
                const link = thumb.querySelector("a[alt]");
                if (link) {
                    const cn = link.getAttribute("alt");
                    if (cn) carNums.add(normalizeCarNum(cn));
                }
            }
            if (carNums.size === 0) return;
            map = await queryLocalCars(Array.from(carNums));
        }

        if (!map || map.size === 0) return;

        const { total, matched } = renderBadges(container, map);
        const cumulativeMatched =
            container.querySelectorAll(".missav-status-tag").length;
        const totalThumbs =
            container.querySelectorAll(".thumbnail.group").length;
        logger.info(
            "渲染标签",
            `${label}: +${total} 新增, +${matched} 命中 | 累计 ${cumulativeMatched}/${totalThumbs} 个标签`,
        );
    }

    // ══════════════════════════════════════════════════
    // 动态内容监听（Alpine.js 渲染完毕后触发）
    // ══════════════════════════════════════════════════

    /**
     * 使用 MutationObserver 监听 DOM 变化，在 Alpine.js 渲染完成后自动处理
     */
    function observeAndProcess() {
        // 先尝试立即处理（可能 Alpine.js 已经渲染完毕）
        let retries = 0;
        const maxRetries = 30; // 最多等待 15 秒
        const tryProcess = () => {
            const thumbItems = document.querySelectorAll(".thumbnail.group");
            if (thumbItems.length > 0) {
                // 从 IndexedDB 全量查出后统一渲染
                processAll();
                return;
            }
            retries++;
            if (retries < maxRetries) {
                setTimeout(tryProcess, 500);
            }
        };

        // 延迟启动（给 Alpine.js 初始化时间）
        setTimeout(tryProcess, 1500);

        // 同时使用 MutationObserver 捕获后续动态加载
        //   - childList：捕获 .thumbnail.group 容器插入
        //   - attributes (alt)：捕获 Alpine.js 的 :alt 绑定赋值（setAttribute）
        //     这是解决「容器先插入、alt 后赋值」时序问题的关键
        let debounceTimer = null;
        const observer = new MutationObserver((mutations) => {
            let hasNewThumbnails = false;
            for (const mutation of mutations) {
                // 1) childList：新增节点包含 .thumbnail.group
                if (mutation.type === "childList") {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType !== Node.ELEMENT_NODE) continue;
                        if (
                            node.matches?.(".thumbnail.group") ||
                            node.querySelector?.(".thumbnail.group")
                        ) {
                            hasNewThumbnails = true;
                            break;
                        }
                    }
                }
                // 2) attributes：Alpine.js :alt 绑定完成后设置 alt 属性
                if (
                    mutation.type === "attributes" &&
                    mutation.attributeName === "alt" &&
                    mutation.target.matches?.("a[alt]") &&
                    mutation.target.closest?.(".thumbnail.group")
                ) {
                    hasNewThumbnails = true;
                }
                if (hasNewThumbnails) break;
            }
            if (hasNewThumbnails) {
                // 防抖：短时间内多次触发合并为一次 processAll
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => processAll(), 300);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["alt"],
        });
    }

    /**
     * 全量处理：从 IndexedDB 查出所有记录，然后渲染所有页面区域
     */
    async function processAll() {
        try {
            // 收集页面所有番号
            const allCarNums = new Set();
            const allThumbs = document.querySelectorAll(".thumbnail.group");
            for (const thumb of allThumbs) {
                const link = thumb.querySelector("a[alt]");
                if (link) {
                    const cn = link.getAttribute("alt");
                    if (cn) {
                        // 归一化后加入查询集
                        const norm = normalizeCarNum(cn);
                        allCarNums.add(norm);
                    }
                }
            }

            if (allCarNums.size === 0) return;

            const carMap = await queryLocalCars(Array.from(allCarNums));
            if (carMap.size === 0) return;

            processPage(carMap);
        } catch (err) {
            logger.err("处理页面失败", err.message || String(err));
        }
    }

    // ══════════════════════════════════════════════════
    // 菜单命令
    // ══════════════════════════════════════════════════

    /**
     * 手动全量更新：清空本地水位线，强制拉取全部数据
     */
    async function manualFullSync() {
        logger.info("手动全量更新", "正在清空本地水位线…");
        await GM_setValue(
            CONFIG.lastSyncHwmKey,
            "1970-01-01T00:00:00.000+08:00",
        );
        await GM_setValue(CONFIG.lastSyncTsKey, 0);
        await syncData({ force: true });
        // 同步完成后刷新标签
        processAll();
    }

    /**
     * 手动增量更新：跳过冷却期，立即执行增量同步
     */
    async function manualIncrementalSync() {
        logger.info("手动增量更新", "跳过冷却期直接同步…");
        await syncData({ force: true });
        // 同步完成后刷新标签
        processAll();
    }

    /**
     * 注册 Tampermonkey 菜单命令
     */
    function registerMenuCommands() {
        try {
            GM_registerMenuCommand("🔄 MissAV 全量同步", manualFullSync);
            GM_registerMenuCommand("🔃 MissAV 增量同步", manualIncrementalSync);
            logger.info("菜单注册", "已注册：全量同步 / 增量同步");
        } catch (e) {
            logger.warn("菜单注册失败", e.message || String(e));
        }
    }

    // ══════════════════════════════════════════════════
    // 入口
    // ══════════════════════════════════════════════════

    /**
     * 入口函数：先同步数据，再处理页面，最后注册菜单
     */
    async function main() {
        logger.info(
            "脚本启动",
            `页面类型: ${isVideoPage() ? "视频播放页" : "列表页"}`,
        );

        // 1) 注册菜单命令（在 main 中注册确保 GM_registerMenuCommand 可用）
        registerMenuCommands();

        // 2) 先同步数据（自动模式，有冷却期）
        try {
            await syncData({ force: false });
        } catch (err) {
            logger.err("初始同步失败", err.message || String(err));
        }

        // 3) 处理页面渲染标签
        observeAndProcess();
    }

    // 启动
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", main);
    } else {
        main();
    }
})();
