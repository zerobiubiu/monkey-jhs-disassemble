/**
 * jsxToString XSS 加固回归测试 —— 保护 doc/151 批次 1 安全边界。
 *
 * 断言渲染器的两条安全不变量：
 * 1. 文本/属性值转义（escapeText / escapeAttr）使注入载荷无法闭合标签或属性。
 * 2. href/src 协议白名单（sanitizeUrl）将 javascript:/data:/vbscript: 归一为 '#'。
 * 另覆盖 on* 事件属性剥离、函数组件递归转义、Fragment 透明输出。
 *
 * 用 react.createElement 构造节点（非 JSX），故本套件无需 JSX 转换或 DOM 环境。
 */
import { createElement, Fragment } from 'react';
import { describe, expect, it } from 'vitest';
import { jsxToString } from '../src/core/jsx-to-string';

describe('jsxToString 文本转义', () => {
    it('转义子节点文本中的 < > &，阻止标签注入', () => {
        const html = jsxToString(createElement('span', null, '<script>alert(1)</script>'));
        expect(html).toBe('<span>&lt;script&gt;alert(1)&lt;/script&gt;</span>');
        expect(html).not.toContain('<script>');
    });

    it('转义数字/布尔/null 子节点的组合', () => {
        // 0 → "0"；false/null → ""；字符串转义
        const html = jsxToString(createElement('div', null, 0, false, null, '<x>'));
        expect(html).toBe('<div>0&lt;x&gt;</div>');
    });
});

describe('jsxToString 属性值转义', () => {
    it('转义属性值中的双引号与尖括号，阻止属性逃逸', () => {
        const payload = '"><img src=x onerror=alert(1)>';
        const html = jsxToString(createElement('div', { title: payload }));
        // 双引号必须被转义为 &quot;，否则可闭合 title 属性并注入新标签
        expect(html).toContain('title="&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"');
        expect(html).not.toContain('<img');
    });

    it('className 映射为 class 并转义', () => {
        const html = jsxToString(createElement('div', { className: 'a"b' }));
        expect(html).toContain('class="a&quot;b"');
    });
});

describe('jsxToString href/src 协议白名单', () => {
    it.each([
        ['javascript:alert(1)'],
        ['  JavaScript:alert(1)'], // 前导空白 + 大小写
        ['data:text/html,<script>alert(1)</script>'],
        ['vbscript:msgbox(1)']
    ])('将危险协议 %s 归一为 #', (url) => {
        const html = jsxToString(createElement('a', { href: url }));
        expect(html).toContain('href="#"');
        expect(html).not.toContain(url.trim());
    });

    it('保留安全协议 http/https', () => {
        expect(jsxToString(createElement('a', { href: 'https://javdb.com' }))).toContain(
            'href="https://javdb.com"'
        );
        expect(jsxToString(createElement('a', { href: '/relative/path' }))).toContain(
            'href="/relative/path"'
        );
    });

    it('对 src 同样执行协议白名单', () => {
        expect(jsxToString(createElement('img', { src: 'javascript:alert(1)' }))).toContain(
            'src="#"'
        );
        expect(jsxToString(createElement('img', { src: 'https://x.com/a.jpg' }))).toContain(
            'src="https://x.com/a.jpg"'
        );
    });
});

describe('jsxToString 事件属性剥离', () => {
    it('忽略 on* 事件处理器，不渲染为属性', () => {
        const html = jsxToString(
            createElement('button', { onClick: () => undefined, id: 'b' }, 'x')
        );
        expect(html.toLowerCase()).not.toContain('onclick');
        expect(html).toContain('id="b"');
    });
});

describe('jsxToString 函数组件与 Fragment', () => {
    it('递归渲染函数组件并对内层文本转义', () => {
        const C = (p: { t: string }) => createElement('b', null, p.t);
        const html = jsxToString(createElement(C, { t: '<x>' }));
        expect(html).toBe('<b>&lt;x&gt;</b>');
    });

    it('Fragment 透明输出子节点', () => {
        const html = jsxToString(createElement(Fragment, null, 'a', '<b>'));
        expect(html).toBe('a&lt;b&gt;');
    });
});
