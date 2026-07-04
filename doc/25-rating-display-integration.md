# 25 - jhsRatingDisplay 评分显示插件集成

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 1. 背景

### 1.1 来源
`archetype/jhsRatingDisplay.user.js`（916 行）是独立油猴脚本 `JHS 评分显示 v2.0`，
功能：在 javdb 列表页卡片封面上显示个人评分（1-5 星），首屏缓存优先 → 悬停懒加载，
实时同步刷新。与本项目 `jhs.user.js`（鉴黄师）是同一作者的两个独立脚本，但评分显示
脚本**寄生**读取鉴黄师的 IndexedDB（`JAV-JHS/appData/car_list`）获取已看列表，并监听
鉴黄师广播的 `jdb:want-watched-sync` 事件实现实时刷新。

### 1.2 集成目标
将独立脚本集成到本项目（鉴黄师拆分重构工程），转为 TS 模块化 + TSX 组件，作为
`BasePlugin` 子类注册到 `PluginManager`，与现有 22 插件并列。要求：
- 转换为 TS 为主的语言，组件生成用 TSX（jsxToString）
- 保证执行逻辑不冲突（与原脚本零偏差）
- 先保证原项目可扩展性，再扩展功能实现
- 目录结构清晰

### 1.3 可行性分析（集成前调研）

| 维度 | 结论 | 依据 |
|------|------|------|
| 数据源一致 | ✅ 直接复用 | `storageManager` 的 localforage 实例 `createInstance({name:'JAV-JHS', storeName:'appData'})` 与原脚本 `JhsDB` 读同一 IDB 库/仓库；`car_list` 键一致；`HAS_WATCH_ACTION='hasWatch'` 与原脚本 `item.status==='hasWatch'` 一致 |
| 事件源已存在 | ✅ 仅监听 | `detail-page-button-plugin.tsx` 的 `broadcastWantWatchedSync` 已触发 `jdb:want-watched-sync` CustomEvent + localStorage + GM_setValue，评分插件只需监听 |
| GM_xmlhttpRequest | ✅ 已有 | grant 已含，globals.d.ts 已声明 |
| GM_addStyle | ❌ 改走 initCss | 项目既定模式：`initCss()` 返回 CSS 字符串 → PluginManager `utils.insertStyle` 注入；不引入 GM_addStyle grant |
| GM_registerMenuCommand | ❌→✅ 补 grant | 项目原未使用，本次补 grant + globals.d.ts 声明，保留原脚本 4 个菜单命令 |
| 站点限定 | ✅ javdb only | 原脚本 `@include https://javdb*.com/*`；main.tsx `if (r)` 块只在 javdb 站点注册 |
| 不复用 gm-http.gmRequest | ✅ 语义不匹配 | gmRequest 对非 2xx reject 且自动 JSON.parse；评分抓取需原始 HTML + 仅按 status===200 判定，直接用全局 GM_xmlhttpRequest 与原脚本零偏差 |

## 2. 方案

### 2.1 目录结构
新建 `src/plugins/rating-display/` 子目录，按职责拆分 6 个模块：

```
src/plugins/rating-display/
├── rating-config.ts            # CONFIG 常量（DEBUG_MODE/IDB/选择器/请求控制）
├── rating-utils.ts             # Utils 工具（log/debounce/createLimiter/getSafeUrl/normalizeCode/getCode/getAnchor）
├── rating-cache.ts             # JhsDB 寄生 IDB + RatingCache + buildWatchedMap
├── rating-net.ts               # Net 限流请求 + parseRating + fetchRating
├── rating-renderer.tsx         # Renderer DOM 操作（jsxToString 生成 innerHTML）
└── rating-display-plugin.tsx   # Core 主流程 + 插件入口（extends BasePlugin）

src/styles/rating-display.css   # 评分标签 + toast 样式（?raw import via initCss）
```

依赖方向（无循环）：
```
rating-display-plugin ──→ rating-net ──→ rating-renderer ──→ rating-utils ──→ rating-config
        │                   └──→ rating-cache ──────────────┘
        ├──→ rating-cache
        ├──→ rating-renderer
        └──→ rating-utils
```

### 2.2 关键设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 已看列表数据源 | 复用 `storageManager.getCarList()` | 同库同键，避免重复开 IDB 连接；storageManager 在 processPlugins 前已就绪 |
| 评分缓存寄生 IDB | 保留原生 indexedDB API | storageManager.forage 为 private 无法访问 `jhsRatingDisplay_data` 键；原脚本即用原生 API，零偏差 |
| 网络请求 | 直接用全局 `GM_xmlhttpRequest` | gmRequest 语义不匹配（JSON.parse + 非 2xx reject）；评分抓取需原始 HTML |
| CSS 注入 | `initCss()` 返回 CSS 字符串 | 项目既定模式，替代原脚本 `GM_addStyle`；CSS 在 processCss 阶段（早于 handle）注入，更早就绪 |
| innerHTML 生成 | `jsxToString(<><span>★</span>...</>)` | 满足 TSX 化要求，DOM 等价；状态切换保留 DOM 操作（appendChild/classList） |
| 菜单命令 | 补 `GM_registerMenuCommand` grant | 保留原脚本 4 个菜单（全量加载/清当前页/清所有/刷新已看） |
| MutationObserver 类型守护 | `instanceof Element` | Node 无 matches/querySelectorAll/closest，原脚本用 `?.` 防御，TS 需显式类型守护 |

