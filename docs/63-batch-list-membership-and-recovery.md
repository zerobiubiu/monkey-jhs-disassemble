# 批量清单关联与中断恢复

> **文档类型**：🧾 变更记录
> **文档状态**：✅ 已执行
> **影响范围**：JavDB 列表批量操作、清单关联、评价同步账本
> **前置文档**：27、31、38、62
> **生效版本**：v1.49.0

## 1. 背景

列表页已有收藏、已读和 1–5 星批量评价，缺少批量控制网站视频清单的入口。
本次用户确认支持加入和移出，失败不计入成功；清单必须实时等待网站确认，
点击开始时先预写以应对关页中断，后续自动核对并唤起续做，同时补齐未完成的批量评价。

## 2. 方案与契约

- 多选后进入「视频清单」，从网站完整分页目录选择一个真实清单，执行加入或移出。
- 点击开始时捕获意图时间与 ID，在同源短日志锁内将完整视频快照写入独立 GM 日志并严格回读，然后才等待长执行锁。等待执行锁期间关页也保留完整任务。后续进度提交在短日志锁内重新读取、合并当前任务，不能抹去并发登记的新任务和替代标记。预写失败时不发送任何网站修改请求，也不改正式关联。
- 执行前接管已经登记的列表评价 `pending/running/failed`，暂停原队列并等在途请求，按本地最新状态过滤已过期操作。已经登记的意图不受随后关闭自动同步开关影响；不会补造未登记的评价。
- 评价请求后回读网站原生评价状态。登录重定向、挑战页、HTTP 2xx 但状态不匹配均不计成功；失败记录不再被自动容量清理淘汰。补同步作用域严格检查 GM 读写及写后回读，损坏或丢写不会被当作零项已完成。
- 清单逐项持有关联锁，先读取权威状态；尚未达到目标才 POST。POST 明确成功或结果不确定后都再次回查，目标清单真实存在且状态符合预期时才写本地 IDB。
- 复用 `handleCheckboxChange` 的原子关联提交与广播，保留已有电影详情字段，禁用详情页自动收藏/自动移出副作用，避免列表页按钮误触。
- 本地关联提交成功后才将该项预写状态提升为 `success`。失败或未知保留 `pending` 和原因，计数中单列成功、待完成和本轮失败；本轮失败是待完成的子集，不相加计算总量。
- 新操作替代同一视频与清单的未完成旧意图；其他清单不受影响。已完成项恢复时不重复执行。原生详情与批量入口共用 GM 最新意图记录和基于 videoId 的关联锁，保留点击时刻而非真正拿锁执行的时刻；旧 native `vltPending` 日志、旧批量日志以及排队的旧操作均不得重新发布覆盖新意图。被后续操作替代的项单列，不冒充成功。
- 详情快捷评价与列表共用执行锁和 latest/revision 校验，旧请求回执不能把新评价标成成功，旧排队请求不再发送。批量拉黑按已读零星推送并保留 `filter` 记录类型，避免恢复时把它误当过期收藏。
- 原生本地独有关联的自动补推也使用同一关联锁，并在锁内重读本地与最新意图；最新目标是移出时不自动加入。整单快照写回在真实写事务内用当前关联和快照影片的并集检查最新意图，相反即返回 conflict、零写入。
- 打开页面、联网、页面重新可见及每 30 秒检查到期任务，重试间隔按 30 秒至 5 分钟退避。恢复先查网站，已生效时只补本地提交。只有脚本所在的同源列表页运行时才有后台检查。
- 原生模态对话框保护焦点与背景交互；运行中没有关闭/取消入口，拦截 Escape 和 cancel，并注册离页提示。浏览器强制关闭无法被脚本绝对阻止，由预写日志恢复。

## 3. 实施文件

- `src/plugins/list-page/lp-batch.tsx`：清单入口接线、选择快照与忙碌保护、恢复生命周期。
- `src/plugins/list-page/lp-batch-actions.ts`：从编排模块提取原评价写入与提示，保留按钮交互；纠正拉黑的远端类型和账本类型。
- `src/plugins/list-page/batch-lists/{journal,service,site,recovery}.ts`：持久日志、执行、网站适配与恢复调度。
- `src/plugins/list-page/batch-lists/dialog.tsx`、`src/components/list-page/batch-lists-dialog.tsx`、`src/styles/list-page/batch-lists.css`：目标选择和不可中断进度视图。
- `src/components/list-page/lp-batch-bar.tsx`、`src/types/batch-lists.ts`：批量按钮及共享契约。
- `src/plugins/list-page/lp-batch-sync.ts`、`src/plugins/setting/jhs-sync/op-sync-records.ts`：可等待的评价排空、Web Lock、版本回执与跨标签刷新。
- `src/constants/status.ts`、`src/plugins/detail-page-button/dpb-rating-api.tsx`：共享评价锁与详情回执版本绑定。
- `src/plugins/setting/jhs-sync/sync-common.ts`、`src/plugins/detail-page-button/dpb-review-sync.tsx`：有界请求与原生评价状态解析复用。
- `src/types/list-intent.ts`、`src/plugins/video-lists-tag/server/vlt-intent.ts`：跨清单入口最新意图契约与严格持久权威。
- `src/plugins/video-lists-tag/server/vlt-server-api.ts`、`vlt-server-recover.ts`、`src/plugins/video-lists-tag/vlt-server.ts`、`vlt-lock-queue.ts`：清单 POST 超时、完整权威分页、点击时刻预写与恢复身份检查、统一关联锁。
- `src/plugins/video-lists-tag/vlt-reconcile.ts`、`server/vlt-reconcile-snapshot.ts`、`db/vlt-db-reconcile.ts`：完整分页解析提取、自动补推重读、写事务内意图守卫。
- 新增清单适配、执行恢复、UI、评价排空及请求故障回归测试；对应根文档、架构地图、catalog、版本与更新日志同步。
- `scripts/site-selector-baseline.json`：原 `vlt-reconcile.ts` 的四个既有选择器逐项迁移到快照模块路径，总基线不增加。

