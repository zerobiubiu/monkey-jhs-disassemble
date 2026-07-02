/**
 * GM HTTP 请求类 GmHttp（提取自 archetype/jhs.user.js L1775-2037）
 *
 * 基于 Tampermonkey `GM_xmlhttpRequest` 的请求封装，提供 GET / JSON POST /
 * 表单 POST / multipart 文件 POST / 分块下载能力。原脚本通过
 * `unsafeWindow.gmHttp = window.gmHttp = new (class { ... })()` 挂载为全局单例，
 * 外部以 `gmHttp.get/post/postForm/postFileFormData/downloadFileInChunks` 形式调用。
 * 本模块仅导出 class GmHttp，全局实例化与挂载由 legacy 启动流程负责。
 *
 * 重构说明（JS→TS，行为等价）：
 * - 匿名 class 表达式 → 命名导出 class GmHttp
 * - 单字母变量语义化：e/t/n/a/i/s/o/r/l/c/d/h/g/p/m/f
 *   → url/body/headers/queryParams/followRedirect/timeout/retryCount/...
 * - 全局 `GM_xmlhttpRequest` / `utils` / `storageManager` / `clog` 由
 *   src/types/globals.d.ts 声明为 any，本模块直接使用
 * - 内部 Promise 回调参数标注 GmResponse；重试 / 分块 / 重定向检测控制流原样保留
 * - `n ||= undefined` 等参数规整改为局部常量 requestData，语义不变
 * - postForm / postFileFormData 仍以 `headers || {}` 保持原引用，Content-Type
 *   写回调用方 headers 对象（与原 `n["Content-Type"] ||= ...` 行为一致）
 */

/** GM_xmlhttpRequest 响应（最小字段集，运行时为 GM 完整响应对象） */
interface GmResponse {
    status: number;
    responseHeaders: string;
    responseText?: string;
    finalUrl?: string;
    response?: unknown;
    error?: string;
}

/** HTTP 请求头映射 */
type HttpHeaders = Record<string, string>;

/** 查询参数 / 表单字段 / JSON body 映射 */
type StringRecord = Record<string, unknown>;

export class GmHttp {
    /**
     * 发起 GET 请求（原 get）。
     * @param url            目标地址
     * @param queryParams    查询参数，非空时拼接到 URL
     * @param headers        自定义请求头
     * @param followRedirect 为 true 时检测 finalUrl 偏离原 URL 则拒绝
     * @returns 解析后的响应体（JSON 对象或纯文本）
     */
    async get(
        url: string,
        queryParams: StringRecord = {},
        headers: HttpHeaders = {},
        followRedirect?: boolean,
    ): Promise<any> {
        return this.gmRequest("GET", url, null, queryParams, headers, followRedirect);
    }

    /**
     * 发起 JSON POST 请求（原 post）。
     * 自动设置 `Content-Type: application/json` 并将 body 序列化为 JSON 字符串。
     * @param url     目标地址
     * @param body    请求体对象（经 JSON.stringify）
     * @param headers 自定义请求头（覆盖默认 Content-Type）
     * @returns 解析后的响应体
     */
    post(
        url: string,
        body: StringRecord = {},
        headers: HttpHeaders = {},
    ): Promise<any> {
        const requestHeaders: HttpHeaders = {
            "Content-Type": "application/json",
            ...headers,
        };
        const bodyString = JSON.stringify(body);
        return this.gmRequest("POST", url, bodyString, null, requestHeaders);
    }

    /**
     * 发起表单 POST 请求（原 postForm）。
     * 默认 `Content-Type: application/x-www-form-urlencoded`，将 formData
     * 拼接为 `key=value&key2=value2` 形式。
     * @param url      目标地址
     * @param formData 表单字段
     * @param headers  自定义请求头（写回 Content-Type，保持原引用语义）
     * @returns 解析后的响应体
     */
    postForm(
        url: string,
        formData: StringRecord = {},
        headers: HttpHeaders = {},
    ): Promise<any> {
        const requestHeaders: HttpHeaders = headers || {};
        requestHeaders["Content-Type"] ||= "application/x-www-form-urlencoded";
        let bodyString = "";
        if (formData && Object.keys(formData).length > 0) {
            bodyString = Object.entries(formData)
                .map(([key, value]) => `${key}=${String(value)}`)
                .join("&");
        }
        return this.gmRequest("POST", url, bodyString, null, requestHeaders);
    }

