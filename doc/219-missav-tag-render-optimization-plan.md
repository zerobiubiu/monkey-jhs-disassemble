# MissAV 标签首屏渲染提速优化实施计划

> **文档类型**：🔧 开发指导
> **文档状态**：🔧 待执行
> **版本**：计划实施后 1.40.1 → 1.40.2（patch，性能优化）
> **前置分析**：doc/218 会话分析——missav 标签延迟出现的根因

## 1. 背景与问题定位

用户反馈：missav 页面有时等很久才出现状态标签（已收藏/已观看/已屏蔽/已下载）。

根因分析（上一条会话，已核实代码）：

1. **渲染被消费阻塞（主因）**：`MissavStatusTagPlugin.handle()` 的启动序列中，
   `observeAndProcess()`（渲染入口）是**倒数第二步**，而它前面
   `await consumeFull(undefined)` → `await consumeDeltaJournal(...)` → 消费验证 →
   意图恢复全是**串行 await**。首屏标签出现时间 = 全量消费耗时 + 增量消费耗时 +
   初始延迟，而不是「页面就绪」。
2. **全量消费耗时**：600KB gzip 解压 + 5.5 万条 `replaceLocalCars`（3000/批 ≈ 19 个
   IDB 事务）+ 全库游标对账，慢机器 1~3s。
3. **增量逐条串行 + 每条全页重扫**：`consumeDeltaJournal` 对 journal 逐条
   `applyDelta`，每条独立「Web Lock + 读水位线 + 读回滚快照 + IDB 事务」，且每条
   末尾都 `processAll()` 全页扫描一次。积压 256 条时增量消费 1~2s、全页重扫 256 次。
4. **渲染初始延迟 1.5s**：`observeAndProcess()` 内 `setTimeout(tryProcess, 1500)`
   ——即使消费秒完成，标签也要等 1.5s 才首次尝试。
5. **`renderBadges` 强制同步布局**：对每个命中项调
   `window.getComputedStyle(thumbDiv)` 判断定位，批量触发 reflow。

## 2. 目标与不变量

**目标**：首屏标签在页面 DOM 就绪后立即渲染（用 IDB 已有数据），消费完成后刷新为
最新数据；增量积压时避免逐条全页重扫。

**不变量（与消费语义相关，不得破坏）**：

- 修订号门控不变：`shouldApply` / `withSyncRevision` 的拒绝旧/重复逻辑不动；
- 消费顺序不变：全量先于增量、增量按修订号升序；
- 幂等重放不变：任何载荷可重复消费，结果一致；
- 崩溃恢复不变：意图日志 `writeIntent`/`clearIntent` 时序不被破坏；
- 零网络请求、零新增依赖、不引入新 GM 键。

## 3. 方案总览（任务分解）

| 任务 | 改动 | 风险 | 收益 |
|------|------|------|------|
| Task 1 | 渲染与消费解耦：`observeAndProcess()` 提前到消费之前 + 首次尝试改为立即执行 | 低 | 首屏标签不再等全量/增量消费 |
| Task 2 | 增量消费合并页面刷新：`processAll` 从逐条移到批处理后 | 低 | 消除 256 次重复全页扫描 |
| Task 3 | `renderBadges` 消除 `getComputedStyle` 强制同步布局 | 低 | 批量渲染 reflow 消除 |

Task 4（真正批量事务合并）**不纳入本期**：收益需在 Task 1-3 落地后实测评估，
且改动会触及 `withSyncRevision` 单条语义，风险/复杂度不成比例（YAGNI）。

## 4. 任务详情

### Task 1：渲染与消费解耦

**文件**：
- Modify：`src/plugins/car-status-sync/missav-status-tag-plugin.ts`（handle() L210-242 区域 + observeAndProcess() L362-377 区域）

**Interfaces**：
- 无新增导出；仅调整 `handle()` 内部调用顺序与 `observeAndProcess()` 内部首试时机。
- 消费路径（`applyFull`/`applyDelta`）末尾的 `processAll()` 保持不变，保证消费后刷新。

- [ ] **Step 1：把 `observeAndProcess()` 移到消费之前**

当前 handle() 顺序（L210-242）：注册监听 → consumeFull → consumeDeltaJournal →
消费验证 → 意图恢复 → observeAndProcess。

改为（消费前立即启动渲染，消费完成后由 applyFull/applyDelta 末尾的 processAll 刷新）：

```ts
        // 4) 先启动渲染（用 IDB 已有数据立即渲染首屏，不阻塞于全量/增量消费）
        this.observeAndProcess();

        // 5) 页面加载时读取当前 GM 存储全量数据初始化
        await this.consumeFull(undefined);
        await this.consumeDeltaJournal(GM_getValue(GM_KEY_CAR_STATUS_DELTA));
```

注：原注释编号 4/4.5/4.6/5 顺延为 5/5.5/5.6/6，仅注释编号变化，逻辑不动。

- [ ] **Step 2：首次尝试改为立即执行**

`observeAndProcess()` 内（当前 L377）：

```ts
        setTimeout(tryProcess, 1500);
```

改为：

```ts
        // 立即尝试一次：DOM 已就绪时零延迟渲染；未就绪由内部 500ms 重试链接管
        tryProcess();
```

