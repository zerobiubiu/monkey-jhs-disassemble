# 42 - ModalListDisabler 清单模态框禁用插件集成

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 1. 背景

### 1.1 来源
`archetype/modalListDisabler.user.js`（85 行）是独立油猴脚本 `JavDB 清单模态框禁用指定列表` v1.0，
功能：监听「保存到清单」模态框（`#modal-save-list`）出现后，自动禁用指定编号的清单项
（默认 501）。仅当复选框处于未选中态（`!checked`）时才禁用，已选中态不干预，保留用户
取消勾选的能力。与本项目 `jhs.user.js`（鉴黄师）是同一作者 zerobiubiu 的独立脚本。

### 1.2 集成目标
将独立脚本集成到本项目（鉴黄师拆分重构工程），转为 TS 模块化，作为 `BasePlugin`
子类注册到 `PluginManager`，与现有 30 插件并列。要求：
- 转换为 TS 为主的语言（本脚本无 HTML 模板，无需 TSX）
- 保证执行逻辑不冲突（与原脚本零偏差）
- 先保证原项目可扩展性，再扩展功能实现
- 目录结构清晰

### 1.3 可行性分析

| 维度 | 结论 | 依据 |
|------|------|------|
| 站点限定 | ✅ javdb only | 原脚本 `@include https://javdb*.com/*`；main.tsx `if (isJavdbSite)` 块注册 |
| GM_* 依赖 | 无 | 纯 DOM 操作，无需补 grant |
| 数据源 | 无 | 不读 IDB/localStorage |
| 事件源 | 无 | 仅 MutationObserver |
| 网络请求 | 无 | 无 GM_xmlhttpRequest |
| 主项目冲突 | ✅ 天然兼容，正向协同 | 见 §1.4 |

### 1.4 主项目冲突排查

原脚本操作 `#modal-save-list` 模态框内的清单复选框。grep `modal-save-list` 到 `src/`
发现 jhs 主项目也操作此模态框（`DetailPageButtonPlugin._initListPanel`）。

| 冲突类型 | 表现 | 协调策略 |
|----------|------|----------|
| DOM 容器共享 | 两者都操作 `#modal-save-list` | **不冲突，正向协同**：jhs 用 CSS `display:none !important` 隐藏模态框但保留 DOM 供 ajax；本插件在 DOM 内禁用复选框；jhs 的 `cloneNode(true)` 克隆时自动复制 `disabled` 属性到平铺面板 |
| MutationObserver | 本插件监听 body subtree；jhs 监听 listContainer（attributeFilter: ['checked', 'disabled']） | **不冲突**：本插件设 `disabled` → 触发 jhs 的 attributeFilter → sync 克隆——这是正确行为（平铺面板同步禁用） |
| CSS 隐藏 | jhs 用 `display:none !important` 隐藏 `#modal-save-list` | **不影响**：本插件操作 DOM 属性（`input.disabled`），不是视觉效果 |

**结论：天然兼容，正向协同**。本插件禁用模态框内复选框，jhs 的克隆机制（`cloneNode(true)`
+ `attributeFilter: ['checked', 'disabled']`）自动同步 `disabled` 到平铺面板，用户在
平铺面板中也无法勾选被禁用的清单项。

## 2. 方案

### 2.1 目录结构
85 行单文件，不拆子目录，无 CSS：

```
src/plugins/modal-list-disabler-plugin.ts   # 清单模态框禁用插件（extends BasePlugin）
```

### 2.2 关键设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 拆分粒度 | 单文件 | 85 行单一职责，无需子目录拆分 |
| CSS | `initCss()` 返回空串 | 原脚本无 GM_addStyle |
| 闭包状态 → 类字段 | `observer` 转为类私有字段 | 原脚本 IIFE 闭包变量 |
| `container.children` 迭代 | `Array.from(container.children)` | 原脚本 `for...of` 遍历 HTMLCollection；TS 中 `for...of` 遍历 HTMLCollection 需降级 target 或 Array.from，用 Array.from 更安全 |
| `input` 类型断言 | `as HTMLInputElement \| null` | `querySelector` 返回 `Element \| null`，需断言为 HTMLInputElement 才能访问 `disabled`/`checked` 属性 |
| `span.innerHTML` | 保留 | 原脚本用 `innerHTML.match(/\((\d+)\)/)` 提取编号；innerHTML 包含 HTML 标签但正则只匹配 `(数字)` 格式，等价 |

### 2.3 模块拆分映射

| 原脚本段 | 行号 | 本项目模块 |
|----------|------|------------|
| UserScript 头 | L1-12 | vite.config.ts（已含 javdb 站点匹配，无需改） |
| 常量（LOG/TARGET_LIST_ID/CONTAINER_SELECTOR） | L14-25 | 模块级常量 |
| `disableTargetItem()` | L34-52 | `ModalListDisablerPlugin.disableTargetItem()` |
| `tryDisable()` | L57-63 | `ModalListDisablerPlugin.tryDisable()` |
| 页面初始 + MutationObserver | L70-85 | `ModalListDisablerPlugin.handle()` |

## 3. 实施

### 3.1 新增文件

| 文件 | 行数 | 职责 |
|------|------|------|
| `src/plugins/modal-list-disabler-plugin.ts` | ~110 | ModalListDisablerPlugin 类（extends BasePlugin，handle 初始尝试 + MutationObserver + disableTargetItem + tryDisable） |

### 3.2 修改文件

| 文件 | 改动 |
|------|------|
| `src/main.tsx` | import ModalListDisablerPlugin；`if (isJavdbSite)` 块 `manager.register(ModalListDisablerPlugin)`；注释 30→31 插件 |
| `doc/README.md` | 文档清单 + 阅读顺序 + 进度概览更新（plugins 30→31） |

### 3.3 控制流保留要点

1. **TARGET_LIST_ID=501**：目标清单编号，匹配 label 中 `(数字)` 格式
2. **disableTargetItem 仅禁用未选中态**：`!input.disabled && !input.checked` 时才设 `disabled=true`，已选中态不干预
3. **tryDisable 查找容器**：`CONTAINER_SELECTOR` 精确路径查找模态框内清单容器
4. **MutationObserver 监听 body subtree**：模态框动态插入 + 内容异步加载时自动重试

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
dist/monkey-jhs-disassemble.user.js  1,766.75 kB │ gzip: 421.12 kB
✓ built in 1.06s
```
构建成功。产物 1766.75 kB（gzip 421.12 kB），较 doc/41 基线 1765.38 kB
（gzip 420.75 kB）+1.37 kB（gzip +0.37 kB），为单文件插件的合理增量。

### 4.3 userscript metadata 验证
本插件未新增 GM_* API，userscript 头部 grant 无变化。

## 5. 后续

- **运行时验证**：建议在 Tampermonkey 加载构建产物，测试：
  - 详情页点击"保存到清单"触发模态框 ajax 加载
  - 编号 501 的清单项复选框被禁用（灰色不可勾选）
  - 已选中的 501 不被干预（保留已选中态）
  - jhs 平铺面板中 501 也自动禁用（cloneNode(true) 复制 disabled 属性）
  - MutationObserver 监听模态框动态插入后自动禁用
