# 35 - ModMyListOpenWay 修改我的清单打开方式插件集成

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 1. 背景

### 1.1 来源
`archetype/modMyListOpenWay.user.js`（37 行）是独立油猴脚本 `修改我的清单打开方式` v1.0，
功能：修改 Javdb "我的清单" 页面的打开方式——让清单链接在新标签页打开
（`target="_blank"`），并把链接从查询字符串格式（`/users/lists?id=xxx`）改为
RESTful 格式（`/lists/xxx`）。首页（`page<2`）隐藏第一项"所有清单"入口。
与本项目 `jhs.user.js`（鉴黄师）是同一作者 zerobiubiu 的独立脚本，完全独立，
不读 IDB、不监听事件、不发网络请求，纯 DOM 操作。

### 1.2 集成目标
将独立脚本集成到本项目（鉴黄师拆分重构工程），转为 TS 模块化，作为 `BasePlugin`
子类注册到 `PluginManager`，与现有 25 插件并列。要求：
- 转换为 TS 为主的语言（本脚本无 HTML 模板，无需 TSX）
- 保证执行逻辑不冲突（与原脚本零偏差）
- 先保证原项目可扩展性，再扩展功能实现
- 目录结构清晰

### 1.3 可行性分析（集成前调研）

| 维度 | 结论 | 依据 |
|------|------|------|
| 站点限定 | ✅ javdb only，且仅 `/users/lists*` 路径 | 原脚本 `@include https://javdb*.com/users/lists*`；本项目 `if (isJavdbSite)` 块注册，`handle()` 内加 `if (!location.pathname.includes('/users/lists')) return;` 守卫等价实现 |
| 数据源 | 无 | 不读 IDB/localStorage |
| 事件源 | 无 | 仅 DOM 操作，无事件监听 |
| GM_* API | 无 | 纯 DOM 操作，无需补 grant |
| CSS | 无 | 无 GM_addStyle，`initCss` 返回空串 |
| 网络请求 | 无 | 无 GM_xmlhttpRequest |

## 2. 方案

### 2.1 目录结构
37 行单文件，不拆子目录：

```
src/plugins/mod-my-list-open-way-plugin.ts   # 修改我的清单打开方式插件（extends BasePlugin）
```

无 CSS 文件（`initCss` 返回空串）。无 globals.d.ts / vite.config 改动（无 GM_*）。

### 2.2 关键设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 拆分粒度 | 单文件 | 37 行单一职责，无需子目录拆分 |
| URL 路径守卫 | `handle()` 内 `if (!location.pathname.includes('/users/lists')) return;` | 原脚本靠 `@include https://javdb*.com/users/lists*` 在 userscript 层限定路径；本项目所有插件注册在 `if (isJavdbSite)` 块不区分路径，需代码内守卫等价实现 |
| CSS | `initCss()` 返回空串 | 原脚本无 GM_addStyle；BasePlugin 要求实现 initCss，返回空串表示无样式 |
| `ul` 缺失守卫 | `if (!ul) return;` | 原脚本直接 `ul.children` 假定 ul 存在；TS 中 `querySelector` 返回 `null` 需守卫，且若页面结构变更不应抛错 |
| `a` 缺失守卫 | `if (!a) continue;` | 原脚本直接 `a.target` 假定每个 li 都有 a；TS 中 `querySelector` 返回 `null` 需守卫，缺项跳过更稳健 |
| `lis[0]` 类型断言 | `as HTMLElement` | `HTMLCollection` 元素类型为 `Element`，无 `style` 属性需 HTMLElement；与原脚本运行时行为一致 |
| `at(-1)` | 改用 `[length-1]` | `Array.prototype.at` 是 ES2022 特性，tsconfig lib 仅 ES2020；用 `segments[segments.length-1]` 等价替代，语义零偏差，不改全局 lib 配置 |

### 2.3 模块拆分映射

| 原脚本段 | 行号 | 本项目模块 |
|----------|------|------------|
| UserScript 头 | L1-11 | vite.config.ts（已含 javdb 站点匹配，无需改） |
| `last` 路径末段 | L15 | `handle()` 内 |
| `ul`/`lis` 查询 | L17-18 | `handle()` 内（加 null 守卫） |
| `isListsPage`/`page` | L20-21 | `handle()` 内 |
| 首页隐藏第一项 | L24-26 | `handle()` 内 |
| 循环改 `target`/`href` | L28-36 | `handle()` 内（加 a null 守卫） |

## 3. 实施

### 3.1 新增文件

| 文件 | 行数 | 职责 |
|------|------|------|
| `src/plugins/mod-my-list-open-way-plugin.ts` | ~90 | ModMyListOpenWayPlugin 类（extends BasePlugin，handle 修改清单链接打开方式） |

### 3.2 修改文件

| 文件 | 改动 |
|------|------|
| `src/main.tsx` | import ModMyListOpenWayPlugin；`if (isJavdbSite)` 块 `manager.register(ModMyListOpenWayPlugin)`；注释 25→26 插件 |
| `doc/README.md` | 文档清单 + 阅读顺序 + 进度概览更新（plugins 25→26） |

### 3.3 控制流保留要点

1. **last 路径末段**：`location.pathname.split('/').filter(Boolean)` 后取 `[length-1]`（原脚本用 `at(-1)`，因 tsconfig lib 仅 ES2020 改用等价写法，语义零偏差），区分 `/users/lists`（首页，last='lists'）vs `/lists/{id}`（详情页，last=id）
2. **isListsPage 判定**：`last === 'lists'`，仅清单列表页才改写 href（详情页链接已是 RESTful）
3. **page 解析**：`Number(new URLSearchParams(location.search).get('page')) || 1`，缺省为 1
4. **首页隐藏第一项**：`isListsPage && page<2` 时 `lis[0].style.display='none'`，且循环从下标 1 开始（跳过被隐藏的"所有清单"入口）
5. **target=_blank**：每个清单链接设 `a.target='_blank'`，新标签页打开
6. **href 改写**：仅 `isListsPage` 时，从 `a.href` 提取 `id` 查询参数，改写为 `/lists/${id}` RESTful 格式

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
dist/monkey-jhs-disassemble.user.js  1,708.03 kB │ gzip: 407.08 kB
✓ built in 1.28s
```
构建成功。产物 1708.03 kB（gzip 407.08 kB），较 doc/34 基线 1707.08 kB
（gzip 406.79 kB）+0.95 kB（gzip +0.29 kB），为单文件插件的合理增量。

警告仍为 layer.css IE hack（`*display`/`*zoom`/`*position`/`_display`，doc/24 已记录，
lightningcss errorRecovery 容错 strip，无害）。

### 4.3 userscript metadata 验证
本插件未新增 GM_* API，userscript 头部 grant 无变化。

## 5. 后续

- **运行时验证**：建议在 Tampermonkey 加载构建产物，测试：
  - 访问 `/users/lists`（首页），"所有清单"入口被隐藏，其余清单链接在新标签页打开
  - 访问 `/users/lists?page=2`（第 2 页），第一项不隐藏，链接改写为 `/lists/{id}`
  - 访问 `/lists/{id}`（清单详情页），插件不执行（守卫生效）
  - 访问其他 javdb 页面，插件不执行（守卫生效）
- **选择器维护**：若 javdb 页面结构变更，修改 `#lists > ul` 与 `div.column.is-10 > a` 选择器即可
