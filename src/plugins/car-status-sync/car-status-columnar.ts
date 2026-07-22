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

import {
    STATUS_LIST,
    VIDEO_ROUTE_PREFIX,
    type ColumnarStore,
    type StatusColumn
} from './car-status-config';

/** 已校验的快照行式记录。 */
export interface ValidatedCarStatusRecord {
    carNum: string;
    status: string;
    url_path: string;
}

export type ColumnarValidationResult =
    | { ok: true; records: ValidatedCarStatusRecord[]; count: number }
    | { ok: false; reason: string };

const COLUMNAR_IMPORT_META_KEYS = new Set([
    'count',
    'count_total',
    'high_water_mark',
    'hwm',
    'mode',
    'ready',
    'revision',
    'ts'
]);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isSafeUrlPath(value: string): boolean {
    const raw = value.trim();
    if (!raw || /[\u0000-\u001f\u007f]/.test(raw)) return false;
    if (/^https?:\/\//i.test(raw) || raw.startsWith('/')) {
        return !normalizeUrl(raw).malformed;
    }
    // 列存通常只保存 vid 短码；其它 scheme（javascript/data/blob 等）不能进入 DB。
    return !raw.startsWith('//') && !/^[a-z][a-z\d+.-]*:/i.test(raw);
}

/**
 * 严格校验来自 GM 的列存快照，再允许其进入 replaceLocalCars。
 *
 * 不能只依赖 `count`：损坏载荷可能让 carNums 数量看似正确，但 urls 缺项，
 * 之后会被写入层过滤并触发“空快照删除全部旧数据”。
 */
export function validateColumnarSnapshot(
    store: unknown,
    expectedCount: unknown
): ColumnarValidationResult {
    if (!Number.isInteger(expectedCount) || (expectedCount as number) < 0) {
        return { ok: false, reason: '快照 count 必须是非负整数' };
    }
    if (!isPlainRecord(store)) {
        return { ok: false, reason: '快照列存必须是普通对象' };
    }

    const validStatuses = new Set<string>(STATUS_LIST);
    const seenCarNums = new Set<string>();
    const records: ValidatedCarStatusRecord[] = [];

    for (const [status, rawGroup] of Object.entries(store)) {
        if (!validStatuses.has(status)) {
            return { ok: false, reason: `快照包含未知状态：${status}` };
        }
        if (!isPlainRecord(rawGroup)) {
            return { ok: false, reason: `状态 ${status} 的列不是普通对象` };
        }

        const carNums = rawGroup.carNums;
        const urls = rawGroup.urls;
        const updateDates = rawGroup.update_date;
        if (!isStringArray(carNums) || !isStringArray(urls)) {
            return { ok: false, reason: `状态 ${status} 的 carNums/urls 必须是字符串数组` };
        }
        if (carNums.length !== urls.length) {
            return { ok: false, reason: `状态 ${status} 的 carNums/urls 长度不一致` };
        }
        // 旧版列存没有 update_date，缺失时兼容；若存在则必须等长且全为字符串。
        if (
            updateDates !== undefined &&
            (!isStringArray(updateDates) || updateDates.length !== carNums.length)
        ) {
            return { ok: false, reason: `状态 ${status} 的 update_date 长度或类型无效` };
        }

        for (let index = 0; index < carNums.length; index++) {
            const carNum = carNums[index].trim();
            const urlPath = urls[index].trim();
            if (!carNum || !urlPath) {
                return { ok: false, reason: `状态 ${status} 包含空番号或空路径` };
            }
            if (!isSafeUrlPath(urlPath)) {
                return { ok: false, reason: `状态 ${status} 包含不安全链接` };
            }
            const normalizedCarNum = carNum.toUpperCase();
            if (seenCarNums.has(normalizedCarNum)) {
                return { ok: false, reason: `快照包含重复番号：${carNum}` };
            }
            seenCarNums.add(normalizedCarNum);
            records.push({ carNum, status, url_path: urlPath });
        }
    }

    const count = expectedCount as number;
    if (records.length !== count) {
        return {
            ok: false,
            reason: `快照记录数不一致：声明 ${count}，实际 ${records.length}`
        };
    }
    return { ok: true, records, count };
}

/**
 * 严格解析设置面板选择的历史“后端列存”文件。
 *
 * 兼容两种旧形态：状态列直接位于根对象，或位于 `groups` 字段；同时拒绝
 * `{}`、主程序备份以及带未知业务键的 JSON，防止它们被误判为空快照并清库。
 */
