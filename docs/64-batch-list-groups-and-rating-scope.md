# 批量聚合清单与目标视频评价同步范围

> **文档类型**：🧾 变更记录
> **文档状态**：✅ 已执行
> **影响范围**：列表批量清单、目标评价同步、清单自动路由与创建、手动停止及继续
> **前置文档**：63-batch-list-membership-and-recovery.md
> **生效版本**：v1.49.1

## 1. 背景

用户明确修正 v1.49.0 的行为：阻塞等待的评价只属于本次修改清单的视频，其他视频继续后台异步；
选择清单应与详情页一样聚合显示，由脚本自动决定具体编号，不能要求展开逐个选择成员；进度窗口允许手动打断。
本文替代 63 中关于全队列排空、具体清单选择与不允许手动停止的说明，原变更记录保持不变。

## 2. 方案与行为

- `drainBatchRatings(targets, onProgress, signal)` 按当前任务视频匹配已登记的待同步评价，优先匹配网站 videoId，缺 ID 时回退统一番号口径。
- 只接管目标视频的 pending/running/failed；非目标视频不被统计、取消或重试，继续由后台队列推进。不同范围调用保留独立结果，同版本重叠执行避免重复请求。
- 目标在途请求等待完成并回读账本；无关请求不被整体等待。网站仍使用共享评价执行锁，因此单个在途请求结束前，另一个请求可能等待锁，不代表整个后台队列被接管。
- 严格持久化限于目标同步读写临界区，不能在网络等待期间改变无关后台登记的故障处理方式。
- 网站目录按详情页 `buildMergeConfig/groupEntries` 归组，复用合并开关、正则和排除项；界面只展示逻辑名称，不展开编号成员。关闭合并或被排除的条目仍与详情页一样单独显示。
- 加入优先复核影片已在组内的关联，避免塞入第二成员；尚未含片时按序号与未满容量选择具体清单，全满按既有编号规则续建。移出覆盖组内已含片成员。
- 执行时重新读取网站状态，组规则快照、具体路由、创建名称与已尝试标记均可持久恢复。可能已经发出的未知请求不改投其他成员，未知创建先回查，不重复创建。
- 仍然先预写、再发网站请求，网站确认且本地成功提交才计入成功；原跨入口最新意图与关联锁保护保留。
- 运行时可点「停止执行」或按 Escape 请求合作停止，等待已发网络请求确认与本地提交后才关闭；不直接中止已发送请求。评价、具体成员以及创建请求均在新请求边界检查停止信号，等待批量执行锁时也可停止。
- 点击停止即通过独立短锁持久化 `paused` 与暂停修订号，不等待在途网络结算；只更新最新日志中的暂停字段，不覆盖成功状态或具体路由。旧执行快照不能清除暂停，较早排队的继续请求不能覆盖较新的停止；新一次明确继续才解除暂停。
- 未开始或组内部分完成的整视频仍为待完成，不计成功；已有成功项目保持成功。自动恢复跳过暂停任务，明确「继续执行」才解除暂停；关闭后重新打开选择窗也可「继续未完成操作」，按原日志恢复全部未完成操作。
- 仅暂停清单的阻塞补同步；原本属于后台评价队列的未完成意图仍可继续后台推进，其他视频始终不被全局暂停。意外关页、断网及普通失败继续沿用自动回查恢复。

## 3. 实施文件

- `src/plugins/list-page/lp-batch-sync.ts`、`src/plugins/setting/jhs-sync/op-sync-records.ts`：目标范围、后台队列隔离与严格同步临界区。
- `src/types/batch-lists.ts`、`src/plugins/list-page/batch-lists/service.ts`、`journal.ts`、`recovery.ts`：聚合选择、路由/创建恢复信息、目标范围、停止与恢复传递。
- `src/plugins/list-page/batch-lists/site.ts`、`directory.ts`、`groups.ts`：复用详情归组与分配规则，按网站新鲜状态执行。
- `src/plugins/video-lists-tag/vlt-create-list-api.ts`、`server/vlt-create-request.ts`、`server/vlt-create-confirm.ts`：拆分请求与详情 DOM 确认；批量创建不执行返回 JS，不提前写本地。原创建 API 超过 500 行，按职责拆分后各文件低于软上限。
- `src/types/list-intent.ts`、`src/plugins/video-lists-tag/server/vlt-intent.ts`、`db/vlt-db-reconcile.ts`、`vlt-reconcile.ts`：组内未分配成员只作废旧意图，不能被自动补推当成真实加入目标。
- `src/components/list-page/batch-lists-dialog.tsx`、`src/plugins/list-page/batch-lists/dialog.tsx`、`src/styles/list-page/batch-lists.css`：聚合项、自动分配提示及准确的评价范围文案。
- 相关测试、隔离预览 fixture、README、GREASYFORK、架构地图、catalog、版本与 CHANGELOG 同步。

