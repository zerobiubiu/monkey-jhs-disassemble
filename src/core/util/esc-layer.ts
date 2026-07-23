/**
 * ESC 弹层关闭机制（提取自 CommonUtil）。
 *
 * 含跨同源 frame 共享的模块级硬门闩 `escLayerGate`，以及逐级关闭逻辑
 * （getTopLayerEl / syncLayerIndexStack / _handleGlobalEscKey /
 * _handleGlobalEscKeyUp / setupEscClose）。依赖全局 $、layer、clog、unsafeWindow。
 * setupEscClose 需读写 CommonUtil 实例字段（_boundHandler/_boundEscKeyupHandler/
 * layerIndexStack），故以实例为参数透传（thread collaborator）。
 */

import type { CommonUtil } from '../common-util';

/**
 * ESC 关闭 layer 的全局硬门，跨所有同源 frame 共享同一把锁。
 *
 * doc/87 根因（最终修复）：
 * - doc/85/86 把 `escLayerGate` 定义为模块级 `const`，每个 frame 各执一份独立实例。
 * - doc/87 第一次修复尝试改挂 `unsafeWindow.__jhsEscGate`，但在 Tampermonkey 中
 *   每个 frame 的 `unsafeWindow` 指向**当前 frame 自己的 window**，并非跨 frame 共享
 *   的 top。实测 top 与同源 iframe 的 `__jhsEscGate` 仍是两个不同对象
 *   （`gateIsTopGate === false`）——锁仍按 frame 隔离，一次 ESC 在 iframe 内触发
 *   父子两个捕获 handler 各用各的锁，都 tryEnter 成功，各关一层。
 *
 * 最终修复：把 gate 挂到 `window.top.__jhsEscGate`。同源前提下，parent 与同源
 * iframe 均可访问同一 `window.top` 对象，gate 真正共享。
 * 跨域 iframe（如 supjav 等非 javdb iframe，本脚本不在其内运行，但保险起见）
 * 访问 `window.top` 抛 SecurityError，try/catch 兜底回退到当前 frame 的
 * `unsafeWindow/window`，那种情况下本就只有当前 frame 一份 handler，无需共享。
 *
 * 共享后：任一 handler `tryEnter` 成功即锁住，另一 handler 立即失败 return；
 * iframe 内若无自身弹层则 `release()`，父 handler 接力关父弹层。
 * 一次物理按键严格只关一层，逐级关闭成立。
 */
export const escLayerGate: { locked: boolean; tryEnter(): boolean; release(): void } =
    (() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cross-frame window with custom __jhsEscGate property
        let w: any;
        try {
            // 同源跨 frame 共享：parent 与同源 iframe 都能访问 window.top 同一对象
            w = window.top;
            // 触发访问以验证同源可访问（window.top 存在但读属性可能跨域抛错）
            void (w && w.location);
        } catch {
            // 跨域 iframe：本脚本通常不在其内运行；回退到当前 frame
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- unsafeWindow is untyped global
            w = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window) as any;
        }
        if (!w.__jhsEscGate) {
            w.__jhsEscGate = {
                locked: false,
                tryEnter(): boolean {
                    if (this.locked) return false;
                    this.locked = true;
                    return true;
                },
                release(): void {
                    this.locked = false;
                }
            };
        }
        return w.__jhsEscGate as typeof escLayerGate;
    })();

/**
 * 从 DOM 解析当前最顶层可 ESC 关闭的 layer（按 z-index）。
 * 跳过 loading/tips、已标记关闭中、display:none 的节点。
 */
export function getTopLayerEl(): HTMLElement | null {
    const nodes = document.querySelectorAll('.layui-layer[times]');
    let topEl: HTMLElement | null = null;
    let topZ = -Infinity;
    for (let i = 0; i < nodes.length; i++) {
        const el = nodes[i] as HTMLElement;
        const type = el.getAttribute('type') || '';
        if (type === 'loading' || type === 'tips') continue;
        if (el.getAttribute('data-jhs-esc-closing') === '1') continue;
        const cs = window.getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const z = parseInt(cs.zIndex, 10);
        const zVal = Number.isFinite(z) ? z : i;
        const times = Number(el.getAttribute('times'));
        if (!Number.isFinite(times)) continue;
        if (zVal >= topZ) {
            topZ = zVal;
            topEl = el;
        }
    }
    return topEl;
}

