/**
 * car-status-sync 共享日志工厂。
 * 统一 car-list-reader / missav-status-tag 的日志格式，仅前缀不同。
 */

export interface CarStatusLogger {
    info(step: string, ...args: unknown[]): void;
    ok(step: string, ...args: unknown[]): void;
    warn(step: string, ...args: unknown[]): void;
    err(step: string, ...args: unknown[]): void;
}

export function createLogger(prefix: string): CarStatusLogger {
    return {
        info(step, ...args) {
            console.log(
                `%c${prefix}%c ${step}`,
                'color:#25b1dc;font-weight:bold;',
                '',
                ...args
            );
        },
        ok(step, ...args) {
            console.log(
                `%c${prefix} ✓%c ${step}`,
                'color:#1f7a3d;font-weight:bold;',
                '',
                ...args
            );
        },
        warn(step, ...args) {
            console.warn(
                `%c${prefix} ⚠%c ${step}`,
                'color:#d7a80c;font-weight:bold;',
                '',
                ...args
            );
        },
        err(step, ...args) {
            console.error(
                `%c${prefix} ✗%c ${step}`,
                'color:#de3333;font-weight:bold;',
                '',
                ...args
            );
        }
    };
}