    /**
     * 发起 multipart/form-data 文件 POST 请求（原 postFileFormData）。
     * 手动构造 WebKitFormBoundary boundary 与 multipart 体。
     * @param url        目标地址
     * @param formFields 表单字段（值将被字符串化）
     * @param headers    自定义请求头（Content-Type 会被覆盖为 multipart）
     * @returns 解析后的响应体
     */
    postFileFormData(
        url: string,
        formFields: StringRecord = {},
        headers: HttpHeaders = {},
    ): Promise<any> {
        const requestHeaders: HttpHeaders = headers || {};
        const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2)}`;
        requestHeaders["Content-Type"] = `multipart/form-data; boundary=${boundary}`;
        let body = "";
        if (formFields && Object.keys(formFields).length > 0) {
            body = Object.entries(formFields)
                .map(
                    ([key, value]) =>
                        `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${String(value)}\r\n`,
                )
                .join("");
        }
        body += `--${boundary}--`;
        return this.gmRequest("POST", url, body, null, requestHeaders);
    }

    /**
     * 分块下载文件并触发浏览器下载（原 downloadFileInChunks）。
     * 先以 `Range: bytes=0-0` 探测总大小，再按 1MB 分块逐块下载（每块独立重试），
     * 合并为 Blob 后经 transform 转换（可选）交给 utils.download 保存。
     * @param url       文件地址
     * @param headers   自定义请求头
     * @param filename  保存文件名（必填）
     * @param transform 可选，对合并后的文本进行转换再保存
     * @throws 文件名缺失 / 无法获取大小 / 分块下载失败时抛出
     */
    async downloadFileInChunks(
        url: string,
        headers: HttpHeaders = {},
        filename?: string,
        transform?: (content: string) => string,
    ): Promise<void> {
        if (!filename) {
            throw new Error("请提供文件名 (filename) 用于保存。");
        }
        const timeout: number = await storageManager.getSetting("httpTimeout", 5000);
        const retryCount: number = await storageManager.getSetting("httpRetryCount", 3);
        let fileSize: number = 0;
        let mimeType: string | undefined;
        clog.log(`[${filename}] 正在获取文件大小...`);
        try {
            const sizeResponse: GmResponse = await utils.retry(
                () =>
                    new Promise<GmResponse>((resolve, reject) => {
                        GM_xmlhttpRequest({
                            method: "GET",
                            url: url,
                            headers: {
                                ...headers,
                                Range: "bytes=0-0",
                            },
                            timeout: timeout,
                            onload: resolve,
                            onerror: () =>
                                reject(new Error("网络错误：无法获取文件大小")),
                            ontimeout: () => reject(new Error("超时：获取文件大小")),
                        });
                    }),
                retryCount,
            );
            if (sizeResponse.status !== 206 && sizeResponse.status !== 200) {
                throw new Error(`请求文件大小失败，状态码: ${sizeResponse.status}`);
            }
            {
                const contentRangeMatch = sizeResponse.responseHeaders.match(
                    /content-range:\s*bytes\s*\d+-\d+\/(\d+)/i,
                );
                const contentTypeMatch = sizeResponse.responseHeaders.match(
                    /content-type:\s*([^\s;]+)/i,
                );
                if (contentRangeMatch && contentRangeMatch[1]) {
                    fileSize = parseInt(contentRangeMatch[1], 10);
                } else {
                    const contentLengthMatch = sizeResponse.responseHeaders.match(
                        /content-length:\s*(\d+)/i,
                    );
                    if (!contentLengthMatch || sizeResponse.status !== 200) {
                        throw new Error(
                            "无法从响应头中获取文件总大小，服务器可能不支持 Range 请求。",
                        );
                    }
                    fileSize = parseInt(contentLengthMatch[1], 10);
                    clog.warn(
                        `[${filename}] 服务器返回 200 状态码，可能不支持 Range 请求。将尝试完整下载。`,
                    );
                }
                if (contentTypeMatch && contentTypeMatch[1]) {
                    mimeType = contentTypeMatch[1];
                }
                clog.log(
                    `[${filename}] 文件总大小：${(fileSize / 1024 / 1024).toFixed(2)} MB, MIME 类型: ${mimeType || "未知"}`,
                );
            }
        } catch (err: any) {
            clog.error(`[${filename}] 获取文件大小失败:`, err.message);
            throw err;
        }
        if (!fileSize || fileSize <= 0) {
            throw new Error("获取到的文件大小无效或服务器拒绝提供大小信息。");
        }
        const chunkSize = 1048576;
        const chunkCount = Math.ceil(fileSize / chunkSize);
        const promises: Promise<void>[] = [];
        const chunks: ArrayBuffer[] = new Array(chunkCount);
        clog.log(
            `[${filename}] 文件将被分为 ${chunkCount} 块进行下载 (每块约 ${(1).toFixed(2)} MB)`,
        );
        for (let index = 0; index < chunkCount; index++) {
            const start = index * chunkSize;
            const rangeHeader = `bytes=${start}-${Math.min(start + chunkSize - 1, fileSize - 1)}`;
            const promise = await utils.retry(
                () =>
                    new Promise<void>((resolve, reject) => {
                        const requestHeaders: HttpHeaders = {
                            ...headers,
                            Range: rangeHeader,
                            Accept: "application/octet-stream",
                        };
                        GM_xmlhttpRequest({
                            method: "GET",
                            url: url,
                            headers: requestHeaders,
                            timeout: timeout,
                            responseType: "arraybuffer",
                            onload: (response: GmResponse) => {
                                if (response.status === 206 || response.status === 200) {
                                    const chunkData = response.response;
                                    if (chunkData instanceof ArrayBuffer) {
                                        chunks[index] = chunkData;
                                        clog.log(
                                            `[${filename}] 成功下载第 ${index + 1}/${chunkCount} 块 (${rangeHeader})`,
                                        );
                                        resolve();
                                    } else {
                                        reject(
                                            new Error(
                                                `第 ${index + 1} 块响应不是 ArrayBuffer。`,
                                            ),
                                        );
                                    }
                                } else {
                                    reject(
                                        new Error(
                                            `第 ${index + 1} 块请求失败，状态码: ${response.status}`,
                                        ),
                                    );
                                }
                            },
                            onerror: (errorEvent: GmResponse) =>
                                reject(
                                    new Error(
                                        `第 ${index + 1} 块网络错误: ${errorEvent.error}`,
                                    ),
                                ),
                            ontimeout: () => reject(new Error(`第 ${index + 1} 块超时。`)),
                        });
                    }),
                retryCount,
            );
            promises.push(promise);
        }
        try {
            await Promise.all(promises);
            clog.log(`[${filename}] 所有分块下载完成，开始合并...`);
        } catch (err: any) {
            clog.error(`[${filename}] 分块下载过程中发生错误:`, err.message);
            throw err;
        }
        const blob = new Blob(chunks);
        if (blob.size !== fileSize) {
            clog.warn(
                `[${filename}] 警告：合并后的 Blob 大小 (${blob.size}) 与预期文件大小 (${fileSize}) 不匹配！`,
            );
        }
        const text = await blob.text();
        const content = transform ? transform(text) : text;
        utils.download(content, filename);
        clog.log(`[${filename}] 文件合并完成，已触发浏览器下载。`);
    }

    /**
     * GM_xmlhttpRequest 通用请求（原 gmRequest）。
     * 统一处理查询参数拼接、超时/重试（utils.retry）、JSON/文本响应解析、
     * 重定向检测与错误状态码抛出。
     * @param method         HTTP 方法
     * @param url            目标地址
     * @param data           请求体（字符串或对象），falsy 时转为 undefined
     * @param queryParams    查询参数，非空时拼接到 URL
     * @param headers        请求头
     * @param followRedirect 为 true 时若 finalUrl 偏离原 URL 则拒绝
     * @returns 解析后的响应体（JSON.parse 成功返回对象，否则纯文本）
     */
    async gmRequest(
        method: string,
        url: string,
        data: string | StringRecord | null = {},
        queryParams: StringRecord | null = {},
        headers: HttpHeaders = {},
        followRedirect: boolean = false,
    ): Promise<any> {
        let requestUrl = url;
        if (queryParams && Object.keys(queryParams).length) {
            const queryString = new URLSearchParams(
                queryParams as Record<string, string>,
            ).toString();
            requestUrl += (requestUrl.includes("?") ? "&" : "?") + queryString;
        }
        const timeout: number = await storageManager.getSetting("httpTimeout", 5000);
        const retryCount: number = await storageManager.getSetting("httpRetryCount", 3);
        const requestData = data || undefined;
        return await utils.retry(
            () =>
                new Promise<any>((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: method,
                        url: requestUrl,
                        headers: headers,
                        timeout: timeout,
                        data: requestData,
                        onload: (response: GmResponse) => {
                            try {
                                if (followRedirect && response.finalUrl !== requestUrl) {
                                    reject("请求被重定向了,URL是:" + response.finalUrl);
                                }
                                if (response.status >= 200 && response.status < 300) {
                                    if (response.responseText) {
                                        try {
                                            resolve(JSON.parse(response.responseText));
                                        } catch {
                                            resolve(response.responseText);
                                        }
                                    } else {
                                        resolve(response.responseText || response);
                                    }
                                } else {
                                    clog.error(
                                        "请求失败,状态码:",
                                        response.status,
                                        requestUrl,
                                    );
                                    if (response.responseText) {
                                        try {
                                            const parsed = JSON.parse(response.responseText);
                                            reject(parsed);
                                        } catch {
                                            reject(
                                                new Error(
                                                    response.responseText ||
                                                        `请求发生错误 ${response.status}`,
                                                ),
                                            );
                                        }
                                    } else {
                                        reject(new Error(`请求发生错误 ${response.status}`));
                                    }
                                }
                            } catch (err) {
                                reject(err);
                            }
                        },
                        onerror: (errorEvent: GmResponse) => {
                            clog.error("网络错误:", requestUrl);
                            reject(new Error(errorEvent.error || "网络错误"));
                        },
                        ontimeout: () => {
                            reject(new Error("请求超时: " + requestUrl));
                        },
                    });
                }),
            retryCount,
        );
    }
}
