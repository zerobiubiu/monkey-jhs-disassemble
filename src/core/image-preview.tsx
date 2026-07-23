/**
 * 图片悬浮预览（原 window.ImageHoverPreview）
 *
 * 鼠标悬浮于匹配 `selector` 的元素时，读取其 `dataAttribute`（或 `src`）指向的大图，
 * 在鼠标旁的浮层中预览。支持按 maxWidth/maxHeight 等比缩放、超出视口自动翻转位置、
 * 加载态 / 失败态展示。
 *
 * 由 archetype/jhs.user.js L2225-2362 提取重构，行为等价：
 * - 默认配置对象（原 L2227-2238）保留为 `this.config`
 * - constructor(原 L2226-2245) / init(原 L2246-2250) / injectStyles(原 L2251-2254)
 *   / createPreviewElement(原 L2255-2259) / bindEvents(原 L2260-2273)
 *   / handleMouseEnter(原 L2274-2305) / calculateImageSize(原 L2306-2321)
 *   / handleMouseMove(原 L2322-2343) / handleMouseLeave(原 L2344-2349)
 *   / destroy(原 L2350-2362) 一一对应
 * - 原构造函数内 `this.x = null` 赋值改为 class field 语法（useDefineForClassFields）
 * - 单字母变量语义化：e→event、t→target/imgSrc、n→img、a/i→width/height、s/o→previewWidth/Height
 * - `injectStyles` 内 CSS 模板字符串（含 ${this.config.xxx} 插值）已提取为
 *   src/styles/image-preview.css + ?raw，运行时以占位 replace 注入
 * - 事件参数显式标注为 MouseEvent / HTMLElement / HTMLImageElement
 * - destroy 中 `removeEventListener` 传方法引用经 `as EventListener` 适配签名
 *   （与原脚本一致：移除的引用与 bindEvents 中箭头包装的监听器不匹配，此处保持原行为）
 */

import { injectCss as H } from './style-injector';
import { jsxToString } from './jsx-to-string';
import { ImagePreviewError } from '../components/image-preview/image-preview-error';
import { ImagePreviewImg } from '../components/image-preview/image-preview-img';
import imagePreviewCssRaw from '../styles/image-preview.css?raw';

interface ImagePreviewConfig {
    selector: string;
    dataAttribute: string;
    maxWidth: number;
    maxHeight: number;
    offsetX: number;
    offsetY: number;
    zIndex: number;
    transition: number;
    autoAdjustPosition: boolean;
}

class ImagePreview {
    config: ImagePreviewConfig;
    preview: HTMLDivElement | null = null;
    currentTarget: HTMLImageElement | null = null;
    timer: ReturnType<typeof setTimeout> | null = null;
    imgElement: HTMLImageElement | null = null;
    boundElements: WeakSet<HTMLElement> = new WeakSet<HTMLElement>();

    constructor(options: Partial<ImagePreviewConfig> = {}) {
        this.config = {
            selector: '.hover-preview',
            dataAttribute: 'data-full',
            maxWidth: 1000,
            maxHeight: 1000,
            offsetX: 20,
            offsetY: 20,
            zIndex: 9999999999,
            transition: 0.2,
            autoAdjustPosition: true,
            ...options
        };
        this.init();
    }

    init(): void {
        this.injectStyles();
        this.createPreviewElement();
        this.bindEvents();
    }

    injectStyles(): void {
        // imagePreviewCssRaw 为纯 CSS（无 <style> 包裹），占位以「默认值 + 行末注释」
        // 形式存在，经 replace 整串替换注入运行时配置值，由 injectCss 创建 <style> 注入。
        const css = imagePreviewCssRaw
            .replace('9999999999; /*__Z_INDEX__*/', `${this.config.zIndex}; /*__Z_INDEX__*/`)
            .replace(
                '0.2s ease; /*__TRANSITION__*/',
                `${this.config.transition}s ease; /*__TRANSITION__*/`
            )
            .replace('1000px; /*__MAX_WIDTH__*/', `${this.config.maxWidth}px; /*__MAX_WIDTH__*/`)
            .replace(
                '1000px; /*__MAX_HEIGHT__*/',
                `${this.config.maxHeight}px; /*__MAX_HEIGHT__*/`
            );
        H(css);
    }

