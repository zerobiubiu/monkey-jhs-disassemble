# 评价与清单同批配置执行

> **文档类型**：🧾 变更记录
> **文档状态**：✅ 已执行
> **影响范围**：视频流批量设置、评价准备与恢复、清单进度窗口
> **前置文档**：64-batch-list-groups-and-rating-scope.md
> **生效版本**：v1.49.2

## 1. 背景

用户希望同一批视频的评价与清单可以一次配置执行，也可以分别操作，避免先改评价后重新选择视频再修改清单。
本次沿用现有批量评价快捷按钮，并在清单窗口加入可选评价设置；聚合清单、网站确认、暂停及继续的既有约束继续生效。

## 2. 方案与行为

- 工具条「评价与清单」打开统一窗口，可选「不修改评价 / 收藏 / 已读」；已读支持 0–5 星。
- 默认不修改评价，仍可只操作聚合清单；只改评价继续使用原快捷收藏、已读和星级按钮，保持后台异步设置及行为。
- 组合设置只点一次开始：先严格预写清单、评价及全部视频，再准备本地评价和网站同步账本，只阻塞同步目标视频的未完成评价，随后执行聚合清单。
- 组合中明确选择的新评价会同步网站；原快捷评价的 `autoServerSync` 设置保持原有行为。
- 新评价使用稳定意图身份及登记顺序，恢复不生成一次更晚的评价；准备阶段独立记录，不能把本地已达标误当成网站成功。
- 初次日志短锁内分配同批评价顺序；并发组合即使同毫秒捕获也有独立顺序。只允许日志中证明的较早组合成为合法前序，未知后续详情/快捷评价仍需保留。
- 准备前检查登记时的评价意图和本地状态；发现较新的评价则保留后续操作。评价与清单分别保留完成状态，清单失败时无需重新设置已完成评价。
- 组合评价回执在交接给任务日志前保留，不因容量裁剪或清理提前丢失；正常旧历史的裁剪不会误判为一次新评分。
- 本地 `car_list` 的六个公开读改写入口共用短写锁；组合评价在同锁内检查最新状态和意图后才提交，避免旧写入覆盖详情页后来评分。锁不包含网站网络请求。
- 手动停止仍立即保存暂停意图，在途请求确认后停止后续项目；继续使用原组合记录，不依赖当时页面勾选或重新选择设置。
- 组合窗口关闭后刷新状态标签与评分索引，保留当前勾选，方便继续处理同批视频。

## 3. 实施文件

- `src/types/batch-lists.ts`、`src/plugins/list-page/batch-lists/journal.ts`、`service.ts`：可选评价、逐项准备记录、严格校验与执行编排。
- `src/plugins/list-page/batch-lists/ratings.ts`、`src/plugins/setting/jhs-sync/op-sync-records.ts`：评价本地准备、稳定身份登记与恢复。
- `src/core/storage/car-list-ops.ts`：共享本地读改写锁和条件批量提交，保留原公开方法签名与通知语义。
- `src/components/list-page/batch-lists-dialog.tsx`、`lp-batch-bar.tsx`、`src/plugins/list-page/batch-lists/dialog.tsx`、`src/styles/list-page/batch-lists.css`：可选设置、统一开始与进度文案。
- `src/plugins/list-page/lp-batch.tsx`：组合执行后刷新卡片评价与索引。
- 相关回归测试、README、GREASYFORK、架构地图、catalog、版本与 CHANGELOG 同步。
- 新增 `tests/batch-lists-ratings.test.ts`、`tests/batch-lists-composition.test.ts`、`tests/car-list-write-lock.test.ts`，扩展既有 service/UI 测试；组合接线使用真实 StorageManager、条件提交及任务/评价账本，仅隔离网站适配与网络排空。

本次新增模块与触及模块均低于 500 行软上限，无新增目录、依赖或插件，不调整结构及选择器棘轮。

## 4. 后续验证建议

由用户部署后，少量视频验证收藏加清单、已读五星加清单、单独清单和快捷评价；检查准备/网站请求/清单阶段停止后的恢复，
以及评价成功但清单失败时仅补剩余工作。确认其他视频仍后台异步，并检查移动宽度下表单布局。

## 5. 执行验证记录

### 执行环境

2026-11-02，Windows / PowerShell，使用项目已有 Bun、TypeScript、Vite、Vitest，不安装依赖。

### 验证命令与实际输出

以下均在仓库根目录实际执行，退出码均为 0。

| 命令 | 实际输出或关键摘录 | 结论 |
|---|---|---|
| `bun run test` | `Test Files 71 passed (71)`；`Tests 863 passed (863)` | 全量通过 |
| `bun run build` | `tsc -b && vite build`；`458 modules transformed`；产物 `1,406.38 kB / gzip 361.02 kB` | 稳定源码构建通过；版本递增后重建通过 |
| `bun run lint` | `eslint src/`，无错误或警告输出 | 通过 |
| `bun run lint:css` | `stylelint "src/styles/**/*.css"`，无错误输出 | 通过 |
| `bun run check:structure` | `OK (416 files, 69 dirs within limits; 0 file-ceilings, 3 dir-ceilings in ratchet)` | 未抬高上限 |
| `bun run check:selectors` | `OK (82 files, 245 literals; 8 file(s) below baseline)` | 未抬高预算 |
| `bun run check:docs` | `OK (43 plugins [5 flagged], 69 core files)` | 索引计数一致 |
| `bun run check:version` | `OK (userscript 1.49.2 = package.json 1.49.2)` | 版本一致 |
| `git diff --check` | 无输出 | 已跟踪文件无空白错误 |
| 已有 `impeccable.exe detect --json` 加三个 UI/CSS 路径 | `[]` | 本次静态扫描无发现；未启动浏览器 |

另执行只读 Node/TypeScript AST 脚本，以 `git cat-file --batch` 读取 HEAD 并对比当前源码，`newOrExpandedCycles: []`，退出码 0。
实际核对产物 `dist/monkey-jhs-disassemble.user.js` 为 1,406,385 字节，头部 `@version 1.49.2`。

复查曾实际复现两项失败：旧组合本地写覆盖后来详情评分、同毫秒两个组合中较新评分被旧组合变化取消。
接入真实共享存储写锁/条件提交及日志内登记顺序后，对应真实组合接线文件 5 项全部通过；最终全量结果如上。
前端验证通过 JSX 渲染与 jsdom 接线覆盖默认仅清单、收藏/已读五星组合、原快捷评价保留、恢复不携带当前新选择、评价未确认与清单结果分开显示。

### 验证结论与限制

- 本次实现与项目检查已完成，保留原未提交改动；未提交、推送或切换分支。
- 按用户既有要求未操作浏览器、未部署脚本；未触碰任何已有页面。替身及 DOM 接线测试不能视为实站验收。
- 构建仍输出第三方 `layer.css` 既有 IE hack 的 Lightning CSS 容错警告，构建退出码为 0；未修改第三方样式。
- 原独立快捷评价入口保持原有后台同步设置；组合配置明确选择的新评价执行网站同步。
- AOCI 工具发现结果为空，无法调用其运行合同或维护接口，未手工改写正式认知索引。