export function parseColumnarImport(value: unknown): ValidatedCarStatusRecord[] {
    if (!isPlainRecord(value)) throw new Error('列存导入文件必须是普通对象');

    const root = value;
    const hasGroups = Object.prototype.hasOwnProperty.call(root, 'groups');
    if (hasGroups && !isPlainRecord(root.groups)) {
        throw new Error('列存导入文件的 groups 字段格式无效');
    }
    const rawStore = hasGroups ? (root.groups as Record<string, unknown>) : root;
    const statusSet = new Set<string>(STATUS_LIST);
    const statusKeys = Object.keys(rawStore).filter((key) => statusSet.has(key));
    if (statusKeys.length === 0) {
        throw new Error('列存导入文件不包含任何已知状态分组');
    }

    const allowedRootKeys = new Set(COLUMNAR_IMPORT_META_KEYS);
    if (hasGroups) allowedRootKeys.add('groups');
    for (const key of Object.keys(root)) {
        if (!hasGroups && statusSet.has(key)) continue;
        if (!allowedRootKeys.has(key)) {
            throw new Error(`列存导入文件包含未知字段：${key}`);
        }
    }
    if (hasGroups) {
        for (const key of Object.keys(rawStore)) {
            if (!statusSet.has(key)) {
                throw new Error(`列存导入文件包含未知状态：${key}`);
            }
        }
    }

    const store = Object.fromEntries(statusKeys.map((key) => [key, rawStore[key]]));
    const declaredCount = root.count_total ?? root.count;
    let expectedCount: number;
    if (declaredCount !== undefined) {
        if (!Number.isInteger(declaredCount) || (declaredCount as number) < 0) {
            throw new Error('列存导入文件的记录数必须是非负整数');
        }
        expectedCount = declaredCount as number;
    } else {
        // 只用于给严格校验器提供期望值；组内类型/长度仍由校验器逐项检查。
        expectedCount = statusKeys.reduce((sum, status) => {
            const group = rawStore[status];
            if (!isPlainRecord(group) || !Array.isArray(group.carNums)) return sum;
            return sum + group.carNums.length;
        }, 0);
    }

    const validation = validateColumnarSnapshot(store, expectedCount);
    if (!validation.ok) throw new Error(validation.reason);
    return validation.records;
}

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
        if (/^https?:\/\//i.test(rawUrl)) {
            const u = new URL(rawUrl);
            if (u.protocol.toLowerCase() !== 'https:' || u.hostname.toLowerCase() !== 'javdb.com') {
                return { code: rawUrl, malformed: true };
            }
            path = u.pathname + (u.search || '');
        } else if (rawUrl.startsWith('/')) {
            if (rawUrl.startsWith('//')) return { code: rawUrl, malformed: true };
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
    const statusByCarNum = new Map<string, string>();

    for (const item of carList) {
        if (!item || typeof item !== 'object') {
            dropped++;
            continue;
        }
        // 字段类型与内容校验：不能只判断 truthy，否则对象/数字会在 URL 解析或
        // IndexedDB 写入阶段被隐式转字符串，造成不可回放的“看似成功”快照。
        if (
            typeof item.carNum !== 'string' ||
            typeof item.url !== 'string' ||
            typeof item.status !== 'string' ||
            item.carNum.trim() === '' ||
            item.url.trim() === '' ||
            item.status.trim() === ''
        ) {
            dropped++;
            continue;
        }

        const status = item.status.trim();
        if (!STATUS_LIST.includes(status as (typeof STATUS_LIST)[number])) {
            dropped++;
            continue;
        }
        if (!groups[status]) {
            groups[status] = new Map();
        }

        const { code, malformed: bad } = normalizeUrl(item.url);
        if (bad) malformed++;

        // 同 carNum 在同一 status 重复时，后写覆盖（保留 updateDate 最新原则由 carList 自身排序保证）
        const carNum = item.carNum.trim();
        const normalizedCarNum = carNum.toUpperCase();
        const previousStatus = statusByCarNum.get(normalizedCarNum);
        if (previousStatus !== undefined && previousStatus !== status) {
            dropped++;
            continue;
        }
        statusByCarNum.set(normalizedCarNum, status);
        const updateDate = typeof item.updateDate === 'string' ? item.updateDate : '';
        groups[status].set(normalizedCarNum, { url: code, updateDate });
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
