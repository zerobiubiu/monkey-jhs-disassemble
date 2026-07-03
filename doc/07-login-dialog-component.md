# 07 - Top250 登录表单转 LoginDialog 组件

**文档类型**：🔧开发指导
**文档状态**：✅已执行

## 1. 背景

`src/plugins/top250-plugin.ts` 的 `openLoginDialog`（L315-376，原 archetype
`jhs.user.js` L4666）以 `layer.open({ content: '<html 登录表单>' })` 内联
一段较长的 HTML 字符串字面量（用户名/密码输入框 + 登录按钮，含内联 style
与 onfocus/onblur/onmouseover/onmouseout 内联 JS，字符串内以 `\n` / `\'`
转义）。

按 `doc/06-component-html-string.md` 确立的 HTML→组件统一规定（普通函数
返回 HTML 字符串，不用 JSX、不用 `renderToStaticMarkup`），将该内联
HTML 提取为 `src/components/login-dialog.ts` 的 `LoginDialog()` 组件，
插件层改为 `content: LoginDialog()` 消费，与 `temporary-image-container`
保持同一模式。

## 2. 修改方案

### 2.1 新建 `src/components/login-dialog.ts`

- 导出 `LoginDialog(): string`，函数体为模板字符串，原样保留原 content
  的 HTML 结构、id（`username`/`password`/`loginBtn`）、内联 style 与
  内联 JS（onfocus/onblur/onmouseover/onmouseout）。
- 前导/尾部空白（开头换行+16 空格、结尾换行+12 空格）原样保留，与原
  content 字符串零偏差（layer 渲染虽不受空白影响，但遵循"字符串原样
  保留"原则）。
- 本表单无动态值，故无 props（与统一规定第 4 条一致：动态插值用 props，
  无动态值可无 props）。
- 文件用 `.ts`（无 JSX 语法，符合统一规定第 3 条）。
- 补全文件级与函数级 doc-comment（用途/参数/返回值）。

### 2.2 修改 `src/plugins/top250-plugin.ts`

- import 区按字母序于 `../constants/api` 之前插入：
  ```ts
  import { LoginDialog } from "../components/login-dialog";
  ```
- `openLoginDialog` 内 `content` 由字符串字面量改为调用：
  ```ts
  content: LoginDialog(),
  ```
- `success` 回调（`#loginBtn` 点击 / 输入校验 / `/v1/sessions` 提交 /
  令牌写入 / 刷新）保持不变，事件绑定仍由插件持有，组件只负责静态结构。

## 3. 执行验证记录

### 3.1 构建

```
$ pnpm run build
$ tsc -b && vite build
15:42:21 [vite] warning: `esbuild` option was specified by "vite:react-swc" plugin...
vite v8.1.2 building client environment for production...
✓ 63 modules transformed.
computing gzip size...
dist/monkey-jhs-disassemble.user.js  458.18 kB │ gzip: 114.28 kB
✓ built in 263ms
```

`tsc -b` 通过 strict + noUnusedLocals + noUnusedParameters +
noFallthroughCasesInSwitch + noUncheckedSideEffectImports；`vite build`
成功出包。模块数 62 → 63（新增 `login-dialog.ts`）。

### 3.2 产物体积

- 修改前（doc 06 基线）：458.24 kB（gzip 114.26 kB）
- 修改后：**458.18 kB**（gzip 114.28 kB）
- 结论：与基线一致，无膨胀（HTML 字符串由插件文件移至组件文件，等价
  搬迁，体积不变）。✓

### 3.3 行为一致性核查

- `LoginDialog()` 返回的 HTML 字符串与原 content 字面量逐字符一致
  （含前导/尾部空白、内联 style、内联 JS）；layer.open content 渲染
  行为零偏差。✓
- `#loginBtn`/`#username`/`#password` 三个 id 保留，success 回调中的
  jQuery 选择器与提交流程不受影响。✓
- 无 `react-dom/server` 引入，符合统一规定。✓

### 3.4 提交

- 主题：`Top250 登录表单转组件`
- 文件：`src/components/login-dialog.ts`（新增）、
  `src/plugins/top250-plugin.ts`、`doc/07-login-dialog-component.md`、
  `doc/README.md`
- hash：见下文 `git log` 输出