    createPreviewElement(): void {
        this.preview = document.createElement('div');
        this.preview.className = 'image-hover-preview';
        document.body.appendChild(this.preview);
    }

    bindEvents(): void {
        document.querySelectorAll<HTMLElement>(this.config.selector).forEach((element) => {
            if (!this.boundElements.has(element)) {
                element.addEventListener('mouseenter', (event) => this.handleMouseEnter(event));
                element.addEventListener('mouseleave', (event) => this.handleMouseLeave(event));
                element.addEventListener('mousemove', (event) => this.handleMouseMove(event));
                this.boundElements.add(element);
            }
        });
    }

    handleMouseEnter(event: MouseEvent): void {
        clearTimeout(this.timer!);
        const target = event.currentTarget as HTMLImageElement;
        this.currentTarget = target;
        const imgSrc = target.getAttribute(this.config.dataAttribute) || target.src;
        if (!imgSrc) {
            return;
        }
        const preview = this.preview!;
        preview.innerHTML = '';
        preview.classList.add('loading');
        preview.style.display = 'block';
        preview.classList.remove('active');
        const img = new Image();
        img.onload = () => {
            preview.classList.remove('loading');
            preview.innerHTML = jsxToString(<ImagePreviewImg src={imgSrc} />);
            this.imgElement = preview.querySelector<HTMLImageElement>('img');
            const { width, height } = this.calculateImageSize(img);
            preview.style.width = `${width}px`;
            preview.style.height = `${height}px`;
            // 读取 offsetHeight 强制浏览器回流，确保后续 opacity 过渡生效
            preview.offsetHeight;
            preview.classList.add('active');
            this.handleMouseMove(event);
        };
        img.onerror = () => {
            preview.classList.remove('loading');
            preview.innerHTML = jsxToString(<ImagePreviewError />);
        };
        img.src = imgSrc;
    }

    calculateImageSize(img: HTMLImageElement): {
        width: number;
        height: number;
    } {
        let width = img.naturalWidth;
        let height = img.naturalHeight;
        if (width > this.config.maxWidth || height > this.config.maxHeight) {
            const scale = Math.min(this.config.maxWidth / width, this.config.maxHeight / height);
            width *= scale;
            height *= scale;
        }
        return { width, height };
    }

    handleMouseMove(event: MouseEvent): void {
        const preview = this.preview!;
        if (!this.currentTarget || !preview.classList.contains('active')) {
            return;
        }
        const { offsetX, offsetY } = this.config;
        let left = event.clientX + offsetX;
        let top = event.clientY + offsetY;
        if (this.config.autoAdjustPosition) {
            const previewWidth = preview.offsetWidth;
            const previewHeight = preview.offsetHeight;
            if (left + previewWidth > window.innerWidth) {
                left = event.clientX - previewWidth - offsetX;
            }
            if (top + previewHeight > window.innerHeight) {
                top = event.clientY - previewHeight - offsetY;
            }
            left = Math.max(0, left);
            top = Math.max(0, top);
        }
        preview.style.left = `${left}px`;
        preview.style.top = `${top}px`;
    }

    handleMouseLeave(_event: MouseEvent): void {
        const preview = this.preview!;
        preview.classList.remove('active');
        preview.style.display = 'none';
        this.currentTarget = null;
        this.imgElement = null;
    }

    destroy(): void {
        document.querySelectorAll<HTMLElement>(this.config.selector).forEach((element) => {
            if (this.boundElements.has(element)) {
                element.removeEventListener('mouseenter', this.handleMouseEnter as EventListener);
                element.removeEventListener('mouseleave', this.handleMouseLeave as EventListener);
                element.removeEventListener('mousemove', this.handleMouseMove as EventListener);
                this.boundElements.delete(element);
            }
        });
        const preview = this.preview;
        if (preview && preview.parentNode) {
            preview.parentNode.removeChild(preview);
        }
    }
}

export { ImagePreview };
