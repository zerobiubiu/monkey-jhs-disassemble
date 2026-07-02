/**
 * Viewer (viewerjs) 配置工厂（提取自 archetype/jhs.user.js L2167-2220）
 *
 * 原脚本在 window.showImageViewer 内用 `const s = {...}` 构造 Viewer 选项，
 * 随后 `const o = new Viewer(a[0], s); o.show();`。`s` 的 viewed/shown/hidden
 * 回调通过闭包引用四个运行时变量：
 * - o：Viewer 实例，在 s 之后由 `new Viewer(el, s)` 赋值（前向引用，回调惰性读取）
 * - a：图片容器（jQuery 包裹的临时 div 或目标元素）
 * - i：是否为临时容器（字符串 src 时创建，shown 后需移除）
 * - e：外层重置文档 overflow 的函数（基于 .layui-layer-shade 计数恢复滚动）
 *
 * 跨模块无法直接闭包这些调用时变量，故 VIEWER_CONFIG 设计为工厂：接收
 * ViewerConfigContext（携带上述依赖），返回等价的 Viewer 选项对象。其中 o
 * 因“构造后才赋值”的前向引用特性，通过 viewerRef 持有者惰性读取；各回调在
 * 入口快照 viewerRef.current（等价于原 const o 的多次读取，语义一致）。
 *
 * 行为等价说明（控制流一一对应）：
 * - 静态选项 zIndex/navbar/zoomOnWheel/zoomRatio/toggleOnDblclick/toolbar/
 *   title/keyboard 原样保留（原 L2168-2183）
 * - viewed（原 L2184-2188）：zoomTo(1.4) → 计算水平偏移 → moveTo；原局部
 *   `let e`（数值偏移）语义化为 offsetX，避免与外层 resetOverflow 混淆
 * - shown（原 L2189-2210）：临时容器移除 → 锁滚动 → 赋值 handleKeydown
 *   （Escape/空格 阻止冒泡并 destroy、解锁滚动、resetOverflow）→ 注册 keydown
 * - hidden（原 L2211-2219）：条件移除 keydown → destroy → 解锁滚动 → resetOverflow
 *
 * 单字母变量语义化：o→viewer、a→container、i→isTemporary、
 * e(外层)→resetOverflow、e(viewed 内)→offsetX、t(keydown 事件)→event
 *
 * 全局 Viewer 由 userscript @require 引入，类型声明见 src/types/globals.d.ts
 * （暂为 any），故 new Viewer(el, config) 返回 any，本模块仅约束配置对象结构。
 */

/** Viewer 回调所需的运行时上下文（原闭包依赖的显式化）。 */
interface ViewerConfigContext {
    /**
     * 图片容器（原 a）。字符串 src 时为由 jQuery 创建并 appendTo("body") 的
     * 临时 div（display:none，内含 <img>）；否则为 $(t) 目标元素。
     */
    container: any;
    /** 是否为临时容器（原 i）。为 true 时 shown 后需从 DOM 移除。 */
    isTemporary: boolean;
    /**
     * 重置文档 overflow 的函数（原外层 e）。依据 .layui-layer-shade 数量
     * 决定 html.overflow 是否恢复为 ""，延迟 10ms 执行。
     */
    resetOverflow: () => void;
    /**
     * Viewer 实例持有者（原 o）。因 `new Viewer(el, config)` 在 config 之后
     * 才赋值，回调通过 viewerRef.current 惰性读取；调用方应在构造后立即
     * 赋值：viewerRef.current = new Viewer(el, VIEWER_CONFIG(ctx))。
     */
    viewerRef: { current: any };
}

/** Viewer (viewerjs) 选项结构（仅约束本模块产出的字段子集）。 */
interface ViewerOptions {
    zIndex: number;
    navbar: boolean;
    zoomOnWheel: boolean;
    zoomRatio: number;
    toggleOnDblclick: boolean;
    toolbar: {
        zoomIn: number;
        zoomOut: number;
        reset: number;
        rotateLeft: number;
        rotateRight: number;
        flipHorizontal: number;
        flipVertical: number;
    };
    title: boolean;
    keyboard: boolean;
    viewed: () => void;
    shown: () => void;
    hidden: () => void;
}

/**
 * 构造 Viewer 配置对象（原 s）。
 *
 * 用途：为 window.showImageViewer 构造 viewerjs 选项，含静态 UI 配置与
 * viewed/shown/hidden 三个回调。回调通过 ctx 读取运行时依赖（容器、
 * 临时标志、resetOverflow、Viewer 实例），控制流与原脚本等价。
 *
 * @param ctx  运行时上下文（container / isTemporary / resetOverflow / viewerRef）
 * @returns Viewer 选项对象，传入 `new Viewer(el, config)`
 */
export const VIEWER_CONFIG = (ctx: ViewerConfigContext): ViewerOptions => ({
    zIndex: 999999990,
    navbar: false,
    zoomOnWheel: false,
    zoomRatio: 0.1,
    toggleOnDblclick: false,
    toolbar: {
        zoomIn: 1,
        zoomOut: 1,
        reset: 1,
        rotateLeft: 0,
        rotateRight: 0,
        flipHorizontal: 0,
        flipVertical: 0,
    },
    title: false,
    keyboard: false,
    viewed() {
        const viewer = ctx.viewerRef.current;
        viewer.zoomTo(1.4);
        const offsetX = (viewer.viewerData.width - viewer.imageData.width) / 2;
        viewer.moveTo(offsetX, 0);
    },
    shown() {
        const viewer = ctx.viewerRef.current;
        if (ctx.isTemporary) {
            ctx.container.remove();
        }
        document.documentElement.style.overflow = "hidden";
        document.body.style.overflow = "hidden";
        viewer.handleKeydown = function (event: KeyboardEvent) {
            if (event.key === "Escape" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                viewer.destroy();
                document.removeEventListener("keydown", viewer.handleKeydown);
                document.documentElement.style.overflow = "";
                document.body.style.overflow = "";
                ctx.resetOverflow();
            }
        };
        document.addEventListener("keydown", viewer.handleKeydown);
    },
    hidden() {
        const viewer = ctx.viewerRef.current;
        if (viewer && viewer.handleKeydown) {
            document.removeEventListener("keydown", viewer.handleKeydown);
        }
        viewer.destroy();
        document.documentElement.style.overflow = "";
        document.body.style.overflow = "";
        ctx.resetOverflow();
    },
});
