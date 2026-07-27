# 206 - 消除「清单自动校准失败」良性噪音（机会性对账静默化）

> **文档类型**：🔧 开发指导
> **文档状态**：✅ 已执行

## 1. 背景

用户操作清单时频繁出现 toast：

> ⚠ 清单自动校准失败：服务端清单状态已变化，与触发对账时的状态不一致

该提示来自 VLT 清单对账模块 `vlt-reconcile.ts` 的 `performReconciliation`（L259 抛出、
L285 弹出）。排查（仅读代码，未改动）确认：**这是良性安全提示，不丢数据、服务端操作
照常成功**，但在本项目「自动化密集」场景下被频繁触发，构成噪音。本文记录消除该噪音的
方案，用户已确认 ①②③④ 全做，**暂不实现**。

## 2. 根因（排查结论）

对账用**模态框标签显示的数量**（`getDisplayedListCount` 读 `(501)`）作为「预期」，抓取
**真实服务端全量**后比对；不一致即报「状态已变化」。但**显示数量滞后**：

- 标签数量由脚本在**权威校验返回后**才更新（`performServerCheckboxMutation` →
  `fetchAuthoritativeCheckboxState` → `setListDisplayedCount`，`vlt-server.ts` L84）。
- 本地 IDB `actualCount` 也在权威校验后更新（`commitAuthoritativeState`）。
- 二者更新与「自动对账巡检」的读取**无互斥**，存在时间窗。

触发时序（取消勾选 `等待更新2`，500→移除 1 部）：

```
取消勾选 → POST 移除(服务端=500) → commitAuthoritativeState(本地=500)
   │ 此时标签仍显示 (501)，setListDisplayedCount 尚未执行
   └→ runAutomaticReconciliation 读「显示=501 / 本地=500」→ 误判漂移
        → 以预期 501 抓真实 500 → snapshotMatchesExpectation 不一致
        → 「服务端状态已变化」⚠
   （稍后 setListDisplayedCount 才把标签刷成 500）
```

**本项目更易触发的原因**：doc/124（评星→移出等待更新，一次连删多个）、doc/53（加入→
自动收藏）、doc/125（加入他清单→取消等待更新）、doc/200 合并面板（转发原生 checkbox，
走同一 VLT 管线）共同制造「同一批等待更新清单上的快速连续操作」，撑大上述时间窗；
大清单（501，约 20 页 + 双完整快照比对）抓取窗口长达数秒， further 提高撞窗概率。

**良性判定**：本地镜像的正确性由**权威校验路径**（`commitAuthoritativeState` 用
`simple_lists` 权威值校准）保证；失败的对账只是**冗余的后台/前置补校**在追一个已滞后的
显示数字。`reconcileListBeforeMutation` 失败也不阻断写入（`postJavdbListMutation` 照常），
操作后权威路径仍会校准本地。故该 toast 为噪音。

## 3. 方案（用户确认 ①②③④ 全做）

核心思路：**不改任何数据行为，只把两处"机会性对账"的失败降为静默；保留真正兜底的告警；
并拉长自动巡检防抖从源头减少误判。**

| # | 改动 | 位置 | 内容 |
|---|---|---|---|
| ① | 静默后台巡检对账 | `vlt-reconcile.ts` `runAutomaticReconciliation`（约 L372-377 的 `reconcileListWithJavdb(...)` 调用） | `quiet: false` → `quiet: true` |
| ② | 静默变更前预校对账 | `vlt-reconcile.ts` `reconcileListBeforeMutation`（约 L332-337 的 `reconcileListWithJavdb(...)` 调用） | `quiet: false` → `quiet: true` |
| ③ | **保留**真兜底告警 | `vlt-reconcile.ts` `reconcileAfterConfirmedMutation`（约 L341-347） | **保持 `quiet: false` 不变**（权威校验本身失败后的真兜底，值得告警） |
| ④ | 拉长自动巡检防抖 | `vlt-reconcile.ts` `AUTO_RECONCILE_DELAY`（L14） | `350` → `800`（ms），让 `setListDisplayedCount` 先刷显示再巡检 |

