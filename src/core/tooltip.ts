/**
 * Tooltip 定位与全局 hover 工具（提取自 archetype/jhs.user.js / legacy L312-441）
 *
 * 原脚本以 IIFE 注入 .js-tooltip 样式，并绑定 document mouseover/mouseout：
 * - mouseover：命中 [data-tip-*] 元素后，延迟 50ms 显示 tooltip（若仍 hover）
 * - mouseout：清理 hoverTimeout，离开目标时移除 tooltip
 *
 * positionTooltip 为原 IIFE 内的 function e（定位核心）：依触发元素 rect 与
 * 指定方向计算 fixed 定位坐标，空间不足时自动翻转方向，并做视口边界夹紧。
 *
 * 全局 $/layer/utils 由 src/types/globals.d.ts 声明为 any。
 */

import tooltipCssRaw from "../styles/tooltip.css?raw";

/** 触发 tooltip 的元素，运行时挂载 tooltipElement 与 hoverTimeout。 */
interface TooltipableElement extends HTMLElement {
    /** 当前显示的 tooltip 元素（运行时挂载）。 */
    tooltipElement?: HTMLElement | null;
    /** hover 延时句柄（运行时挂载）。 */
    hoverTimeout?: number | null;
}

/** tooltip 支持的定位方向。 */
type TooltipDirection = "top" | "bottom" | "left" | "right";

/** 匹配所有支持 data-tip* 属性的元素的选择器。 */
const TOOLTIP_SELECTOR =
    "[data-tip-top], [data-tip-bottom], [data-tip-left], [data-tip-right], [data-tip]";

/**
 * 创建 tooltip DOM 并挂到 body（原 IIFE 内的匿名工厂）。
 *
 * @param content tooltip 的 HTML 内容
 * @returns tooltip 根元素（.js-tooltip）
 */
function createTooltipElement(content: string): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.classList.add("js-tooltip");
    const inner = document.createElement("div");
    inner.innerHTML = content;
    wrapper.appendChild(inner);
    document.body.appendChild(wrapper);
    return wrapper;
}

/**
 * 依触发元素位置与方向，定位并显示 tooltip（原 function e）。
 *
 * 控制流（与原脚本等价）：
 * 1. 创建 tooltip，临时 display:block 量取尺寸后藏回 display:none
 * 2. 依 direction 计算首选坐标；空间不足且对侧容纳时翻转方向
 * 3. top/bottom 方向夹紧水平居中；left/right 方向夹紧垂直居中
 * 4. 写入 left/top，加 is-active，挂到 element.tooltipElement
 *
 * @param element   触发元素（运行时挂 tooltipElement）
 * @param content   tooltip HTML 内容
 * @param direction 首选定位方向
 */
export function positionTooltip(
    element: TooltipableElement,
    content: string,
    direction: TooltipDirection,
): void {
    const tooltip = createTooltipElement(content);
    tooltip.style.display = "block";
    const elementRect = element.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    tooltip.style.display = "none";
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    let left: number | undefined;
    let top: number | undefined;
    let actualDirection: TooltipDirection = direction;
    const fitsVertically = (y: number) =>
        y >= 8 && y + tooltipRect.height <= viewportHeight - 8;
    const fitsHorizontally = (x: number) =>
        x >= 8 && x + tooltipRect.width <= viewportWidth - 8;
    const centerX =
        elementRect.left + elementRect.width / 2 - tooltipRect.width / 2;
    const centerY =
        elementRect.top + elementRect.height / 2 - tooltipRect.height / 2;
    switch (direction) {
        case "top":
            top = elementRect.top - tooltipRect.height - 0;
            if (top < 8 && fitsVertically(elementRect.bottom + 0)) {
                top = elementRect.bottom + 0;
                actualDirection = "bottom";
            }
            break;
        case "bottom":
            top = elementRect.bottom + 0;
            if (
                top + tooltipRect.height > viewportHeight - 8 &&
                fitsVertically(elementRect.top - tooltipRect.height - 0)
            ) {
                top = elementRect.top - tooltipRect.height - 0;
                actualDirection = "top";
            }
            break;
        case "left":
            left = elementRect.left - tooltipRect.width - 0;
            if (left < 8 && fitsHorizontally(elementRect.right + 0)) {
                left = elementRect.right + 0;
                actualDirection = "right";
            }
            break;
        case "right":
            left = elementRect.right + 0;
            if (
                left + tooltipRect.width > viewportWidth - 8 &&
                fitsHorizontally(elementRect.left - tooltipRect.width - 0)
            ) {
                left = elementRect.left - tooltipRect.width - 0;
                actualDirection = "left";
            }
            break;
    }
    const isHorizontal =
        actualDirection === "left" || actualDirection === "right";
    if (actualDirection === "top" || actualDirection === "bottom") {
        left = centerX;
        if (left < 8) {
            left = 8;
        } else if (left + tooltipRect.width > viewportWidth - 8) {
            left = viewportWidth - tooltipRect.width - 8;
        }
    } else if (isHorizontal) {
        top = centerY;
        if (top < 8) {
            top = 8;
        } else if (top + tooltipRect.height > viewportHeight - 8) {
            top = viewportHeight - tooltipRect.height - 8;
        }
    }
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.classList.add("is-active");
    element.tooltipElement = tooltip;
}

/**
 * 注入 tooltip 样式并绑定全局 hover 显示/隐藏事件（原外层 IIFE）。
 *
 * 幂等性未保证：重复调用会重复注入样式与事件监听。legacy 启动序列调用一次即可。
 */
export function setupTooltip(): void {
    document.head.insertAdjacentHTML(
        "beforeend",
        `<style>${tooltipCssRaw}</style>`,
    );
    document.addEventListener("mouseover", (event) => {
        const target = (event.target as HTMLElement).closest(
            TOOLTIP_SELECTOR,
        ) as TooltipableElement | null;
        if (target && !target.tooltipElement) {
            let content = "";
            let direction: TooltipDirection = "top";
            if (target.hasAttribute("data-tip-bottom")) {
                content = target.getAttribute("data-tip-bottom") ?? "";
                direction = "bottom";
            } else if (target.hasAttribute("data-tip-left")) {
                content = target.getAttribute("data-tip-left") ?? "";
                direction = "left";
            } else if (target.hasAttribute("data-tip-right")) {
                content = target.getAttribute("data-tip-right") ?? "";
                direction = "right";
            } else if (target.hasAttribute("data-tip-top")) {
                content = target.getAttribute("data-tip-top") ?? "";
                direction = "top";
            } else if (target.hasAttribute("data-tip")) {
                content = target.getAttribute("data-tip") ?? "";
                direction = "top";
            }
            if (!content) {
                return;
            }
            target.hoverTimeout = window.setTimeout(() => {
                if (target.matches(":hover") && !target.tooltipElement) {
                    positionTooltip(target, content, direction);
                }
            }, 50);
        }
    });
    document.addEventListener("mouseout", (event) => {
        const target = (event.target as HTMLElement).closest(
            TOOLTIP_SELECTOR,
        ) as TooltipableElement | null;
        if (!target) {
            return;
        }
        if (target.hoverTimeout) {
            clearTimeout(target.hoverTimeout);
            target.hoverTimeout = null;
        }
        if (!target.contains(event.relatedTarget as Node)) {
            if (target.tooltipElement) {
                target.tooltipElement.remove();
                target.tooltipElement = null;
            }
        }
    });
}
