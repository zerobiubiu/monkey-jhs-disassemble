# doc/174 — Wave 1 原子化拆分与复用合并

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

Round-2 审计后执行首轮原子化 + 复用合并循环，目标：降低单文件行数、消除重复组件、
抽取共享工具。本轮覆盖 storage-manager / vlt-tags 两个超大文件的原子化拆分，
review/related 两组近同组件的复用合并，以及 5 个共享工具的新增与接入。

## 1. storage-manager.ts 拆分（1321→415）

拆出 `src/core/storage/` 下六个仓储模块：

| 新模块 | 职责 |
|--------|------|
| car-list-ops.ts | 车牌清单 CRUD |
| blacklist-ops.ts | 黑名单 CRUD |
| blacklist-car-list-ops.ts | 黑名单车牌清单 |
| favorite-actress-ops.ts | 收藏演员 CRUD |
| keyword-ops.ts | 关键词 CRUD |
| storage-migrations.ts | 版本迁移逻辑 |

类保留薄委托 + 类型再导出（`CarRecord` / `BlacklistItem` / `FavoriteActress` 等），
外部 `from '../core/storage-manager'` 零改动；type-only 循环导入安全。

## 2. vlt-tags.ts 拆分（1028→421）

拆出三个模块：

| 新模块 | 职责 |
|--------|------|
| vlt-filter-bar.ts | 筛选栏渲染与交互 |
| vlt-tag-renderer.ts | 标签渲染 |
| vlt-sync-listener.ts | 同步事件监听 |

## 3. 组件复用合并

- review/ 与 related/ 七对近同组件 → `src/components/shared/` 参数化组件
  （section-header / containers / status-message / end-message / error-message / load-more）
- vlt-panel + missav-panel → `sync-panel`
- 新增 `colored-text-cell`
- 删除 16 个冗余组件文件
- review-item / related-item 因字段不同保留

## 4. 共享工具新增

| 工具 | 职责 |
|------|------|
| core/util/util-translate | 翻译去重，带 10s AbortController |
| core/util/util-async | withLoading 包装器 |
| core/util/tabulator-factory | zh-cn locale + 基础配置工厂 |
| core/util/back-to-top | 回到顶部按钮 |
| core/toast.failWithToast | 失败 toast 包装 |

接入 list-page / translate / top250 / hit-show / want-and-watched / dpb-subtitle /
gfriends / list-waterfall / base-plugin / api 共 10 处调用点。

## 5. 门禁修复

- 补 storage-migration 的 `clean_no_url_blacklist` / `async_merge_other` 两个实例方法
  委托以恢复测试 seam。
- tabulator-factory / back-to-top 由 core 根目录归入 core/util，使 src/core 直接文件
  回落至 28 上限内。

## 实施清单

| 文件 | 操作 |
|------|------|
| src/core/storage/car-list-ops.ts | 新增 |
| src/core/storage/blacklist-ops.ts | 新增 |
| src/core/storage/blacklist-car-list-ops.ts | 新增 |
| src/core/storage/favorite-actress-ops.ts | 新增 |
| src/core/storage/keyword-ops.ts | 新增 |
| src/core/storage/storage-migrations.ts | 新增 |
| src/core/storage-manager.ts | 瘦身为薄委托 |
| src/plugins/video-lists-tag/vlt-filter-bar.ts | 新增 |
| src/plugins/video-lists-tag/vlt-tag-renderer.ts | 新增 |
| src/plugins/video-lists-tag/vlt-sync-listener.ts | 新增 |
| src/plugins/video-lists-tag/vlt-tags.ts | 瘦身 |
| src/components/shared/*.tsx | 新增（7 参数化组件） |
| src/components/setting-panels/sync-panel.tsx | 新增 |
| src/components/setting-panels/vlt-panel.tsx | 删除 |
| src/components/setting-panels/missav-panel.tsx | 删除 |
| src/core/util/util-translate.ts | 新增 |
| src/core/util/util-async.ts | 新增 |
| src/core/util/tabulator-factory.ts | 新增 |
| src/core/util/back-to-top.ts | 新增 |
| src/core/toast.ts | 新增 failWithToast |
| 16 个冗余组件文件 | 删除 |

## 验证记录

- tsc：0 错
- vitest：28/28
- eslint：0 错（123 warn 基线）
- stylelint：干净
- check:structure：OK（281 文件 41 目录）
