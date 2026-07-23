/**
 * jsxToString —— 轻量 JSX → HTML 字符串渲染器。
 *
 * 替代 `react-dom/server` 的 `renderToStaticMarkup`：后者携带 SSR 依赖
 * 被打入产物致 +452 kB 膨胀（见 doc/06）；本模块仅依赖 `react` 的类型
 * （`import type`），运行时零依赖，产物体积回到无 react-dom/server 基线。
 *
 * 适用范围：纯函数组件（无 hooks/state/effects），返回同步 ReactNode。
 * 满足本工程将组件渲染为 HTML 字符串后注入 jQuery/layer 的场景。
 *
 * 支持节点类型：
 * - **函数组件**：`(type as Function)(props)` 调用，递归 jsxToString 结果。
 * - **DOM 元素**：`<tag attrs>children</tag>`；自闭合标签
 *   （img/input/br/hr/meta/link 等 void elements）输出 `<tag attrs />`。
 * - **Fragment**（`<>...</>`）：透明拼接 children。
 * - **文本/数字**：`String()`；文本节点转义 `&` `<` `>`（不转义 `"`）。
 * - **数组**：`map(jsxToString).join('')`。
 * - **null/boolean/undefined/bigint(暂忽略)/Promise/Portal**：`''`。
 *
 * 属性处理：
 * - `className` → `class`
 * - `style` 对象 → CSS 字符串（camelCase→kebab-case，如
 *   `{backgroundColor:'red'}` → `background-color:red`）
 * - `style` 字符串 → 原样
 * - `data-*` / `aria-*` / 其他 → 原样 `key="value"`
 * - 布尔属性：`true` → 裸属性；`false`/`null`/`undefined` → 省略
 * - `on*` 事件 → 忽略
 * - `dangerouslySetInnerHTML` → 取 `__html` 作为原始 inner HTML 注入（不转义），
 *   属性本身不渲染为 HTML 属性（React 的 raw HTML 注入约定）
 *
 * @module core/jsx-to-string
 */
import type { ReactNode, ReactElement } from 'react';

/**
 * 自闭合标签集合（HTML void elements，无子节点也无闭合标签）。
 * @see https://html.spec.whatwg.org/multipage/syntax.html#void-elements
 */
const VOID_TAGS = new Set<string>([
    'img',
    'input',
    'br',
    'hr',
    'meta',
    'link',
    'area',
    'base',
    'col',
    'embed',
    'param',
    'source',
    'track',
    'wbr'
]);

/** Fragment 类型标识：`Symbol.for("react.fragment")`（兼容 React 18/19）。 */
const REACT_FRAGMENT_TYPE: symbol = Symbol.for('react.fragment');

/** 元素 props 的宽松运行时形状（值类型未知，按字段名分发处理）。 */
interface PropsRecord {
    [key: string]: unknown;
}

/**
 * 判断节点是否为 ReactElement。
 *
 * 不严格校验 `$$typeof` Symbol 值（React 18 = `react.element`，
 * React 19 = `react.transitional.element`），改为运行时按结构判定
 * （对象 + 含 `type`/`props` 字段），以同时兼容两版本。
 *
 * @param node 任意 ReactNode
 * @returns 是否为可渲染的 ReactElement
 */
function isReactElement(node: unknown): node is ReactElement {
    return (
        node != null &&
        typeof node === 'object' &&
        'type' in node &&
        'props' in node &&
        typeof (node as { props: unknown }).props === 'object' &&
        (node as { props: unknown }).props !== null
    );
}

/**
 * 转义文本节点的特殊字符：`&` `<` `>`。
 *
 * 不转义 `"`（文本节点不需要；属性值单独处理）。
 * 属性值（src/alt/data-* 等）按本工程约定不转义，与原脚本
 * `$('<img src="${t}">')` 字符串拼接行为一致。
 * @param s 原始文本
 * @returns 转义后文本
 */
