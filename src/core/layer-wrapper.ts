/**
 * layer.open / layer.close 包装（提取自 archetype/jhs.user.js / legacy L474-495）
 *
 * 原脚本在启动时对全局 layer（由 userscript @require 引入的 layui-layer，
 * 类型声明见 src/types/globals.d.ts，此处为 any）做两层包装：
 * - layer.close：关闭后延迟 10ms 依据 .layui-layer-shade 数量恢复 html.overflow
 * - layer.open：劫持 success 回调，在原 success 执行后对新弹层挂 ESC 关闭
 *   （utils.setupEscClose）
 *
 * 额外增强（doc/84）：
 * - 注入 layer-fix.css，修复 lightningcss 误删关闭钮定位
 * - 默认 closeBtn: 1（右上角关闭）
 * - type 1/2 默认 shadeClose: true（点遮罩关闭，显式 false 仍生效）
 * - close 时同步清理 utils.layerIndexStack，避免 ESC 误关多层
 *
 * 调用 setupLayerWrapper() 即完成上述包装。幂等性未保证：重复调用会叠加包装。
 */

import { injectCss } from './style-injector';
import layerFixCss from '../styles/layer-fix.css?raw';

/**
 * 延迟检查 .layui-layer-shade 数量，恢复文档 overflow。
 *
 * 仍有遮罩时保持 overflow:hidden，否则清空（恢复滚动）。延迟 10ms 等 DOM 更新。
 * 与 showImageViewer 内的 resetOverflow 同语义，但此处独立定义（原脚本即在
 * layer.close 内以内联 IIFE 形式存在，不复用外层闭包）。
 *
 * @param delay 延迟毫秒数，默认 10
 */
function resetOverflowByShadeCount(delay: number = 10): void {
    setTimeout(() => {
        const shadeCount = document.querySelectorAll('.layui-layer-shade').length;
        document.documentElement.style.overflow = shadeCount > 0 ? 'hidden' : '';
    }, delay);
}

/** 从 ESC 栈移除指定 layer 索引（close 任意路径同步）。 */
function removeFromEscStack(index: unknown): void {
    try {
        const stack = (window as any).utils?.layerIndexStack as number[] | undefined;
        if (!stack || index == null) return;
        const num = Number(index);
        for (let i = stack.length - 1; i >= 0; i--) {
            if (stack[i] === num) {
                stack.splice(i, 1);
            }
        }
    } catch {
        /* utils 尚未挂载时忽略 */
    }
}

/**
 * 包装全局 layer.open / layer.close。
 *
 * 用途：在 legacy 启动序列调用一次，为所有后续 layer 弹层自动附加：
 * - close 后恢复文档滚动（依据遮罩计数）+ 同步 ESC 栈
 * - open 默认右上角关闭钮；page/iframe 默认可点遮罩关闭
 * - open 的 success 回调后挂 ESC 关闭（utils.setupEscClose）
 *
 * 保留原控制流：close 先调用原实现再重置 overflow；open 先保存原 success，
 * 替换为新 success（先执行原 success，再挂 ESC），再调用原 open。
 */
export function setupLayerWrapper(): void {
    injectCss(layerFixCss);

    const originalClose = layer.close;
    layer.close = function (index: any) {
        removeFromEscStack(index);
        const result = originalClose.call(this, index);
        resetOverflowByShadeCount();
        return result;
    };

    const originalCloseAll = layer.closeAll;
    if (typeof originalCloseAll === 'function') {
        layer.closeAll = function (type?: any) {
            try {
                const stack = (window as any).utils?.layerIndexStack as number[] | undefined;
                if (stack) stack.length = 0;
            } catch {
                /* ignore */
            }
            const result = originalCloseAll.call(this, type);
            resetOverflowByShadeCount();
            return result;
        };
    }

    const originalOpen = layer.open;
    layer.open = function (options: any) {
        const opts = options || {};
        if (opts.closeBtn === undefined || opts.closeBtn === null) {
            opts.closeBtn = 1;
        }
        if (opts.shadeClose === undefined && (opts.type === 1 || opts.type === 2)) {
            opts.shadeClose = true;
        }
        const originalSuccess = opts.success;
        opts.success = function (el: any, index: any) {
            if (typeof originalSuccess == 'function') {
                originalSuccess.call(this, el, index);
            }
            utils.setupEscClose(index);
        };
        return originalOpen.call(this, opts);
    };
}
