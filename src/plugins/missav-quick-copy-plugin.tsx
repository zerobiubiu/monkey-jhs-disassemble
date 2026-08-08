/**
 * MissAV 快速复制 & JavDB 搜索插件 MissavQuickCopyPlugin —— 集成自
 * archetype/MissAV Quick Copy & Javdb Search.user.js（v1.0.2，~190 行）。
 *
 * 功能：为 MissAV 视频播放页面提供番号快速复制和一键跳转 JavDB 搜索。
 * - 点击"复制番号"按钮 → 番号复制到剪贴板 + 浮动提示
 * - 点击"转到JavDB搜索"按钮 → 新标签页打开 JavDB 搜索对应番号
 *
 * 集成方式：作为 BasePlugin 子类注册到 PluginManager，仅在 missav 站点注册
 * （main.tsx 的 `if (isMissavSite)` 块）。无 CSS（按钮样式复用 missav 页面
 * tailwind class），无 GM_addStyle，无 initCss。
 *
 * === 主项目冲突排查（无冲突，独立运行） ===
 * 本插件操作 missav 播放页工具栏选择器
 * `body > div:nth-child(3) > div.sm:container... > div > div.flex-1.order-first > div.mt-4 > div`，
 * 仅在此容器内 prepend/appendChild 两个按钮。src/ 中无任何插件操作此选择器
 * （MissavStatusTagPlugin 操作的是缩略图 `.thumbnail` 容器，与本插件无交集）。
 * MutationObserver 监听 document.body subtree 等待目标元素出现即 disconnect，
 * 不与其他插件的 observer 互相触发。
 *
 * 控制流保留要点：
 * 1. extractCode 番号提取：FC2-PPV-\d+ 整体保留；其他取 pathname 末段的前两段
 *    （如 abc-123-456 → abc-123）
 * 2. copyToClipboard：navigator.clipboard.writeText（Promise）
 * 3. showToast：原生 DOM 浮动提示（fixed 定位 + opacity 过渡）
 * 4. openInNewTab：创建隐形 <a target=_blank> + click（原脚本注释掉了
 *    GM_openInTab/window.open，实际用 <a>.click()，保留此实现）
 * 5. createButton/createSVGClipboard：原生 createElement/createElementNS 创建按钮 +
 *    剪贴板 SVG 图标；createSVGJavDB：JavDBIcon 组件（SVG 命名常量 +
 *    dangerouslySetInnerHTML）经 jsxToString 渲染后由 template 解析提取 svg 节点
 * 6. insertButtons：prepend 复制按钮 + appendChild JavDB 按钮
 * 7. MutationObserver：监听 document.body subtree，找到目标元素后 disconnect + insertButtons
 */
import { jsxToString } from '../core/jsx-to-string';

import { BasePlugin } from './base-plugin';

import { JavDBIcon } from '../components/misc/javdb-icon';

/** 日志前缀。 */
const LOG = '[MissAV 快速复制]';

/**
 * missav 播放页工具栏选择器（按钮挂载点）。
 * 对应原脚本 selector 常量。
 */
const MENU_BAR_SELECTOR =
    'body > div:nth-child(3) > div.sm\\:container.mx-auto.px-4.content-without-search.pb-12 > div > div.flex-1.order-first > div.mt-4 > div';

/**
 * 从 URL pathname 提取番号。
 * 对应原脚本 extractCode 函数。
 *
 * - FC2-PPV-\d+ 格式整体保留（如 FC2-PPV-1234567）
 * - 其他格式取末段的前两段（如 abc-123-456 → abc-123）
 * - 不足两段时返回完整末段
 *
 * @param pathname 当前页面的 pathname（如 /dm/abc-123-cn）
 * @returns 提取的番号（如 abc-123）
 */
function extractCode(pathname: string): string {
    const filename = pathname.split('/').pop() || '';
    if (/^FC2-PPV-\d+$/i.test(filename)) return filename;
    const parts = filename.split('-');
    return parts.length >= 2 ? parts[0] + '-' + parts[1] : filename;
}

/**
 * 复制文本到剪贴板。
 * 对应原脚本 copyToClipboard 函数。
 *
 * @param text 要复制的文本
 * @returns Promise<boolean>，true=成功，false=失败
 */
function copyToClipboard(text: string): Promise<boolean> {
    return navigator.clipboard
        .writeText(text)
        .then(() => true)
        .catch(() => false);
}

