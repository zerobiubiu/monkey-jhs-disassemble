# doc/216 — 编号清单整理 期2b/2c：韧性层 + 体验层

> **文档类型**：🔧 开发指导
> **文档状态**：✅ 已执行

## 1. 背景

doc/204 期2a 已实现核心写路径（先加后删 + 权威校验 + 试运行闸）。
期2b 叠加韧性层（自适应退避 + 恢复日志/续传 + 批检查点 + 整次撤销），
期2c 叠加体验层（进度条 + 汇总报告 + 续传/撤销按钮）。

## 2. 期2b 韧性层

### 2.1 恢复日志 + 回滚日志（lr-journal.ts）

- **恢复日志**（localStorage `jhs:reflow:journal`）：执行前写 running，每批更新 nextIndex/completed/failed，
  完成标 done 并清除。支持续传：面板初始化检测未完成日志 → 显示「继续上次整理」按钮。
- **回滚日志**（localStorage `jhs:reflow:rollback:{sessionId}`）：每完成一步追加
  `{videoId, addedTo, removedFrom}`。供整次撤销（逆序反向搬运）。

### 2.2 自适应退避

- 失败时退避升档（间隔 ×2，最高 ×8），成功时逐步降回正常。
- 连续失败达 maxRetry（默认 3）→ 暂停执行（status=suspended），等用户续传。
- 进度回调暴露 `backoffLevel` 供 UI 显示当前退避档位。

### 2.3 批检查点

- 每 batchSize（默认 20）个操作保存一次恢复日志（nextIndex/completed/failed）。
- 中断后从 nextIndex 续传，幂等兜底（不变式2）。

### 2.4 整次撤销（undoSession）

- 按回滚日志逆序执行反向搬运：先加回 removedFrom，再删 addedTo。
- 同样串行 + 限速 + 可中止。
- 面板「撤销本次整理」按钮触发（执行完成且有成功步骤时显示）。

## 3. 期2c 体验层

### 3.1 进度条

- 面板新增进度条（绿色填充 + 百分比文本 + 退避档位标注）。
- 每步更新，实时反映执行进度。

### 3.2 汇总报告

- 执行完成后显示报告区：成功数 / 失败数 / 待清理重复 / 失败明细（最多 20 条）。

### 3.3 按钮

- 「继续上次整理」：检测到未完成恢复日志时显示，从断点续传。
- 「撤销本次整理」：执行完成且有成功步骤时显示，一键反向搬运。

## 4. 实施

### 修改文件清单

| 操作 | 文件 |
|------|------|
| 新增 | `src/plugins/list-reflow/lr-journal.ts`（恢复日志 + 回滚日志） |
| 重写 | `src/plugins/list-reflow/lr-execute.ts`（期2a+2b 合并：退避/检查点/回滚/撤销） |
| 重写 | `src/plugins/list-reflow/lr-panel.tsx`（集成续传/撤销/进度条/报告） |
| 修改 | `src/components/list-reflow/reflow-panel.tsx`（新增进度条/续传/撤销/报告挂载点） |
| 修改 | `src/styles/list-reflow/list-reflow.css`（进度条/报告/按钮样式） |
| 修改 | `tests/lr-execute.test.ts`（新增 lr-journal mock） |
| 修改 | `vite.config.ts`（version 1.38.1→1.39.0） |

## 5. 执行验证记录

- 全项目 diagnostics：源码零错误零警告
- 测试文件诊断通过（lr-journal mock 已添加）
- 待用户本地 `bun run build` + `bun run test` 确认

## 6. 后续验证建议

1. 在 /lists/{id} 清单页识别编号组 → 生成计划 → 执行整理
2. 试运行 K 个后确认继续 → 观察进度条实时更新
3. 中途点击「中止」→ 刷新页面 → 确认「继续上次整理」按钮出现 → 续传
4. 执行完成后确认「撤销本次整理」按钮出现 → 点击撤销 → 确认反向搬运
5. 故意制造连续失败（如断网）→ 确认暂停 + 续传正常
6. 确认汇总报告正确显示成功/失败/待清理明细
