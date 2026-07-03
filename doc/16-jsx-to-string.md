# 16 - 轻量 jsxToString 替代 react-dom/server

**文档类型**：🔧开发指导
**文档状态**：✅已执行

## 1. 背景

`doc/06` 因 `react-dom/server` 的 `renderToStaticMarkup` 致产物从 459 kB
膨胀至 911 kB（+98%），确立了「组件返回 HTML 字符串，禁用 JSX」的统一
规定。该规定牺牲了 JSX 的类型安全与可组合性，所有 HTML→组件转换均以
模板字符串拼接完成。

后续若要恢复 JSX 模式（类型安全、条件渲染/列表渲染清晰、与 React 生态
对齐），需一个**不引入 react-dom/server** 的轻量 JSX→HTML 渲染器。本
文档实施该方案：自定义 `jsxToString`，仅依赖 `react` 的**类型**
（`import type`），运行时零依赖，产物体积回到无 react-dom/server 基线。

适用范围：**纯函数组件**（无 hooks/state/effects，返回同步 ReactNode）。
覆盖本工程将组件渲染为 HTML 字符串后注入 jQuery/layer 的全部场景。

## 2. 修改方案

### 2.1 新建 `src/core/jsx-to-string.ts`

实现 `jsxToString(node: ReactNode): string`，处理：

- **函数组件**：`(el.type as Function)(el.props)` 调用，递归 jsxToString
  结果（纯函数组件，无 hooks）。
- **DOM 元素**：`<tag attrs>children</tag>`；自闭合标签
  （img/input/br/hr/meta/link 等 void elements）输出 `<tag attrs />`。
- **Fragment**（`<>...</>`）：透明拼接 children（`type ===
  Symbol.for("react.fragment")`）。
- **文本/数字**：`String()`；文本节点转义 `&` `<` `>`（不转义 `"`）。
- **数组**：`map(jsxToString).join('')`。
- **null/boolean/undefined/bigint/Promise/Portal**：`''`。

属性处理：

- `className` → `class`
- `style` 对象 → CSS 字符串（camelCase→kebab-case，如
  `{backgroundColor:'red'}` → `background-color:red`）
- `style` 字符串 → 原样
- `data-*` / `aria-*` / 其他 → 原样 `key="value"`
- 布尔属性：`true` → 裸属性（如 `disabled`）；`false`/`null`/`undefined` → 省略
- `on*` 事件 → 忽略

类型层面：`import type { ReactNode, ReactElement } from "react"`，仅类型
不引入 react 运行时。ReactElement.type 的类型断言为
`symbol | string | ((p) => ReactNode)`，以兼容 Fragment（运行时 type 为
symbol，但 TS 默认类型 `string | JSXElementConstructor` 不含 symbol）。

### 2.2 `src/components/temporary-image-container.tsx`

- 保持 JSX 函数组件实现不变（已是 JSX 形态，反转 doc/06 对该组件的
  「返回 HTML 字符串」规定）。
- 仅更新文件头注释：渲染方式说明由「用 `renderToStaticMarkup`」改为
  「用 `jsxToString`（来自 ../core/jsx-to-string，轻量渲染器，不引入
  react-dom/server）」，并引用本 `doc/16`。

### 2.3 `src/main.tsx`

- 删除 `import { renderToStaticMarkup } from "react-dom/server";`。
- 新增 `import { jsxToString } from "./core/jsx-to-string";`。
- `showImageViewer` 调用点由
  ```ts
  a = $(
      renderToStaticMarkup(
          <TemporaryImageContainer src={String(t)} alt={n} />,
      ),
  ).appendTo("body");
  ```
  改为
  ```ts
  a = $(
      jsxToString(
          <TemporaryImageContainer src={String(t)} alt={n} />,
      ),
  ).appendTo("body");
  ```
- 移除后 `main.tsx` 不再引入 `react-dom/server`，仅保留 `react` 类型
  依赖（由 menu-button-box/rating-bar/status-tag/temporary-image-container
  示范组件引用）。

## 3. 与 doc/06 的关系

- **doc/06（✅已执行，历史定稿，永不可改）**：确立了「组件返回 HTML
  字符串，禁用 react-dom/server」的统一规定。该规定在「无轻量 JSX
  渲染器」的前提下成立。
