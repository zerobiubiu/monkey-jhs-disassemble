# 39 - ListWaterfall 清单瀑布流插件集成

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 1. 背景

### 1.1 来源
`archetype/listWaterfall.user.js`（510 行）是独立油猴脚本 `JavDB 清单瀑布流` v0.1.0，
功能：为「我的清单」和「收藏的清单」页面启用瀑布流自动翻页，滚动接近底部自动加载
下一页。GM_xmlhttpRequest 抓取下一页 HTML → DOMParser 解析 → 提取 `#lists > ul`
的 li → 去重（id 集合）→ append 到当前容器 → 链接重写（target=_blank + /lists/{id}
短地址）→ 替换分页 nav → 同步地址栏 URL（replaceState）。含状态条三态
（loading/error/no-more）+ 回到顶部按钮。与本项目 `jhs.user.js`（鉴黄师）是同一作者
zerobiubiu 的独立脚本。

### 1.2 集成目标
将独立脚本集成到本项目（鉴黄师拆分重构工程），转为 TS 模块化，作为 `BasePlugin`
子类注册到 `PluginManager`，与现有 28 插件并列。要求：
- 转换为 TS 为主的语言（本脚本用 `document.createElement` 创建 DOM，无需 TSX）
- 保证执行逻辑不冲突（与原脚本零偏差）
- 先保证原项目可扩展性，再扩展功能实现
- 目录结构清晰

### 1.3 可行性分析

| 维度 | 结论 | 依据 |
|------|------|------|
| 站点限定 | ✅ javdb only，仅 `/users/lists` + `/users/favorite_lists` | 原脚本 `@include` 两条路径；`handle()` 内加 `ALLOWED_PATHS` 路径守卫 |
| GM_* 依赖 | GM_xmlhttpRequest(已含) / GM_setValue(已含) / **GM_getValue(需补)** / GM_addStyle(改走 initCss) / GM_registerMenuCommand(已含) | 需补 GM_getValue grant + globals.d.ts 声明 |
| 数据源 | GM_setValue/getValue（开关持久化 `jdb:list-waterfall-enabled`） | 不读 IDB/localStorage |
| 事件源 | 无 | 仅 scroll 监听 |
| 网络请求 | GM_xmlhttpRequest 抓 HTML，判 `status>=200 && <300` | 直接用全局 GM_xmlhttpRequest（抓 HTML + 按 status 判定，不复用 gmHttp.get 因 gmHttp 对非 2xx reject） |
| 主项目冲突 | ✅ 无冲突 | 见 §1.4 |

### 1.4 主项目冲突排查

原脚本操作 `#lists > ul` 容器（清单列表页），grep `#lists` 到 `src/` 确认主项目
无任何插件操作此容器（主项目 `AutoPagePlugin` 操作 `.movie-list` 视频列表页）。

| 冲突类型 | 表现 | 协调策略 |
|----------|------|----------|
| DOM 容器 | listWaterfall 操作 `#lists > ul`（清单列表）；jhs `AutoPagePlugin` 操作 `.movie-list`（视频列表） | **不同容器，无冲突** |
| 功能重叠（ModMyListOpenWay） | `ModMyListOpenWayPlugin`（doc/35）修改首屏 `#lists > ul > li` 链接；listWaterfall 的 `rewriteItemLinks` 对 append 的新 li 做相同重写 | **不冲突**：ModMyListOpenWay 只处理首屏 li，listWaterfall 处理 append 的新 li；两者操作不同 li 集合。原脚本注释"与 modMyListOpenWay 行为保持一致" |
| 回到顶部按钮 | listWaterfall 创建 `#jdb-wf-back-to-top` | grep `back-to-top` 确认主项目无同 ID 元素 |
| pagination-next | listWaterfall 查找 `a.pagination-next`；jhs `BasePlugin.getSelector` 也有 `.pagination-next` | **不同页面**：listWaterfall 仅清单页，jhs 仅视频列表页 |