### 2.3 模块拆分映射

| 原脚本段 | 行号 | 本项目模块 |
|----------|------|------------|
| `CONFIG` | L24-45 | `rating-config.ts` |
| `Utils` | L50-131 | `rating-utils.ts` |
| `JhsDB` | L136-179 | `rating-cache.ts`（openIdb + buildWatchedMap，getAllCarList 改复用 storageManager） |
| `RatingCache` | L184-302 | `rating-cache.ts` |
| `Net` | L307-331 | `rating-net.ts` |
| `parseRating` | L340-349 | `rating-net.ts` |
| `fetchRating` | L354-390 | `rating-net.ts` |
| `Renderer` | L395-474 | `rating-renderer.tsx` |
| `Core` | L479-916 | `rating-display-plugin.tsx`（类方法） |
| `GM_addStyle` CSS | L483-566 | `src/styles/rating-display.css`（?raw import via initCss） |

## 3. 实施

### 3.1 新增文件

| 文件 | 行数 | 职责 |
|------|------|------|
| `src/plugins/rating-display/rating-config.ts` | ~60 | RatingConfig 接口 + RATING_CONFIG 常量 |
| `src/plugins/rating-display/rating-utils.ts` | ~140 | DOMParser/log/debounce/createLimiter/getSafeUrl/normalizeCode/getCode/getAnchor |
| `src/plugins/rating-display/rating-cache.ts` | ~190 | openIdb/buildWatchedMap/RatingCache（load/save/get/set/clear/size） |
| `src/plugins/rating-display/rating-net.ts` | ~130 | limiter/request/parseRating/fetchRating |
| `src/plugins/rating-display/rating-renderer.tsx` | ~120 | hideNativeBadge/showPlaceholder/showRating/removeFrom |
| `src/plugins/rating-display/rating-display-plugin.tsx` | ~290 | RatingDisplayPlugin 类（Core 主流程 + 插件入口） |
| `src/styles/rating-display.css` | ~75 | .jhs-user-rating / .jhs-rd-toast / @keyframes |

### 3.2 修改文件

| 文件 | 改动 |
|------|------|
| `src/types/globals.d.ts` | 加 `declare const GM_registerMenuCommand: any;` |
| `vite.config.ts` | grant 数组加 `'GM_registerMenuCommand'` |
| `src/main.tsx` | import RatingDisplayPlugin；`if (r)` 块注册 `e.register(RatingDisplayPlugin)`；注释 22→23 插件 |

### 3.3 控制流保留要点

1. **双写缓存**：RatingCache.set → saveToLS + _syncToIdb（localStorage 主 + IDB 寄生备份）
2. **缓存恢复**：load() localStorage 优先 → IDB 兜底恢复到 localStorage
3. **首屏缓存优先**：processItem 命中已看 → 有缓存直接 showRating，无缓存 showPlaceholder
4. **悬停懒加载**：pointerover 500ms 后 fetchRating，pointerout 取消
5. **缓存验证**：首屏缓存命中项标记 jhsrdFromCache，init 后取消 loaded，首次悬停重新抓取验证评分变化
6. **实时刷新**：
   - 同标签页 CustomEvent `jdb:want-watched-sync` → _invalidateCards 精确刷新
   - 跨标签页 storage 事件 → JSON.parse payload 精确刷新
   - visibilitychange → 标记待验证 + _dirty 时全量 refreshAll
7. **启动同步检测**：init 时比对 `jdb:want-watched-sync` 与 `jhsrd:last-sync-digest`，不一致则全量清空缓存
8. **MutationObserver**：childList/subtree/attributes(class) → 新卡片加入 pending（debounce 150ms）/ status-tag 变动即时刷新

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
dist/monkey-jhs-disassemble.user.js  1,221.87 kB │ gzip: 314.19 kB
✓ built in 885ms
```
构建成功。产物 1221.87 kB（gzip 314.19 kB），较 doc/24 基线 1202.82 kB（gzip 309.12 kB）
+19.05 kB（gzip +5.07 kB），为评分显示插件 6 模块 + CSS 的合理增量。

警告仍为 layer.css IE hack（`*display`/`*zoom`，doc/24 已记录，lightningcss errorRecovery
容错 strip，无害）。

### 4.3 userscript metadata 验证
构建产物 userscript 头部 grant 含 `GM_registerMenuCommand`，4 个菜单命令将在
Tampermonkey 菜单中显示。

## 5. 后续

- **运行时验证**：建议在 Tampermonkey 加载构建产物，测试：卡片评分标签显示、悬停懒加载、
  跨标签页同步刷新、4 个菜单命令、MutationObserver 新卡片刷新
- **dead code**：原脚本 `archetype/doc/06-jhsRatingDisplay-refresh-fix.md` 提到的旧版
  刷新机制修复已在本集成中体现（_invalidateCards 传 status/op + storage 精确刷新）