> ①② 仅改 `reconcileListWithJavdb` 调用的 `quiet` 参数（参数现成）；④ 调一个常量。
> `performReconciliation` 的 `clog.error`（L282）**不受 quiet 影响，照常打印**——排查能力保留。

## 4. 安全性论证（为何"最安全"）

- **零数据行为变更**：`snapshotMatchesExpectation` 校验 + 双完整快照比对**原样保留**，
  对账仍会**拒绝写入不一致快照**；仅失败时不再弹 toast。
- **真正的安全网仍在且有声**：本地正确性靠权威路径 `commitAuthoritativeState`；它失败时
  的提示「本地完整清单将在下次打开页面时继续校准」**保留**；③ 的兜底告警也**保留**。
- **可排查**：所有对账失败仍 `clog.error('[JavDB][清单对账] 失败…')` 进日志。
- **爆炸半径极小**：2 处 `quiet` 参数 + 1 个常量，无逻辑分支改动。

## 5. 不选的方案（及理由）

- **放宽 `snapshotMatchesExpectation` 计数校验**（别把显示滞后当成状态变化）：更贴近根因，
  但改动 doc/126 作者刻意设的严格对账语义，有引入隐性同步 bug 风险，不符合"最安全"。**不选。**
- **全部静默（连 ③ 也静音）**：会吞掉真正的同步失败信号，过度。**不选。**

## 6. 涉及修改的模块（仅列，不实现）

| 文件 | 改动 |
|---|---|
| `src/plugins/video-lists-tag/vlt-reconcile.ts` | ① `runAutomaticReconciliation` 对账调用 `quiet:true`；② `reconcileListBeforeMutation` 对账调用 `quiet:true`；③ `reconcileAfterConfirmedMutation` 保持 `quiet:false`；④ `AUTO_RECONCILE_DELAY` 350→800 |

（无类型/接口变更，无新增依赖。）

## 7. 验证方式

1. `bun run build`（tsc -b 零错误）+ `bun run test`（现有套件全绿）+ `bun run lint`（0 告警）。
2. **实测（登录 JavDB）**：
   - 在 `等待更新` 清单上快速勾选/取消、评星触发自动移出 → **不再弹「清单自动校准失败」**。
   - clog 控制台仍可见 `[JavDB][清单对账]` 日志（排查能力保留）。
   - 构造权威校验失败场景（如临时断网后操作）→ 仍应见「…将在下次打开页面时继续校准」
     及 ③ 兜底告警（真信号保留）。
   - 数据一致性：操作后清单数量、501 上限判断、本地镜像均正常。

## 8. 预期效果

- 日常操作 / 评星自动移出等待更新 → 不再弹良性「校准失败」。
- 真正同步失败（极少）→ 仍提示，值得留意。
- 数据一致性、上限判断、本地镜像校准 → 一切照旧。

## 9. 执行验证记录（2026-07-27）

①②③④ 已实现：① `runAutomaticReconciliation` 对账 `quiet:true`；② `reconcileListBeforeMutation`
对账 `quiet:true`；③ `reconcileAfterConfirmedMutation` 保持 `quiet:false`；④ `AUTO_RECONCILE_DELAY`
改为可变 `autoReconcileDelay`（默认 800）+ `setAutoReconcileDelay()`，由 VLT 插件 handle 从设置
`autoReconcileDelay` 注入（设置 UI 见 doc/207 清单管理器「对账校准」分区）。

```
$ bun run build      # tsc -b 零错误，✓ built
$ bun run test       # 103 passed
$ bun run lint       # 0 errors / 0 warnings
$ bun run check:structure   # OK
```

版本随 doc/207 清单管理器重构一并 minor +1（1.32.1→1.33.0）。
