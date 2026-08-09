// @vitest-environment jsdom
/**
 * jquery 4.0.0 × layui-layer 1.0.9 运行时兼容回归测试（doc/242）。
 *
 * 背景：doc/239 起 7 库 JS 由 CDN @require 注入（vite.config.ts externalGlobals），
 * doc/242 将 jquery 3.7.1 → 4.0.0。jQuery 4 移除了 13 个静态方法
 * （$.trim/isArray/parseJSON/type/now/isNumeric/isFunction/isWindow/camelCase/
 * nodeName/cssNumber/cssProps/fx.interval）+ `toggleClass(布尔)` 签名 + 原型
 * push/sort/splice。最大的第三方依赖是 layui-layer 1.0.9（`ready.run(jQuery)` +
 * 大量 `$(window).width()/.height()/.scrollTop()`），本测试锁定其兼容性不回归。
 *
 * 注入方式：直接读 node_modules 的 dist 文件（与 CDN @require 同源同版），
 * 按 Tampermonkey 注入顺序 jquery → layer，以 `window.eval` 在 jsdom 窗口域执行
 *（vitest jsdom 下动态 script 标签不执行，window.eval 实测可行）。
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const JQUERY_DIST = path.resolve('node_modules/jquery/dist/jquery.min.js');
const LAYER_DIST = path.resolve('node_modules/layui-layer/dist/layer.js');

/** 在 jsdom 窗口域执行库代码（等价 @require 注入）。 */
function evalInWindow(code: string): void {
    (window as Window & { eval: (c: string) => unknown }).eval(code);
}

declare global {
    interface Window {
        jQuery: any;
        $: any;
        layer: any;
    }
}

describe('jquery 4.0.0 × layui-layer 1.0.9 兼容', () => {
    beforeAll(() => {
        // @require 顺序 1：jquery（UMD 挂 window.jQuery/$）
        evalInWindow(readFileSync(JQUERY_DIST, 'utf8'));
        // 占位 script：layer.js 的 ready.getPath 读 document.scripts[last].src，
        // eval 无 script 元素会抛错；真实 @require 场景天然存在该元素。
        const placeholder = document.createElement('script');
        placeholder.src = 'https://cdn.jsdelivr.net/npm/layui-layer@1.0.9/dist/layer.min.js';
        document.head.appendChild(placeholder);
        // @require 顺序 2：layer（webpack 打包含 CSS，依赖全局 jQuery 完成 ready.run）
        evalInWindow(readFileSync(LAYER_DIST, 'utf8'));
    });

    it('jquery 4.0.0 加载成功', () => {
        expect(window.jQuery?.fn?.jquery).toBe('4.0.0');
        expect(window.$).toBeDefined();
    });

    it('layer 初始化成功（ready.run(jQuery) 拿到全局 jQuery）', () => {
        expect(window.layer).toBeDefined();
        expect(window.layer.v).toBe('3.0.1');
    });

    it('layer 依赖的 $(window) 尺寸/滚动 API 在 jQuery 4 下可用', () => {
        const $ = window.jQuery as JQueryStatic;
        // jsdom 无布局引擎，宽度/高度为 0 属预期；重点是调用不抛错。
        expect($(window).width()).toBeGreaterThanOrEqual(0);
        expect($(window).height()).toBeGreaterThanOrEqual(0);
        expect($(window).scrollTop()).toBeGreaterThanOrEqual(0);
        expect($(window).innerWidth()).toBeGreaterThanOrEqual(0);
        expect($(window).innerHeight()).toBeGreaterThanOrEqual(0);
        expect($('html').length).toBe(1);
    });

    it('layer.open 产出 .layui-layer DOM，close / closeAll 正常', () => {
        const idx = window.layer.open({
            type: 1,
            title: '测试',
            content: '<div id="layer-content">内容</div>',
            area: ['300px', '200px']
        });
        expect(idx).toBeGreaterThan(0);
        expect(document.querySelectorAll('.layui-layer').length).toBeGreaterThan(0);
        expect(() => window.layer.close(idx)).not.toThrow();
        expect(() => window.layer.closeAll()).not.toThrow();
    });

    it('layer.msg / load / tips 不抛错', () => {
        const layer = window.layer;
        expect(() => layer.msg('测试消息')).not.toThrow();
        const loadIdx = layer.load();
        expect(loadIdx).toBeGreaterThan(0);
        expect(() => layer.close(loadIdx)).not.toThrow();
        expect(() => layer.tips('提示', document.body)).not.toThrow();
        layer.closeAll();
    });

    it('项目常用 jQuery API 冒烟（jQuery 4 保留面）', () => {
        const $ = window.jQuery as JQueryStatic;
        const el = $('<div id="jq-smoke">x</div>').appendTo(document.body);

        // 事件
        expect(el.on('click', () => 0).trigger('click').length).toBe(1);
        // 类操作
        expect(el.addClass('a').hasClass('a')).toBe(true);
        expect(el.removeClass('a').hasClass('a')).toBe(false);
        // 属性
        expect(el.attr('data-x', 'y').attr('data-x')).toBe('y');
        expect(el.prop('id')).toBe('jq-smoke');
        // 文本/遍历
        expect(el.text()).toBe('x');
        expect(el.closest('body').length).toBe(1);
        expect(el.find('span').length).toBe(0);
        // 静态工具
        expect($.each([1, 2], () => true).length).toBe(2);
        expect(typeof $.extend).toBe('function');
        expect(typeof $.ajax).toBe('function');

        el.remove();
        expect(document.querySelector('#jq-smoke')).toBeNull();
    });
});