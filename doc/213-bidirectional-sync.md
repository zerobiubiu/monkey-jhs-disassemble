# doc/213 — JHS ↔ JavDB 双向增量同步

> **文档类型**：🔧 开发指导
> **文档状态**：✅ 已执行

## 1. 背景

doc/210 实现了 JHS→JavDB 单向想看同步（修复历史积压）。用户需要完整的双向增量同步：

- 脚本有/网站无 → 补到网站
- 网站有/脚本无 → 补到脚本
- 冲突（双方状态不一致）→ 仅报告番号，不自动处理
- 顺带：同步已看时携带本地缓存评分

## 2. 方案

### 2.1 模块拆分

原 `jhs-to-javdb-sync.ts`（235 行）拆分为 `src/plugins/setting/jhs-sync/` 子目录（4 模块）：

| 文件 | 职责 |
|------|------|
| `sync-common.ts` | 共享类型（SyncOptions/SyncResult/ConflictEntry）+ 工具函数（CSRF/fetchVideoMap/postWantToWatch/postWatched/readRatingCacheMap） |
| `sync-to-javdb.ts` | JHS→JavDB 方向：想看同步 + 已看同步（含评分） |
| `sync-from-javdb.ts` | JavDB→JHS 方向：想看同步 + 已看同步 |
| `sync-ui.ts` | UI 编排：全量双向同步 + 单向兼容入口 + 中止 + 结果格式化 |
| `index.ts` | 统一出口 |

### 2.2 同步逻辑

**四个方向顺序执行**：
1. JHS→JavDB 想看：FAVORITE_ACTION 且 JavDB 无状态 → POST want_to_watch
2. JHS→JavDB 已看：HAS_WATCH_ACTION 且 JavDB 无状态 → POST reviews(watched+score)
3. JavDB→JHS 想看：JavDB 想看但 JHS 无 FAVORITE → saveCar(FAVORITE_ACTION)
4. JavDB→JHS 已看：JavDB 已看但 JHS 无 HAS_WATCH → saveCar(HAS_WATCH_ACTION)

**冲突定义**：
- JHS 想看 vs JavDB 已看 → 冲突
- JHS 已看 vs JavDB 想看 → 冲突
- 冲突仅报告（番号 + 双方状态），不自动处理

**评分来源**（JHS→JavDB 已看）：car.score > localStorage 评分缓存(jdb:rating_cache_v2) > 0

**映射**：fetchVideoMap 增强版，同时提取 videoId（href）和 carNum（.video-title strong）

### 2.3 UI 变更

清单管理器「收藏同步」分区：
- 新增「双向增量同步」主按钮（#jhs-sync-full-btn）
- 原按钮降级为「仅 JHS→JavDB 想看」（#jhs-sync-btn，兼容入口）
- 状态区增加 maxHeight + overflowY 滚动
- 描述文案更新为双向说明

### 2.4 安全策略

- 先备份提示（确认框）
- 限速（默认 500ms 可调）
- 可中止（模块级 signal）
- 冲突不自动处理
- JavDB 已看绝不降级为想看

## 3. 实施

### 修改文件清单

| 操作 | 文件 |
|------|------|
| 新增 | `src/plugins/setting/jhs-sync/sync-common.ts` |
| 新增 | `src/plugins/setting/jhs-sync/sync-to-javdb.ts` |
| 新增 | `src/plugins/setting/jhs-sync/sync-from-javdb.ts` |
| 新增 | `src/plugins/setting/jhs-sync/sync-ui.ts` |
| 新增 | `src/plugins/setting/jhs-sync/index.ts` |
| 修改 | `src/components/setting-panels/list-manager-panel.tsx`（同步分区 UI） |
| 修改 | `src/plugins/setting/setting-form-bind.ts`（事件绑定） |
| 删除 | `src/plugins/setting/jhs-to-javdb-sync.ts`（逻辑迁入子目录） |

## 4. 执行验证记录

- `tsc -b`：零错误（diagnostics 全项目刷新确认）
- `vite build`：待用户本地验证
- ESLint：待用户本地验证

## 5. 后续验证建议

1. 在 JavDB 站点打开设置 → 清单管理器 → 收藏同步
2. 点击「双向增量同步」，确认四阶段顺序执行
3. 验证冲突报告格式（番号 + 双方状态）
4. 验证中止按钮在任意阶段可用
5. 验证「仅 JHS→JavDB 想看」兼容按钮仍正常