/**
 * 页面内浮动提示（原生 DOM，fixed 定位 + opacity 过渡）。
 * 对应原脚本 showToast 函数。
 *
 * @param message 提示文本
 * @param duration 显示时长（毫秒），默认 2000
 */
function showToast(message: string, duration: number = 2000): void {
    const toast = document.createElement('div');
    toast.textContent = message;
    Object.assign(toast.style, {
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.7)',
        color: '#fff',
        padding: '8px 16px',
        borderRadius: '4px',
        fontSize: '14px',
        zIndex: '9999',
        transition: 'opacity 0.3s',
        opacity: '1'
    });
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/**
 * 在新标签页打开 URL（创建隐形 <a target=_blank> + click）。
 * 对应原脚本 openInNewTab 函数。
 *
 * 原脚本注释掉了 GM_openInTab 和 window.open，实际用 <a>.click() 方法，
 * 保留此实现（与原脚本零偏差）。
 *
 * @param url 要打开的 URL
 * @returns boolean，true=触发成功
 */
function openInNewTab(url: string): boolean {
    console.log(`${LOG} openInNewTab 触发`);
    try {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        console.log(`${LOG} 执行 模拟单击 a 标签`);
        document.body.removeChild(a);
        return true;
    } catch (e) {
        console.log(`${LOG} 单击 a 标签失败:`, e);
        return false;
    }
}

/**
 * 创建通用按钮（原生 DOM，tailwind class 与 missav 原生播放页按钮对齐）。
 * 对应原脚本 createButton 函数。
 *
 * 样式对齐：原生按钮 class 为 `inline-flex items-center whitespace-nowrap
 * text-sm text-nord4 leading-4 font-medium focus:outline-none hover:text-nord6`，
 * 间距由外层 space-x 控制（自定义按钮组独立成组后不再依赖 mr-2）。
 *
 * @param label 按钮文本
 * @param svgElement SVG 图标元素
 * @param onClick 点击回调
 * @returns HTMLButtonElement 按钮元素
 */
function createButton(label: string, svgElement: Node, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className =
        'inline-flex items-center whitespace-nowrap text-sm text-nord4 leading-4 font-medium focus:outline-none hover:text-nord6';
    button.appendChild(svgElement);
    button.appendChild(document.createTextNode(label));
    button.addEventListener('click', (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
    });
    return button;
}

/**
 * 创建剪贴板 SVG 图标（原生 createElementNS）。
 * 对应原脚本 createSVGClipboard 函数。
 *
 * 尺寸用 tailwind class 对齐原生图标（h-3 w-3 xs:h-4 xs:w-4 响应式），
 * 不用固定 width/height 属性。
 *
 * @returns SVGSVGElement 剪贴板图标
 */
function createSVGClipboard(): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('class', 'mr-1 md:mr-2 h-3 w-3 xs:h-4 xs:w-4');
    svg.setAttribute('viewBox', '0 0 16 16');

    const path1 = document.createElementNS(svg.namespaceURI, 'path');
    path1.setAttribute('fill-rule', 'evenodd');
    path1.setAttribute(
        'd',
        'M10.854 7.146a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L7.5 9.793l2.646-2.647a.5.5 0 0 1 .708 0'
    );

    const path2 = document.createElementNS(svg.namespaceURI, 'path');
    path2.setAttribute(
        'd',
        'M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1z'
    );

    const path3 = document.createElementNS(svg.namespaceURI, 'path');
    path3.setAttribute(
        'd',
        'M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0z'
    );

    svg.appendChild(path1);
    svg.appendChild(path2);
    svg.appendChild(path3);
    return svg;
}

/**
 * 创建 JavDB SVG 图标（JavDBIcon 组件经 jsxToString 渲染后由 template 解析提取 svg 节点）。
 * 对应原脚本 createSVGJavDB 函数。
 *
 * 解析后移除固定 width/height（tabler 24px），改用 tailwind class 对齐原生图标尺寸。
 *
 * @returns Node JavDB 字母 J 图标
 */
function createSVGJavDB(): Node {
    const html = jsxToString(<JavDBIcon />);
    const template = document.createElement('template');
    template.innerHTML = html;
    const svg = template.content.querySelector('svg');
    if (svg instanceof SVGElement) {
        svg.removeAttribute('width');
        svg.removeAttribute('height');
        svg.setAttribute('class', 'mr-1 md:mr-2 h-3 w-3 xs:h-4 xs:w-4');
    }
    return svg as Node;
}

