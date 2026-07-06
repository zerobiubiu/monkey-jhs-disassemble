/**
 * 列存转换模块 —— car_list 原始行式数据 ↔ 列存压缩格式互转。
 *
 * 来源：archetype/jhsCarListReader.user.js L147-284 + L340-389（normalizeUrl/
 * toColumnar/buildDelta）+ archetype/missavStatusTag.user.js L310-330（columnarToFlat）。
 *
 * 列存格式将 5.5 万条行式记录按 status 分组为 4 组并列数组（carNums/urls），
 * 相同结构的同质数据 gzip 压缩率更高（~85%），base64 后约 600KB，
 * 远低于 GM 存储限制，适合跨域传递。
 */

import { VIDEO_ROUTE_PREFIX, type ColumnarStore, type StatusColumn } from './car-status-config';

/**
 * 把 url 规整为「仅保留 /v/ 后的短码」或「原样保留路径」。
 *
 * 转换示例（来源：jhsCarListReader.user.js L195-218）：
 *   https://javdb.com/v/ZGY1J   →  ZGY1J
 *   /v/ZGY1J                    →  ZGY1J
 *   https://javdb.com/v/a?a=1   →  a?a=1（保留 query）
 *   https://javdb.com/actors/12 →  /actors/12（非 /v/ 路径原样保留）
 *
 * @param rawUrl 原始 URL
 * @returns code 规整后的值；malformed 是否无法解析
 */
export function normalizeUrl(rawUrl: string): { code: string; malformed: boolean } {
    let path = rawUrl;
    try {
        if (/^https?:\/\//.test(rawUrl)) {
            const u = new URL(rawUrl);
            path = u.pathname + (u.search || '');
        } else if (rawUrl.startsWith('/')) {
            path = rawUrl;
        } else {
            return { code: rawUrl, malformed: true };
        }
    } catch {
        return { code: rawUrl, malformed: true };
    }

    // 剥离 /v/ 路由前缀（仅当出现这个前缀时才剥离）
    if (path.startsWith(VIDEO_ROUTE_PREFIX)) {
        return { code: path.slice(VIDEO_ROUTE_PREFIX.length), malformed: false };
    }
    return { code: path, malformed: false };
}

/**
 * 将服务端返回的 url_path 还原为完整 javdb URL。
 * 来源：missavStatusTag.user.js L140-146。
 * @param urlPath vid 短码（如 "ZGY1J"）或以 "/" 开头的路径（如 "/actors/12"）
 * @returns 完整 URL
 */
export function buildJavdbUrl(urlPath: string): string {
    if (!urlPath) return 'https://javdb.com';
    if (urlPath.startsWith('/')) {
        return 'https://javdb.com' + urlPath;
    }
    return 'https://javdb.com/v/' + urlPath;
}

/**
 * 将原始 car_list（每条含 carNum/url/status/updateDate 等字段）
 * 转换为「按 status 分组」的列存压缩格式。
 *
 * 来源：jhsCarListReader.user.js L241-284。
 *
 * 设计点：
 *  - url 只保留 path + 剥离 /v/ 路由前缀（只需存 vid 短码）
 *  - 不输出 names/createDate/publishTime/remark/starId（同步任务用不到）
 *  - 同一 carNum 在同一 status 中出现时，后写覆盖（保留 updateDate 最新原则）
 *
 * @param carList 原始数据（storageManager.getCarList() 返回的 CarRecord[]）
 * @returns byStatus 列存分组；dropped 无效记录数；malformed url 异常数
 */