/**
 * 同步 layerIndexStack 与 DOM（剔除已销毁索引）。
 */
export function syncLayerIndexStack(layerIndexStack: number[]): number[] {
    return layerIndexStack.filter(
        (idx) => document.getElementById(`layui-layer${idx}`) != null
    );
}

/**
 * 全局 ESC：只关闭当前最顶层 layer（逐级）。
 *
 * 关键点（doc/86）：
 * - 模块级时间门 `escLayerGate`：一次按键 / 500ms 内最多关一层（不依赖实例字段）
 * - 关闭前立即 display:none + data-jhs-esc-closing，避免 layer 关闭动画 200ms
 *   内 DOM 仍在导致第二次 getTop 仍命中同一层或连关下层
 * - 忽略 event.repeat
 */
export function _handleGlobalEscKey(event: KeyboardEvent): void {
    if (event.key !== 'Escape' && event.keyCode !== 27) {
        return;
    }
    const maybeJqEvent = event as KeyboardEvent & { originalEvent?: KeyboardEvent };
    const native = maybeJqEvent.originalEvent ?? event;
    if (native.repeat) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
    }
    // 模块级硬门：防止同键连发 / 多 listener / keyup 过早解锁
    if (!escLayerGate.tryEnter()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
    }

    const topEl = getTopLayerEl();
    if (!topEl) {
        escLayerGate.release();
        return;
    }
    const layerIdx = Number(topEl.getAttribute('times'));
    if (!Number.isFinite(layerIdx)) {
        escLayerGate.release();
        return;
    }

    // 预览器打开时交给 viewer
    const $layerEl = $(topEl);
    let hasViewer = $layerEl.find('.viewer-container').length > 0;
    // doc/87 真根因修复：顶层是 type=iframe 弹层时，检查 iframe 内是否有更内层的弹层
    // （如 iframe 详情弹层内又开了磁力搜索二级弹层）。
    // 若有，ESC 应优先关 iframe 内最内层弹层，不应直接关外层 iframe 弹层
    // （否则 iframe 销毁连带内层弹层全没了，体感"一次关全部"）。
    // 若 iframe 内也有弹层，释放 gate 让 iframe 内 handler 处理。
    let hasInnerLayer = false;
    if (!hasViewer) {
        const iframeEl = topEl.querySelector(
            `#layui-layer-iframe${layerIdx}`
        ) as HTMLIFrameElement | null;
        if (iframeEl?.contentDocument) {
            try {
                if (
                    iframeEl.contentDocument.querySelector('.viewer-container')
                ) {
                    hasViewer = true;
                }
                // 检查 iframe 内是否有可关闭的弹层（非 loading/tips、非关闭中、可见）
                if (!hasViewer) {
                    const iframeLayers = iframeEl.contentDocument.querySelectorAll('.layui-layer[times]');
                    for (const il of Array.from(iframeLayers)) {
                        const ilType = il.getAttribute('type') || '';
                        if (ilType === 'loading' || ilType === 'tips') continue;
                        if (il.getAttribute('data-jhs-esc-closing') === '1') continue;
                        const ilCs = window.getComputedStyle(il);
                        if (ilCs.display === 'none' || ilCs.visibility === 'hidden') continue;
                        hasInnerLayer = true;
                        break;
                    }
                }
            } catch {
                clog.warn('无法检查跨域 iframe 内的 .viewer-container');
            }
        }
    }
    if (hasViewer) {
        escLayerGate.release();
        return;
    }
    // doc/87：iframe 内有弹层时，外层 handler 不应关外层 iframe 弹层（否则
    // iframe 销毁连带内层弹层全没了）。但 iframe document 不会自动收到父
    // document 的 keydown 事件，所以外层 handler 需要主动向 iframe document
    // dispatch 一个 ESC keydown，让 iframe 内的 handler 关闭内层弹层。
    if (hasInnerLayer) {
        const iframeEl = topEl.querySelector(
            `#layui-layer-iframe${layerIdx}`
        ) as HTMLIFrameElement | null;
        if (iframeEl?.contentDocument) {
            try {
                // 不释放 gate：iframe 内 handler 共享同一把 gate（window.top），
                // tryEnter 会成功（外层 handler 已 lock），但外层 handler 在
                // dispatch 前释放 gate，让 iframe handler 拿到锁
                escLayerGate.release();
                const innerEvt = new KeyboardEvent('keydown', {
                    key: 'Escape',
                    keyCode: 27,
                    which: 27,
                    bubbles: true,
                    cancelable: true,
                    composed: true
                });
                iframeEl.contentDocument.dispatchEvent(innerEvt);
                // iframe handler 若成功关闭内层弹层会自己 setTimeout 释放 gate
                // 若 iframe handler 也没关到东西，800ms 后 gate 仍被锁 → 800ms 后
                // 由 iframe handler 的 setTimeout 兑底释放
                // 但如果 iframe handler 没被调用（跨域或未绑），释放 gate
                window.setTimeout(() => escLayerGate.release(), 100);
                return;
            } catch {
                // 跨域 iframe 无法 dispatch，释放 gate
                escLayerGate.release();
                return;
            }
        }
        escLayerGate.release();
        return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    // 立即从"可选顶层"中摘掉（layer 关闭动画期间 DOM 仍在）
    topEl.setAttribute('data-jhs-esc-closing', '1');
    topEl.style.display = 'none';
    const shade = document.getElementById(`layui-layer-shade${layerIdx}`);
    if (shade) {
        shade.setAttribute('data-jhs-esc-closing', '1');
        shade.style.display = 'none';
    }

    // 只关这一层；包装会同步栈
    layer.close(layerIdx);
    // 兜底：若 keyup 丢失，800ms 后强制解锁
    window.setTimeout(() => escLayerGate.release(), 800);
}

