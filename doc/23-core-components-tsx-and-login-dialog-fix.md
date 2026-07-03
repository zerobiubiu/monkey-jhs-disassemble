# 23 - core 3 组件转 TSX + LoginDialog on* 内联 JS 丢失修复

**文档类型**：🔧开发指导
**文档状态**：✅已执行

## 1. 背景

`doc/16` 落地轻量 `jsxToString`（`src/core/jsx-to-string.ts`），仅依赖 react
的**类型**（`import type`），运行时零依赖。`doc/17`~`22` 先后将列表页 / 鉴定记录 /
黑名单 / 详情页按钮 / 设置弹层 / top250·nav·other-site·preview·want-watched 共
60+ 个 HTML 字符串组件转为 TSX 原生 React 组件，调用点改 `jsxToString(<Comp
{...props} />)`。

本次收尾 `doc/13` 扫描的 core 3 个剩余 HTML 字符串组件（`logger-log-entry` /
`image-preview-img` / `image-preview-error`）转 TSX，调用点 `logger.ts` 与
`image-preview.ts` 因含 JSX 同步 `.ts`→`.tsx`。同时修复 `doc/22` 遗留的
`LoginDialog` onfocus/onblur/onmouseover/onmouseout 内联 JS 丢失问题（jsxToString
忽略 `on*` 事件属性致视觉装饰丢失）。

## 2. 转换清单

### 2.1 组件（.ts → .tsx，删原 .ts）

| 旧文件 | 新文件 | 说明 |
|--------|--------|------|
| `logger-log-entry.ts` | `logger-log-entry.tsx` | 3 props（timeStr/messageType/message）；时间戳 span + 消息 span（`data-type`）；message 为已格式化 HTML 字符串（含 `<a>`/`<br/>`），用 `dangerouslySetInnerHTML` 原样注入不转义；前后/中间 `\n` + 缩进空格以字符串字面量 `{INDENT_*}` 保留（JSX 编译器会去除纯空白子节点，故必须显式字符串注入） |
| `image-preview-img.ts` | `image-preview-img.tsx` | 1 prop（src）；`<img src alt="预览图" />`（void element 自闭合，与浏览器 innerHTML 解析等价） |
| `image-preview-error.ts` | `image-preview-error.tsx` | 无 props；`<div style={{padding:'10px',color:'#f00'}}>图片加载失败</div>`（style 对象化，值原样保留） |

### 2.2 调用点（core .ts → .tsx，调用改 jsxToString）

| 旧文件 | 新文件 | 调用数 | 说明 |
|--------|--------|--------|------|
| `src/core/logger.ts` | `src/core/logger.tsx` | 1 | `_createLogElement` 中 `el.innerHTML = LoggerLogEntry({...})` → `el.innerHTML = jsxToString(<LoggerLogEntry timeStr={...} messageType={...} message={...} />)`；import `{ jsxToString } from "./jsx-to-string"` |
| `src/core/image-preview.ts` | `src/core/image-preview.tsx` | 2 | `handleMouseEnter` 中 `preview.innerHTML = ImagePreviewImg({src})` / `ImagePreviewError()` → `jsxToString(<ImagePreviewImg src={...} />)` / `jsxToString(<ImagePreviewError />)`；import `{ jsxToString } from "./jsx-to-string"` |

注：`main.tsx` / `list-page-plugin.tsx` / `setting-plugin.tsx` 对 `logger` /
`image-preview` 的 import 路径不含扩展名，`.ts`→`.tsx` 后由 TS bundler
resolution 自动解析，无需改动。

## 3. LoginDialog on* 内联 JS 丢失修复

### 3.1 问题

`doc/22` 将 `login-dialog.ts`→`.tsx` 时，原版内联 `onfocus`/`onblur`/
`onmouseover`/`onmouseout` JS（来自 `archetype/jhs.user.js` L4667-4685 的
`layer.open content` 字符串）被 jsxToString 忽略（`renderAttrs` 跳过 `on*`
属性，见 `src/core/jsx-to-string.ts` L150）。DOM 结构与 id/类名/style 零偏差，
但视觉装饰丢失：

- `#username` / `#password` 输入框 focus 时 borderColor `#4a8bfc`、background `#fff`；
  blur 时恢复 `#e0e0e0` / `#f9f9f9`。
- `#loginBtn` mouseover 时 background `#3a7be0`；mouseout 时恢复 `#4a8bfc`。

### 3.2 修复方案

