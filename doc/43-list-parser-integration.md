# 43 - ListParser 清单解析器插件集成

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 1. 背景

### 1.1 来源
`archetype/listParser.user.js`（75 行）是独立油猴脚本 `清单解析器` v1.0，功能：在
清单详情页（`/lists/*`）的演员名称 span 后插入"唤醒解析器"按钮，点击通过
`lists://?url=<URL>` 自定义协议唤醒外部解析器应用。与本项目 `jhs.user.js`（鉴黄师）
是同一作者 zerobiubiu 的独立脚本。

### 1.2 集成目标
将独立脚本集成到本项目（鉴黄师拆分重构工程），转为 TS 模块化，作为 `BasePlugin`
子类注册到 `PluginManager`，与现有 31 插件并列。要求：
- 转换为 TS 为主的语言（本脚本无 HTML 模板，无需 TSX）
- 保证执行逻辑不冲突（与原脚本零偏差）
- 先保证原项目可扩展性，再扩展功能实现
- 目录结构清晰

### 1.3 可行性分析

| 维度 | 结论 | 依据 |
|------|------|------|
| 站点限定 | ✅ javdb only，仅 `/lists/*`（清单详情页） | 原脚本 `@include javdb*.com/lists/*`；`handle()` 内加路径守卫 `/lists/` 且排除 `/users/` |
| GM_* 依赖 | 无 | 纯 DOM 操作 |
| 数据源 | 无 | 不读 IDB/localStorage |
| 事件源 | 无 | 仅 click + mouseenter/mouseleave |
| 网络请求 | 无 | 无 GM_xmlhttpRequest |
| 主项目冲突 | ✅ 无冲突 | 见 §1.4 |

### 1.4 主项目冲突排查

原脚本操作 `span.actor-section-name`（清单详情页标题区），grep 到 `src/` 发现
jhs 多个插件也使用此选择器。

| 冲突类型 | 表现 | 协调策略 |
|----------|------|----------|
| `.actor-section-name` 共享 | jhs 多插件（ActressInfoPlugin/FavoriteActressesPlugin/ListPageButtonPlugin/ListPagePlugin/BasePlugin）读取此 span 的 `.text()`；listParser 在其后插入按钮 | **不冲突**：jhs 只读取文本，不修改 DOM；listParser 只 `insertAdjacentElement('afterend')` 追加兄弟节点，不修改 span 本身 |
| 按钮插入位置 | listParser 在 `span.actor-section-name` 的 afterend 插入；`ListReadingStatusPlugin`（doc/40）在 `h2` 的 prepend 插入 | **不冲突**：不同插入点，不互相覆盖 |
| 页面范围 | listParser `/lists/*`（清单详情页）；ListReadingStatus 也含 `/lists/*` | **不冲突**：同页面但操作不同 DOM 位置 |

**结论：无冲突，独立运行**。

## 2. 方案

### 2.1 目录结构
75 行单文件，不拆子目录，无 CSS（内联 style）：

```
src/plugins/list-parser-plugin.ts   # 清单解析器插件（extends BasePlugin）
```

### 2.2 关键设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 拆分粒度 | 单文件 | 75 行单一职责 |
| CSS | `initCss()` 返回空串 | 原脚本用内联 style，无 GM_addStyle |
| 路径守卫 | `if (!pathname.startsWith('/lists/')) return` + `if (pathname.startsWith('/users/')) return` | 原脚本 `@include /lists/*` 含清单详情页，但排除 `/users/lists`（清单列表页）；双守卫精确匹配 |
| 轮询常量 | `MAX_RETRIES=50`/`RETRY_INTERVAL=200` 提为模块级常量 | 原脚本硬编码在 `waitForAndInsert(retries=50, interval=200)` 参数默认值 |
| 闭包状态 | 无（无状态，纯函数调用） | 原脚本 IIFE 无闭包状态，转为类方法即可 |

### 2.3 模块拆分映射

| 原脚本段 | 行号 | 本项目模块 |
|----------|------|------------|
| UserScript 头 | L1-12 | vite.config.ts（已含 javdb 站点匹配） |
| `SPAN_SELECTOR` 常量 | L16-17 | 模块级常量 |
| `insertWakeButton()` | L19-68 | `ListParserPlugin.insertWakeButton()` |
| `waitForAndInsert()` | L64-68 | `ListParserPlugin.waitForAndInsert()` |
| 入口（readyState 检查 + 调用） | L70-75 | `ListParserPlugin.handle()` |

## 3. 实施

### 3.1 新增文件

| 文件 | 行数 | 职责 |
|------|------|------|
| `src/plugins/list-parser-plugin.ts` | ~130 | ListParserPlugin 类（extends BasePlugin，handle 路径守卫 + waitForAndInsert 轮询 + insertWakeButton 插入按钮） |

### 3.2 修改文件

| 文件 | 改动 |
|------|------|
| `src/main.tsx` | import ListParserPlugin；`if (isJavdbSite)` 块 `manager.register(ListParserPlugin)`；注释 31→32 插件 |
| `doc/README.md` | 文档清单 + 阅读顺序 + 进度概览更新（plugins 31→32） |

### 3.3 控制流保留要点

1. **SPAN_SELECTOR 精确选择**：`div.columns.is-mobile.section-columns span.actor-section-name`
2. **防重复插入**：`getElementById('lists-protocol-wake-btn')` 检查已存在则返回 true
3. **内联 Bootstrap 风格**：btn-primary 配色（#0d6efd）+ hover 变深（#0b5ed7），页面无 Bootstrap CSS 时仍美观
4. **click 唤醒协议**：`location.href = 'lists://?url=' + encodeURIComponent(origin + pathname)`，去除查询参数和 hash
5. **setInterval 轮询**：50 次 × 200ms = 10s，等待 span 异步渲染出现

## 4. 执行验证记录

### 4.1 类型检查
```bash
$ bunx tsc -b
（无输出，退出码 0）
```

### 4.2 构建
```bash
$ bunx vite build
dist/monkey-jhs-disassemble.user.js  1,769.05 kB │ gzip: 421.79 kB
✓ built in 1.06s
```
构建成功。产物 1769.05 kB（gzip 421.79 kB），较 doc/42 基线 1766.75 kB
（gzip 421.12 kB）+2.30 kB（gzip +0.67 kB），为单文件插件的合理增量。

### 4.3 userscript metadata 验证
本插件未新增 GM_* API，userscript 头部 grant 无变化。

## 5. 后续

- **运行时验证**：建议在 Tampermonkey 加载构建产物，测试：
  - 访问清单详情页（`/lists/{id}`），演员名称后出现"唤醒解析器"按钮
  - 按钮 Bootstrap 风格（蓝色 btn-primary），hover 变深
  - 点击按钮触发 `lists://` 协议跳转（需系统注册了 lists:// 协议才能唤醒外部应用）
  - 防重复插入：页面 DOM 变化后不重复插入按钮
  - 清单列表页（`/users/lists`）不出现按钮（路径守卫）
  - jhs 的 `.actor-section-name` 读取不受影响（只追加兄弟节点）
