/**
 * 异步加载工具函数。
 *
 * 提供 withLoading 包装器：显示全局 loading 蒙层，执行异步函数，
 * 无论成功失败均在 finally 中关闭蒙层。
 */

/**
 * 在 loading 蒙层保护下执行异步函数。
 * @param fn 待执行的异步函数
 * @returns fn 的返回值
 */
export async function withLoading<T>(fn: () => Promise<T>): Promise<T> {
    const loadingHandle = loading();
    try {
        return await fn();
    } finally {
        loadingHandle.close();
    }
}