在 `src/plugins/top250-plugin.tsx` 的 `openLoginDialog` `success` 回调顶部
（`$("#loginBtn").click(...)` 之前），用 jQuery `.on(...)` 链式绑定等价事件，
与原内联 JS 行为完全一致：

```ts
$("#username, #password")
    .on("focus", function (this: HTMLElement) {
        this.style.borderColor = "#4a8bfc";
        this.style.background = "#fff";
    })
    .on("blur", function (this: HTMLElement) {
        this.style.borderColor = "#e0e0e0";
        this.style.background = "#f9f9f9";
    });
$("#loginBtn")
    .on("mouseover", function (this: HTMLElement) {
        this.style.background = "#3a7be0";
    })
    .on("mouseout", function (this: HTMLElement) {
        this.style.background = "#4a8bfc";
    });
```

要点：

- **`function` 非 arrow**：jQuery `on` 回调内 `this` 为 DOM 元素，arrow function
  的 `this` 词法绑定外层（无 `style` 属性），必须用 `function` 表达式。
- **`this: HTMLElement` 显式标注**：tsconfig `strict` 含 `noImplicitThis`，
  不标注会报 `'this' implicitly has type 'any'`。`HTMLElement.style` 为
  `CSSStyleDeclaration`，可读写 `borderColor` / `background`（string）。
  与项目已有惯例 `detail-page-button-plugin.tsx` L1438 `function (this: any)`
  一致，本处用更精确的 `HTMLElement` 替代 `any`。
- **绑定时机**：在 `success` 回调内（layer 已渲染 DOM 后），与原版内联
  `onfocus` 属性在 DOM 解析时即生效的时机等价（layer content 注入后立即绑定）。
- **不修改 `login-dialog.tsx` 组件本身**：组件只负责静态结构，事件绑定由
  调用方（`openLoginDialog`）持有，与 `doc/22` 的"组件只负责静态结构"
  设计一致。

### 3.3 同步更新

`src/components/login-dialog.tsx` 头部注释原"视觉装饰丢失"改为"视觉装饰
由 `top250-plugin.tsx` 的 success 回调用 jQuery `.on(...)` 等价补回"。

## 4. 执行验证记录

### 4.1 build

```
$ pnpm run build
$ tsc -b && vite build
✓ 166 modules transformed.
dist/monkey-jhs-disassemble.user.js  518.40 kB │ gzip: 122.96 kB
✓ built in 344ms
```

tsc strict 通过（noUnusedLocals/noUnusedParameters/noFallthroughCasesInSwitch/
noImplicitThis/noUncheckedSideEffectImports）。

### 4.2 产物体积

| 阶段 | 原始 | gzip |
|------|------|------|
| doc/22 后 | 517.33 kB | 122.79 kB |
| **doc/23（本档）** | **518.40 kB** | **122.96 kB** |

较 doc/22 +1.07 kB（3 个组件 JSX runtime + 2 个 core 文件 .ts→.tsx +
LoginDialog jQuery `.on` 绑定代码段），< 600 kB 阈值。✓

### 4.3 行为一致性

- 3 个 core 组件 HTML 结构/类名/style 值与原 .ts 零偏差：
  - `LoggerLogEntry`：`console-logger-timestamp` / `console-logger-message`
    类名、`data-type` 属性、`\n` + 缩进空格（字符串字面量注入保留）、
    message 以 `dangerouslySetInnerHTML` 原样注入（`<a>`/`<br/>` 不转义）。
  - `ImagePreviewImg`：`<img src alt="预览图" />`（void element 自闭合，
    浏览器 innerHTML 解析与原 `<img src alt="预览图">` 等价）。
  - `ImagePreviewError`：`padding:10px;color:#f00`（camelCase→kebab-case，
    无末尾 `;`，与已有 review/related 组件一致，DOM 等价）。
- `LoginDialog` on* 内联 JS 丢失已由 `top250-plugin.tsx` success 回调
  jQuery `.on(...)` 等价补回：输入框 focus/blur 切 borderColor/background、
  #loginBtn mouseover/mouseout 切 background，行为与原版零偏差。
- 调用点 `logger.tsx` / `image-preview.tsx` import 路径不变（bundler resolution
  自动解析 .tsx），`main.tsx` / `list-page-plugin.tsx` / `setting-plugin.tsx`
  对两者的 import 无需改动。

### 4.4 提交

- 主题：`core 3 组件转 TSX 并修复 LoginDialog on* 内联 JS 丢失`
- commit：见 `git log --oneline -3` 输出
