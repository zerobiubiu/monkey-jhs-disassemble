---
name: userscript-integration
description: 将 archetype/ 下的独立油猴脚本（.user.js）转换集成到本 vite-plugin-monkey + React + TypeScript 工程中，作为 BasePlugin 子类注册到 PluginManager。当用户说"转换/集成 X 脚本"、"把 X.user.js 集成进来"、"像 doc/25 那样转换"时加载本 skill。覆盖：可行性分析、模块拆分、TS/TSX 转换、CSS 注入、GM_* grant 补全、main.tsx 注册、文档撰写、tsc + vite build 验证。
---

# 独立油猴脚本集成到工程（BasePlugin 模式）

本 skill 描述把 `archetype/<name>.user.js` 独立油猴脚本集成到 `monkey-jhs-disassemble`工程的标准化流程。**目标是"零偏差"——打包产物在功能逻辑与执行效果上与原始脚本一致**，先保证可扩展性，再扩展功能。

## 何时使用

触发条件（任一）：
- 用户说"转换/集成 X 脚本"、"把 X.user.js 集成进来"
- 用户引用 `archetype/<name>.user.js` 并要求"像 doc/25 那样处理"
- 用户要求"标准化这个转换流程"

**不要用于**：修改已集成插件的行为（直接编辑即可）、bug 修复（走 doc/NN-backend-mod.md 流程）。

## 前置知识（必读）

工程关键结构（转换前必须理解）：

| 模块 | 路径 | 作用 |
|------|------|------|
| 入口 | `src/main.tsx` | 启动序列；`if (isJavdbSite)` 块内 `manager.register(XxxPlugin)` 注册插件 |
| 插件基类 | `src/plugins/base-plugin.ts` | `BasePlugin`：`getName()`/`initCss()`/`handle()` 三方法 + `getBean()`/`getPageInfo()` 等辅助 |
| 插件管理器 | `src/plugins/plugin-manager.ts` | `register()` 去重、`processCss()` 注入样式、`processPlugins()` 并发执行 handle |
| CSS 注入 | `src/core/style-injector.ts` | `injectCss(css)`；插件 CSS 走 `initCss()` 返回字符串由 `utils.insertStyle` 注入 |
| 全局类型 | `src/types/globals.d.ts` | `declare const GM_xmlhttpRequest` 等 GM_* API；`$`/`layer`/`Tabulator` 等全局库 |
| grant 配置 | `vite.config.ts` | `userscript.grant` 数组；新增 GM_* 必须补 grant + globals.d.ts |
| 站点常量 | `src/constants/site.ts` | `isJavdbSite`/`currentHref`/`JAVDB` 等 |
| JSX 渲染 | `src/core/jsx-to-string.ts` | `jsxToString(<Comp />)` 返回 HTML 字符串（替代 react-dom/server） |
| 文档 | `doc/NN-描述.md` | 编号递增；头部元数据块 + 执行验证记录（见 `doc/README.md`） |

**已集成的独立脚本参考样本**：
- 简单单文件：无（最简单的已集成插件都来自主脚本拆分，参考 `src/plugins/auto-page-plugin.ts`）
- 复杂独立脚本拆分：`src/plugins/rating-display/`（6 模块子目录，对应 `archetype/jhsRatingDisplay.user.js`，文档 `doc/25-rating-display-integration.md`）—— **最贴近本 skill 场景的样本**

## 集成流程（7 步）

### 第 1 步：可行性分析（集成前调研）

**不要直接开写**。先对原脚本做 5 维度调研，输出一张决策表。这是 doc/25 §1.3 的模式。

读取 `archetype/<name>.user.js` 全文，回答：

| 维度 | 问题 | 判定方法 |
|------|------|----------|
| 站点限定 | 是否仅 javdb？还是多站？ | 看 `@include`/`@match` 头；多站则需在插件内分支 |
| GM_* 依赖 | 用了哪些 GM API？ | grep `GM_` 全文；逐一对照 `vite.config.ts` grant 数组与 `globals.d.ts` 声明 |
| 数据源 | 是否读 IndexedDB/localStorage？键名是什么？ | grep `indexedDB`/`localStorage`/`GM_setValue`；对照 `storageManager` 是否同库同键 |
| 事件源 | 是否监听 CustomEvent/BroadcastChannel/storage？ | grep `addEventListener`/`BroadcastChannel`；判断事件源在本项目是否已存在 |
| 网络请求 | 用 `GM_xmlhttpRequest` 还是 `fetch`？语义是否匹配 `gm-http.gmRequest`？ | gmRequest 对非 2xx reject 且自动 JSON.parse；抓 HTML/只判 status===200 的场景**不要复用**，直接用全局 `GM_xmlhttpRequest` |

