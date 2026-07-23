# doc/175 — Wave 2 原子化拆分与复用合并

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

原子化→复用循环第二轮（Wave 2）。在 Wave 1（doc/174）完成 storage-manager / vlt-tags
两个超大文件拆分与 review/related 组件合并后，本轮对 Wave 1 未触及的 6 个插件文件做
原子化拆分，并完成 2 处组件复用合并 + 1 处共享工具抽取，持续压低单文件行数、消除重复
组件、收敛内联 any 块。

## 1. setting-plugin.tsx 拆分（1568→497）

拆出 `src/plugins/setting/` 下五个模块：

| 新模块 | 职责 |
|--------|------|
| webdav-operations.ts | WebDAV 备份/恢复操作 + 凭据校验 |
| cache-management.ts | 缓存查看/清理/导出 |
| setting-form-binder.ts | 表单字段双向绑定 |
| data-import-export.ts | 本地 JSON 导入导出 |
| setting-keys.ts | 设置键常量与类型 |

三处去重/收敛：

- **WebDAV 凭据校验去重**：3 处重复的凭据读取+校验逻辑合并为 `getWebDavCredentials`；
  `autoBackup` 走无 toast 的 `getWebDavCredentialsFromGm`（静默失败，避免自动备份打扰用户）。
- **withLoading 收敛**：5 处 `loading()` + `try/finally` 手动配对改为 `withLoading` 包裹，
  消除遗漏 `loading.close()` 的风险。
- **downloadJson 抽取**：3 处 `Blob` + `createObjectURL` 导出逻辑改为本地 `downloadJson`，
  保留原行为（不引入 `utils.download` 的额外 toast）。

## 2. history-plugin.tsx（782→511）+ blacklist-plugin.tsx（780→441）

两个插件各拆出 tabulator 配置模块 + 业务模块：

| 插件 | 新模块 | 职责 |
|------|--------|------|
| history | history-tabulator.tsx | Tabulator 列配置（复用 core/tabulator-factory） |
| history | history-batch-ops.ts | 批量变更状态业务 |
| blacklist | blacklist-tabulator.tsx | Tabulator 列配置（复用 core/tabulator-factory） |
| blacklist | blacklist-scraper.tsx | 黑名单抓取业务 |

tabulator 配置复用 `core/tabulator-factory` 的 `TABULATOR_ZH_CN` + `createTabulatorOptions`，
消除两处中文本地化与通用选项的重复定义。

**组件复用合并**：history 的源单元格与状态单元格合并为 `shared/colored-text-cell`，
删除 `history-source-cell` / `history-status-cell` 两个字节相同的冗余组件。

## 3. preview-video-plugin.tsx（661→157）+ new-video-plugin.tsx（589→288）

拆出五个模块：

| 新模块 | 职责 |
|--------|------|
| dmm-resolver.tsx | DMM 预告片解析 |
| quality-selector.ts | 画质切换 |
| video-toolbar.tsx | 播放工具栏（快进等） |
| actress-card-renderer.tsx | 演员卡片渲染 |
| avatar-search.tsx | 头像搜索 |

**共享工具抽取**：新增 `core/util/util-status-tag`（`STATUS_TAG_CONFIG` + 位置计算 + 注入），
接入 `list-page-plugin` 两处状态标签渲染，消除重复的标签配置与定位逻辑。

## 4. 副作用：eslint 警告下降

eslint 警告 123→74。拆分后原内联 `any` 块随类型化模块消除（新模块以明确类型签名
替代裸 any），警告净减 49 条。

## 实施清单

| 文件 | 操作 |
|------|------|
| src/plugins/setting-plugin.tsx | 拆分瘦身 1568→497 |
| src/plugins/setting/webdav-operations.ts | 新增 |
| src/plugins/setting/cache-management.ts | 新增 |
| src/plugins/setting/setting-form-binder.ts | 新增 |
| src/plugins/setting/data-import-export.ts | 新增 |
| src/plugins/setting/setting-keys.ts | 新增 |
| src/plugins/history-plugin.tsx | 拆分瘦身 782→511 |
| src/plugins/history/history-tabulator.tsx | 新增 |
| src/plugins/history/history-batch-ops.ts | 新增 |
| src/plugins/blacklist-plugin.tsx | 拆分瘦身 780→441 |
| src/plugins/blacklist/blacklist-tabulator.tsx | 新增 |
| src/plugins/blacklist/blacklist-scraper.tsx | 新增 |
| src/components/shared/colored-text-cell.tsx | 新增（复用合并） |
| src/components/history/history-source-cell.tsx | 删除（冗余） |
| src/components/history/history-status-cell.tsx | 删除（冗余） |
| src/plugins/preview-video-plugin.tsx | 拆分瘦身 661→157 |
| src/plugins/preview-video/dmm-resolver.tsx | 新增 |
| src/plugins/preview-video/quality-selector.ts | 新增 |
| src/plugins/preview-video/video-toolbar.tsx | 新增 |
| src/plugins/new-video-plugin.tsx | 拆分瘦身 589→288 |
| src/plugins/new-video/actress-card-renderer.tsx | 新增 |
| src/plugins/new-video/avatar-search.tsx | 新增 |
| src/core/util/util-status-tag.tsx | 新增（共享工具） |
| src/plugins/list-page-plugin.tsx | 接入 util-status-tag |

## 验证记录

- tsc：0 错
- vitest：28/28
- eslint：0 错（74 warn）
- stylelint：干净
- check:structure：OK（294 文件 46 目录）