`tryProcess` 内部逻辑不变（`.thumbnail.group` 存在 → processAll；否则 retries++
后 500ms 重试，上限 30 次），因此删除 1.5s 初始延迟后重试链自动兜底。

- [ ] **Step 3：验证**

```bash
bun run build        # tsc -b && vite build，预期通过
bun run lint         # 预期 0 errors / 0 warnings
bun run test         # 预期 132/132 通过
bun run check:structure
```

浏览器实测：missav 列表页/视频页刷新，首屏标签应在 DOM 就绪后立即出现（不再等
全量/增量消费）；消费完成后标签自动刷新为最新状态。

### Task 2：增量消费合并页面刷新

**文件**：
- Modify：`src/plugins/car-status-sync/missav-status-tag-plugin.ts`（consumeDeltaJournal() L419-425 + applyDelta() L469-476）

**Interfaces**：
- `consumeDeltaJournal(value: unknown): Promise<void>` 签名不变；
- `applyDelta(delta)` 私有方法签名不变，但**不再在末尾调用 `this.processAll()`**；
- 依赖：`applyDelta` 仅被 `consumeDeltaJournal` 调用（已核实，无其他调用点）。

- [ ] **Step 1：`applyDelta` 移除逐条刷新**

当前（L474-476）：

```ts
            this.markApplied(revision, 'delta');
            await this.processAll();
            clearIntent(revision);
```

改为：

```ts
            this.markApplied(revision, 'delta');
            clearIntent(revision);
```

（`if (!result.applied)` 分支 L469-472 无 processAll，不动。）

- [ ] **Step 2：`consumeDeltaJournal` 批处理后统一刷新**

当前（L420-425）：

```ts
    async consumeDeltaJournal(value: unknown): Promise<void> {
        const journal = sortDeltaJournal(readDeltaJournal(value));
        for (const delta of journal) {
            await this.consumeQueue.enqueue('consume', () => this.applyDelta(delta));
        }
    }
```

改为：

```ts
    async consumeDeltaJournal(value: unknown): Promise<void> {
        const journal = sortDeltaJournal(readDeltaJournal(value));
        for (const delta of journal) {
            await this.consumeQueue.enqueue('consume', () => this.applyDelta(delta));
        }
        // 批量消费完成后统一刷新一次页面（避免每条增量触发一次全页扫描）
        if (journal.length > 0) {
            await this.processAll();
        }
    }
```

所有调用点（handle 初始化 / GM 监听回调 / 强制重同步 / 意图恢复）均走此统一刷新，
无遗漏。

- [ ] **Step 3：验证**

```bash
bun run build && bun run lint && bun run test && bun run check:structure
```

浏览器实测：javdb 端连续操作 20+ 条后切到 missav，控制台「渲染标签」日志应从
「每条一次」降为「每次消费一次」，页面标签一次到位。

### Task 3：renderBadges 消除强制同步布局

**文件**：
- Modify：`src/plugins/car-status-sync/missav-renderer.ts`（renderBadges() L132-135）

**Interfaces**：
- `renderBadges(container, carMap)` 签名与返回值不变；
- `createBadge` 不变。

- [ ] **Step 1：无条件设置定位容器**

当前（L132-135）：

```ts
        // 确保容器可定位
        if (window.getComputedStyle(thumbDiv).position === 'static') {
            thumbDiv.style.position = 'relative';
        }
```

改为：

```ts
        // 确保容器可定位（无条件设置，幂等；避免 getComputedStyle 强制同步布局）
        thumbDiv.style.position = 'relative';
```

`position: relative` 对已是 relative/absolute 的元素重复设置无副作用，行为等价。

- [ ] **Step 2：验证**

```bash
bun run build && bun run lint && bun run test && bun run check:structure
```

浏览器实测：缩略图批量渲染时标签定位与改前一致（右上角），无样式回归。

## 5. 执行验证记录（待实施后填写）

### 执行环境

### 验证命令

### 实际输出

### 前端或调用方验证

### 验证结论

### 已知限制

## 6. 评估与风险

- **Task 1 提前渲染用旧数据**：消费期间页面显示上次 IDB 数据，消费完成后
  `applyFull`/`applyDelta` 末尾的 `processAll()` 刷新——最终一致，可接受；
- **Task 1 期间并发读**：`processAll` 的 `queryLocalCars`（readonly 事务）与
  `replaceLocalCars`（readwrite）并发——IDB 快照隔离，不同事务无死锁；
- **Task 2 刷新时机**：若某条 `applyDelta` 失败（被 catch），批处理末尾的
  `processAll` 仍执行——用已应用部分渲染，失败条目下次重试，符合幂等语义；
- **不变量**：修订号门控、消费顺序、意图日志、GM 键均不变。

## 7. 后续可扩展（不纳入本期）

- 真正批量事务合并（一次锁内合并 journal 全部 items + 一条水位线），需先提取
  纯函数到 `car-status-journal.ts` 以复用测试基建（`tests/car-status-consume.test.ts`）；
- `queryLocalCars` 逐番号 get → 游标批量匹配（页面缩略图 20-100 个时收益有限，
  100 个 get 在同一事务内已并行，暂不做）；
- 全量消费双读 50ms 固定延迟（一致性收益 > 50ms 成本，不动）。