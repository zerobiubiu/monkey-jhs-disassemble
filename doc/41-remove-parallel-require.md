# 41 - 移除失效的 parallel_GM_xmlhttpRequest @require

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 1. 背景

### 1.1 问题
`vite.config.ts` 的 `require` 数组中保留了 1 个 `@require`：
```
https://update.greasyfork.org/scripts/540597/1613170/parallel_GM_xmlhttpRequest.js
```

该 URL 已失效（HTTP 410 Gone，内容为空）。GreasyFork 脚本已被作者删除或下架。

### 1.2 脚本作用
`parallel_GM_xmlhttpRequest.js` 是 GreasyFork 脚本（非 npm 包），作用是在 userscript
加载时覆盖全局 `GM_xmlhttpRequest`，突破 Tampermonkey 默认的并发请求限制。doc/24
保留它的原因仅是"GreasyFork 脚本，非 npm 包"。

### 1.3 项目中的使用情况
`parallel_GM_xmlhttpRequest` 在 `src/` 代码中**没有任何直接引用**。它通过 `@require`
隐式覆盖全局 `GM_xmlhttpRequest`，以下 4 个文件间接受益：

| 文件 | 调用点 | 用途 |
|------|--------|------|
| `src/core/gm-http.ts` | `gmRequest`（L313）+ `downloadFileInChunks`（L150, L222） | 通用 HTTP 请求 + 分块下载 |
| `src/core/webdav.ts` | `_sendRequest`（L87） | WebDav 备份 |
| `src/plugins/rating-display/rating-net.ts` | `request`（L43） | 评分抓取（自带限流器 `createLimiter`） |
| `src/plugins/list-waterfall-plugin.ts` | `gmGet`（L144） | 清单瀑布流抓取下一页 |

### 1.4 影响评估
- **功能不中断**：原生 `GM_xmlhttpRequest` 完全可用
- **高并发场景不受影响**：`rating-net.ts` 有自己的限流器（`FETCH_CONCURRENCY`）控制并发，不依赖 parallel 脚本
- **消除 Tampermonkey 安装时的 @require 加载失败警告**

## 2. 方案

### 2.1 修改
从 `vite.config.ts` 移除 `require` 数组，更新注释。

### 2.2 不修改的文件
- `src/core/gm-http.ts`（仍用全局 `GM_xmlhttpRequest`，原生版本功能正常）
- `src/core/webdav.ts`（同上）
- `src/plugins/rating-display/rating-net.ts`（同上，自带限流器）
- `src/plugins/list-waterfall-plugin.ts`（同上，单次请求不需要并发）

## 3. 实施

### 3.1 修改文件

| 文件 | 改动 |
|------|------|
| `vite.config.ts` | 移除 `require` 数组（含 parallel_GM_xmlhttpRequest URL）；更新注释说明移除原因 |

## 4. 执行验证记录

### 4.1 类型检查
```bash
$ bunx tsc -b
（无输出，退出码 0）
```

### 4.2 构建
```bash
$ bunx vite build
dist/monkey-jhs-disassemble.user.js  1,765.38 kB │ gzip: 420.75 kB
✓ built in 1.46s
```
构建成功。产物 1765.38 kB（gzip 420.75 kB），较 doc/40 基线 1765.48 kB
（gzip 420.83 kB）-0.10 kB（移除一行 @require 声明）。

### 4.3 userscript metadata 验证
构建产物头部**无 `@require` 行**（grep `@require` 无匹配），`@grant` 列表完整保留
（GM_xmlhttpRequest/GM_openInTab/GM_setValue/GM_getValue/GM_addValueChangeListener/
GM_registerMenuCommand/unsafeWindow + vite 自动追加的 GM_addStyle/window.close）。

## 5. 后续

- 无运行时验证需求（原生 GM_xmlhttpRequest 功能与 parallel 版本一致，仅并发上限可能不同；
  rating-net 有自带限流器，其他调用点都是单次请求）
- doc/24 记录的"@require 仅剩 1 个"已成为历史，此 doc 更新为"@require 全部移除"
