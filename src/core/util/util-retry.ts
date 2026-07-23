/**
 * 重试工具（提取自 CommonUtil）。
 * 依赖全局 clog。
 */

/**
 * 带重试的异步执行（原 retry）：遇 "Just a moment"/"重定向"/"404 not found" 立即抛出，
 * 其余错误重试至 maxRetries 次。
 * @param fn         待执行函数（可返回值或 Promise）
 * @param maxRetries 最大重试次数，默认 3
 * @returns 成功则返回 fn 的结果；最终失败则抛出
 * @throws 命中致命错误或达到最大重试次数时抛出原错误
 */
export async function retry<T>(fn: () => T | Promise<T>, maxRetries: number = 3): Promise<T | undefined> {
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            const result = await fn();
            if (attempt > 0) {
                clog.debug(`[重试] 请求成功，共发起 ${attempt + 1} 次。`);
            }
            return result;
        } catch (err) {
            const msg = String(err);
            if (
                msg.includes('Just a moment') ||
                msg.includes('重定向') ||
                msg.toLowerCase().includes('404 not found')
            ) {
                throw err;
            }
            attempt++;
            if (attempt === maxRetries) {
                clog.debug(`[重试] 达到最大重试次数 (${maxRetries})，最终失败：`, err);
                throw err;
            }
            clog.debug(`[重试] 请求失败，准备第 ${attempt + 1} 次重试, 错误信息: ${msg}`);
        }
    }
}