/**
 * 在原生工具栏之后插入独立自定义按钮组（复制番号 + 跳转 JavDB）。
 * 对应原脚本 insertButtons 函数。
 *
 * 布局调整（doc/226）：不再把按钮 prepend/append 进原生工具栏（避免与原生
 * 「收藏/片单/下载/分享」按钮混排、样式不一致），改为在工具栏后插入独立按钮组，
 * 样式与原生按钮对齐（tailwind class + 响应式图标尺寸）。
 *
 * @param menuBar 原生工具栏 DOM 元素
 */
function insertButtons(menuBar: Element): void {
    // 幂等：已插入过则跳过（observer 与 existing 双路径避免重复）
    if (document.querySelector('.jhs-video-actions')) return;

    const fanhao = extractCode(window.location.pathname);

    // 独立按钮组容器（tailwind class 与原生工具栏同风格）
    const bar = document.createElement('div');
    bar.className = 'jhs-video-actions flex flex-wrap justify-center space-x-4 md:space-x-6 py-4';

    // 复制番号按钮
    const copyBtn = createButton('复制番号', createSVGClipboard(), () => {
        copyToClipboard(fanhao).then((success: boolean) => {
            showToast(success ? `番号 ${fanhao} 已复制` : '复制失败');
        });
    });
    bar.appendChild(copyBtn);

    // 跳转 JavDB 按钮
    const javdbBtn = createButton('转到JavDB搜索', createSVGJavDB(), () => {
        const javdbUrl = `https://javdb.com/search?q=${encodeURIComponent(fanhao)}&f=all`;
        console.log(`${LOG} 尝试打开 JavDB 链接:`, javdbUrl);

        const success = openInNewTab(javdbUrl);
        if (success) {
            showToast(`正在跳转到 JavDB 搜索: ${fanhao}`);
        } else {
            showToast('跳转失败，请检查弹窗阻止设置');
            // 备选方案：复制链接到剪贴板
            copyToClipboard(javdbUrl).then((copied: boolean) => {
                if (copied) {
                    showToast('链接已复制到剪贴板，请手动打开');
                }
            });
        }
    });
    bar.appendChild(javdbBtn);

    menuBar.insertAdjacentElement('afterend', bar);
    console.log(`${LOG} ✅ Copy 和 JavDB 按钮已插入工具栏后独立按钮组`);
}

/**
 * MissAV 快速复制 & JavDB 搜索插件主类。
 *
 * 原脚本对应行号：L1-190（整体）。原脚本用 IIFE 闭包承载 MutationObserver，
 * 此处转为类私有字段。
 */
export class MissavQuickCopyPlugin extends BasePlugin {
    /** 等待目标元素的 MutationObserver。 */
    private observer: MutationObserver | null = null;

    /**
     * 返回插件名，供 PluginManager 注册去重。
     *
     * @returns "MissavQuickCopyPlugin"
     */
    getName(): string {
        return 'MissavQuickCopyPlugin';
    }

    /**
     * 无 CSS（按钮样式复用 missav 页面 tailwind class）。
     *
     * @returns 空字符串（不注入 CSS）
     */
    async initCss(): Promise<string> {
        return '';
    }

    /**
     * 主处理：MutationObserver 监听 document.body，找到目标工具栏后插入按钮。
     * 对应原脚本 IIFE 末尾的 observer 逻辑。
     *
     * 原脚本 @match 限定 missav.ws 视频播放页（URL pathname 含 `-`）。
     * 本项目 match 已覆盖 missav.ws/live，本插件在 handle() 内用 pathname
     * 守卫等价原脚本 @match（仅播放页有目标选择器，非播放页 querySelector
     * 返回 null 也不会插入）。
     *
     * @returns Promise<void>；无显式抛出
     */
    async handle(): Promise<void> {
        // 目标选择器匹配即插入（非播放页 querySelector 返回 null，observer 持续等待但不会命中）
        const existing = document.querySelector(MENU_BAR_SELECTOR);
        if (existing) {
            insertButtons(existing);
            return;
        }

        // 监听 DOM 变化，直到找到目标元素
        this.observer = new MutationObserver(() => {
            const menuBar = document.querySelector(MENU_BAR_SELECTOR);
            if (menuBar) {
                this.observer?.disconnect();
                this.observer = null;
                insertButtons(menuBar);
            }
        });
        this.observer.observe(document.body, { childList: true, subtree: true });
    }
}
