# 集成决策矩阵

常见决策点的快速查表。转换前对照本表逐项判定，结果填入 doc §1.3 / §2.2。

## 数据源决策

| 原脚本读法 | 本项目复用方案 | 判定条件 |
|------------|----------------|----------|
| `indexedDB.open('JAV-JHS', 'appData')` 读 `car_list` | 复用 `storageManager.getCarList()` | 同库同键，storageManager 在 processPlugins 前就绪 |
| `indexedDB.open('JAV-JHS', 'appData')` 读**其他**键 | 保留原生 `indexedDB` API | storageManager.forage 为 private，无法访问非 car_list 键 |
| `localStorage.getItem('jhs_xxx')` | 直接用 `localStorage` | 项目不接管 localStorage，原样保留 |
| `GM_setValue('xxx', v)` | 直接用 `GM_setValue` | grant 已含；跨标签页同步用 `GM_addValueChangeListener` |
| 独立 IDB 库（如 `jhsRatingDisplay_data`） | 保留原生 `indexedDB` API | 寄生 IDB，与 storageManager 不同库 |

## 网络请求决策

| 原脚本请求方式 | 本项目方案 | 理由 |
|----------------|------------|------|
| `GM_xmlhttpRequest` 抓 HTML，只判 `status===200` | 直接用全局 `GM_xmlhttpRequest` | gmRequest 对非 2xx reject + 自动 JSON.parse，语义不匹配 |
| `GM_xmlhttpRequest` 调 JSON API，期望非 2xx 抛错 | 复用 `gmHttp.get/post` | 语义匹配，已封装 |
| `fetch(...)` | 改 `GM_xmlhttpRequest` | 跨域 + userscript CSP 限制；fetch 在部分页面不可用 |
| 并发请求需限流 | 自建 `createLimiter(maxConcurrent)` | 项目无通用限流器；参考 `rating-net.ts` |

## CSS 注入决策

| 原脚本做法 | 本项目方案 | 理由 |
|------------|------------|------|
| `GM_addStyle(css)` | `initCss()` 返回 CSS 字符串 → `utils.insertStyle` | 项目既定模式，不引入 GM_addStyle grant |
| 内联 `el.style.cssText = '...'` | 保留原生 DOM style 操作 | 不影响样式注入流程 |
| 模板字符串拼 `<style>...</style>` 注入 | 提取到 `.css` 文件 `?raw` import | 字符级对齐（doc/14） |

## innerHTML 决策

| 原脚本做法 | 本项目方案 | 注意事项 |
|------------|------------|----------|
| `el.innerHTML = '<span class="x">...</span>'` | `el.innerHTML = jsxToString(<Comp />)` | className→class；inline-block 间加 `{' '}` 保空白（doc/32） |
| `el.innerHTML = \`<a onclick="...">...</a>\`` | `jsxToString` + jQuery `.on()` 补回事件 | jsxToString 忽略 `on*` 属性（doc/23 LoginDialog 修复） |
| `el.appendChild(dom)` | 保留原生 DOM 操作 | 不需 jsxToString |
| `$(el).html(htmlString)` | 保留 jQuery `.html()` | 不需 jsxToString |

## 事件监听决策

| 原脚本事件源 | 本项目方案 | 理由 |
|--------------|------------|------|
| `window.addEventListener('keydown', ...)` | 在 `handle()` 内注册 | 原样保留；注意 `isTyping()` 防焦点冲突 |
| `CustomEvent('jdb:xxx')` 监听 | 仅监听，不新建事件源 | 事件源由 detail-page-button-plugin 等已有插件触发 |
| `BroadcastChannel('xxx')` | 复用现有 channel 或新建 | 跨标签页同步；main.tsx 有 `channel-refresh` |
| `window.addEventListener('storage', ...)` | 保留 | 跨标签页 localStorage 同步 |
| `GM_addValueChangeListener` | 保留 | 跨标签页 GM_setValue 同步 |

## 站点限定决策