**关键决策原则**：
1. **数据源同库同键 → 复用 `storageManager`**（避免重复开 IDB 连接）。如 `JAV-JHS/appData/car_list` 与 `storageManager.getCarList()` 同源。
2. **`storageManager.forage` 为 private → 保留原生 `indexedDB` API**（寄生 IDB 无法通过 forage 访问时）。
3. **`GM_addStyle` → 改走 `initCss()`**（项目既定模式，不引入 grant）。
4. **`GM_registerMenuCommand` → 补 grant + globals.d.ts 声明**（保留原菜单）。
5. **innerHTML 模板字符串 → 改 `jsxToString(<TSX />)`**（满足 TSX 化要求，DOM 等价；状态切换保留 DOM 操作）。
6. **不复用 `gm-http.gmRequest` 当语义不匹配时**（gmRequest 自动 JSON.parse + 非 2xx reject；抓 HTML 场景直接用全局 `GM_xmlhttpRequest`）。

### 第 2 步：模块拆分设计

按职责拆分，**无循环依赖**。单文件脚本（< 200 行）可直接 1 个 plugin 文件；复杂脚本（≥ 200 行或多职责）拆子目录。

**子目录拆分模式**（参考 `rating-display/`）：

```
src/plugins/<plugin-name>/
├── <plugin-name>-config.ts        # CONFIG 常量（调试开关/IDB/选择器/请求控制）
├── <plugin-name>-utils.ts         # Utils 工具（log/debounce/limiter/选择器辅助）
├── <plugin-name>-cache.ts         # 缓存（IDB/localStorage 读写，复用 storageManager 时在此）
├── <plugin-name>-net.ts           # 网络请求（限流 + 解析 + fetch）
├── <plugin-name>-renderer.tsx     # DOM 操作（jsxToString 生成 innerHTML）
└── <plugin-name>-plugin.tsx       # Core 主流程 + 插件入口（extends BasePlugin）

src/styles/<plugin-name>.css       # 样式（?raw import via initCss）
```

依赖方向（无循环）：
```
<plugin-name>-plugin ──→ <plugin-name>-net ──→ <plugin-name>-renderer ──→ <plugin-name>-utils ──→ <plugin-name>-config
        │                   └──→ <plugin-name>-cache ──────────────┘
        ├──→ <plugin-name>-cache
        ├──→ <plugin-name>-renderer
        └──→ <plugin-name>-utils
```

**简单脚本（如 keyPageTurning 60 行）**：直接 `src/plugins/<plugin-name>-plugin.ts` 单文件即可，无需子目录。

输出一张"原脚本段 → 本项目模块"映射表（doc/25 §2.3 模式）。

### 第 3 步：编写代码

#### 3.1 插件类骨架

参考 `templates/plugin-template.tsx`。核心结构：

```typescript
import { BasePlugin } from '../base-plugin';
import <pluginName>CssRaw from '../../styles/<plugin-name>.css?raw';

export class <PluginName>Plugin extends BasePlugin {
    getName(): string { return '<PluginName>Plugin'; }
    async initCss(): Promise<string> { return <pluginName>CssRaw; }
    async handle(): Promise<void> { /* 主逻辑 */ }
}
```

**注释规范**（AGENTS.md 强制）：
- 文件头：说明来源（`archetype/X.user.js` 原行号）、功能、集成方式
- 每个方法：doc-comment 说明用途、参数、返回值、对应原脚本行号
- 关键决策：行内注释说明"为什么这样做"（如"不复用 gmRequest，语义不匹配"）

#### 3.2 CSS 提取

- 原脚本 `GM_addStyle('...')` 的 CSS 字符串 → `src/styles/<plugin-name>.css`
- 插件内 `import <name>CssRaw from '../../styles/<plugin-name>.css?raw'`
- `initCss()` 返回该 raw 字符串
- **字符级对齐**：CSS 必须与原版运行时注入值逐字符一致（LF、首尾空白、行尾空格、中文注释保留）；见 doc/14

