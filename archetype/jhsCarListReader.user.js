// ==UserScript==
// @name         JHS car_list 同步器 (列存+gzip+HWM增量)
// @version      3.6
// @description  读取 JavDB JAV-JHS IndexedDB 的 car_list，转换为列存格式并 gzip；通过 /api/sync/hwm 增量过滤后，POST 到 Cloudflare Workers + D1 后端；保留原测量功能用于调变对比。v3.5：5xx/4xx 错误信息改为解析后端 JSON 的 message/error 字段透传 cause 链。v3.6：去除冗余健康检查、合并 status 分拆为一次 POST、跳过 iframe 触发、增加跨标签页 1 分钟冷却期
// @namespace    zerobiubiu.top
// @author       zerobiubiu
// @license      MIT
// @homepageURL  https://github.com/zerobiubiu/javdb-tools
// @include      https://javdb*.com/*
// @icon         https://cdn.jsdelivr.net/gh/zerobiubiu/Figure-bed/b507c13a-9f4e-41b5-bbbb-129d0a21f97d.png
// @run-at       document-end
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      jvsts.zerobiubiu.top
// @connect      javdb-video-status-table-server.1731865922.workers.dev
// @connect      localhost
// @connect      127.0.0.1
// ==/UserScript==

(function () {
    "use strict";

    // 数据库配置（与 jhs.user.js 中 StorageManager 保持一致）
    // 注意：jhs.user.js 源码里写的 DB_VERSION=1，但浏览器里的实际数据库版本可能更高
    //       （例如本地实测 version=2），打开旧库时如果传入的版本 < 现有版本会触发 VersionError。
    //       因此这里的策略是：优先用「不指定版本」方式打开，让浏览器自动采用现有版本号。
    const DB_NAME = "JAV-JHS";
    const STORE_NAME = "appData";
    const KEY_NAME = "car_list";

    /**
     * 打开 IndexedDB：不升级版本，避免 VersionError
     * 优先调用 indexedDB.open(name)（不传 version），浏览器会自动用现有版本；
     * 若仍失败（例如某些浏览器要求必须传版本），则从大到小降级重试。
     * @returns {Promise<IDBDatabase>}
     */
    function openDB() {
        // 1) 优先：不指定版本打开
        return openDBWithVersion().catch((err) => {
            // 2) 兜底：按候选版本号降级重试
            // 把可能存在的更高版本也列进来，避免后续数据库再次升级后又报 VersionError
            const candidates = [9, 8, 7, 6, 5, 4, 3, 2, 1];
            let lastErr = err;
            return candidates
                .reduce(
                    (p, v) =>
                        p.catch(() =>
                            openDBWithVersion(v).catch((e) => {
                                lastErr = e;
                                throw e;
                            }),
                        ),
                    Promise.reject(err),
                )
                .catch(() => {
                    throw lastErr;
                });
        });
    }

    /**
     * 以指定版本号（可选）打开数据库
     * @param {number} [version] 版本号；不传则让浏览器使用现有版本
     * @returns {Promise<IDBDatabase>}
     */
    function openDBWithVersion(version) {
        return new Promise((resolve, reject) => {
            const request =
                version === undefined
                    ? indexedDB.open(DB_NAME)
                    : indexedDB.open(DB_NAME, version);
            // 阻止默认的升级流程：若库版本比传入版本高，触发 VersionError
            //     （不监听 onupgradeneeded，不修改任何结构）
            request.onupgradeneeded = (event) => {
                // 不应走到这里（仅在传入版本 >= 现有版本时才会升级），
                // 此处直接中止事务，避免误创建空表
                try {
                    event.target.transaction.abort();
                } catch (e) {}
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            request.onblocked = () => reject(new Error("IndexedDB 打开被阻塞"));
        });
    }

    /**
     * 读取 appData 表中 car_list 的值
     * @returns {Promise<Array|any>}
     */
    async function readCarList() {
        const db = await openDB();
        try {
            // 校验当前版本的库是否存在目标 object store
            if (!Array.from(db.objectStoreNames).includes(STORE_NAME)) {
                throw new Error(
                    `数据库 "${DB_NAME}" (v${db.version}) 中不存在 object store "${STORE_NAME}"，可能 JHS 脚本尚未在该域名写入数据`,
                );
            }
            return await new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, "readonly");
                const store = tx.objectStore(STORE_NAME);
                const req = store.get(KEY_NAME);
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => reject(req.error);
                tx.onabort = () => reject(tx.error || new Error("事务被中止"));
            });
        } finally {
            db.close();
        }
    }

    /**
     * 计算数据尺寸（bit / KB / 字节）
     * - bit：UTF-8 编码后的字节数 × 8
     * - KB：字节数 / 1024
     * - 中文、emoji 等非 ASCII 字符会按 UTF-8 编码真实字节统计
     * @param {any} value
     * @returns {{bits:number, bytes:number, kb:number}}
     */
    function measureSize(value) {
        // Blob.size 能精确测出 UTF-8 字节数（中文按 3 字节计算）
        let bytes = 0;
        try {
            bytes = new Blob([JSON.stringify(value)]).size;
        } catch (e) {
            // 兜底：用 TextEncoder 估测字节数
            try {
                bytes = new TextEncoder().encode(JSON.stringify(value)).length;
            } catch (e2) {
                bytes = 0;
            }
        }
        return {
            bits: bytes * 8,
            bytes,
            kb: bytes / 1024,
        };
    }

    /**
     * javdb 的视频详情页路由前缀，几乎所有 url 都呈形如 /v/<短码>
     * 一并剥离可省每条 3 字节（×5万条 ≈ 165KB）。服务端拼回时拼 /v/ + 短码
     */
    const VIDEO_ROUTE_PREFIX = "/v/";

    /**
     * 将服务端返回的 ISO8601 +08:00 时间（如 "2026-06-20T01:01:43.167+08:00"）
     * 转换为本地时区的 "YYYY-MM-DD HH:MM:SS" 字符串。
     *
     * 用途：客户端 car_list 里的 updateDate 字段是 jhs.user.js 的 utils.getNowStr() 生成
     * 的本地时间字符串（无时区后缀，格式如 "2025-10-14 14:58:19"）。
     * 为了能与服务端 hwm 做字符串比较，先转成同样格式。
     *
     * 注意：服务端返回的是 +08:00 偏移，如果客户端浏览器本地也是 +08:00
     * （中国环境），转换后的字面字符串与 iso 直接表达的值一致；若客户端不在
     * +08:00 时区（出差 / VPN / 系统时区被改），则转成“客户端本地”表述仍正确。
     *
     * @param {string|null} iso ISO8601 字符串
     * @returns {string} "YYYY-MM-DD HH:MM:SS"，若 iso 为 null 返回 ""
     */
    function isoToLocalStr(iso) {
        if (!iso) return "";
        let d;
        try {
            d = new Date(iso);
            if (isNaN(d.getTime())) return "";
        } catch (e) {
            return "";
        }
        const Y = d.getFullYear();
        const M = String(d.getMonth() + 1).padStart(2, "0");
        const D = String(d.getDate()).padStart(2, "0");
        const H = String(d.getHours()).padStart(2, "0");
        const Min = String(d.getMinutes()).padStart(2, "0");
        const S = String(d.getSeconds()).padStart(2, "0");
        return `${Y}-${M}-${D} ${H}:${Min}:${S}`;
    }

    /**
     * 把 url 规整为「仅保留/后的剩余部分」（不含 origin、不含路由前缀 /v/）。
     *
     * 转换示例：
     *   https://javdb.com/v/ZGY1J   →  ZGY1J        （初规整 path 再去 /v/）
     *   /v/ZGY1J                    →  ZGY1J
     *   https://javdb.com/v/a?a=1   →  a?a=1        （保留 query）
     *   https://javdb.com/actors/12 →  /actors/12   （非 /v/ 路径原样保留，不走划分）
     *   相对字符串/javsee /123av.com →  根据异常计数
     *
     * @param {string} rawUrl
     * @returns {{code:string, malformed:boolean}}
     */
    function normalizeUrl(rawUrl) {
        let path = rawUrl;
        try {
            if (/^https?:\/\//.test(rawUrl)) {
                const u = new URL(rawUrl);
                path = u.pathname + (u.search || "");
            } else if (rawUrl.startsWith("/")) {
                path = rawUrl;
            } else {
                return { code: rawUrl, malformed: true };
            }
        } catch (e) {
            return { code: rawUrl, malformed: true };
        }

        // 剥离 /v/ 路由前缀（仅当出现这个前缀时才剥离，以避免误删其他路径起始）
        if (path.startsWith(VIDEO_ROUTE_PREFIX)) {
            return {
                code: path.slice(VIDEO_ROUTE_PREFIX.length),
                malformed: false,
            };
        }
        return { code: path, malformed: false };
    }

    /**
     * 将原始 car_list（每条含 carNum/url/status/updateDate/names 等字段）
     * 转换为「按 status 分组」的列存压缩格式
     *
     * 输出示意（54914 条 → 4 个分组，每分组两个并列数组对齐）：
     * {
     *   "hasWatch": { "carNums": ["PRTD-031", "ABC-123"], "urls": ["ZGY1J", "aaa"] },
     *   "favorite": { "carNums": [...],                       "urls": [...] },
     *   "filter":   { ... },
     *   "hasDown":   { ... }
     * }
     *
     * 设计点：
     *  - url 只保留 path + 剥离 /v/ 路由前缀（只需存vid 短码），服务端拼回加 /v/ 前缀即可
     *  - 不输出 updateDate（服务端写入/更新时生成，客户端无需传递）
     *  - 不输出 names/createDate/publishTime/remark/starId（同步任务用不到）
     *  - 同一 carNum 在多个 status 中出现时，保留 updateDate 最新的一组按 status 分类
     *
     * @param {Array} carList 原始数据
     * @returns {{byStatus:Object, dropped:number, malformed:number}}
     */
    function toColumnar(carList) {
        const groups = Object.create(null); // status -> Map(carNum -> urlCode)
        let dropped = 0; // 无效字段被丢弃的记录数
        let malformed = 0; // url 异常无法解析的记录数

        for (const item of carList) {
            if (!item || typeof item !== "object") {
                dropped++;
                continue;
            }
            // 字段缺失校验：carNum / url / status 三者必须都有
            if (!item.carNum || !item.url || !item.status) {
                dropped++;
                continue;
            }

            const status = item.status;
            if (!groups[status]) {
                groups[status] = new Map();
            }

            const { code, malformed: bad } = normalizeUrl(item.url);
            if (bad) malformed++;

            // 同 carNum 在同一 status 重复时，后写覆盖（保留 updateDate 最新原则由 carList 自身排序保证；
            // jhs.user.js 中 _saveSingleCar 总是直接更新同条记录，不会出现两条同 carNum）
            groups[status].set(item.carNum, code);
        }

        // Map → 列存数组
        const byStatus = {};
        for (const status of Object.keys(groups)) {
            const map = groups[status];
            const carNums = [];
            const urls = [];
            for (const [carNum, url] of map) {
                carNums.push(carNum);
                urls.push(url);
            }
            byStatus[status] = { carNums, urls };
        }

        return { byStatus, dropped, malformed };
    }

    /**
     * 使用浏览器原生 gzip （CompressionStream 'gzip'）实测压缩后的字节数。
     * 现代浏览器都支持；失败时返回 null。
     *
     * 注意：必须在 https / localhost 环境下可用（CompressionStream 依赖 secure context）。
     *
     * @param {any} value 任意可序列化 JSON 的值
     * @returns {Promise<{bits:number, bytes:number, kb:number}|null>}
     */
    async function measureGzipSize(value) {
        try {
            if (typeof CompressionStream === "undefined") {
                return null;
            }
            const json = JSON.stringify(value);
            // 注意：Blob.stream() 返回 ReadableStream，直接管道给 CompressionStream
            const blob = new Blob([json], { type: "application/json" });
            const cs = new CompressionStream("gzip");
            const stream = blob.stream().pipeThrough(cs);
            const reader = stream.getReader();
            let total = 0;
            while (true) {
                const { done, value: chunk } = await reader.read();
                if (done) break;
                total += chunk.byteLength;
            }
            return { bits: total * 8, bytes: total, kb: total / 1024 };
        } catch (e) {
            // 降级估算（经验值：JSON 同质数据 gzip 压缩比 70~85%）
            const raw = measureSize(value);
            const estimate = Math.round(raw.bytes * 0.2);
            return {
                bits: estimate * 8,
                bytes: estimate,
                kb: estimate / 1024,
                estimated: true, // 标记这是估算值
            };
        }
    }

    /**
     * 构造增量载荷：只包含 updateDate > hwmLocalStr 的记录。
     * 构造结果与 toColumnar 输出结构一致（status→{carNums,urls}），
     * 可直接 gzip 后 POST 给服务端。
     *
     * 增量过滤策略：
     *  - 首次同步：hwm 为 null → 走全量
     *  - 后续同步：仅推送 updateDate 严格大于 hwm 的记录
     *  - 同一 hwm 时间的记录本身已被服务端处理过（或 skipped），不重传
     *
     * @param {Array} carList 原始记录（含 updateDate 字段）
     * @param {string} hwmLocalStr 服务端 hwm 转换为本地 "YYYY-MM-DD HH:MM:SS" 后的字符串
     * @returns {{groups:Object, dropped:number, malformed:number, total:number}}
     */
    function buildDelta(carList, hwmLocalStr) {
        const groups = Object.create(null);
        let dropped = 0;
        let malformed = 0;
        let total = 0;

        for (const item of carList) {
            if (!item || typeof item !== "object") {
                dropped++;
                continue;
            }
            if (!item.carNum || !item.url || !item.status) {
                dropped++;
                continue;
            }

            // 增量过滤
            const ud = item.updateDate || "";
            if (hwmLocalStr && !(ud > hwmLocalStr)) {
                continue;
            }

            const status = item.status;
            if (!groups[status]) {
                groups[status] = { carNums: [], urls: [] };
            }

            // carNum 不能含空白字符（服务端会拒收）
            if (/\s/.test(item.carNum)) {
                dropped++;
                continue;
            }

            const { code, malformed: bad } = normalizeUrl(item.url);
            if (bad) malformed++;

            groups[status].carNums.push(item.carNum);
            groups[status].urls.push(code);
            total++;
        }

        // 移除空分组（客户端侧不能出现 carNums.length !== urls.length 的场景，由同步实现保证）
        for (const k of Object.keys(groups)) {
            if (groups[k].carNums.length === 0) {
                delete groups[k];
            }
        }

        return { groups, dropped, malformed, total };
    }

    /**
     * 使用 CompressionStream('gzip') 将任意 JSON 可序列化数据压缩为 ArrayBuffer。
     * 失败时返回 null（调用方可选择降级为原始 JSON）。
     *
     * 必须在 secure context (https / localhost) 下可用。
     * @param {any} value 待压缩数据
     * @returns {Promise<ArrayBuffer|null>}
     */
    async function gzipToBuffer(value) {
        try {
            if (typeof CompressionStream === "undefined") return null;
            const json = JSON.stringify(value);
            const blob = new Blob([json], { type: "application/json" });
            const cs = new CompressionStream("gzip");
            const stream = blob.stream().pipeThrough(cs);
            return await new Response(stream).arrayBuffer();
        } catch (e) {
            return null;
        }
    }

    // ── 上传配置（对应 FRONTEND_API_GUIDE.md） ────────────────────────
    // 默认指向生产 Workers，可通过 GM_setValue('jhs_api_base') 覆盖为本地 8787 等
    const CONFIG = {
        apiBase: GM_getValue("jhs_api_base", "https://jvsts.zerobiubiu.top"),
        apiKey: GM_getValue("jhs_api_key", ""),
        // 两个接口端点
        endpointHwm: "/api/sync/hwm",
        endpointCars: "/api/sync/cars",
        endpointHealth: "/health",
        // 证明性较短改为相对宽松：Workers 处理大批量 upsert 较慢，且 GM_xmlhttpRequest
        // 占空不阻断页面，可调长。从 30s → 180s
        timeout: 180000,
        // 本地持久化的"上次同步结果"，便于排查；不强制使用
        lastSyncKey: "jhs_last_sync_status",
        // 阶段 3：失败重试队列（GM_setValue 持久化，断电不丢）
        pendingQueueKey: "jhs_pending_delta_queue",
        // 队列最多保留的条目数，超过则视情况压缩或丢弃最旧的（防意外爆栈）
        maxPendingEntries: 100,
        // 单条记录最大重试次数，超过则不再自动重推（用户需人工排查）
        maxRetry: 10,
        // 自动同步冷却期（毫秒）：避免 iframe / 多标签页短时间内重复触发
        // 手动同步（菜单触发）不受此限制
        syncCooldownMs: 60000,
        // 上次同步完成的时间戳（GM 存储 key，跨标签页共享）
        lastSyncTsKey: "jhs_last_sync_ts",
    };

    /**
     * 常量时间字符串比较（防 API Key 时序攻击）
     * @param {string} a
     * @param {string} b
     * @returns {boolean}
     */
    function timingSafeEqual(a, b) {
        if (typeof a !== "string" || typeof b !== "string") return false;
        if (a.length !== b.length) return false;
        let diff = 0;
        for (let i = 0; i < a.length; i++) {
            diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }
        return diff === 0;
    }

    // ── 统一日志器 ────────────────────────────────────────────
    // 设计：所有同步过程日志都打印（不受 silent 影响），
    // silent 只控制是否弹 toast。统一前缀让控制台筛选方便（搜 "[JHS"）。
    const LOG_STYLE = {
        info: "color:#25b1dc;font-weight:bold;",
        ok: "color:#1f7a3d;font-weight:bold;",
        warn: "color:#d7a80c;font-weight:bold;",
        err: "color:#de3333;font-weight:bold;",
    };
    /**
     * 日志器：每条日志带会话标识前缀，避免使用 console.group/groupEnd。
     *
     * 背景：syncDeltaCars 是 async 函数，每个 await 都会把控制权交还给事件循环。
     * 若用 console.groupCollapsed 打开折叠组，await 期间其他脚本（pageSort、鉴黄师等）
     * 的 console 输出会被吸进尚未关闭的折叠组里，导致日志归类错乱。
     * 改为在每条日志前缀带上 session tag，不再依赖 group 嵌套。
     */
    const logger = {
        /** 当前会话标识（如 "[JHS Sync 14:27:27]"），null 时不输出前缀 */
        _tag: null,
        /** 设置 / 清除会话标识（一次 syncDeltaCars 的生命周期内有效） */
        setTag(tag) {
            this._tag = tag || null;
        },
        /** 拼接带 tag 的前缀，无 tag 时返回原 step */
        _prefix(step) {
            return this._tag ? `${this._tag} ${step}` : step;
        },
        /** 带步骤序号的常规信息 */
        info(step, ...args) {
            console.log(
                `%c[JHS] %c${this._prefix(step)}`,
                LOG_STYLE.info,
                "color:inherit;font-weight:bold;",
                ...args,
            );
        },
        /** 成功信息 */
        ok(step, ...args) {
            console.log(
                `%c[JHS] ✓ %c${this._prefix(step)}`,
                LOG_STYLE.ok,
                "color:inherit;font-weight:bold;",
                ...args,
            );
        },
        /** 警告 */
        warn(step, ...args) {
            console.warn(
                `%c[JHS] ⚠ ${this._prefix(step)}`,
                LOG_STYLE.warn,
                ...args,
            );
        },
        /** 错误 */
        err(step, ...args) {
            console.error(
                `%c[JHS] ✗ ${this._prefix(step)}`,
                LOG_STYLE.err,
                ...args,
            );
        },
    };

    /**
     * GM_xmlhttpRequest 的 Promise 包装（跨域必须走 GM_xhr，不能用 fetch）
     * @param {object} opts 与 GM_xmlhttpRequest 入参一致
     * @returns {Promise<{status:number, responseText:string, responseHeaders:string}>}
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
                        responseHeaders: r.responseHeaders || "",
                    }),
                onerror: () =>
                    reject(new Error(`网络错误：${opts.method} ${opts.url}`)),
                ontimeout: () =>
                    reject(new Error(`请求超时：${opts.method} ${opts.url}`)),
            });
        });
    }

    /**
     * 从后端响应体提取人类可读的错误说明
     * 后端 5xx 形如 {"error":"Internal Server Error","message":"<cause 链>"}，
     * 4xx 形如 {"error":"..."}。优先返回 message/error 字段，避免原始 JSON 噪声
     * 占用截断配额而切掉真正根因（后端 5xx 的 message 会沿 cause 链用
     * 「 | caused by: 」拼接 SQLite 原始错误，该部分位于末尾，最易被截断）。
     * JSON 解析失败时回退到截断的原始文本。
     * @param {string} responseText 后端响应体原文
     * @param {number} maxLen 最大返回长度（字符）
     * @returns {string}
     */
    function extractApiError(responseText, maxLen = 300) {
        const raw = responseText || "<空响应>";
        try {
            const body = JSON.parse(responseText);
            if (body && typeof body === "object") {
                const msg = body.message || body.error;
                if (typeof msg === "string" && msg) {
                    return msg.slice(0, maxLen);
                }
            }
        } catch (_) {
            // 非 JSON 响应体，回退到截断的原始文本
        }
        return raw.slice(0, maxLen);
    }

    /**
     * GET /health — 服务器存活探活。不需要鉴权。
     * 返回 {ok:boolean, reachable:boolean, status:number, httpVersion:string, serverTime:string}
     */
    async function checkHealth() {
        const url = CONFIG.apiBase + CONFIG.endpointHealth;
        try {
            const r = await gmXHR({
                method: "GET",
                url,
                headers: { Accept: "application/json" },
            });
            // 解析 body（服务器错误也可能返回非 200，但只要 TCP+HTTP 到达就算 reachable）
            let body = null;
            try {
                body = JSON.parse(r.responseText);
            } catch (e) {
                /* response 可能是 HTML/空 */
            }
            return {
                reachable: r.status > 0, // status >0 说明握手成功（4xx/5xx也算可达）
                ok: r.status === 200,
                status: r.status,
                serverVersion: body?.version || "未知",
                serverTime: body?.time || "未知",
                raw: r.responseText.slice(0, 200),
            };
        } catch (e) {
            // 网络层错误（DNS 失败 / TCP 拒绝 / 超时）
            return {
                reachable: false,
                ok: false,
                status: 0,
                error: e.message,
            };
        }
    }

    /**
     * GET /api/sync/hwm
     * 返回 { high_water_mark: string|null, count_total: number }
     * @returns {Promise<{high_water_mark:string|null, count_total:number}>}
     */
    async function fetchHwm() {
        if (!CONFIG.apiKey) throw new Error("未配置 API Key");
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
        let body;
        try {
            body = JSON.parse(r.responseText);
        } catch (e) {
            throw new Error(`hwm 响应非 JSON: ${r.responseText}`);
        }
        return {
            high_water_mark: body.high_water_mark ?? null,
            count_total: body.count_total ?? 0,
        };
    }

    /**
     * POST /api/sync/cars — gzip 列存载荷
     * @param {object} groups 列存分组对象
     * @returns {Promise<{applied:number, skipped_duplicate:number, high_water_mark:string, count_total:number}>}
     */
    async function pushCars(groups) {
        if (!CONFIG.apiKey) throw new Error("未配置 API Key");
        if (!groups || Object.keys(groups).length === 0) {
            // 空载荷（本次无增量），直接返回 noop，不发请求节省流量
            return { applied: 0, skipped_duplicate: 0, noop: true };
        }

        const gz = await gzipToBuffer(groups);
        if (!gz) {
            // CompressionStream 不可用时降级为原始 JSON
        }

        const headers = {
            "X-Api-Key": CONFIG.apiKey,
            Accept: "application/json",
        };
        let body;
        if (gz) {
            // 注意：GM_xmlhttpRequest 支持 ArrayBuffer/Uint8Array 作为 data
            headers["Content-Type"] = "application/json";
            headers["Content-Encoding"] = "gzip";
            body = gz;
        } else {
            headers["Content-Type"] = "application/json";
            body = JSON.stringify(groups);
        }

        const r = await gmXHR({
            method: "POST",
            url: CONFIG.apiBase + CONFIG.endpointCars,
            headers,
            data: body,
        });
        if (r.status === 401) throw new Error("API Key 无效（401）");
        if (r.status === 413) throw new Error("请求体超过 10MB 上限（413）");
        if (r.status >= 500) {
            // 5xx 服务器内部错误：解析 JSON 提取 message 字段（后端会沿 cause 链
            // 用「 | caused by: 」拼接真正根因），避免对原始 JSON 文本截断时
            // 把末尾的 SQLite 原始错误切掉。保留「服务器内部错误」前缀供上层分类。
            throw new Error(
                `服务器内部错误（${r.status}）：${extractApiError(r.responseText, 600)}`,
            );
        }
        if (r.status !== 200) {
            // 4xx 业务错误：后端 body 形如 {"error":"..."}，同样优先解析字段
            throw new Error(
                `推送失败 ${r.status}: ${extractApiError(r.responseText, 300)}`,
            );
        }
        let resp;
        try {
            resp = JSON.parse(r.responseText);
        } catch (e) {
            throw new Error(`推送响应非 JSON: ${r.responseText}`);
        }
        return resp;
    }

    // ── 阶段 3：失败重试 + 本地增量队列合并 ─────────────────────────
    //
    // 设计：
    //  - 失败的增量包不丢弃：记录到 GM_setValue('jhs_pending_delta_queue') 持久化
    //  - 下次 syncDeltaCars 时先把队列里旧的增量合并到本次 delta，一起重推
    //  - 保证幂等：因为服务端用 (carNum, status) 复合键 upsert，重复推同一条不会出错
    //  - 达到 maxRetry 上限的条目不再自动重推，保留在队列里待人工处理

    /**
     * 读出本地待重试队列
     * 单条结构：{ id, groups, retries, firstAt, lastAt, error }
     * @returns {Array}
     */
    function loadPendingQueue() {
        try {
            const q = GM_getValue(CONFIG.pendingQueueKey, []);
            return Array.isArray(q) ? q : [];
        } catch (e) {
            return [];
        }
    }

    /**
     * 保存待重试队列（写回 GM_setValue）
     * @param {Array} q
     */
    function savePendingQueue(q) {
        try {
            GM_setValue(CONFIG.pendingQueueKey, q);
        } catch (e) {
            /* ignore */
        }
    }

    /**
     * 把一个失败的 groups 增量包加入队列
     * @param {object} groups 列存分组对象
     * @param {string} error 失败原因
     */
    function enqueueFailedDelta(groups, error) {
        if (!groups || Object.keys(groups).length === 0) return;
        const q = loadPendingQueue();
        q.push({
            id: Date.now() + "-" + Math.random().toString(36).slice(2, 8),
            groups,
            retries: 0,
            firstAt: new Date().toISOString(),
            lastAt: new Date().toISOString(),
            error,
        });
        // 防止无限堆积：超过上限时丢弃最早无 retries 溢出的条目
        if (q.length > CONFIG.maxPendingEntries) {
            q.splice(0, q.length - CONFIG.maxPendingEntries);
        }
        savePendingQueue(q);
    }

    /**
     * 统计一个 groups 对象里的总记录数（用于日志输出）
     * @param {object} groups
     * @returns {number}
     */
    function countGroups(groups) {
        if (!groups) return 0;
        let n = 0;
        for (const status of Object.keys(groups)) {
            const arr = groups[status];
            if (arr && arr.carNums) n += arr.carNums.length;
        }
        return n;
    }

    /**
     * 合并多个 groups 增量包为一个（同 carNum + status 后写覆盖前写）
     * @param {Array<object>} groupsList 多个列存分组对象
     * @returns {object} 合并后的列存分组对象
     */
    function mergeGroups(groupsList) {
        // 用 Map<status, Map<carNum, url>> 临时结构便于去重覆盖
        const tmp = Object.create(null);
        for (const g of groupsList) {
            if (!g) continue;
            for (const status of Object.keys(g)) {
                const arr = g[status];
                if (!arr || !arr.carNums || !arr.urls) continue;
                if (arr.carNums.length !== arr.urls.length) continue;
                if (!tmp[status]) tmp[status] = new Map();
                const map = tmp[status];
                const carNums = arr.carNums;
                const urls = arr.urls;
                for (let i = 0; i < carNums.length; i++) {
                    map.set(carNums[i], urls[i]); // 后写覆盖
                }
            }
        }
        // Map → 列存数组
        const merged = {};
        for (const status of Object.keys(tmp)) {
            const map = tmp[status];
            if (map.size === 0) continue;
            const carNums = [];
            const urls = [];
            for (const [cn, u] of map) {
                carNums.push(cn);
                urls.push(u);
            }
            merged[status] = { carNums, urls };
        }
        return merged;
    }

    /**
     * 重试队列里所有可重试条目：先合并，再一次性 POST
     * @param {boolean} silent
     * @returns {Promise<{merged_count:number, applied:number, skipped:number, failed_left:number}>}
     */
    async function flushPendingQueue(silent = true) {
        const q = loadPendingQueue();
        if (q.length === 0) {
            logger.info("Retry", "待重试队列空，跳过 flush");
            return { merged_count: 0, applied: 0, skipped: 0, failed_left: 0 };
        }
        logger.info("Retry", `待重试队列 ${q.length} 个增量包`);

        // 先过滤出可重试条目（未达 maxRetry）
        const retryable = [];
        const stillFailed = [];
        for (const entry of q) {
            if (entry.retries < CONFIG.maxRetry) {
                entry.retries++;
                entry.lastAt = new Date().toISOString();
                retryable.push(entry);
            } else {
                stillFailed.push(entry);
            }
        }

        if (retryable.length === 0) {
            logger.warn(
                "Retry",
                `所有 ${stillFailed.length} 个条目已达最大重试次数(${CONFIG.maxRetry})，不再自动重推`,
            );
            return {
                merged_count: 0,
                applied: 0,
                skipped: 0,
                failed_left: stillFailed.length,
            };
        }
        logger.info(
            "Retry",
            `可重试 ${retryable.length} 个，达上限 ${stillFailed.length} 个保留`,
        );

        // 合并所有待重试 groups
        const merged = mergeGroups(retryable.map((e) => e.groups));
        const mergedCount =
            Object.values(merged).reduce(
                (s, arr) => s + (arr.carNums?.length || 0),
                0,
            ) || 0;
        logger.info(
            "Retry",
            `合并后共 ${mergedCount} 条，准备重推，groups=`,
            Object.keys(merged),
        );

        try {
            const resp = await pushCars(merged);
            logger.ok(
                "Retry",
                `重推成功：applied=${resp.applied ?? 0} skipped=${resp.skipped_duplicate ?? 0} count_total=${resp.count_total ?? "-"}`,
            );
            // 成功 → 从队列里移除已成功的（保留 stillFailed）
            savePendingQueue(stillFailed);
            return {
                merged_count: mergedCount,
                applied: resp.applied ?? 0,
                skipped: resp.skipped_duplicate ?? 0,
                failed_left: stillFailed.length,
            };
        } catch (err) {
            logger.err(
                "Retry",
                `重推失败：${err.message}（retries已+1，保留队列）`,
            );
            savePendingQueue([...stillFailed, ...retryable]);
            throw err;
        }
    }

    /**
     * 主编排：读 IndexedDB → 拉 HWM → 本地时间对齐 → 增量过滤 → gzip → POST → 打印结果
     * 防重复触发：isSyncing 锁 + GM 存储冷却期（跨标签页共享）
     * @param {{silent?:boolean}} opts silent=true 为自动触发（受冷却期限制），false 为手动触发（跳过冷却）
     */
    let isSyncing = false;
    async function syncDeltaCars({ silent = false } = {}) {
        // 冷却期检查：自动触发（如 iframe / 多标签页）1 分钟内不重复发起
        // 手动触发（菜单按钮）不受此限制
        if (silent) {
            const lastSync = GM_getValue(CONFIG.lastSyncTsKey, 0);
            if (Date.now() - lastSync < CONFIG.syncCooldownMs) {
                return; // 冷却期内，静默跳过
            }
        }
        if (isSyncing) {
            logger.warn("同步", "已有同步任务在进行，跳过");
            return;
        }
        isSyncing = true;
        const tag = `[JHS Sync ${new Date().toLocaleTimeString()}]`;
        logger.setTag(tag);
        logger.info("同步开始", `silent=${silent}`);
        try {
            const carList = await readCarList();
            logger.info("1-读取", `本地 car_list 记录数：${carList.length}`);

            // 0) 阶段 3：先尝试把之前失败的待重试队列重推一遍
            try {
                logger.info("0-重试队列", "开始 flush 待重试队列");
                const flushed = await flushPendingQueue(silent);
                if (flushed.merged_count > 0) {
                    logger.ok(
                        "0-重试队列",
                        `flush 完成：合并 ${flushed.merged_count} 条, 写入 ${flushed.applied}, 队列剩余 ${flushed.failed_left}`,
                    );
                }
            } catch (retryErr) {
                logger.warn(
                    "0-重试队列",
                    `flush 失败，稍后自动再试：${retryErr.message}`,
                );
            }

            // 1) 拉 HWM
            logger.info("1-拉HWM", `请求 GET ${CONFIG.endpointHwm}`);
            const hwm = await fetchHwm();
            logger.ok(
                "1-拉HWM",
                `服务端 HWM = ${hwm.high_water_mark ?? "null"} / count_total = ${hwm.count_total}`,
            );

            // 2) 时间对齐：服务端 ISO8601 +08:00 → 本地 "YYYY-MM-DD HH:MM:SS"
            const localHwm = isoToLocalStr(hwm.high_water_mark);
            logger.info(
                "2-时间对齐",
                `服务端 ${hwm.high_water_mark ?? "null"} → 本地字符串 "${localHwm}"${localHwm ? "" : " (首次, 全量)"}`,
            );

            // 3) 增量过滤
            const delta = buildDelta(carList, localHwm);
            logger.info(
                "3-增量过滤",
                `增量 ${delta.total} 条 / 丢弃 ${delta.dropped} / url 异常 ${delta.malformed}`,
                Object.keys(delta.groups),
            );

            // 4) 没有增量 → 跳过 POST
            if (delta.total === 0) {
                logger.ok("4-判断", "无增量记录，跳过推送");
                showSyncResult({
                    success: true,
                    noop: true,
                    applied: 0,
                    skipped_duplicate: 0,
                    server_count: hwm.count_total,
                    delta_count: 0,
                    hwm_in: hwm.high_water_mark,
                    hwm_out: hwm.high_water_mark,
                });
                return;
            }

            // 5) 推送
            logger.info(
                "5-推送",
                `准备 POST ${CONFIG.endpointCars}，groups=`,
                Object.keys(delta.groups),
            );
            const gzipPreview = await measureGzipSize(delta.groups);
            if (gzipPreview)
                logger.info(
                    "5-推送",
                    `预计 gzip 后体积: ${gzipPreview.kb.toFixed(2)} KB (${gzipPreview.bytes} 字节)`,
                );

            // 5) 推送：所有 status 合并为一次 POST，减少网络开销
            //   后端列存接口接受全部 status 同在一个 body
            logger.info(
                "5-推送",
                `一次 POST ${CONFIG.endpointCars}，共 ${delta.total} 条 / ${Object.keys(delta.groups).length} 个 status`,
            );
            let resp = null;
            try {
                resp = await pushCars(delta.groups);
            } catch (pushErr) {
                // 错误分类（决定是否入队重试）
                const isTransient =
                    pushErr.message.includes("网络错误") ||
                    pushErr.message.includes("超时") ||
                    pushErr.message.includes("服务器内部错误");
                const isOverSize = pushErr.message.includes("413");
                const isNetworkOnly = pushErr.message.includes("网络错误");
                const isServerFault =
                    pushErr.message.includes("服务器内部错误");

                if (isNetworkOnly) {
                    logger.err("5-推送", `网络层故障：${pushErr.message}`);
                } else if (isServerFault) {
                    logger.err(
                        "5-推送",
                        `后端服务器内部错误（5xx）：\n${pushErr.message}`,
                    );
                } else if (isOverSize) {
                    logger.warn(
                        "5-推送",
                        `请求体过大（413）：${pushErr.message}`,
                    );
                } else {
                    logger.warn("5-推送", `业务错误：${pushErr.message}`);
                }

                if (isTransient || isOverSize) {
                    enqueueFailedDelta(delta.groups, pushErr.message);
                    logger.warn(
                        "5-推送",
                        `全部 ${delta.total} 条已入队，下次自动重试（队列长度：${loadPendingQueue().length}）`,
                    );
                } else {
                    logger.warn(
                        "5-推送",
                        `失败（业务错误），未入队，需人工排查`,
                    );
                }
                throw pushErr;
            }

            // 6) 持久化 + 打印
            const pendingLeft = loadPendingQueue().length;
            GM_setValue(CONFIG.lastSyncKey, {
                at: new Date().toISOString(),
                delta_count: delta.total,
                response: resp,
                pending_left: pendingLeft,
            });
            logger.ok(
                "6-完成",
                `applied=${resp.applied ?? 0} skipped=${resp.skipped_duplicate ?? 0} count_total=${resp.count_total ?? "-"} pending=${pendingLeft}`,
                resp,
            );
            showSyncResult({
                success: true,
                applied: resp.applied ?? 0,
                skipped_duplicate: resp.skipped_duplicate ?? 0,
                server_count: resp.count_total ?? hwm.count_total,
                delta_count: delta.total,
                hwm_in: hwm.high_water_mark,
                hwm_out: resp.high_water_mark,
                pending_left: pendingLeft,
            });
        } catch (err) {
            logger.err("同步失败", err.message || String(err), err);
            showSyncResult({
                success: false,
                error: err.message || String(err),
            });
        } finally {
            isSyncing = false;
            logger.setTag(null);
            // 无论成功/失败/无增量，都记录完成时间戳，触发冷却期
            // （避免 iframe / 多标签页在短时间内重复触发）
            GM_setValue(CONFIG.lastSyncTsKey, Date.now());
        }
    }

    /**
     * 右下角小 toast 提示同步结果（极简实现）
     * @param {object} info
     */
    function showSyncResult(info) {
        try {
            const box = document.createElement("div");
            box.style.cssText =
                "position:fixed;right:12px;bottom:12px;z-index:99999999;" +
                "padding:10px 14px;border-radius:8px;background:#222;color:#fff;" +
                "font:13px/1.4 -apple-system,Segoe UI,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.3);" +
                "max-width:340px;opacity:0;transition:opacity .2s;";
            const success = info.success !== false;
            box.style.background = success ? "#1f7a3d" : "#a52828";
            const io = info.hwm_in || "null";
            const oo = info.hwm_out || "—";
            const sc = info.server_count ?? "—";
            const pendingSuffix =
                info.pending_left > 0
                    ? `<br/>⚠️ 重试队列剩 ${info.pending_left} 项`
                    : "";
            if (info.noop) {
                box.innerHTML = `✓ 无需同步（服务端 ${sc} 条 / HWM=${oo}）${pendingSuffix}`;
            } else if (info.success) {
                box.innerHTML =
                    `✓ 同步成功<br/>` +
                    `本端增量 ${info.delta_count} 条 / 写入 ${info.applied} / 跳过 ${info.skipped_duplicate}<br/>` +
                    `服务端总 ${sc} 条<br/>` +
                    `HWM: ${io} → ${oo}` +
                    pendingSuffix;
            } else {
                box.textContent = "✗ 同步失败：" + (info.error || "未知错误");
            }
            document.body.appendChild(box);
            requestAnimationFrame(() => (box.style.opacity = "1"));
            setTimeout(() => {
                box.style.opacity = "0";
                setTimeout(() => box.remove(), 250);
            }, 4000);
        } catch (e) {
            /* ignore */
        }
    }

    /**
     * 菜单：配置 API Base / Key
     */
    function menuConfig() {
        const base = prompt("API Base 地址：", CONFIG.apiBase);
        if (base !== null) {
            GM_setValue("jhs_api_base", base.trim() || CONFIG.apiBase);
            CONFIG.apiBase = base.trim() || CONFIG.apiBase;
        }
        const key = prompt("API Key：", CONFIG.apiKey);
        if (key !== null) {
            GM_setValue("jhs_api_key", key.trim());
            CONFIG.apiKey = key.trim();
        }
        alert("已保存，下次菜单触发立即生效（无需刷新）。");
    }
    /**
     * 菜单：探活后端 /health
     */
    async function menuHealthCheck() {
        logger.setTag("[JHS Health]");
        logger.info("手动健康检查", "开始探活");
        try {
            const h = await checkHealth();
            if (!h.reachable) {
                logger.err("Health", `服务器不可达：${h.error}`);
                alert(`✗ 服务器不可达\n${h.error}`);
                return;
            }
            const lines = [
                `可达：${h.reachable ? "✓" : "✗"}`,
                `HTTP 状态：${h.status}`,
                `健康（200）：${h.ok ? "✓" : "✗"}`,
                `服务版本：${h.serverVersion}`,
                `服务器时间：${h.serverTime}`,
            ];
            if (h.raw) lines.push(`响应预览：${h.raw}`);
            logger.ok("Health", lines.join(" / "));
            alert(lines.join("\n"));
        } catch (e) {
            logger.err("Health", e.message);
            alert("探活异常：" + e.message);
        } finally {
            logger.setTag(null);
        }
    }
    /**
     * 菜单：查看 / 清空待重试队列
     */
    function menuPendingQueue() {
        const q = loadPendingQueue();
        if (q.length === 0) {
            alert("待重试队列为空 ✓");
            return;
        }
        const totalCars = q.reduce(
            (s, e) =>
                s +
                Object.values(e.groups || {}).reduce(
                    (n, arr) => n + (arr.carNums?.length || 0),
                    0,
                ),
            0,
        );
        const text = q
            .map((e, i) => {
                const cnt = Object.values(e.groups || {}).reduce(
                    (n, arr) => n + (arr.carNums?.length || 0),
                    0,
                );
                return `${i + 1}. ${cnt} 条 / retries=${e.retries} / 时间 ${e.firstAt} / 原因：${(e.error || "").slice(0, 60)}`;
            })
            .join("\n");
        const action = confirm(
            `队列中 ${q.length} 个增量包，合计 ${totalCars} 条记录：\n\n${text}\n\n确定=清空队列 ✗，取消=保留`,
        );
        if (action) {
            savePendingQueue([]);
            alert("队列已清空");
        }
    }
    // 这里故意保留旧测量入口（main() 仍用于调试体量对比）
    // 注册油猴菜单
    try {
        GM_registerMenuCommand("🔁 同步增量到后端", () =>
            syncDeltaCars({ silent: false }),
        );
        GM_registerMenuCommand("🩺 探活后端 /health", () => menuHealthCheck());
        GM_registerMenuCommand("♻️ 重试失败队列 (并立即推送)", () =>
            flushPendingQueue(false).catch(() => {}),
        );
        GM_registerMenuCommand("📋 查看/清空待重试队列", menuPendingQueue);
        GM_registerMenuCommand("⚙️ 配置 API Base / Key", menuConfig);
    } catch (e) {
        /* 某些环境不支持 GM_registerMenuCommand */
    }

    /**
     * 格式化尺寸字符串
     */
    const fmt = (size) =>
        size && size.estimated
            ? size.kb.toFixed(2) + " KB (估算)"
            : size
              ? size.kb.toFixed(2) + " KB"
              : "N/A";
    const mkRatio = (a, b) =>
        a && b && a.bytes > 0
            ? ((1 - b.bytes / a.bytes) * 100).toFixed(1)
            : "0";

    /**
     * 入口函数：读取数据 → 转列存 → gzip 实测，打印三段压缩率
     */
    async function main() {
        try {
            const carList = await readCarList();

            // 原始结构尺寸（参考基准）
            const rawSize = measureSize(carList);

            // 列存压缩：status → { carNums:[...], urls:[...] }
            const colRes = toColumnar(carList);
            const colSize = measureSize(colRes.byStatus);

            // 列存 → gzip（最终载荷，客户端→服务端实际传输尺寸）
            const colGzip = await measureGzipSize(colRes.byStatus);

            // 暴露到全局供控制台调试
            try {
                window.jhsCarList = carList; // 原始
                window.jhsCompressed = colRes.byStatus; // 列存（待 gzip 的源数据）
            } catch (e) {}

            // 各分组记录数
            const groupCounts = {};
            let totalCompressed = 0;
            for (const [status, obj] of Object.entries(colRes.byStatus)) {
                const n = obj.carNums.length;
                groupCounts[status] = n;
                totalCompressed += n;
            }

            const colRatio = mkRatio(rawSize, colSize);
            const gzipRatio = mkRatio(rawSize, colGzip);

            console.groupCollapsed(
                `%c[JHS car_list] ${carList.length} 条\n原始 ${fmt(rawSize)} → 列存 ${fmt(colSize)} (-${colRatio}%) → gzip ${fmt(colGzip)} (-${gzipRatio}%)`,
                "color:#25b1dc;font-weight:bold;",
            );
            console.table({
                原始: {
                    记录数: carList.length,
                    尺寸: fmt(rawSize),
                },
                列存: {
                    记录数: totalCompressed,
                    尺寸: fmt(colSize),
                    压缩率: "-" + colRatio + "%",
                },
                "最终载荷(列存+gzip)": {
                    记录数: totalCompressed,
                    尺寸: fmt(colGzip),
                    压缩率: "-" + gzipRatio + "%",
                },
            });
            console.log("各分组记录数：", groupCounts);
            if (colRes.dropped || colRes.malformed) {
                console.warn(
                    `转换中丢弃 ${colRes.dropped} 条无效记录，url 异常 ${colRes.malformed} 条`,
                );
            }
            console.log("前 5 条预览（压缩前）：", carList.slice(0, 5));
            console.log("列存格式（window.jhsCompressed）：", colRes.byStatus);
            console.groupEnd();
        } catch (err) {
            console.error("[JHS car_list Reader] 读取失败:", err);
        }
    }

    // 等 DOM 就绪后再读取（document-end 通常已经 OK，再做一次兜底）
    /**
     * 页面就绪后：先跑一次自动增量同步（静默），失败不打扰；再做尺寸测量打印
     * 说明：自动同步失败静默处理（仅打 console.error），避免用户没配 API Key 时弹窗
     */
    function onReady() {
        // 跳过 iframe 内的重复触发（如广告 / 预览 iframe 也会加载本脚本）
        if (window.self !== window.top) return;
        // 自动同步（已在 syncDeltaCars 内部 try/catch + isSyncing 锁 + 冷却期）
        syncDeltaCars({ silent: true }).then(() => {
            main(); // 跑一次测量打印，保留原有调试能力
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", onReady);
    } else {
        onReady();
    }
})();
