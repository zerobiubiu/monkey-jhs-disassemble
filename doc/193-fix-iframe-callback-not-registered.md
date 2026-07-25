# doc/193 — 修复 iframe 详情页增量回调未注册导致跨站同步静默失败

> **文档类型**：🔧 开发指导
> **文档状态**：✅ 已执行

## 1. 背景

用户报告：在 javdb 详情页把 MGT-140 从「已读」改为「收藏」后，missav 页面
（含刷新后）徽章不更新。

前序 doc/188（IDB 版本）、doc/189（增量形状路由）、doc/190（徽章冻结）、
doc/192（消费侧健壮性）修复了四个独立问题，但用户反馈问题仍在。

### 诊断数据（用户提供）

javdb 端 `🔍 诊断：跨站同步发布侧` 输出：

```json
{
  "site": "javdb",
  "version": "1.28.33",
  "flag": true,
  "gmRevision": 1784727753092,
  "carListRev": 0,
  "syncedRev": 0,
  "journal": { "length": 0, "entries": [] },
  "fullSnapshot": { "revision": 1784859700433, "count": 60380 }
}
```

**关键异常**：
- `journal.length: 0` — 增量 journal 为空，标记收藏时 delta **从未写入**
- `carListRev: 0` — `GM_KEY_CAR_LIST_REV` 从未递增，`pushDeltaFlagged` **从未成功执行**
- `fullSnapshot.ready` 缺失 — 快照由旧版非 flag 路径发布（无 `ready`/`mode`/`revision`）

## 2. 根因分析

javdb 详情页通过 **layui 弹窗 iframe** 打开。`CarListReaderPlugin.handle()` 首行：

```ts
if (window.self !== window.top) return;
```

在 iframe 中直接返回，导致 `storageManager.setCarListChangeCallback(...)` **从未执行**。

当用户在 iframe 中点「收藏」时：
1. `favoriteOne()` → `storageManager.saveCar(...)` → `saveCar(sm, input)`
2. `saveCar` 触发 `sm.carListChangeCallback?.({ action: 'upsert', upserts: [car] })`
3. 但 iframe 中的 `storageManager.carListChangeCallback` 是 `undefined`（从未注册）
4. `undefined?.()` → **静默跳过**，不报错、不推送、不递增 `carListRev`

全量同步也永不重跑：`carListRev=0, syncedRev=0` → `needsSync=false` → 跳过。
missav 永远只能拿到首次加载时的旧快照。

## 3. 修复方案

将 `setCarListChangeCallback` 调用移到 iframe 守卫**之前**：

```ts
async handle(): Promise<void> {
    // 增量回调必须在所有帧（含 layui 详情页 iframe）注册
    storageManager.setCarListChangeCallback(
        (event: CarListChangeEvent) => {
            this.pushDelta(event);
        }
    );

    // 菜单命令、全量同步、诊断仅在 top frame 执行（避免 iframe 重复注册）
    if (window.self !== window.top) return;
    // ...
}
```

每个帧有独立的 `storageManager` 实例（Tampermonkey 每帧独立执行脚本），
callback 注册互不干扰。iframe 中 `saveCar` 触发 callback → `pushDelta` →
`pushDeltaFlagged` → `GM_setValue` 写入 journal → missav 消费。

菜单命令、全量同步、诊断菜单仍限制在 top frame（避免多 iframe 重复注册）。

## 4. 实施

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/plugins/car-status-sync/car-list-reader-plugin.ts` | 修改 | callback 注册移到 iframe 守卫前；删除原位置重复注册 |
| `vite.config.ts` | 修改 | 版本 1.28.33 → 1.28.34 |
| `changelog/CHANGELOG.md` | 修改 | +v1.28.34 条目 |
| `doc/README.md` | 修改 | +doc/193 条目 |

## 5. 执行验证记录

- `diagnostics`（Zed TS 语言服务）：`car-list-reader-plugin.ts` **0 errors / 0 warnings**
- `bun run build` / `bun run test`：终端超时未能完成，需用户手动运行

## 6. 后续验证建议

1. `bun run build` — 确认构建通过
2. 更新油猴脚本（确认版本 = **1.28.34**）
3. javdb 和 missav **都刷新**
4. 在 javdb **详情页**（layui 弹窗 iframe 中）把 MGT-140 改状态
5. 切到 missav 含该番号的页面 → 刷新
6. **期望**：徽章变为新状态
7. 再次运行 `🔍 诊断：跨站同步发布侧`，确认 `journal.length > 0` 且 `carListRev > 0`
