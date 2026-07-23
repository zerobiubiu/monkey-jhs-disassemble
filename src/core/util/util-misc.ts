/**
 * 杂项工具（提取自 CommonUtil）。
 * 依赖全局 md5、clog。
 */

/** time 计时器条目（原 time 内 Map value） */
export interface TimerEntry {
    startTime: number;
    unit: string;
    precision: number;
}

/**
 * 判断是否移动端 UA（原 isMobile）。
 * @returns 命中任一移动端关键字则 true
 */
export function isMobile(): boolean {
    const ua = navigator.userAgent.toLowerCase();
    return [
        'iphone',
        'ipod',
        'ipad',
        'android',
        'blackberry',
        'windows phone',
        'nokia',
        'webos',
        'opera mini',
        'mobile',
        'mobi',
        'tablet'
    ].some((keyword) => ua.includes(keyword));
}

/**
 * 生成简易唯一 ID（原 simpleId）：crypto.randomUUID() 去掉首个 "-"。
 * @returns 无连字符的 UUID 字符串
 */
export function simpleId(): string {
    return crypto.randomUUID().replace('-', '');
}

/**
 * 延时等待（原 sleep）。
 * @param ms 毫秒，默认 1000
 * @returns 超时后 resolve 的 Promise
 */
export function sleep(ms: number = 1000): Promise<void> {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** JSON 深拷贝（防外部污染缓存）。 */
export function copyObj<T>(data: T): T {
    return JSON.parse(JSON.stringify(data));
}

/** 递归 Object.freeze，返回冻结后的对象。 */
export function deepFreeze<T extends object>(obj: T): T {
    if (obj === null || typeof obj !== 'object' || Object.isFrozen(obj)) {
        return obj;
    }
    const propNames = Object.getOwnPropertyNames(obj);
    for (const name of propNames) {
        const value = (obj as Record<string, unknown>)[name];
        if (value && typeof value === 'object') {
            deepFreeze(value);
        }
    }
    return Object.freeze(obj);
}

/**
 * 重建并返回站点签名（原 reBuildSignature，内联自模块级函数 O() L1082-1093）。
 * 20 秒内复用 localStorage 缓存的签名，过期则基于时间戳与 md5 重新生成。
 * @returns 签名字符串（缓存未命中时可能为 null）
 */
export function reBuildSignature(): string | null {
    const tsKey = 'jhs_review_ts';
    const signKey = 'jhs_review_sign';
    const nowSec = Math.floor(Date.now() / 1000);
    if (nowSec - (Number(localStorage.getItem(tsKey)) || 0) <= 20) {
        return localStorage.getItem(signKey);
    }
    const sign = `${nowSec}.lpw6vgqzsp.${md5(`${nowSec}71cf27bb3c0bcdf207b64abecddc970098c7421ee7203b9cdae54478478a199e7d5a6e1a57691123c1a931c057842fb73ba3b3c83bcd69c17ccf174081e3d8aa`)}`;
    localStorage.setItem(tsKey, String(nowSec));
    localStorage.setItem(signKey, sign);
    return sign;
}

/**
 * 计时器：首次调用以 label 开始计时，二次调用返回耗时字符串（原 time）。
 * @param timers    计时器表（实例状态，由调用方传入）
 * @param label     计时标签，默认 "default"
 * @param unit      单位 "s" 秒 / 其他毫秒，默认 "s"
 * @param precision 小数精度，默认 2
 * @returns 二次调用返回 "{label}: {x}秒/毫秒"；首次调用返回 undefined
 */
export function time(
    timers: Map<string, TimerEntry>,
    label: string = 'default',
    unit: string = 's',
    precision: number = 2
): string | undefined {
    if (timers.has(label)) {
        const entry = timers.get(label)!;
        const elapsed = performance.now() - entry.startTime;
        let formatted: string;
        let unitLabel: string;
        if (entry.unit === 's') {
            formatted = (elapsed / 1000).toFixed(entry.precision);
            unitLabel = '秒';
        } else {
            formatted = elapsed.toFixed(entry.precision);
            unitLabel = '毫秒';
        }
        timers.delete(label);
        return `${label}: ${formatted}${unitLabel}`;
    }
    timers.set(label, {
        startTime: performance.now(),
        unit,
        precision
    });
}