function escapeText(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 转义属性值的特殊字符：`&` `<` `>` `"`。
 * 属性值必须转义 `"`，否则攻击者可通过 `"` 闭合属性注入新属性。
 * @param s 原始属性值
 * @returns 转义后属性值
 */
function escapeAttr(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * 校验 URL 协议安全性（doc/151 批次 1 安全加固）。
 * 允许 http/https/mailto/tel/相对路径，阻止 javascript:/data:/vbscript: 等危险协议。
 * @param url 原始 URL
 * @returns 安全的 URL（危险协议返回 '#'）
 */
function sanitizeUrl(url: string): string {
    const trimmed = url.trim().toLowerCase();
    if (
        trimmed.startsWith('javascript:') ||
        trimmed.startsWith('data:') ||
        trimmed.startsWith('vbscript:')
    ) {
        return '#';
    }
    return url;
}

/**
 * camelCase → kebab-case 转换。
 * 如 `backgroundColor` → `background-color`、`marginTop` → `margin-top`。
 * @param s camelCase 样式键
 * @returns kebab-case CSS 属性名
 */
function camelToKebab(s: string): string {
    return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/**
 * 将 React `style` 对象转换为 CSS 字符串。
 *
 * - camelCase 键 → kebab-case
 * - 跳过 `null`/`undefined`/`false` 值
 * - 数值/字符串值直接拼接（含 `!important` 等后缀原样保留）
 *
 * 如 `{ backgroundColor: "red", marginTop: 10 }` → `background-color:red;margin-top:10`。
 *
 * 注：React `renderToStaticMarkup` 对纯数字值会附加 `px`（除部分无单位属性外），
 * 本实现不做此处理，由调用方在 props 中显式给单位字符串（与原脚本内联 style 行为一致）。
 * @param style React style 对象
 * @returns CSS 声明字符串（无末尾 `;`）
 */
function styleToCss(style: PropsRecord): string {
    return Object.entries(style)
        .filter(([, v]) => v != null && v !== false)
        .map(([k, v]) => `${camelToKebab(k)}:${v as string | number}`)
        .join(';');
}

/**
 * 渲染元素 props 为 HTML 属性字符串（前置空格）。
 *
 * 规则：
 * - `children`：跳过（由 `renderChildren` 处理）
 * - `on*`（事件）：跳过（HTML 字符串注入后无意义）
 * - `className`：→ `class="..."`
 * - `style`：对象走 `styleToCss`，字符串原样输出
 * - 布尔 `true`：裸属性（如 `disabled`）
 * - 布尔 `false` / `null` / `undefined`：省略
 * - 其他：`key="String(value)"`
 *
 * @param props 元素 props
 * @returns 形如 ` class="..." style="..."` 的字符串；无属性时为空串
 */
function renderAttrs(props: PropsRecord): string {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(props)) {
        if (value == null || value === false) continue;
        if (key === 'children') continue;
        if (key === 'dangerouslySetInnerHTML') continue;
        if (key.startsWith('on')) continue;
        if (key === 'className') {
            if (value !== '') parts.push(`class="${escapeAttr(String(value))}"`);
            continue;
        }
        if (key === 'htmlFor') {
            parts.push(`for="${escapeAttr(String(value))}"`);
            continue;
        }
        if (key === 'style') {
            if (typeof value === 'string') {
                parts.push(`style="${escapeAttr(value)}"`);
            } else if (typeof value === 'object' && value !== null) {
                const css = styleToCss(value as PropsRecord);
                if (css) parts.push(`style="${escapeAttr(css)}"`);
            }
            continue;
        }
        if (value === true) {
            parts.push(key);
            continue;
        }
        const attrValue = (key === 'href' || key === 'src') ? sanitizeUrl(String(value)) : String(value);
        parts.push(`${key}="${escapeAttr(attrValue)}"`);
    }
    return parts.length ? ' ' + parts.join(' ') : '';
}

/**
 * 渲染 children（任意 ReactNode）为拼接后的字符串。
 *
 * - `null`/`undefined`/`boolean` → `''`
 * - `string` → 转义后文本
 * - `number`/`bigint` → `String()`
 * - `Array` → 递归每个元素后 `join('')`
 * - `ReactElement` → 递归 `jsxToString`
 * - 其他（Portal/Promise 等）→ `''`
 *
 * @param children 元素 props.children（已宽松为 unknown）
 * @returns 拼接后的 HTML 字符串
 */
function renderChildren(children: unknown): string {
    if (children == null || typeof children === 'boolean') return '';
    if (typeof children === 'string') return escapeText(children);
    if (typeof children === 'number' || typeof children === 'bigint') {
        return String(children);
    }
    if (Array.isArray(children)) {
        return children.map((c) => renderChildren(c)).join('');
    }
    if (isReactElement(children)) {
        return jsxToString(children);
    }
    return '';
}

/**
 * 将 React 节点（JSX 产物）渲染为 HTML 字符串。
 *
 * 等价于 `react-dom/server` 的 `renderToStaticMarkup`（对本工程纯函数组件
 * 场景），但不引入 `react-dom/server`，避免 SSR 依赖膨胀产物。
 *
 * 处理顺序：
 * 1. `null`/`undefined`/`boolean` → `''`
 * 2. `string` → 转义文本
 * 3. `number`/`bigint` → `String()`
 * 4. `Array` → 递归拼接
 * 5. `ReactElement`：
 *    - Fragment（`type` 为 `Symbol.for("react.fragment")`）→ 透明输出 children
 *    - 函数组件（`typeof type === "function"`）→ 调用并递归
 *    - DOM 元素（`typeof type === "string"`）→ `<tag attrs>children</tag>` 或自闭合
 *    - 其他（类组件/ExoticComponent 等）→ `''`（本工程未使用）
 *
 * @param node 任意 ReactNode（元素 / 文本 / 数组 / null / ...）
 * @returns HTML 字符串；空节点返回空串
 *
 * @example
 *   jsxToString(<div className="x" style={{ display: "none" }}>hi</div>)
 *   // → `<div class="x" style="display:none">hi</div>`
 *
 *   jsxToString(<TemporaryImageContainer src="a.jpg" alt="A" />)
 *   // → `<div class="temporary-container" style="display:none"><img src="a.jpg" alt="A" /></div>`
 */
export function jsxToString(node: ReactNode): string {
    if (node == null || typeof node === 'boolean') return '';
    if (typeof node === 'string') return escapeText(node);
    if (typeof node === 'number' || typeof node === 'bigint') {
        return String(node);
    }
    if (Array.isArray(node)) {
        return node.map(jsxToString).join('');
    }
    if (!isReactElement(node)) {
        // Portal / Promise / 其他不支持节点，忽略
        return '';
    }
    const { type, props } = node as ReactElement<PropsRecord> & {
        type: symbol | string | ((p: PropsRecord) => ReactNode);
    };

    // Fragment：透明输出 children
    if (type === REACT_FRAGMENT_TYPE) {
        return renderChildren((props as PropsRecord).children);
    }

    // 函数组件：调用并递归
    if (typeof type === 'function') {
        const result = (type as (p: PropsRecord) => ReactNode)(props as PropsRecord);
        return jsxToString(result);
    }

    // DOM 元素：string tag
    if (typeof type === 'string') {
        const tag = type;
        const attrs = renderAttrs(props as PropsRecord);
        if (VOID_TAGS.has(tag)) {
            return `<${tag}${attrs} />`;
        }
        // dangerouslySetInnerHTML：React 的 raw HTML 注入约定，
        // 取 __html 作为原始 inner HTML（不转义），跳过 children 渲染。
        const dsi = (props as PropsRecord).dangerouslySetInnerHTML as
            { __html?: string } | undefined;
        if (dsi && typeof dsi.__html === 'string') {
            return `<${tag}${attrs}>${dsi.__html}</${tag}>`;
        }
        const inner = renderChildren((props as PropsRecord).children);
        return `<${tag}${attrs}>${inner}</${tag}>`;
    }

    // 未知类型（类组件/ExoticComponent 等）：本工程未使用，忽略
    return '';
}
