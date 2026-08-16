> **文档类型**：🔧 开发指导 / 🧭 架构决策
> **文档状态**：✅ 已执行
> **影响范围**：JavDB Origin 的大型 localStorage 缓存、恢复日志、备份导入导出；MissAV 跨站状态保持不变
> **前置文档**：`docs/README.md`、`docs/plugin-catalog.md`
> **替代文档**：无
> **生效版本**：v1.46.4

# IndexedDB 持久数据迁移

## 1. 背景

JavDB Origin 的 `localStorage` 由大型缓存和恢复日志共同使用。当前 `jhs_translate` 约 7 MB，前五个业务缓存合计约 9.29 MB，已导致 VLT 恢复日志写入触发 `QuotaExceededError`。浏览器检查同时确认：现有 `JAV-JHS/appData` 已保存 64,507 条 `car_list`、VLT 数据和评分备份；MissAV Origin 的 `MissAV-CarStatus/cars` 已保存 64,507 条记录，均不应在本次迁移中复制或重构。

## 2. 方案与决策

- 新建独立 IndexedDB：`JAV-JHS-PersistentData`，不改变 `JAV-JHS` 与 `MissAV-CarStatus` 的数据库版本。
- 大型 localStorage 对象按 namespace + entryKey 拆成独立 `records` 记录，避免每次更新重写整个 JSON。
- 使用 `meta` 记录 `copying → verified → cleanup-pending → complete` 状态；校验成功后才删除已迁移旧副本。
- JavDB 启动时执行迁移；MissAV 只保留现有 IndexedDB 与 GM 跨站同步。
- `jdb:rating_cache_v2` 与现有 `JAV-JHS/appData/jhsRatingDisplay_data` 合并后以现有 IDB key 为唯一来源，避免产生第三份副本。
- 未知旧 key（包括 `jdb:rating_cache_v1`、旧版时间戳、`appUser`、`car:MTMD-001`）不自动删除。
- 旧备份中的 `__localStorage` 仍可导入，新备份增加 `__persistentData`。

## 3. 迁移范围

大型缓存：`jhs_translate`、`jhs_dmm_video`、`jhs_other_site`、`jhs_other_site_dmm`、`jhs_screenShot`、`jhs_actress_info`、`jhs_score_info`、`jhs_visit_history`。

恢复数据：`jhs:sync_session_v1`、`jdb:vlt-pending-server-sync:*`、`jhs:car-sync-intent:*`、`jhs:reflow:journal`、`jhs:reflow:rollback:*`。

保持原位置：用户设置、授权令牌、签名短缓存、GM 跨站状态、广播 key、sessionStorage、`JAV-JHS/appData/*` 和 `MissAV-CarStatus/*`。

## 4. 实施文件

- 新增 `src/core/storage/persistent-data-backend.ts` 与 `src/core/storage/persistent-data-store.ts`：独立 IDB 后端、内存镜像、namespace CRUD、批量事务写入、迁移状态。
- 新增 `src/core/storage/persistent-data-migration.ts`：旧 localStorage 解析、复制、校验、清理和旧备份兼容。
- 修改 JavDB 缓存插件、恢复日志、评分缓存、缓存管理和备份导入导出。
- 修改 `src/main.tsx`：仅 JavDB 在现有 `JAV-JHS` 迁移后、插件执行前启动持久数据迁移。
- 新增存储与迁移单元测试；不引入生产依赖。

## 5. 旧版本和失败处理

旧版已知缓存 key 与当前格式兼容；未知 key 保留。迁移失败、JSON 损坏、IndexedDB 不可用或校验不一致时保留旧副本，并让兼容读取路径继续工作。旧版脚本不会读取新数据库，迁移后降级可能重新生成缓存，但不影响新数据库中的数据。

## 6. 执行验证记录

### 执行环境

- WSL/Linux；项目目录 `/mnt/e/monkey-jhs-disassemble`
- Bun 依赖已按锁文件安装；未修改浏览器站点数据

### 验证命令

- `bun run test`
- `bun run lint`
- `bun run lint:css`
- `bun run check:structure`
- `bun run build`
- `git diff --check`

### 实际输出

- Vitest：14 个测试文件、188 个用例全部通过。
- ESLint：通过（0 error）。
- Stylelint：未通过，命中仓库既有 `src/styles/fold-category-plugin.css` 的 2 个大小写规则错误；本次未修改该文件。
- 结构门禁：`OK`，373 个文件、63 个目录在限制内。
- 生产构建：通过；产物约 1,187.23 kB，gzip 约 303.64 kB。
- `git diff --check`：通过；Git 对仓库既有 CRLF 文件给出换行提示，不影响校验。

### 前端或调用方验证

启动流程仅在 JavDB Origin 初始化并迁移 `JAV-JHS-PersistentData`；MissAV 不打开该库。备份 payload 增加 `__persistentData`，导入时等待 IndexedDB 写入完成后再刷新页面；缓存/恢复日志调用方已切换到 namespace 适配层。

用户于 2026-08-16 在真实 JavDB 标签页执行只读验证：迁移状态为 `complete`，数据库包含 `meta`/`records` 两个对象仓库，共 62,008 条格式正常的记录；迁移涉及的旧 localStorage key 均已清理，验证脚本未发现问题。

### 验证结论

代码、类型、单元测试、ESLint、结构门禁和生产构建通过；Stylelint 仍有未改动文件的既有错误。真实浏览器验证确认当前实例的迁移状态为 `complete`。迁移失败时保留旧副本，未知键不自动删除。

### 已知限制

当前浏览器验证是在迁移完成后进行的，旧副本已删除，因此无法事后逐条对比迁移前后的完整数据内容；也尚未完成跨标签页对照、备份恢复和 VLT 恢复日志写入的专项验证。未知旧 key 仍不在自动清理范围内。
