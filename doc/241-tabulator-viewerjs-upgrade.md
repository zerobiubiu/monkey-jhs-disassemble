# 241 - tabulator-tables 6.5.2 + viewerjs 1.11.8 升级

> 文档类型：🔧开发指导
> 文档状态：✅已执行
> 影响范围：运行时 CDN 库（tabulator-tables / viewerjs）+ vite.config.ts externalGlobals
> 前置文档：239-library-cdn-require.md（CDN 架构）、240-deps-upgrade.md（依赖升级）
> 替代文档：无
> 生效版本：1.46.1

## 1. 背景

doc/240 升级工具链时，7 个运行时 CDN 库保持锁定（版本与 `externalGlobals` URL
严格同步）。用户随后确认：**tabulator-tables 与 viewerjs 可以升级**（npm 包 +
CDN URL 同步），jquery 4.0.0 需验证后再定，暂不动。

## 2. 方案

| 库 | 旧版本 | 新版本 | 升级类型 |
|----|--------|--------|----------|
| tabulator-tables | 6.3.1 | **6.5.2** | minor（bugfix + 新特性），CDN URL + npm 包同步 |
| viewerjs | 1.11.1 | **1.11.8** | minor（bugfix），CDN URL + npm 包同步 |

- `vite.config.ts` `externalGlobals` 两处 URL 同步改版本（npm 打包 CSS 与 CDN
  JS 必须同版本，否则 UI 错位）。
- 其余 5 库（jquery 3.7.1 / layer 1.0.9 / md5 2.19.0 / toastify 1.12.0 /
  localforage 1.10.0）保持不动。
- 版本号 1.46.0 → **1.46.1**（运行时库行为变化，需用户更新脚本）。

## 3. 实施

| 文件 | 改动 |
|------|------|
| `package.json` | tabulator-tables 6.3.1→6.5.2、viewerjs 1.11.1→1.11.8（exact 锁定风格不变）；version 1.46.0→1.46.1 |
| `bun.lock` | bun add 更新 |
| `vite.config.ts` | externalGlobals 两处 URL 版本更新；注释更新（tabulator/viewer 为 doc/241 升级，jquery 待验证）；userscript.version 1.46.1 |
| `doc/README.md` / `changelog/CHANGELOG.md` | 阅读顺序 + 计数 + v1.46.1 条目 |

## 4. 执行验证记录

### 4.1 执行环境

Windows，Bun 1.x，Vite 8.2.1，TypeScript 6.0.3。

### 4.2 验证命令与实际输出

| 命令 | 结果 |
|------|------|
| CDN URL 探测（4 个：两库 JS + 两库 CSS） | ✅ 全部 200，CSS 路径（tabulator_semanticui.min.css / viewer.min.css）不变 |
| `bun run build`（tsc -b && vite build） | ✅ 通过，产物 1,168.21 kB（gzip 299.25 kB），@require 含 tabulator@6.5.2 / viewerjs@1.11.8，@version 1.46.1 |
| tabulator 6.5.2 UMD 全局校验 | ✅ `dist/js/tabulator.js` 尾部仍 `return TabulatorFull`（interop 默认导入不变） |
| 产物 interop | ✅ `window.Tabulator = tabulator_tables.default`，4 段库 CSS 仍在 |
| `bun run test` | ✅ 12 文件 177 用例全绿 |
| `bun run lint` | ✅ 0 errors |
| `bun run check:structure` | ✅ OK |

### 4.3 前端或调用方验证

建议真机回归：黑名单/历史/备份 Tabulator 表格（formatter/排序/分页）、图片查看器
（Viewer 缩放/旋转/全屏）。tabulator 6.5.2 与 viewerjs 1.11.8 均为 v6/v1 系内
minor 升级，API 兼容。

### 4.4 验证结论

✅ tabulator-tables 6.5.2 + viewerjs 1.11.8 升级完成（npm 包 + CDN URL 同步），
全部门禁通过；jquery 3.7.1 保持锁定待验证。

### 4.5 已知限制

- 与原始 archetype 的 tabulator/viewer 版本偏差属**有意升级**（用户确认），
  doc/239 的「URL 与 archetype 完全一致」表述自此对这两库不再成立。
- jquery 4.0.0 升级待用户另行确认后处理（需运行时回归）。

## 5. 后续验证建议

- 真机回归 Tabulator 表格与 Viewer 图片查看器。
- jquery 4.0.0：升级需同步 CDN URL + 全量功能回归（`$` 未类型化调用面广）。