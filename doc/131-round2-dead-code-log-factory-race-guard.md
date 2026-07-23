# doc/131 — 第二轮深度优化：死代码清理 + 日志工厂 + 竞态守卫 + 类型收窄

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

doc/130 六维度审计后，对「未修复项」中可安全执行的 4 项进行第二轮优化。
所有修改均为纯重构/防护，不改变用户可见行为。

## 方案

### 1. api.ts 死代码清理

经 grep 验证零外部引用的导出：

- **删除函数**：`removeSignature`、`searchMovie`、`getMagnets`、`login`
  （top250-plugin 内联了自己的登录逻辑，fc2-plugin 内联了磁链请求）
- **移除 export**：`RequestHeaders` 接口、`DEFAULT_REQUEST_HEADERS` 函数
  （仅文件内部使用）
- **精简 javDbApi**：12 个属性中仅 `markDataListHtml` 被外部访问
  （fc2-by-123av-plugin L192/L441），其余 11 个零访问，全部移除
- **保留**：`MovieDetail`/`RelatedCollection` 接口（函数返回类型文档价值）、
  所有被外部 import 的函数

### 2. car-status-sync 日志工厂提取

car-list-reader-plugin.ts 和 missav-status-tag-plugin.ts 各自定义了结构相同的
4 个日志函数（logInfo/logOk/logWarn/logErr），仅前缀不同。

- **新建** `src/plugins/car-status-sync/car-status-logger.ts`：
  `CarStatusLogger` 接口 + `createLogger(prefix)` 工厂
- **两个插件文件**：删除各自的 4 个日志函数定义，改用
  `const { info: logInfo, ok: logOk, warn: logWarn, err: logErr } = createLogger(PREFIX);`
- 日志调用点零修改，控制台输出格式统一采用 car-list-reader 版

### 3. Fc2By123Av 竞态守卫

`handleQuery()` 有 3 个 fire-and-forget 调用点（搜索/排序/分页），无并发防护。

- 类字段 `_querySeq = 0`，handleQuery 开头 `const seq = ++this._querySeq;`
- 两个 fetchPage await 之后、任何状态变更（maxPage）和 DOM 写入之前：
  `if (seq !== this._querySeq) return;`
- 与 MagnetHub 的 `_searchSeq` 模式一致（doc/130）

### 4. base-plugin.ts 类型收窄

`CarInfo` 和 `SelectorConfig` 接口经 grep 验证零外部 import，移除 `export`
收窄为模块内部类型。

## 实施（修改文件清单）

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/constants/api.ts` | 修改 | 删 4 函数 + 2 去 export + javDbApi 精简 |
| `src/plugins/car-status-sync/car-status-logger.ts` | 新建 | createLogger 工厂 |
| `src/plugins/car-status-sync/car-list-reader-plugin.ts` | 修改 | 删日志函数，用工厂 |
| `src/plugins/car-status-sync/missav-status-tag-plugin.ts` | 修改 | 删日志函数，用工厂 |
| `src/plugins/fc2-by-123av-plugin.ts` | 修改 | _querySeq 竞态守卫 |
| `src/plugins/base-plugin.ts` | 修改 | CarInfo/SelectorConfig 去 export |

## 执行验证记录

```
$ bun run build
tsc -b && vite build
✓ 221 modules transformed.
dist/monkey-jhs-disassemble.user.js  1,992.78 kB │ gzip: 459.65 kB
✓ built in 1.50s
```

tsc 零错误。产物 -1.87 kB（死代码删除 > 日志工厂新增）。

## 排除项

| 内容 | 原因 |
|------|------|
| visit-history formatDate 去重 | utils.formatDate 返回含时间部分，格式不等价 |
| ModalListDisabler 页面守卫 | 详情页需要该插件（模态框在详情页出现），加守卫会破坏功能 |
| ImageRecognition isUploading 竞态 | 已有 isUploading 守卫（L201），仅 UX 级影响 |
