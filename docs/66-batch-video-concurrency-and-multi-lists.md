# 逐视频并发执行评价与多选清单

> **文档类型**：变更记录
> **文档状态**：已执行
> **影响范围**：视频流批量操作、跨页恢复、评价互斥、基础配置
> **前置文档**：65-batch-rating-and-list-composition.md
> **替代关系**：修正 65 的整批评价先行编排；沿用稳定意图、确认回执及手动暂停约束
> **生效版本**：v1.49.3

## 1. 背景

用户反馈组合操作先执行全部视频评价，再统一修改清单；清单仅能单选；新开 JavDB 页面会把已有运行误当中断并唤醒恢复；要求默认两个视频并发且可在设置菜单修改。

原执行器先准备整批评价并调用一次全目标排空，再串行处理清单。恢复调度通过查询锁后打开窗口，存在查询与实际认领之间的竞态；评价网络自身还持有全局长锁，仅增加外层 worker 不能实现真实并发。

## 2. 方案与行为

- 清单改用复选框，可同时选择多个独立清单或逻辑组。搜索仅隐藏不匹配行，不清除勾选；一次提交完整视频、评价及全部清单意图。
- 按视频分配并发槽：准备并结算该视频评价，再处理所有未完成清单，随后处理下一视频。不再设置全批评价屏障；同视频的多个恢复任务仍顺序处理。
- 「设置 → 基础配置 → 网络请求 → 批量操作并发视频数」默认 2。允许正整数，缺省或非法值回到 2；小数不截断。保存后，下次开始或继续执行读取新值；实际 worker 数不超过待处理视频数。
- 评价失败已结算时仍可完成独立清单步骤，但该视频不会计为整体成功。成功数以评价责任与所有清单均终态的视频计算，失败视频去重计数；失败及未知结果保留恢复记录。
- 评价网络按 `videoId` 互斥，后台队列、组合排空、详情快捷与自动对账入口共用；共享 GM 账本及本地准备使用短锁，不在网络期间持有全局锁。自动对账取得锁后重读本地与网站状态，跳过已完成或已被新本地评价替代的旧判断。原快捷评价仍按既有设置后台推送。
- 自动恢复原子申请同源执行锁的 `ifAvailable`，成功后才读取最新到期任务及打开窗口。运行中页面持锁时其他页立即跳过，不排队重放，不按心跳超时将慢请求或后台页面判为失活。
- GM 运行键发布 token、任务身份和进度，实际运行权以浏览器锁为准。执行结算即释放锁，等待结果窗关闭在锁外进行，避免「继续执行」等待自己的锁。
- 新日志为 v2：每视频独立记录评价完成状态及各清单的状态、错误、路由。读取边界严格验证并迁移 v1，保留旧任务身份、时间、暂停修订、评价和不确定创建路由；新写仅使用 v2。
- 并发进度按视频合并，保留其他 worker、新登记任务及后续替代/暂停标记。新任务只替代重叠视频与清单的未完成关联，不取消其他清单或独立评价。
- 手动停止立即保存暂停意图，等待已发请求确认后返回；不会自动重启。继续仅补未完成步骤，已成功评价及关联不重复提交。不可持久化错误也须等待其他已发 worker 结算后再释放执行锁。
- 保留已有组级容量/创建锁，防止并发分配造成重名续建或超过容量；未改变清单对账及网站确认规则。

## 3. 实施文件

### 执行与持久化

- `src/types/batch-lists.ts`
- `src/plugins/list-page/batch-lists/service.ts`
- `src/plugins/list-page/batch-lists/journal.ts`
- `src/plugins/list-page/batch-lists/executor.ts`（新增）
- `src/plugins/list-page/batch-lists/execution-state.ts`（新增）
- `src/plugins/list-page/batch-lists/recovery.ts`
- `src/plugins/list-page/batch-lists/ratings.ts`

### 评价互斥与调用方

- `src/plugins/list-page/lp-batch-sync.ts`
- `src/plugins/setting/jhs-sync/rating-locks.ts`（新增）
- `src/plugins/detail-page-button/dpb-rating-api.tsx`
- `src/plugins/detail-page-button/dpb-review-sync.tsx`
- `src/constants/status.ts`
- `src/plugins/setting/setting-form-bind.ts`

### 界面与配置

- `src/constants/batch-operations.ts`（新增）
- `src/components/list-page/batch-lists-dialog.tsx`
- `src/plugins/list-page/batch-lists/dialog.tsx`
- `src/styles/list-page/batch-lists.css`
- `src/components/setting-panels/base-panel.tsx`
- `src/plugins/setting/setting-form-load.ts`

### 验证及说明

- 新增 `tests/batch-lists-execution.test.ts`、`batch-lists-journal.test.ts`、`batch-lists-test-env.ts`、`lp-rating-concurrency.test.ts`、`setting/batch-concurrency.test.ts`。
- 更新 service、composition、ratings、UI、drain、batch-sync、batch-actions、detail-rating 相关回归与 `tests/browser/batch-lists-ui.ts` 预览。
- 同步 README、GREASYFORK、AGENTS 架构地图、catalog、文档索引、两处版本与 CHANGELOG。

