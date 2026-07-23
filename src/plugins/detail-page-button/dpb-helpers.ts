/**
 * 详情页按钮插件纯 DOM 轮询辅助函数。
 * 从 detail-page-button-plugin.tsx 提取，逻辑与原实现一致。
 */

/**
 * 轮询等待指定选择器的元素 innerHTML 发生变化。对应原 L6020-6047。
 * @param selector CSS 选择器
 * @param ms 超时毫秒
 * @returns 变化后的元素或 null
 */
export function waitForDomChange(selector: string, ms: number): Promise<any> {
    return new Promise((resolve) => {
        const start = Date.now();
        const el: any = document.querySelector(selector);
        if (!el) {
            resolve(null);
            return;
        }
        const before = el.innerHTML;
        const check = () => {
            const cur: any = document.querySelector(selector);
            if (!cur) {
                resolve(null);
                return;
            }
            if (cur.innerHTML !== before) {
                resolve(cur);
                return;
            }
            if (Date.now() - start > ms) {
                resolve(cur);
                return;
            }
            setTimeout(check, 200);
        };
        setTimeout(check, 200);
    });
}

/**
 * 轮询等待 fn 返回的元素出现。对应原 L6048-6065。
 * @param fn 查找元素的函数
 * @param ms 超时毫秒
 * @returns 找到的元素或 null
 */
export function waitForEl(fn: () => any, ms: number): Promise<any> {
    return new Promise((resolve) => {
        const start = Date.now();
        const check = () => {
            const el = fn();
            if (el) {
                resolve(el);
                return;
            }
            if (Date.now() - start > ms) {
                resolve(null);
                return;
            }
            setTimeout(check, 150);
        };
        check();
    });
}