- **doc/16（本档）**：引入轻量 `jsxToString` 后，**对 `TemporaryImageContainer`
  这一个组件**反转 doc/06 的「返回 HTML 字符串」子规定，改回 JSX 函数
  组件。doc/06 的统一规定对**其余组件**仍生效（后续可逐个按本档模式
  反转，每反转一个新建一份独立文档）。

## 4. 执行验证记录

### 4.1 构建

```
$ pnpm run build
$ tsc -b && vite build
✓ 166 modules transformed.
dist/monkey-jhs-disassemble.user.js  485.12 kB │ gzip: 119.73 kB
✓ built in 288ms
```

`tsc -b` 通过 `strict` + `noUnusedLocals` + `noUnusedParameters` +
`noFallthroughCasesInSwitch` + `noUncheckedSideEffectImports`；
`vite build` 成功出包。

### 4.2 产物体积

| 阶段 | 原始 | gzip | vs 基线 |
|------|------|------|---------|
| 基线（无 react-dom/server，doc/06 后） | 481.35 kB | — | — |
| react-dom/server 回归点（doc/06 前） | 911 kB | — | +429.65 kB |
| **本档 jsxToString** | **485.12 kB** | **119.73 kB** | **+3.77 kB（+0.78%）** |

结论：产物体积相对基线仅 +3.77 kB（jsxToString 模块自身 +少量 SWC
JSX runtime 增量），远低于 +452 kB 的 react-dom/server 膨胀。**可接受**
（< 600 kB 阈值）。✓

### 4.3 jsxToString 实现正确性

用 `npx tsx --tsconfig tsconfig.app.json` 跑临时测试脚本（已清理），
覆盖 6 类用例：

| # | 用例 | 输出 | 结论 |
|---|------|------|------|
| 1 | `<TemporaryImageContainer src="...a.jpg" alt="封面" />` | `<div class="temporary-container" style="display:none"><img src="...a.jpg" alt="封面" /></div>` | ✓ 与期望字符级一致 |
| 2 | alt 缺省 | `<div class="temporary-container" style="display:none"><img src="x.jpg" alt="" /></div>` | ✓ 默认空串生效 |
| 3 | 函数组件 + 数组 + 文本转义 + style 对象 camelToKebab | `<ul class="list" style="display:flex;margin-top:10"><li data-id="a">a <b>bold</b></li><li data-id="b&lt;c">...` | ✓ `<`/`>`/`&` 转义、camelCase→kebab-case、数组 map 拼接 |
| 4 | 自闭合 + 布尔属性 + 事件忽略 | `<input type="text" disabled class="inp" data-tip="提示" />` | ✓ void tag 自闭合、`disabled` 裸属性、`onClick` 忽略、`className`→`class` |
| 5 | 文本 `<a> & <b>` | `<span>&lt;a&gt; &amp; &lt;b&gt;</span>` | ✓ 文本节点转义 |
| 6 | null/true/undefined/42/[1,"two",null,<i/>] | `""`/`""`/`""`/`"42"`/`"1two<i></i>"` | ✓ 空值/数字/数组 |

核心场景（临时容器 HTML 输出）字符级匹配期望，实现正确。✓

### 4.4 残留引用核查

- `react-dom/server` / `renderToStaticMarkup`：`src/` 内运行时**零引用**
  （`main.tsx` 已移除 import）。
- 仅 `menu-button-box.tsx` / `rating-bar.tsx` / `status-tag.tsx` 三个
  示范组件的**文档注释**中作为推荐用法出现（与 doc/06 统一规定相悖，
  属本档范围外，列为后续可选清理：可改用 `jsxToString` 或继续保留为
  示范注释）。
- `temporary-image-container.tsx` 注释已改为指向 `jsxToString`。✓

### 4.5 提交

- 主题：`新增轻量 jsxToString 替代 react-dom/server`
- 文件：`src/core/jsx-to-string.ts`（新增）、
  `src/components/temporary-image-container.tsx`（注释更新）、
  `src/main.tsx`（import + 调用点）、`doc/16-jsx-to-string.md`（本档）、
  `doc/README.md`（清单更新）
- hash：见 `git log -1`
