/**
 * 番号（影片身份）归一化与等价判定 —— 全仓**唯一权威**。
 *
 * 背景（doc/46 领域重构试点）：重构前「番号身份」这一条领域规则由 8 处各自实现，
 * 大小写口径 3 套、页面原文与存储键混用（见 doc/46 §二 现状差异）。本模块是单点权威，
 * 任何新增的番号归一化/比较需求都在此扩展策略，**禁止在插件内复制实现**。
 *
 * 依赖方向：领域层，禁止 import 任何 UI、存储、网络、插件模块（只允许纯函数）。
 */

/**
 * 番号归一化策略。三者对应不同的真实业务口径，语义不同、不可互相替代：
 *
 * - `upper`：trim + 大写。**存储键口径** —— car_list 匹配、MissAV 状态镜像与水位线、
 *   增量日志去重、列存快照重复检查、外部访问计数键。
 * - `rating`：trim + 大写 + 空白转连字符。**评分域口径** —— 页面卡片文本 → 评分缓存键。
 * - `path`：MissAV 页面 URL / `a[alt]` 形态 → 标准番号（取末段、`FC2-PPV-<数字>` 原样大写、
 *   按 `_` 或 `-` 取前两段拼回、大写）。
 *
 * 说明：JavDB 详情页/列表卡片取到的**页面原文不归一**（写作 `CAR-123` 还是 `car-123` 随页面），
 * 它按 `upper` 口径比较 —— 见 `carNumEquals` 与 `carNumKey`。
 */
export type CarNumNormalizePolicy = 'upper' | 'rating' | 'path';

/**
 * 按策略归一化番号。
 *
 * @param raw 原始番号文本（可为空/未定义，返回空串）
 * @param policy 归一化策略，默认 `upper`
 * @returns 归一化后的番号
 */
export function normalizeCarNum(raw: string | null | undefined, policy: CarNumNormalizePolicy = 'upper'): string {
    if (!raw) return '';
    if (policy === 'rating') {
        return raw.trim().toUpperCase().replace(/\s+/g, '-');
    }
    if (policy === 'path') {
        // 1) 取最后一段（去掉路径前缀）
        const filename = raw.split('/').pop() || '';
        // 2) FC2 系列保留完整形态
        if (/^FC2-PPV-\d+$/i.test(filename)) return filename.toUpperCase();
        // 3) 按下划线或横线拆分，取前两段拼回
        const separator = filename.includes('_') ? '_' : '-';
        const parts = filename.split(separator);
        const code = parts.length >= 2 ? parts[0] + '-' + parts[1] : filename;
        return code.toUpperCase();
    }
    return raw.trim().toUpperCase();
}

/**
 * 番号匹配键：把番号折叠成「同一影片」的等价键。
 *
 * 大小写敏感性由调用方按业务口径显式传入（不在这里读全局开关，
 * 以保持领域层对基础设施的零依赖）。
 *
 * @param carNum 番号
 * @param caseInsensitive 是否忽略大小写
 * @returns 比较用键
 */
export function carNumKey(carNum: string, caseInsensitive: boolean): string {
    return caseInsensitive ? carNum.toLowerCase() : carNum;
}

/**
 * 判定两个番号是否指向同一影片。
 *
 * @param a 番号 A
 * @param b 番号 B
 * @param caseInsensitive 是否忽略大小写
 * @returns 同一影片 true
 */
export function carNumEquals(a: string, b: string, caseInsensitive: boolean): boolean {
    return carNumKey(a, caseInsensitive) === carNumKey(b, caseInsensitive);
}

/**
 * 西方番号格式化（业务规则，原 `base-plugin._formatWesternCar`）：
 * 纯字母番号 + 发布日期 → `CAR.YY.MM.DD`。
 *
 * 由设置开关 `featureFlags.westernCarFormat` 门控，调用方负责判断开关。
 *
 * @param carNum 原始番号
 * @param rawDate 发布时间文本
 * @returns 格式化番号；不满足条件时原样返回
 */
export function formatWesternCarNum(carNum: string, rawDate: string): string {
    if (!carNum || !rawDate) return carNum;
    if (!/^[a-zA-Z\s]+$/.test(carNum)) return carNum;
    const dateMatch = rawDate.match(/\d{2}(\d{2})-(\d{2})-(\d{2})/);
    if (dateMatch) {
        return `${carNum.replace(/\s+/g, '')}.${dateMatch[1]}.${dateMatch[2]}.${dateMatch[3]}`;
    }
    return carNum;
}