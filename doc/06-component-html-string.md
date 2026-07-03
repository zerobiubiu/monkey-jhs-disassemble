# 06 - 组件返回 HTML 字符串，移除 react-dom/server

**文档类型**：🔧开发指导
**文档状态**：✅已执行

## 1. 背景

`src/main.tsx` 在 787259a（main.tsx CSS/HTML 提取为独立文件/组件）提取
`TemporaryImageContainer` 时引入了 `import { renderToStaticMarkup } from "react-dom/server";`，
将组件 JSX 转为 HTML 字符串供 `$(html)` 消费。该导入触发 `react-dom/server`
整包打入产物，导致 `dist/monkey-jhs-disassemble.user.js` 从 459.58 kB
膨胀至 911 kB（+98%），不可接受。

根因：`react-dom/server` 的 `renderToStaticMarkup` 携带大量服务端渲染依赖，
vite-plugin-monkey 无法 tree-shake 掉其内部模块。

## 2. 统一规定（后续所有 HTML→组件转换遵循）

- 组件为普通函数，返回 HTML 字符串（模板拼接，含 `${props.x}` 插值）。
- **不用 JSX、不用 renderToStaticMarkup**（避免引入 react-dom/server 导致产物膨胀）。
- 文件可用 `.ts`（无 JSX）或 `.tsx`（但无 JSX 语法）。
- 插件 `layer.open({ content })` 直接用 `ComponentName(props)` 返回的字符串。
- 属性值不做转义，与原始 jQuery `.append(htmlString)` 行为一致（与原脚本零偏差）。

## 3. 修改方案

### 3.1 `src/components/temporary-image-container.tsx`

- 删除 `import type { CSSProperties } from "react";` 与 `CONTAINER_STYLE` 常量。
- 函数签名由返回 JSX 改为返回 `string`：
  ```ts
  export function TemporaryImageContainer({
      src,
      alt = "",
  }: TemporaryImageContainerProps): string {
      return `<div class="temporary-container" style="display:none;"><img src="${src}" alt="${alt}"></div>`;
  }
  ```
- 保留 `TemporaryImageContainerProps` 接口与 doc-comment（用途/参数/返回值）。
- 文件仍用 `.tsx` 扩展名（无 JSX 语法，符合统一规定）。
- 属性值不转义，行为与原始 `$('<div...>').append(\`<img src="${t}" alt="${n}">\`)` 一致；
  相比此前的 `renderToStaticMarkup`（React 会转义属性），本修改反而回归原脚本行为。

### 3.2 `src/main.tsx`

- 删除 `import { renderToStaticMarkup } from "react-dom/server";`。
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
      TemporaryImageContainer({ src: String(t), alt: n }),
  ).appendTo("body");
  ```
- 移除后 `main.tsx` 不再含任何 JSX；`react-dom/server` 不再被打包，
  仅 `react`（由 menu-button-box/rating-bar/status-tag 三个示范组件引用）保留，
  与 459 kB 基线一致。

## 4. 执行验证记录

### 4.1 构建

```
$ pnpm run build
$ tsc -b && vite build
✓ 62 modules transformed.
dist/monkey-jhs-disassemble.user.js  458.24 kB │ gzip: 114.26 kB
✓ built in 282ms
```

`tsc -b` 通过 strict + noUnusedLocals + noUnusedParameters +
noFallthroughCasesInSwitch + noUncheckedSideEffectImports；`vite build` 成功出包。

### 4.2 产物体积

- 修改前（911 kB 回归点）：911 kB
- 修改后：**458.24 kB**（gzip 114.26 kB）
- 基线（doc 05 / 68f7ff1）：462.66 kB（gzip 113.30 kB）
- 结论：产物体积回落至 ~460 kB 基线，膨胀消除。✓

### 4.3 残留引用核查

`renderToStaticMarkup` / `react-dom/server` 在 `src/` 内仅剩
`menu-button-box.tsx` / `rating-bar.tsx` / `status-tag.tsx` 三个示范组件的
**文档注释**中作为推荐用法出现（与新统一规定相悖，属本次范围外，列为后续可选清理）；
`temporary-image-container.tsx` 的注释为"禁止使用"说明，符合规定。
运行时已无任何 `react-dom/server` 引用。✓

### 4.4 提交

- 主题：`修复:组件返回 HTML 字符串,移除 react-dom/server`
- 文件：`src/components/temporary-image-container.tsx`、`src/main.tsx`、
  `doc/06-component-html-string.md`、`doc/README.md`
- hash：见 `git log -1`（提交哈希在构建产物报告中同步给出）
