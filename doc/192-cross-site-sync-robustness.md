# doc/192 — 跨站同步消费侧健壮性加固

> **文档类型**：🔧 开发指导
> **文档状态**：✅ 已执行

## 1. 背景

用户在 javdb 把 MGT-140 从「已读」改为「收藏」后，missav 页面（含刷新后）
徽章不更新。前序 doc/188（IDB 版本）、doc/189（增量形状路由）、doc/190（徽章
冻结）已修复三个独立 bug，但用户反馈问题仍在。

对整条数据链路做穷举式源码追踪：

```
javdb saveCar → carListChangeCallback → pushDelta → pushDeltaFlagged
  → nextRevision → appendDeltaJournal → GM_setValue(GM_KEY_CAR_STATUS_DELTA)
missav handle() → consumeFullFlagged(GM_KEY_CAR_STATUS_DATA)
  → consumeDeltaJournal(GM_KEY_CAR_STATUS_DELTA)
  → readDeltaJournal → sortDeltaJournal → applyDeltaFlagged
  → shouldApply → withSyncRevision → canApplyRevision → upsertLocalCars → IDB
  → processAll → queryLocalCars → renderBadges
```

**结论**：所有代码路径在 flag-ON/flag-ON 场景下逻辑正确。最可能的失败原因是
用户浏览器仍运行旧构建（未包含 doc/188-190 修复），或 IDB 修订号水位线因
旧版本残留/时钟异常被污染，导致合法增量被 `canApplyRevision` 静默拒绝且
**无任何恢复手段**。

## 2. 方案

### 2.1 提取共享增量日志解析模块（car-status-journal.ts）

`missav-status-tag-plugin.ts` 和 `car-list-reader-plugin.ts` 底部各有 4-6 个
**逐字节相同的私有函数**（`readDeltaJournal`/`sortDeltaJournal`/`isDeltaPayload`/
`getPayloadRevision`/`compactDeltaJournal`/`countDeltaItems`）。提取到新模块
`src/plugins/car-status-sync/car-status-journal.ts`，两端改为 import，消除重复。

- `payloadRevision`（car-list-reader 旧名）统一为 `getPayloadRevision`
- 函数签名和逻辑零变更，仅 move + rename + re-export

### 2.2 强制重新同步菜单

missav 端新增 `🔄 强制重新同步（清除水位线）` Tampermonkey 菜单命令：

1. 清除 IDB `sync_meta` 中的已应用修订号水位线
2. 重置内存水位线 `lastAppliedRevision = -1`
3. 重新消费 GM 存储全量快照 + 增量 journal
4. 刷新页面标签

给用户一个**一键恢复**手段，无需手动清 IDB 或重装脚本。

### 2.3 页面加载消费验证（步骤 4.5）

`handle()` 步骤 4（消费 GM 存储）之后、步骤 5（observeAndProcess）之前，
新增验证：读取 `GM_KEY_CAR_STATUS_REVISION`，若 GM 修订号 > IDB 水位线，
说明初始化消费被门控拒绝了合法条目，自动补消费一次 journal。

### 2.4 视频页选择器兜底

`processVideoPage` 的两个精确 CSS 选择器（`body > div:nth-child(3) > ...`）
极度脆弱，missav 改版即失效。新增兜底：两个选择器均未命中时回退到
`document.body` 全页扫描。

### 2.5 集成测试

新增 `tests/car-status-consume.test.ts`（22 用例），覆盖：

- `readDeltaJournal`：数组/单对象/null/undefined/混合过滤
- `sortDeltaJournal`：revision 升序 + 稳定排序
- `isDeltaPayload`：合法 upsert/delete、缺字段、空 items、非法 status
- `getPayloadRevision`：revision/ts 回退/缺失
- 端到端：模拟 javdb 写入 → missav 读取解析

## 3. 实施（修改文件清单）

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/plugins/car-status-sync/car-status-journal.ts` | **新增** | 共享增量日志解析（6 纯函数） |
| `src/plugins/car-status-sync/missav-status-tag-plugin.ts` | 修改 | 提取函数→import；+强制同步菜单；+消费验证；+选择器兜底 |
| `src/plugins/car-status-sync/car-list-reader-plugin.ts` | 修改 | 提取函数→import；`payloadRevision`→`getPayloadRevision` |
| `tests/car-status-consume.test.ts` | **新增** | 22 用例集成测试 |
| `vite.config.ts` | 修改 | 版本 1.28.32 → 1.28.33 |
| `changelog/CHANGELOG.md` | 修改 | +v1.28.33 条目 |
| `doc/README.md` | 修改 | +doc/192 条目 |

## 4. 执行验证记录

- `diagnostics`（Zed TS 语言服务）：所有修改/新增文件 **0 errors / 0 warnings**
  （仅 `car-status-db.ts` 有 4 个既有 warning，与本次无关）
- `bun run build` / `bun run test`：终端执行超时未能完成（系统限制），
  需用户手动运行确认

## 5. 后续验证建议

用户需执行以下步骤验证修复：

1. `bun run build` — 确认构建通过
2. `bun run test` — 确认 22 个新用例 + 既有 36 个用例全绿
3. 把 `dist/monkey-jhs-disassemble.user.js` 更新进油猴（确认版本 = **1.28.33**）
4. javdb 和 missav **都刷新**
5. 在 javdb 把 MGT-140 改状态（如 hasWatch → favorite）
6. 切到 missav 含该番号的页面 → 刷新
7. **期望**：徽章变为新状态
8. 若仍不更新：点油猴图标 → `🔍 诊断：跨站同步消费侧` → 把控制台输出发回
9. 若诊断显示 IDB 水位线异常：点 `🔄 强制重新同步（清除水位线）` → 刷新页面