### 大文件与复用评估

`lp-batch.tsx` 原 491 行，加入新编排会超过 500 行软上限，因此先按界面编排/评价写入职责拆出
`lp-batch-actions.ts`。没有改变原评价按钮 JSX；新增清单按钮属于本次功能扩展，既有结构由原渲染回归覆盖。
`vlt-reconcile.ts` 原 494 行，增加跨入口保护前先将完整分页抓取与快照解析按数据获取职责移到
`server/vlt-reconcile-snapshot.ts`，不按行数机械切割。保留原解析与双遍稳定性校验语义。
已将提取后的原抓取/解析函数正文与 HEAD 机械比较，除导出标记外完全一致；快照模块 170 行，对账编排模块 345 行。
所有新增实现文件保持在 500 行以内，不增加依赖、插件注册、存储 schema 或 GM grant。

## 4. 后续验证建议与限制

建议在登录的真实 JavDB 账号用少量视频验收加入、移出、满清单拒绝、断网、关页后恢复、网站登录失效和评分回读。
本次隔离测试不修改真实账号清单或评价，无法宣称真实网站已验收。
恢复日志按站点 origin 隔离；更换域名后不会自动执行旧域名任务，全部页面关闭期间不会执行。
网站账号更换、网站 DOM/API 后续改版以及浏览器或扩展清理存储不属于隔离验证证明范围。

## 5. 执行验证记录

### 执行环境

2026-11-02，Windows、PowerShell，使用项目已有 Bun、TypeScript、Vite、Vitest；未安装依赖。

### 验证命令与实际输出

| 命令 | 实际输出摘录 | 退出码 |
|---|---|---|
| `bun run test` | `Test Files 66 passed (66)`；`Tests 726 passed (726)` | 0 |
| `bun run build` | `453 modules transformed`；`dist/monkey-jhs-disassemble.user.js 1,362.04 kB / gzip 351.06 kB` | 0 |
| `bun run lint` | ESLint 无问题输出 | 0 |
| `bun run lint:css` | Stylelint 无问题输出 | 0 |
| `bun run check:structure` | `411 files, 69 dirs within limits` | 0 |
| `bun run check:selectors` | `82 files, 245 literals`；8 个文件低于基线 | 0 |
| `bun run check:docs` | `43 plugins [5 flagged], 69 core files` | 0 |
| `bun run check:version` | `userscript 1.49.0 = package.json 1.49.0` | 0 |
| `git diff --check` | 无错误输出 | 0 |
| Impeccable `detect --json`，范围为本次四个 UI 源码/样式文件 | `[]` | 0 |

版本按新增功能模块递增 minor 为 1.49.0，并在递增后重新构建；已读取产物头部确认 `@version 1.49.0`。
构建仍输出第三方 layer.css 原有 IE hack 容错告警，构建退出 0，未修改该上游样式。
另用项目已有 TypeScript AST 比较 HEAD 与本次运行时 import/re-export 图：修改前后均 1 个既有环，新增运行时环为 `[]`（退出 0）。
初轮编译在并行实现文件尚未齐全时失败，齐全后构建通过；初轮选择器门禁发现新增裸 `.review-buttons`，改走已有 `detailReviewButtons` 注册键后通过。
快照模块拆分后门禁曾因新路径缺少基线失败，将四项既有基线整体迁移后通过，没有提高总门槛。
独立源码复核最初要求修复详情旧评价回执、跨入口旧清单意图反放、拉黑记录类型不匹配；补齐共享锁、意图身份、点击时刻与事务内守卫后，三项均 resolved，最终结论为 `ship（仅代码范围）`。

### 前端或调用方验证

UI 和恢复测试使用隔离替身，不发真实网站修改请求。最初尝试 Ego 时实际返回
`Failed to connect to ego_cli bootstrap`；没有把连接失败写成浏览器验证通过。
随后用户明确要求不使用 Ego、不做脚本部署验收，并要求只在新开的 Chrome 页面访问 JavDB。
因此停止隔离浏览器验收方案，关闭本次预览服务，不启动额外 Chrome 配置。

通过 Codex 已连接的 Chrome 新开只读 `/users/simple_lists?vid=...` 页面，观察到实际 JSON
`lists` 与 `page`，17 个条目的 checkbox 带 `value`、`data-list-id`、
`data-action="change->list#listCheckboxChanged"`，末页 `page` 为换行文本。
该结构与现有解析器及本次适配一致。只读页面核对后关闭，不点击清单 checkbox、评价或保存按钮。
未部署用户脚本，未验证新版脚本在网站实际执行的视觉效果、请求成功或恢复行为；这些由用户部署后验收。

### 验证结论与已知限制

项目未提供 AOCI MCP 工具且 `.mcp.json` 不存在，无法调用 `aoci_rules`、`aoci_overview` 或 `aoci_maintain`；
本次未手改正式认知索引，源码变化可能使旧索引过期。