执行器按编排、逐视频执行、运行权、日志职责拆分，触及源码均未新增超过 500 行的文件，无新增插件、核心模块或依赖，不提高结构及选择器棘轮。

## 4. 后续验证建议与边界

安装构建产物后，可用少量实际视频核对登录会话、真实网络失败和清单容量边界。并发过高可能触发网站限流，默认保持 2；同一逻辑清单的容量/续建临界区仍会互斥。

本次没有向真实 JavDB 账户发写请求，也没有安装脚本、提交或推送。浏览器网络为本机模拟网站，GM API 由该隔离源的 localStorage 适配；执行器、评价请求实现、回读解析、Web Locks、localforage/IndexedDB 和 UI 使用真实源码。该证据不等同于 Tampermonkey 沙箱或真实站点端到端验收。
夹具的评价账本模块先于 GM 适配初始化，使用模块内存回退；清单任务日志通过 GM 适配共享，影片和清单关联使用真实 IndexedDB。跨页面评价账本持久化及旧回执保护另由独立模块上下文和严格存储回归覆盖，不能把本次浏览器冒烟视作原生 GM 存储验收。

## 5. 执行验证记录

### 环境

2026-11-05，Windows，项目已有 Bun、TypeScript、Vite、Vitest；使用 omp 现有配置启动的 Chromium 标签页。未安装依赖，未改浏览器配置。

### 命令与输出

| 验证 | 实际输出 | 结论 |
|---|---|---|
| `bun run test` | `75 passed (75)`；`917 passed (917)` | 自动对账补齐后的最终全量通过 |
| `bun run test tests/batch-lists-execution.test.ts tests/batch-lists-ratings.test.ts` | `2 passed (2)`；`43 passed (43)` | 类型修正后的相关路径通过 |
| `bun run build` | `462 modules transformed`；`1,420.49 kB / gzip 364.40 kB`；产物版本 `1.49.3` | 自动对账补齐后 TypeScript 与构建通过 |
| `bun run lint` | 退出码 0，无告警 | 通过 |
| `bun run lint:css` | 退出码 0，无告警 | 通过 |
| `bun run check:structure` | `OK (420 files, 69 dirs within limits; 0 file-ceilings, 3 dir-ceilings in ratchet)` | 未提高预算 |
| `bun run check:selectors` | `OK (82 files, 245 literals; 8 file(s) below baseline)` | 无新增裸站点依赖 |
| `bun run check:version` | `OK (userscript 1.49.3 = package.json 1.49.3)` | 版本一致 |
| `bun run check:docs` | `OK (43 plugins [5 flagged], 69 core files)` | 文档计数一致 |

首次构建发现运行状态清理值 `null` 不符合现有 GM 类型声明，以及回调内可选评价对象未收窄；分别改为既有 JSON 编码边界的 `'null'` 和局部稳定引用后构建通过。构建保留第三方 layer.css 既有 IE hack 容错警告，未修改第三方样式。

补查发现详情页自动对账未接入共享视频锁；新增回归先实际观察到重复提交（在途4星时新页面又调用4星推送）。修复为按视频等待并读取新鲜两端状态，连同“等待期间新评分优先”两项回归在最终全量 917 项中通过。

### 真实浏览器隔离冒烟

通过临时本机 HTTP 服务运行真实模块，使用两个独立标签页及共享同源存储。临时入口/服务脚本已删除，两个标签页及服务已关闭。

| 场景 | 观测与断言 |
|---|---|
| 默认并发与两清单 | 4 视频，真实评价网络峰值 2；4 次评价 POST、8 次清单 POST、8 条本地关联；全部完成 |
| 修改并保存并发 | 输入 3、保存并重开仍为 3；下一批 4 视频网络峰值 3；4 次评价 POST、8 次清单 POST、8 条本地关联 |
| 跨页恢复检查 | 第一页同时持有批量执行锁及 3 个不同视频评价锁；第二页启动后实际尝试恢复认领 1 次，窗口数 0，未新增重复请求 |
| 逐视频顺序 | 每视频评价完成后才发该视频清单请求；前三视频的两清单完成后才开始第四视频评价 |
| 新详情页自动对账 | 独立双标签运行真实drain与autoSyncReviewState，先装GM适配再加载模块；一个4星请求在途时启动第二页自动对账，最终仅1次POST、2次GET、网络峰值1，持久账本success/4星；本地记录读取使用共享固定夹具 |
| 在途停止与继续 | 3 个评价在途时停止，3 个请求均确认结束、任务 paused=true，尚未发送清单请求；继续后全批累计仍仅4次评价、8次清单POST，8条本地关联 |
| 选择与视觉 | 选择第一清单→搜索第二清单并勾选→清空搜索，仍保留2项；实际截图核对多选窗和带标签的并发输入 |

浏览器工具的默认 `page.evaluate` 与页面主世界全局隔离，初期探针误判初始化；改为 DOM 等待及当前标签页 CDP 主世界读取后完成上述断言。临时工具夹具的 `structuredClone` 调用绑定错误已纠正，不涉及产品源码；未把夹具失败当成产品失败或成功证据。