## 4. 后续验证建议

由用户部署后，用少量视频检查聚合显示、已有组内关联幂等、跨容量分配、满员续建、移出多个成员、
创建回执未知后的回查、评价/清单/创建阶段停止后继续、停止后关窗重开的恢复入口，以及其他视频评价在目标同步期间继续后台推进。
本次不操作浏览器、不安装或部署脚本，不把替身测试写为真实账号验收。

## 5. 执行验证记录

### 执行环境

2026-11-02，Windows / PowerShell，使用项目已有 Bun、TypeScript、Vite 与 Vitest；不安装依赖。

### 验证命令与实际输出

以下命令均在仓库根目录执行，退出码均为 0。

| 命令 | 实际输出或关键摘录 | 结论 |
|---|---|---|
| `bun run test` | `Test Files 68 passed (68)`；`Tests 804 passed (804)` | 全量通过，含评价范围隔离、聚合路由、未知创建、手停/继续、在途确认及并发暂停修订号 |
| `bun run build` | `tsc -b && vite build`；`457 modules transformed`；`dist/monkey-jhs-disassemble.user.js 1,389.09 kB / gzip 357.58 kB` | 代码稳定后构建通过；递增版本后重建仍通过 |
| `bun run lint` | `eslint src/`，无错误或警告输出 | 通过 |
| `bun run lint:css` | `stylelint "src/styles/**/*.css"`，无错误输出 | 通过 |
| `bun run check:structure` | `OK (415 files, 69 dirs within limits; 0 file-ceilings, 3 dir-ceilings in ratchet)` | 未抬高结构上限 |
| `bun run check:selectors` | `OK (82 files, 245 literals; 8 file(s) below baseline)` | 未抬高选择器预算 |
| `bun run check:docs` | `OK (43 plugins [5 flagged], 69 core files)` | 目录数据一致 |
| `bun run check:version` | `OK (userscript 1.49.1 = package.json 1.49.1)` | 版本一致 |
| `git diff --check` | 无输出 | 已跟踪文件无空白问题 |

拆分额外执行只读 Node/TypeScript AST 对比脚本（PowerShell here-string 传入 `node`，读取 `git ls-tree/git show HEAD` 与当前源文件）：
输出 `{"baselineCycles":1,"currentCycles":1,"newOrExpandedCycles":[]}`，退出码 0；没有新增或扩大运行时导入环，保留仓库原有的一组环。

前端调用方通过 JSX 渲染契约与 jsdom 接线验证：停止、等待当前请求、继续、关窗后重开、目录失败仍提供恢复入口，以及恢复使用原任务而不是当前勾选。
版本递增遵循先完成源码构建再同步 `package.json`、`vite.config.ts` 与 CHANGELOG；实际核对产物头部为 `// @version 1.49.1`，文件 1,389,093 字节。

### 验证结论与限制

- 开发复查中的暂停竞态回归曾实际失败：旧暂停快照覆盖新路由、在途请求期间未及时保存暂停；修复为短锁内只改暂停字段、独立监听停止立即写入后，两项回归已通过。另补同毫秒下较早继续请求不能解除较新停止的回归。
- 构建仍输出第三方 `layer.css` 既有 IE hack 的 Lightning CSS 容错警告；构建不失败，未修改第三方样式。
- 按用户要求未执行浏览器验收、未部署脚本、未操作任何已有页面；网站真实容量、账号权限及正式运行效果留待用户部署后验收。替身网站适配与 DOM 测试不能视为实站成功证明。
- AOCI 工具发现结果为空，无法调用 `aoci_rules/overview/maintain`，本次未手写正式认知索引。