export function toColumnar(carList: any[]): {
    byStatus: Record<string, { carNums: string[]; urls: string[]; update_date: string[] }>;
    dropped: number;
    malformed: number;
} {
    // status -> Map(carNum -> {url, updateDate})
    const groups: Record<string, Map<string, { url: string; updateDate: string }>> = Object.create(
        null
    );
    let dropped = 0;
    let malformed = 0;

    for (const item of carList) {
        if (!item || typeof item !== 'object') {
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

        // 同 carNum 在同一 status 重复时，后写覆盖（保留 updateDate 最新原则由 carList 自身排序保证）
        groups[status].set(item.carNum, { url: code, updateDate: item.updateDate || '' });
    }

    // Map → 列存数组
    const byStatus: Record<string, { carNums: string[]; urls: string[]; update_date: string[] }> =
        {};
    for (const status of Object.keys(groups)) {
        const map = groups[status];
        const carNums: string[] = [];
        const urls: string[] = [];
        const update_date: string[] = [];
        for (const [carNum, { url, updateDate }] of map) {
            carNums.push(carNum);
            urls.push(url);
            update_date.push(updateDate);
        }
        byStatus[status] = { carNums, urls, update_date };
    }

    return { byStatus, dropped, malformed };
}

/**
 * 将列存格式转换为行式数组（missav 端写入本地 IndexedDB 用）。
 *
 * 来源：missavStatusTag.user.js L310-330 columnarToFlat。
 * 列存: {filter:{carNums:[],urls:[]}, favorite:{...}, ...}
 * 行式: [{carNum, status, url_path}, ...]
 *
 * @param store 列存数据（解压后的 ColumnarStore 或部分 status）
 * @returns 行式记录数组
 */
export function columnarToFlat(store: Record<string, any>): Array<{
    carNum: string;
    status: string;
    url_path: string;
}> {
    const records: Array<{ carNum: string; status: string; url_path: string }> = [];
    for (const status of Object.keys(store)) {
        const group = store[status];
        if (!group || !group.carNums || !group.urls) continue;
        const { carNums, urls } = group;
        for (let i = 0; i < carNums.length; i++) {
            records.push({
                carNum: carNums[i],
                status,
                url_path: urls[i]
            });
        }
    }
    return records;
}

/**
 * 统计列存数据中的总记录数。
 * @param store 列存数据
 * @returns 总记录数
 */
export function countColumnar(store: Record<string, any>): number {
    let n = 0;
    for (const status of Object.keys(store)) {
        const col = store[status];
        if (col && col.carNums) n += col.carNums.length;
    }
    return n;
}

/**
 * 使用 CompressionStream('gzip') 将任意 JSON 可序列化数据压缩为 base64 字符串。
 *
 * 来源：jhsCarListReader.user.js L399-410 gzipToBuffer。
 * 必须在 secure context (https / localhost) 下可用。
 *
 * @param value 待压缩数据
 * @returns base64 编码的 gzip 字符串；失败时返回 null
 */
export async function gzipToBase64(value: unknown): Promise<string | null> {
    try {
        if (typeof CompressionStream === 'undefined') return null;
        const json = JSON.stringify(value);
        const blob = new Blob([json], { type: 'application/json' });
        const cs = new CompressionStream('gzip');
        const stream = blob.stream().pipeThrough(cs);
        const buf = await new Response(stream).arrayBuffer();
        // ArrayBuffer → base64（兼容大数组，避免 String.fromCharCode 栈溢出）
        const bytes = new Uint8Array(buf);
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
        }
        return btoa(binary);
    } catch {
        return null;
    }
}

/**
 * 将 base64 编码的 gzip 字符串解压为原始 JSON 对象。
 *
 * 来源：missavStatusTag.user.js L353-361 fetchCarsSince 的解压逻辑。
 *
 * @param base64 base64 编码的 gzip 字符串
 * @returns 解压后的对象；失败时返回 null
 */
export async function gunzipFromBase64<T = any>(base64: string): Promise<T | null> {
    try {
        if (typeof DecompressionStream === 'undefined') return null;
        // base64 → Uint8Array
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        const ds = new DecompressionStream('gzip');
        const stream = new Blob([bytes]).stream().pipeThrough(ds);
        const text = await new Response(stream).text();
        return JSON.parse(text) as T;
    } catch {
        return null;
    }
}

/**
 * 构造空列存结构（4 个 status 各一个空 StatusColumn）。
 */
export function emptyStore(): ColumnarStore {
    const empty: StatusColumn = { carNums: [], urls: [], update_date: [] };
    return {
        filter: { ...empty },
        favorite: { ...empty },
        hasDown: { ...empty },
        hasWatch: { ...empty }
    } as ColumnarStore;
}
