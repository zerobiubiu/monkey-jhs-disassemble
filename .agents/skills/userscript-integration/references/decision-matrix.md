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
