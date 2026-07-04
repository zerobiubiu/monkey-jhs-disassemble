# 28 - 清理其他死代码与多余导出

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 1. 背景

doc/27 清理 javbus 站点死代码后，用户要求排查是否还有"未知的死代码或非 javdb 的支持"。
经系统排查（grep 站点域名 + 未使用导出扫描 + 未使用 CSS 扫描），发现一批死代码与多余导出，
一次性清理。

## 2. 排查结论

### 2.1 非 javdb 站点支持
**无残留**。代码中出现的 `missav`/`supjav` 是 `other-site-plugin` 在 javdb 详情页
生成跳转按钮的有效功能（按番号在第三方站点搜索）；`fc2ppvdb` 是 clog 异常过滤的
关键词。均非站点判定/支持代码。

### 2.2 未使用 CSS
`src/styles/` 下 23 个 CSS 文件全部被 `?raw` import，无未使用 CSS。

## 3. 清理内容

### 3.1 死代码（完全未引用）

| 项 | 文件 | 处理 |
|----|------|------|
| `TABULATOR_ZH_CN` 语言包 | `src/constants/tabulator-zh.ts` | **删除整个文件**。该常量是从原脚本提取的 tabulator 中文本地化对象，但各插件仍用内联的 zh-cn 对象（未接入提取的常量），属"未完成重构"产物，0 引用 |
| `RatingNet` 聚合导出 | `src/plugins/rating-display/rating-net.ts` | 删除 `export const RatingNet = { limiter, request }`。该聚合对象 0 引用（`rating-display-plugin` 直接用 `fetchRating`，内部 `limiter`/`request` 仍被 `fetchRating` 使用，保留） |
| 123av 来源标签 | `src/plugins/history-plugin.tsx` | 删除 `else if (url.includes('123av'))` 分支（"123Av" 标签）。用户从未在 123av 站点使用，历史数据无 123av 来源，分支永不执行 |

### 3.2 多余 export（模块内部使用，无需导出）

| 项 | 文件 | 处理 |
|----|------|------|
| `positionTooltip` | `src/core/tooltip.ts` | `export function` → `function`（仅被同模块 `setupTooltip` 内部调用） |
| `createToast` | `src/core/toast.ts` | `export const` → `const`（仅被同模块 `show` 内部调用） |
| `parseFiletree` | `src/core/gfriends.ts` | `export function` → `function`（仅被同模块 `loadGfriends` 内部调用） |
| `WEBDAV_SALT` | `src/core/webdav-crypto.ts` | `export const` → `const`（仅被同模块 `encryptCredential`/`decryptCredential` 内部使用） |

### 3.3 不准确文案修正

`other-site-plugin` 实际只支持 MissAv + SupJav 跳转，但设置面板文案误举"123AV"。
修正为实际支持的站点：

| 文件 | 改动 |
|------|------|
| `src/components/simple-setting-panel.tsx` | `data-tip` 文案 `如missAv,123AV` → `如missAv,SupJav` |
| `src/plugins/setting-plugin.tsx` | `title` 文案 `如missav,123Av等` → `如missav,supjav等` |
| `src/components/history-source-cell.tsx` | 注释 `javdb/123av` → `javdb`；`"Javdb"/"123Av"` → `"Javdb"` |

## 4. 验证记录

- `grep -rniE "javbus|123av|seejav|javsee|tabulator-zh|TABULATOR_ZH_CN" src/ vite.config.ts`：**零匹配**
- `src/constants/tabulator-zh.ts`：文件已删除
- `tsc -b`：退出码 0
- `vite build`：191 modules，产物 **1206.48 kB（gzip 310.91 kB）**，较 doc/27 后 1206.64 kB **-0.16 kB**（删 RatingNet/tabulator-zh/123av 分支/去 export）
- 各多余 export 去除后，模块内部仍引用这些函数/常量，`noUnusedLocals` 不报错

## 5. 已确认非死代码（保留）

排查中确认以下导出虽 0 外部引用，但被模块内部使用或被外部使用，**非死代码**：
- `API_BASE`/`reBuildSignature`（`constants/api.ts`）：被 `top250-plugin` import + api.ts 内部多处使用
- `ACTOR`/`ACTRESS`/`CENSORED`/`UNCENSORED`/`JAVDB`/`isJavdbSite`/`isSearchOrUserPage`/`currentHref`（`constants/site.ts`）：均被多文件引用
- `isFc2Page`：javdb 的 fc2 搜索页判定（`advanced_search?type=3`），非 fc2 站点支持