**结论：无冲突，独立运行**。

## 2. 方案

### 2.1 目录结构
510 行单一职责（清单瀑布流），不拆子目录。有 CSS，拆出 CSS 文件：

```
src/plugins/list-waterfall-plugin.ts       # 清单瀑布流插件（extends BasePlugin）
src/styles/list-waterfall-plugin.css       # loader 三态 + 回到顶部按钮样式
```

### 2.2 关键设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 拆分粒度 | 单文件 + CSS | 510 行单一职责，无需子目录拆分 |
| CSS 注入 | `initCss()` 返回 CSS 字符串 | 原脚本 `GM_addStyle`；改走项目既定 initCss 模式 |
| 路径守卫 | `ALLOWED_PATHS` 集合 + `handle()` 内 `if (!ALLOWED_PATHS.has(pathname)) return` | 原脚本 `@include /users/lists*` + `/users/favorite_lists*`；本项目所有插件注册在 `if (isJavdbSite)` 块不区分路径，需代码内守卫 |
| GM_getValue | 补 grant + globals.d.ts | 原脚本用 GM_getValue 读开关状态；本项目原未含此 grant |
| GM_registerMenuCommand | 移到 `handle()` 内注册 | 原脚本在 IIFE 顶层注册（所有 javdb 页面）；本项目仅清单页注册（handle 内路径守卫通过后才注册） |
| 网络请求 | 直接用全局 `GM_xmlhttpRequest` | 原脚本判 `status>=200 && <300`；gmHttp.get 对非 2xx reject 且可能 JSON.parse，语义不匹配 |
| 闭包状态 → 类字段 | 全部 ListWaterfall 类字段转为 `ListWaterfallPlugin` 私有字段 | 原脚本独立 class；转为 BasePlugin 子类 |
| `toggleEnabled` | `this.toggleEnabled.bind(this)` 传给 GM_registerMenuCommand | 原脚本 `toggleEnabled` 是 IIFE 内独立函数；类化后需 bind 保留 this |
| `innerHTML` SVG | 保留原生 `btn.innerHTML` | 原脚本用 innerHTML 注入 SVG；不需 jsxToString（SVG 字符串简单，无 XSS 风险） |
| `container.parentNode!` | 非空断言 | `parentNode` 类型为 `Node \| null`，但容器已确认存在（querySelector 成功），parentNode 必然存在 |

### 2.3 模块拆分映射

| 原脚本段 | 行号 | 本项目模块 |
|----------|------|------------|
| UserScript 头 | L1-20 | vite.config.ts（javdb 站点匹配 + 补 GM_getValue grant） |
| 常量（LOG/ENABLED_KEY/PRELOAD/MAX_PAGES/ALLOWED_PATHS/SEL） | L25-48 | 模块级常量 |
| `isEnabled()` | L54-56 | 模块级函数 `isEnabled` |
| `toggleEnabled()` | L61-72 | `ListWaterfallPlugin.toggleEnabled()` |
| `GM_registerMenuCommand` | L74-77 | `handle()` 内注册 |
| `GM_addStyle(...)` CSS | L80-153 | `src/styles/list-waterfall-plugin.css`（?raw import via initCss） |
| 路径/开关校验 | L155-162 | `handle()` 内 |
| `getInitialPage()` | L170-173 | 模块级函数 |
| `findNextUrl()` | L180-183 | 模块级函数 |
| `toAbsolute()` | L190-192 | 模块级函数 |
| `rewriteItemLinks()` | L201-213 | 模块级函数 |
| `gmGet()` | L220-237 | 模块级函数 |
| `ListWaterfall` 类 | L245-502 | `ListWaterfallPlugin` 类 |
| 入口 `waterfall.init()` | L506-507 | `handle()` 内 `this.init()` |

## 3. 实施

### 3.1 新增文件

