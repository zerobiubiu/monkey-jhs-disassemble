/**
 * 日期/时间格式化工具（提取自 CommonUtil）。
 * 纯函数，无实例状态依赖。
 */

/**
 * 取当前时间格式化字符串（原 getNowStr）。
 * @param dateSep   日期分隔符，默认 "-"
 * @param timeSep   时间分隔符，默认 ":"
 * @param timestamp 毫秒时间戳；提供则格式化该时间，否则当前时间
 * @returns "YYYY-MM-DD HH:mm:ss" 形式字符串
 */
export function getNowStr(
    dateSep: string = '-',
    timeSep: string = ':',
    timestamp: number | null = null
): string {
    const date = timestamp ? new Date(timestamp) : new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${[year, month, day].join(dateSep)} ${[hours, minutes, seconds].join(timeSep)}`;
}

/**
 * 格式化日期为字符串（原 formatDate）。
 * @param input   Date 对象或日期字符串
 * @param dateSep 日期分隔符，默认 "-"
 * @param timeSep 时间分隔符，默认 ":"
 * @returns "YYYY-MM-DD HH:mm:ss" 形式字符串
 * @throws 输入非 Date/字符串或字符串无法解析时抛 Error
 */
export function formatDate(input: Date | string, dateSep: string = '-', timeSep: string = ':'): string {
    let date: Date;
    if (input instanceof Date) {
        date = input;
    } else {
        if (typeof input !== 'string') {
            throw new Error('Invalid date input: must be Date object or date string');
        }
        date = new Date(input);
        if (isNaN(date.getTime())) {
            throw new Error('Invalid date string');
        }
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${[year, month, day].join(dateSep)} ${[hours, minutes, seconds].join(timeSep)}`;
}

/**
 * 计算两个时间相差的整小时数（原 getHourDifference）。
 * @param start 起始时间
 * @param end   结束时间
 * @returns 向下取整的小时差
 */
export function getHourDifference(start: Date, end: Date): number {
    const startMs = start.getTime();
    const endMs = end.getTime();
    const hours = Math.abs(endMs - startMs) / 3600000;
    return Math.floor(hours);
}

/**
 * 判断给定时间距现在是否不足指定小时数（原 isUnnecessaryCheck，用于"无需检查"判定）。
 * @param timeStr           可被 new Date 解析的时间字符串
 * @param checkIntervalTime 检查间隔（小时），字符串或数字
 * @returns true 表示仍在间隔内、无需检查
 * @throws 未传入 checkIntervalTime 抛 Error
 */
export function isUnnecessaryCheck(timeStr: string, checkIntervalTime: string | number): boolean {
    if (!checkIntervalTime) {
        throw new Error('未传入checkIntervalTime');
    }
    const hours = parseInt(String(checkIntervalTime), 10);
    if (isNaN(hours)) return false;
    return getHourDifference(new Date(timeStr), new Date()) < hours;
}