/** ESC 抬起：解锁门闩，允许下一次物理按键再关一层 */
export function _handleGlobalEscKeyUp(event: KeyboardEvent): void {
    if (event.key === 'Escape' || event.keyCode === 27) {
        escLayerGate.release();
    }
}

/**
 * 为指定 layer 索引注册 ESC 关闭监听（原 setupEscClose）。
 * 仅绑定一次 document 捕获阶段 keydown/keyup；iframe 同源 document 同步绑定。
 * @param util     CommonUtil 实例（提供 _boundHandler/_boundEscKeyupHandler/layerIndexStack 字段）
 * @param layerIdx layer.open 返回的索引
 */
export function setupEscClose(util: CommonUtil, layerIdx: number): void {
    if (!util._boundHandler) {
        util._boundHandler = util._handleGlobalEscKey.bind(util);
        util._boundEscKeyupHandler = util._handleGlobalEscKeyUp.bind(util);
        $(document).off('keydown.globalLayerEsc keyup.globalLayerEsc');
        document.removeEventListener('keydown', util._boundHandler, true);
        document.removeEventListener('keyup', util._boundEscKeyupHandler, true);
        document.addEventListener('keydown', util._boundHandler, true);
        document.addEventListener('keyup', util._boundEscKeyupHandler, true);
    }
    const numIdx = Number(layerIdx);
    if (Number.isFinite(numIdx) && util.layerIndexStack.indexOf(numIdx) === -1) {
        util.layerIndexStack.push(numIdx);
    }
    // 延迟绑定 iframe（type=2 的 success 在 load 后才调，此时 contentDocument 可用）
    const iframeEl = document.getElementById(
        `layui-layer-iframe${layerIdx}`
    ) as HTMLIFrameElement | null;
    if (iframeEl && iframeEl.getAttribute('data-esc-bound') !== 'yes') {
        const bindIframe = () => {
            try {
                const doc = iframeEl.contentDocument;
                if (!doc || !util._boundHandler || !util._boundEscKeyupHandler) return;
                doc.removeEventListener('keydown', util._boundHandler, true);
                doc.removeEventListener('keyup', util._boundEscKeyupHandler, true);
                doc.addEventListener('keydown', util._boundHandler, true);
                doc.addEventListener('keyup', util._boundEscKeyupHandler, true);
                iframeEl.setAttribute('data-esc-bound', 'yes');
            } catch (err) {
                clog.error('iframe监听失败 (跨域或未加载完毕):', err);
            }
        };
        if (iframeEl.contentDocument?.readyState === 'complete') {
            bindIframe();
        } else {
            iframeEl.addEventListener('load', bindIframe, { once: true });
        }
    }
}