#### 3.3 innerHTML → jsxToString

原脚本用模板字符串拼 HTML 注入的，转 TSX：

```typescript
import { jsxToString } from '../../core/jsx-to-string';

function RatingTag({ score }: { score: number }) {
    return <span className="jhs-rating">{'★'.repeat(score)}</span>;
}

// 替代原 el.innerHTML = `<span class="jhs-rating">${'★'.repeat(score)}</span>`
el.innerHTML = jsxToString(<RatingTag score={score} />);
```

**jsxToString 注意事项**（见 `src/core/jsx-to-string.ts`）：
- `className` → `class`
- `style` 对象 → CSS 字符串（camelCase→kebab-case）
- 布尔属性：`true` → 裸属性；`false` → 省略
- `on*` 事件 → 忽略（需用 jQuery `.on()` 补回，见 doc/23 LoginDialog 修复）
- `dangerouslySetInnerHTML` → 原始 HTML 注入
- inline-block 元素间空白会丢失，需手动 `{' '}`（见 doc/32）

#### 3.4 GM_* grant 补全

对每个原脚本用到但 `vite.config.ts` grant 数组没有的 GM API：

1. `vite.config.ts` 的 `grant` 数组加该 API 名
2. `src/types/globals.d.ts` 加 `declare const GM_xxx: any;`

当前已补齐的 grant（截至 doc/33）：
```
GM_xmlhttpRequest / GM_openInTab / GM_setValue / GM_addValueChangeListener /
GM_registerMenuCommand / unsafeWindow
```

### 第 4 步：main.tsx 注册

在 `src/main.tsx` 的 `if (isJavdbSite)` 块内，按现有插件顺序后追加：

```typescript
import { <PluginName>Plugin } from './plugins/<plugin-name>-plugin';  // 或子目录路径
// ...
if (isJavdbSite) {
    // ... 现有 24 插件
    manager.register(<PluginName>Plugin);  // 新增
}
```

同步更新：
- 顶部注释"注册 N 插件"→ N+1
- `doc/README.md` 当前进度概览的 plugins 计数

### 第 5 步：撰写文档

在 `doc/` 下新建 `NN-<plugin-name>-integration.md`，NN 为下一个编号（查 `doc/` 最大编号 +1）。

**文档结构**（严格遵循 AGENTS.md 文档组织规范 + doc/25 模式）：

```markdown
# NN - <PluginName> 插件集成

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 1. 背景
### 1.1 来源
（原脚本路径、行数、功能描述、与本项目的关系）
### 1.2 集成目标
（转为 TS/TSX，作为 BasePlugin 子类注册，与现有 N 插件并列）
### 1.3 可行性分析
（5 维度决策表：数据源/事件源/GM_API/CSS/网络请求）

## 2. 方案
### 2.1 目录结构
（新建文件树 + 依赖方向图）
### 2.2 关键设计决策
（决策点 | 选择 | 理由 表格）
### 2.3 模块拆分映射
（原脚本段 | 行号 | 本项目模块 表格）

## 3. 实施
### 3.1 新增文件
（文件 | 行数 | 职责 表格）
### 3.2 修改文件
（文件 | 改动 表格）
### 3.3 控制流保留要点
（编号列出原脚本的关键控制流，逐条说明如何保留）

## 4. 执行验证记录
### 4.1 类型检查
（tsc -b 输出）
### 4.2 构建
（vite build 输出 + 产物体积 + 与基线 delta）
### 4.3 userscript metadata 验证
（grant / 菜单命令等）

## 5. 后续
（运行时验证建议 + dead code 说明）
```

同步更新 `doc/README.md`：
- 文档清单表追加一行
- 阅读顺序追加一条
- 当前进度概览的 plugins 计数 +1、build 体积更新

### 第 6 步：验证

**必须执行，不等用户提醒**（AGENTS.md 强制）：

```bash
# 6.1 类型检查
bunx tsc -b
# 期望：无输出，退出码 0

# 6.2 构建
bunx vite build
# 期望：✓ built，产物体积合理（与上一基线 delta 应为新增模块的合理增量）
```