| 文件 | 行数 | 职责 |
|------|------|------|
| `src/plugins/list-waterfall-plugin.ts` | ~400 | ListWaterfallPlugin 类（extends BasePlugin，handle 路径守卫 + init + loadNextPage + checkLoad + scroll 同步 + 回到顶部） |
| `src/styles/list-waterfall-plugin.css` | ~80 | `.jdb-wf-loader` 三态 + `#jdb-wf-back-to-top` + `@keyframes` |

### 3.2 修改文件

| 文件 | 改动 |
|------|------|
| `src/types/globals.d.ts` | 加 `declare const GM_getValue: any;` |
| `vite.config.ts` | grant 数组加 `'GM_getValue'` |
| `src/main.tsx` | import ListWaterfallPlugin；`if (isJavdbSite)` 块 `manager.register(ListWaterfallPlugin)`；注释 28→29 插件 |
| `doc/README.md` | 文档清单 + 阅读顺序 + 进度概览更新（plugins 28→29） |

### 3.3 控制流保留要点

1. **isEnabled/toggleEnabled**：GM_getValue 读开关（默认开启）；toggle 切换 + confirm 刷新
2. **ALLOWED_PATHS 路径白名单**：`/users/lists` + `/users/favorite_lists`，精确校验 pathname
3. **init 查找容器**：`#lists > ul`，记录首屏 li id 到 loadedIds 集合（去重）
4. **loader 三态**：loading（蓝色+旋转动画）/ error（红色+点击重试）/ no-more（绿色）
5. **loadNextPage**：gmGet 抓 HTML → DOMParser 解析 → 提取 li → 去重（首 li id 已存在则停止）→ append fragment → rewriteItemLinks → 记录 pageItems → 替换分页 nav
6. **MAX_PAGES(200) 保护**：防止异常无限加载
7. **checkLoad**：loader 距视口底部 PRELOAD_DISTANCE(800px) 时触发
8. **updateCurrentPageFromScroll**：滚动时自末页向前找首个 top ≤ scrollY 的页，replaceState 同步 URL
9. **createBackToTopBtn**：固定右下角，rAF 节流，滚动 >300px 淡入，点击平滑回顶

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
dist/monkey-jhs-disassemble.user.js  1,734.67 kB │ gzip: 414.29 kB
✓ built in 1.01s
```
构建成功。产物 1734.67 kB（gzip 414.29 kB），较 doc/38 基线 1724.81 kB
（gzip 411.36 kB）+9.86 kB（gzip +2.93 kB），为 list-waterfall 插件 + CSS 的合理增量。

### 4.3 userscript metadata 验证
构建产物 userscript 头部 grant 含 `GM_getValue`（本次新增），`GM_registerMenuCommand`
菜单命令将在清单页 Tampermonkey 菜单中显示。

## 5. 后续

- **运行时验证**：建议在 Tampermonkey 加载构建产物，测试：
  - 访问 `/users/lists`（我的清单），滚动到底部自动加载下一页
  - 访问 `/users/favorite_lists`（收藏的清单），同样自动翻页
  - loader 三态：加载中（蓝色旋转）/ 加载失败（红色点击重试）/ 已经到底了（绿色）
  - 滚动时地址栏 URL 同步（replaceState）
  - 新 append 的 li 链接重写（target=_blank + /lists/{id} 短地址）
  - 回到顶部按钮：滚动 >300px 淡入，点击平滑回顶
  - GM_registerMenuCommand 菜单：切换开关 + confirm 刷新
  - 非清单页（如视频列表页）不触发瀑布流（路径守卫）
  - ModMyListOpenWay 首屏 li 链接重写不被 listWaterfall 覆盖（不同 li 集合）
- **与 ModMyListOpenWay 的协同**：两者都操作 `#lists > ul > li`，但
  ModMyListOpenWay 只处理首屏 li（handle 时一次性修改），listWaterfall 的
  rewriteItemLinks 只处理 append 的新 li。若用户先访问清单页（ModMyListOpenWay
  修改首屏），再滚动加载新页（listWaterfall 修改新 li），两者不冲突
