# doc/151 — jsxToString XSS 加固

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

批次 1 安全加固项「JSX 文本及属性完整转义，校验 href/src 协议」。

`jsxToString` 的 `escapeText()` 已转义文本节点的 `&`/`<`/`>`，
但 `renderAttrs()` 中属性值未转义 `"`，攻击者可通过 `"` 闭合属性
注入新属性（如 `onmouseover="alert(1)"`）。

`href`/`src` 属性无协议校验，`javascript:alert(1)` 等危险协议
可直接通过。

## 方案

### 1. escapeAttr — 属性值转义

```typescript
function escapeAttr(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
```

应用于 `renderAttrs` 的所有属性值输出：
- `class="..."` — `escapeAttr(String(value))`
- `style="..."` — `escapeAttr(value)` / `escapeAttr(css)`
- 其他属性 — `escapeAttr(attrValue)`

### 2. sanitizeUrl — 协议校验

```typescript
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
```

仅应用于 `href` 和 `src` 属性。允许 http/https/mailto/tel/相对路径。

## 实施

| 文件 | 操作 |
|------|------|
| `src/core/jsx-to-string.ts` | 修改：新增 escapeAttr + sanitizeUrl，renderAttrs 全部属性值转义 |

## 执行验证记录

```
$ bun run build
tsc -b && vite build
✓ 229 modules transformed.
dist/monkey-jhs-disassemble.user.js  2,023.36 kB │ gzip: 467.05 kB
✓ built in 1.21s
```

tsc 零错误。产物 +0.49 kB（escapeAttr + sanitizeUrl 函数）。