| 原脚本 `@include`/`@match` | 本项目方案 |
|----------------------------|------------|
| `https://javdb*.com/*` | main.tsx `if (isJavdbSite)` 块内注册 |
| `https://javdb*.com/v/*`（仅详情页） | 插件内 `if (window.isDetailPage)` 守卫 |
| 多站（javdb + javbus 等） | javbus 已清理（doc/27），仅保留 javdb 分支 |

## 模块拆分决策

| 原脚本规模 | 拆分方案 |
|------------|----------|
| < 200 行，单一职责 | 单文件 `src/plugins/<name>-plugin.ts` |
| ≥ 200 行，多职责 | 子目录 `src/plugins/<name>/`，按 config/utils/cache/net/renderer/plugin 拆 |
| 含可复用工具函数 | utils 模块独立，供其他插件 import |

## 冲突协调决策（第 1.5 步排查结果）

**排查方法**：grep 原脚本的选择器/data 属性/DOM 容器/MutationObserver 目标到 `src/` 全项目搜索，找出操作同一目标的插件。

### 冲突类型与协调策略

| 冲突类型 | 表现 | 典型案例 | 协调策略 |
|----------|------|----------|----------|
| 双重功能重叠 | 两个插件做同一件事（排序/过滤/显隐） | PageSort vs `ListPageButtonPlugin.sortItems` | 排序互斥：本插件激活时清除对方状态（`localStorage.removeItem('jhs_sortMethod')`），监听对方按钮 click 清除本插件状态 |
| MutationObserver 互相触发 | 两个 observer 监听同一 DOM childList，互相 append 触发对方，可能死循环 | PageSort sortGuard vs `ListPagePlugin.checkDom` observer | applySort 内 `disconnect()` 自身 observer → 排序 → `takeRecords()` 清空 → `observe()` 重建；或对方操作时本插件 observer 通过状态守卫不反应（`if (!activeSort) return`） |
| DOM 容器共享 | 多个插件操作同一容器子项 | PageSort/`AutoPagePlugin`/`ListPagePlugin` 都操作 `.movie-list .item` | 加 autoPage/isListPage 守卫，与主项目插件一致地跳过（`if (autoPage===YES) return` / `if (!isListPage) return`） |
| data 属性冲突 | 两套 data 属性标记原始位置 | `data-original-index` vs `data-sort-original-index` | 复用主项目已有的 data 属性，仅当未标记时才打标（`if (!el.hasAttribute('data-x')) el.setAttribute(...)`） |
| 事件监听冲突 | 同一元素同一事件多个监听器 | keydown 方向键 vs `Hotkey.handleKeydown` | 加 `isTyping()` 焦点守卫，或检查 `Hotkey` 是否已处理 |

### 协调原则

1. **本插件单方面适配，零侵入主项目已定稿插件**——不修改 `list-page-button-plugin`/`list-page-plugin`/`auto-page-plugin` 等已定稿逻辑，避免引入新风险
2. **同一时刻仅一个功能系统生效**——通过状态互斥（清除对方 localStorage/activeSort）实现
3. **复杂冲突可能需两份文档**——集成 doc/NN + 协调优化 doc/NN+1（参考 doc/36+37 模式）

### 常见需排查的关键操作符

| 关键操作符 | grep 到 `src/` 的搜索目标 | 可能冲突的插件 |
|------------|--------------------------|----------------|
| `.movie-list` | `.movie-list` | `ListPagePlugin`/`AutoPagePlugin`/`ListPageButtonPlugin`/`HitShowPlugin`/`Top250Plugin` |
| `.toolbar` | `.toolbar` | `ListPageButtonPlugin`（按钮注入） |
| `data-*-index` | `data-original-index` 等 | `ListPageButtonPlugin.sortItems` |
| `MutationObserver` | `MutationObserver` | `ListPagePlugin.checkDom`/`RatingDisplayPlugin` |
| 排序/sort | `sortItems`/`sort(` | `ListPageButtonPlugin.sortItems` |
| `pagination-` | `pagination-next`/`pagination-previous` | `AutoPagePlugin`/`BasePlugin.getSelector` |
| `localStorage` 键名 | `jhs_sortMethod`/`jhs_translate` 等 | 对应功能插件 |
