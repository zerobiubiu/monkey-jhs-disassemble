# 34 - KeyPageTurning 键盘翻页插件集成

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 1. 背景

### 1.1 来源
`archetype/keyPageTurning.user.js`（60 行）是独立油猴脚本 `Javdb 键盘翻页` v1.0，
功能：对 Javdb 的内容使用左右方向键来翻页（点击分页栏的 `pagination-previous`/
`pagination-next` 链接）。与本项目 `jhs.user.js`（鉴黄师）是同一作者 zerobiubiu
的独立脚本，完全独立，不读 IDB、不监听事件、不发网络请求，纯 DOM 事件监听。

### 1.2 集成目标
将独立脚本集成到本项目（鉴黄师拆分重构工程），转为 TS 模块化，作为 `BasePlugin`
子类注册到 `PluginManager`，与现有 24 插件并列。要求：
- 转换为 TS 为主的语言（本脚本无 HTML 模板，无需 TSX）
- 保证执行逻辑不冲突（与原脚本零偏差）
- 先保证原项目可扩展性，再扩展功能实现
- 目录结构清晰

### 1.3 可行性分析（集成前调研）

| 维度 | 结论 | 依据 |
|------|------|------|
| 站点限定 | ✅ javdb only | 原脚本 `@include https://javdb*.com/*`；main.tsx `if (isJavdbSite)` 块注册 |
| 数据源 | 无 | 不读 IDB/localStorage |
| 事件源 | 无 | 仅 `window.keydown/keyup`，不监听 CustomEvent/BroadcastChannel |
| GM_* API | 无 | 纯 DOM 操作，无需补 grant |
| CSS | 无 | 无 GM_addStyle，`initCss` 返回空串 |
| 网络请求 | 无 | 无 GM_xmlhttpRequest |
| 详情页排除 | ✅ handle 内守卫 | 原脚本 `@exclude /v/*`；本项目所有插件注册在 `if (isJavdbSite)` 块不区分页面，故 `handle()` 内加 `if (window.isDetailPage) return;` 等价实现 |

## 2. 方案

### 2.1 目录结构
60 行单文件，不拆子目录：

```
src/plugins/key-page-turning-plugin.ts   # 键盘翻页插件（extends BasePlugin）
```

无 CSS 文件（`initCss` 返回空串）。无 globals.d.ts / vite.config 改动（无 GM_*）。

### 2.2 关键设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 拆分粒度 | 单文件 | 60 行单一职责，无需子目录拆分 |
| 详情页排除 | `handle()` 内 `if (window.isDetailPage) return;` | 原脚本靠 `@exclude /v/*` 在 userscript 层排除；本项目所有插件注册在 `if (isJavdbSite)` 块不区分页面，需代码内守卫等价实现 |
| CSS | `initCss()` 返回空串 | 原脚本无 GM_addStyle；BasePlugin 要求实现 initCss，返回空串表示无样式 |
| 锁状态 | 类私有字段 `lockLeft`/`lockRight` | 原脚本闭包变量，迁移为类字段；防长按方向键连发 |
| 选择器 | 顶层常量保留 | 原脚本 `SELECTOR_LEFT`/`SELECTOR_RIGHT` 原样保留，注释标明可按页面实际修改 |
| `document.activeElement` 类型 | `as HTMLElement \| null` | TS 中 `activeElement` 类型为 `Element \| null`，无 `isContentEditable`/`tagName` 属性需 HTMLElement；运行时几乎总是 HTMLElement，断言合理 |

### 2.3 模块拆分映射

| 原脚本段 | 行号 | 本项目模块 |
|----------|------|------------|
| UserScript 头 | L1-9 | vite.config.ts（已含 javdb 站点匹配，无需改） |
| `SELECTOR_LEFT/RIGHT` 常量 | L13-14 | `key-page-turning-plugin.ts` 顶层常量 |
| `isTyping()` | L8-15 | `KeyPageTurningPlugin.isTyping()` 私有方法 |
| `safeClick()` | L17-25 | `KeyPageTurningPlugin.safeClick()` 私有方法 |
| `lockLeft/lockRight` | L29-30 | `KeyPageTurningPlugin.lockLeft/lockRight` 私有字段 |
| `keydown` 监听 | L32-50 | `KeyPageTurningPlugin.handle()` 内 |
| `keyup` 监听 | L52-55 | `KeyPageTurningPlugin.handle()` 内 |

## 3. 实施

### 3.1 新增文件

| 文件 | 行数 | 职责 |
|------|------|------|
| `src/plugins/key-page-turning-plugin.ts` | ~110 | KeyPageTurningPlugin 类（extends BasePlugin，handle 注册键盘监听 + isTyping + safeClick） |

### 3.2 修改文件

| 文件 | 改动 |
|------|------|
| `src/main.tsx` | import KeyPageTurningPlugin；`if (isJavdbSite)` 块 `manager.register(KeyPageTurningPlugin)`；注释 24→25 插件 |
| `doc/README.md` | 文档清单 + 阅读顺序 + 进度概览更新（plugins 24→25） |

### 3.3 控制流保留要点

1. **isTyping 焦点守卫**：焦点在 `input`/`textarea`/`select` 或 `contentEditable` 元素时不拦截方向键，避免输入场景误触翻页
2. **safeClick 双策略**：优先 `a.click()` 原生方法；无 `click` 方法时兜底 `new MouseEvent('click', {bubbles, cancelable})` + `dispatchEvent`（注：`isTrusted` 无法伪造）
3. **长按连发锁**：`lockLeft`/`lockRight` 初始 false；keydown 触发后置 true 阻止连发；keyup 置 false 解锁，需按下再抬起才接受下一次
4. **preventDefault**：命中翻页链接时 `e.preventDefault()` 阻止浏览器默认滚动行为；监听以 `{ passive: false }` 注册以允许 preventDefault
5. **详情页排除**：`handle()` 首行 `if (window.isDetailPage) return;` 等价原脚本 `@exclude /v/*`

## 4. 执行验证记录

### 4.1 类型检查
```bash
$ bunx tsc -b
（无输出，退出码 0）
```
全量类型检查通过，无错误无警告。

### 4.2 构建
```bash
$ bunx vite build
dist/monkey-jhs-disassemble.user.js  1,707.08 kB │ gzip: 406.79 kB
✓ built in 1.01s
```
构建成功。产物 1707.08 kB（gzip 406.79 kB），较 doc/33 基线 1705.49 kB
（gzip 406.39 kB）+1.59 kB（gzip +0.40 kB），为键盘翻页插件单文件的合理增量。

警告仍为 layer.css IE hack（`*display`/`*zoom`/`*position`/`_display`，doc/24 已记录，
lightningcss errorRecovery 容错 strip，无害）。

### 4.3 userscript metadata 验证
本插件未新增 GM_* API，userscript 头部 grant 无变化。

## 5. 后续

- **运行时验证**：建议在 Tampermonkey 加载构建产物，测试：
  - 列表页按 ←/→ 方向键翻页
  - 焦点在搜索框时方向键不触发翻页
  - 长按方向键不连发（需抬起再按）
  - 详情页不触发翻页（守卫生效）
- **选择器维护**：若 javdb 页面结构变更，修改 `SELECTOR_LEFT`/`SELECTOR_RIGHT` 顶层常量即可