若失败：
- 类型错误 → 修 TS 类型（常见：`instanceof Element` 类型守护、`any` 兜底）
- 构建失败 → 看 lightningcss 警告（IE hack 无害）、循环依赖、import 路径

**不要**为了通过 tsc 而简化或删减有意义的代码（AGENTS.md：完整正确的代码 > 表面干净的代码）。

### 第 7 步：执行验证记录回填

验证通过后，把 §4 的实际输出回填到文档（tsc 输出、vite build 产物体积 + delta），状态从 🔧待执行 改为 ✅已执行。这是 AGENTS.md 的强制要求——"后端修改文档需附执行验证"。

## 关键约束（不可违反）

1. **零偏差**：转换后的执行逻辑必须与原脚本一致。任何行为偏离必须在文档 §2.2 明确标注为"用户要求的行为改进"（参考 doc/33）。
2. **不复用不匹配的语义**：`gm-http.gmRequest` 适合 JSON API（自动 parse + 非 2xx reject）；抓 HTML/只判 status===200 的场景直接用全局 `GM_xmlhttpRequest`。
3. **CSS 走 initCss，不走 GM_addStyle**：项目既定模式。
4. **grant 必须补全**：用了 GM_* 就必须在 vite.config + globals.d.ts 两处都补。
5. **文档不可回头改**：已执行的 doc 永不可改，后续变更新建递增编号文档（AGENTS.md migration 原则）。
6. **注释中文**：所有注释、文档用简体中文（AGENTS.md）。
7. **测试数据清理**：验证产生的临时数据自行清理（AGENTS.md）。

## 模板与参考

本 skill 目录下的辅助文件：

- `templates/plugin-template.md` —— 插件类骨架模板（单文件版，````tsx` 代码块包裹，用 `.md` 避免占位符 `<pluginName>` 被 TS 语言服务解析为 JSX 报错）
- `templates/plugin-subdir-template.md` —— 子目录拆分模板（复杂脚本用）
- `templates/doc-template.md` —— 集成文档模板
- `references/decision-matrix.md` —— 常见决策点的快速查表
- `references/checklist.md` —— 集成完成检查清单

**注意**：模板文件统一用 `.md` + 代码块包裹，**不要**用 `.tsx`/`.ts` 扩展名——占位符 `<pluginName>`/`<PluginName>` 会被 TS 语言服务当成 JSX 元素解析导致语法错误（`tsc -b` 不报错因为 `.agents/` 不在 `include: ["src"]` 内，但 Zed 的 TS 语言服务会扫描项目所有 `.tsx` 文件做诊断）。

**最佳参考样本**：
- 复杂独立脚本集成：`src/plugins/rating-display/` + `doc/25-rating-display-integration.md`（6 模块子目录，最贴近本 skill 场景）
- 简单插件：`src/plugins/auto-page-plugin.ts`（单文件，BasePlugin 三方法 + CSS ?raw import）
- TSX 转换：doc/17~23（HTML 字符串 → jsxToString 的 63 个组件转换记录）

## 执行示例

用户说"把 `archetype/keyPageTurning.user.js` 集成进来"时，agent 应：

1. 读 `archetype/keyPageTurning.user.js`（60 行，键盘左右翻页）
2. 5 维度调研：javdb only / 无 GM_API / 无数据源 / 无事件源 / 无网络请求 → 简单场景
3. 拆分决策：60 行单文件，不拆子目录 → `src/plugins/key-page-turning-plugin.ts`
4. 编码：`KeyPageTurningPlugin extends BasePlugin`，`handle()` 注册 keydown/keyup 监听，`isTyping()`/`safeClick()` 原样保留
5. 注册：`main.tsx` 加 `manager.register(KeyPageTurningPlugin)`，注释 24→25
6. 文档：`doc/34-key-page-turning-integration.md`
7. 验证：`bunx tsc -b && bunx vite build`
8. 回填 §4 验证记录，状态 ✅已执行

## 失败处理

- **原脚本依赖本项目未实现的接口**：先评估是否能复用现有 `storageManager`/`gmHttp`/`utils`；不能则需先补基础设施（走单独的 doc/NN-backend-mod.md）
- **tsc 报错无法修复**：1-2 次尝试后向用户说明剩余错误，不强行删代码
- **行为偏离原脚本**：在文档 §2.2 明确标注"偏离原版，属用户要求的行为改进"（参考 doc/33 模式）
