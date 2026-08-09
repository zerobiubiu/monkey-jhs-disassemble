# 10 清单管理（doc/200–217 融合）

> **文档类型**：📄 参考说明（历史文档阶段融合）
> **文档状态**：📄 参考
> **阶段范围**：doc/200–doc/217（详情页序号清单合并 → 编号清单整理 ListReflow → 自动收藏/移除联动 → 收藏双向同步 → Git 备份通道）
> **合并说明**：本文档由 `doc/` 下 200–217 共 18 份历史文档按时间线精简融合而成。删除构建命令输出回放、逐条验证步骤回放、边缘情况穷举与重复的产物尺寸记录；保留背景/根因、方案与关键决策、实施要点（模块/文件级）、结果与演进链。文中 "(doc/NN)" 为历史事件标识，指向原 `doc/NN-*.md`。
> **前置文档**：doc/53/124/125（自动收藏/移除联动的「等待更新」旧模型）、doc/126（VLT 服务端/本地对账语义）、doc/55（`triggerJavdbWantAndSyncRatingBar` 引入）、doc/171（WebDav 明文备份策略）、doc/199（GM 请求导航头）
> **替代文档**：doc/200–217（原文件随后删除）
> **生效版本**：userscript version 1.31.0 → 1.40.0

## 阶段概览

本阶段围绕「清单管理」展开：以详情页序号清单合并（doc/200）为源头，衍生出两条主线——**编号清单整理 ListReflow**（doc/201 期0 调查 → doc/202 期1 只读预览 → doc/203 组识别修复 → doc/204 期2 实写执行方案 → doc/216 期2b/2c 韧性层+体验层）与**自动收藏/移除联动及收藏同步**（doc/205 泛化受保护模型 → doc/206 对账消噪 → doc/207 清单管理器设置页 → doc/208 三项优化 → doc/209 `pluginManager` 未定义根治 → doc/210 JHS→JavDB 批量同步 → doc/213 双向增量同步 → doc/214 独立设置页+引擎重写），其间穿插 CSS/类型/瀑布流小修复（doc/211/212/215）与 Git 备份通道（doc/217）。

阶段内 userscript 版本从 1.30.4 演进至 1.40.0，测试用例从 95 增至 132。**doc 编号顺序与实现顺序不完全一致**：204/205/206 均为「先计划存档、后分批实现」，且 doc/207 用户确认了执行顺序「doc/206 → 清单管理器设置页 → doc/205 → doc/204 分期」，故实际版本链为 206+207（1.33.0）→ 205（1.34.0）→ 204 期2a（1.35.0）→ 208（1.35.1）→ 209（1.35.2）→ 210（1.36.0）→ 211（1.36.1）→ 213（1.37.0）→ 214（1.38.0）→ 215（1.38.1）→ 216（1.39.0）→ 217（1.40.0）。

## 一、详情页清单序号清单合并（doc/200）

### 背景/根因

视频详情页清单平铺面板（`.jhs-list-panel`）逐条列出用户全部自建清单。用户按「文字+序号」习惯维护同源清单（如 `等待更新1/2`、`迫切想看1/2/3`）时，面板被大量同源清单占据；且 JavDB 单清单上限 501 部，满了需手动新建下一序号清单并重新勾选，操作繁琐。

需求：同前缀序号清单在面板**合并为一行**；勾选时脚本**自动**把当前影片放入 JavDB 服务端最靠前的未满清单（按末尾序号 1→2→3 优先），满 501 顺延，全满则**自动新建**下一序号清单。

### 方案与决策

**分组规则**（正则 `^(.+?)(\d+)$`，可在设置自定义）：`等待更新2` → base=`等待更新`/num=`2`；base 全数字（纯数字清单名如 `2024`）不参与合并；**D1=A** 单个序号清单也按 base 展示（overflow 行为统一）；裸名（完整名 == 某组 base）吸收为该组 num=0 最优先成员；**D5=B** 设置「不参与合并的清单名」，完整名或 base 命中即回退为原名单条。

**加入路由**：勾选合并行 → 组内已有成员含此片则提示「已在组中」（幂等）；否则按序号升序取第一个**未满（count<501 且非禁用）且未含片**成员转发原生勾选；全满则 `createList(base+最大序号+1)` 自动新建（建清单自动关联当前影片），完成后重渲染。

**移除路由（D2=A）**：取消勾选 → 从组内**所有含片成员**串行移除（相邻 change 间隔 220ms，避免 JavDB ajax 竞态）。

**展示**：合并行复用 `.jhs-list-item` 结构——名称=base、数量丸=组成员总数、勾选态=任一成员含片、**D4=B 半选态**（部分含片时 `indeterminate` 虚线边框）；附「▸ N 个清单」展开明细（各成员序号/名称/数量/已含/已满）与「整理」按钮。

**「整理」按钮（跨影片回填不可行）**：详情页接口 `/users/simple_lists?vid=` 仅返回**当前影片**的清单归属与各清单总数，无法获知其他影片分布，故跨影片回填不可行（属未来清单页功能）。本版实现为**当前影片在组内的去重收敛**：若影片同时占组内多个清单，移除其余、仅保留最靠前的未满清单。

**设置项（D3=A）**：`listMergeEnabled`（开关，默认开启）/ `listMergePattern`（自定义正则，留空用默认）/ `listMergeExcludeNames`（逗号分隔排除名），存于 `settingObj`（开放索引签名，无需改类型），`saveForm` 后 `refresh()` 重载生效。

### 实施要点

| 文件 | 改动 |
|------|------|
| `dpb-list-merge.ts` | **新增** 纯逻辑：`parseListName`/`compileMergePattern`/`isMergeExcluded`/`buildMergeConfig`/`groupEntries`/`isMemberFull`/`sortMembersByNum`/`pickTargetMember`/`nextListName`/`computeGroupCheckState` + 常量（`DEFAULT_LIST_MERGE_PATTERN`/`LIST_FULL_THRESHOLD=501`） |
| `dpb-list-merge-ui.ts` | **新增** DOM 与路由：`buildMergedRow`/`forwardListGroupChange`/`reflowGroup`/`toggleGroupDetail`/`syncMergedRowsForListId` 等；复用 VLT `createList` 与 `util-misc.sleep` |
| `dpb-list-panel.tsx` | `renderListPanel` 注入分组；`forwardListPanelChange` 识别合并行转路由；`syncListPanelInputState` 增同步；`bindListPanelControls` 增展开/整理点击委托 |
| `detail-page-button-plugin.tsx` | 新增 `_listMergeConfig` 字段（默认关闭直至加载），`handle()` 详情页分支加载 |
| `base-panel.tsx` / `setting-form-load.ts` | 「清单收藏合并」分区（开关+正则+排除名）；3 字段读写（排除名以 `string[]` 持久化） |
| `rating-bar.css` | 合并行样式（`__bar`/`__toggle`/`__reflow`/`__detail`/`__member*` + `indeterminate` 虚线边框），复用既有调色板，无 `transition: all` |
| `tests/dpb-list-merge.test.ts` | **新增** 33 个纯逻辑单测（解析/容错/排除/配置/归组/满员/选取/命名/勾选态） |

**两个关键决策**：①合并模块保存成员 `{listId, 序号, count, checked, disabled}` 元数据即可路由——`forwardListPanelChange` 始终基于常驻隐藏的原生 `#modal-save-list [data-list-target="listContainer"]` 按 listId 定位，路由不依赖成员行是否渲染；②VLT 的 `createList` 在详情页语境已验证安全，**直接 import 复用、不上移 core**（避免 VLT 回归风险）。合并行 DOM 以 `document.createElement` 命令式构建（与既有 `createListPanelEntry` 一致，非字符串模板，不违规）。

### 结果

`tsc -b` 零错误；5 套件 95 用例通过（含 dpb-list-merge 33 用例）；ESLint 0 errors/0 warnings；version `1.30.4` → `1.31.0`（新增功能模块，minor+1）。用户登录实测（2026-07-27）反馈「详情页版本我已经试过了，功能逻辑没啥问题」。

### 演进链与遗留

跨影片回填（清单页版）属独立后续功能，即 doc/201 的期0 调查与 doc/202 起的 ListReflow 主线。doc/200 的合并面板与后续 doc/205 的 Feature B 存在交互（移除取消原生 checkbox → modal observer → `syncMergedRowsForListId` 响应式刷新合并行）。

## 二、编号整理期0 可行性调查（doc/201）

### 背景/根因

doc/200 的详情页合并只能管「新片往哪放」（前向填充），无法**跨影片回填**（把高位清单的影片挪到低位清单空位，恢复「低序号先填满」不变式）；该能力须放在清单页实现。本文是 doc/200 预留的「期0 只读调查」，**不含任何代码变更**。

### 调查发现（关键：端点风险已消解）

原以为最大变数是「加入/移除端点未知需逆向」，调查发现项目早已封装好成熟可复用的增删管线：

| 能力 | 位置 | 要点 |
|------|------|------|
| 加入/移除端点 | `vlt-server-api.ts` `postJavdbListMutation` | `POST /users/save_video_to_list`（X-CSRF-Token + body `{video_id, checked, list_id}`），**页面内原生 fetch（same-origin）**继承浏览器 Cloudflare 通行态，比 `GM_xmlhttpRequest` 安全得多；返回成功/失败 → `confirmed/rejected/unknown` |
| 权威状态校验 | `fetchAuthoritativeCheckboxState` | 分页读 `/users/simple_lists?vid=`，返回 `{checked, count, name}`，可在每次增删后复核 |
| 健壮管线参照 | `vlt-server.ts` `performServerCheckboxMutation` | 串行队列（`enqueueAssociationTask`）+ 恢复日志（`createPendingJournal`/localStorage）+ 增删后权威校验 + 失败回滚 |
| 组发现 | `/users/lists` 页 | 每条 `a[href*="/lists/{id}"]` 文本形如「清单名 (数量)」（`fetchListIdByName` 已用此解析并去数量后缀），分页用 `a.pagination-next`；复用 doc/200 `parseListName` 归组 |
| 清单内影片枚举 | `/lists/{id}` | 标准 javdb 视频网格页：`.movie-list .item` + `.pagination-next` 翻页；影片 ID 取 `a[href*="/v/"]` → `/v/([^/?#]+)` |
| CSRF | `getCsrfToken()` | 读 `meta[name=csrf-token]`（Rails 全站 meta），清单页同样存在 |

### 方案与决策

**可行性结论：可行，端点/校验/组发现/枚举均有现成基础，无需逆向**；主要工作量在「批量执行引擎的安全性」（预演/中止/续传/限速）与「枚举开销」。

**组内压实功能设计草案**（纯逻辑，可单测）：给编号组 `等待更新1..N`，把已有影片重排为「低序号先填满 501 才往后」——①枚举组内各清单影片（保序），全组去重得有序影片流；②按 501 容量依次分配（前 501→清单1，次 501→清单2……）得目标归属；③diff 现态/目标得搬运列表 `(videoId, fromListId, toListId)`；④排序执行（本文建议**先移除后加入**，避免目标清单满 501 拒绝加入）。

**风险与约束**：枚举开销大（一个 3 清单组约需数十次翻页）；破坏性（必须「只读预演 → 明确确认 → 小批量 → 可中止 → 可续传 → 权威复核」）；语义需用户拍板（清单内顺序是否保留、多序号清单重复影片收敛）；满员时序；Cloudflare 限流（限速+失败退避）。**工期约为 doc/200 的 2–3 倍**。

**建议分期**：期1 只读预览（清单页注入「本编号组状态」面板 + 生成压实计划预览，**不执行任何写入**，几乎零风险）；期2 写入（预演确认后才执行，带限速/中止/续传/权威复核）。

### 结果

纯只读代码 survey，无网络请求、无数据写入、无代码变更。复用清单：`postJavdbListMutation`/`fetchAuthoritativeCheckboxState`/doc/200 `parseListName`/`groupEntries`/`findNextUrl`/`getSelector` 等。

## 三、编号整理期1 只读预览（doc/202）

### 背景/根因

doc/201 确认端点风险消解。本期实现**期1 只读预览**：在清单页识别同前缀编号组、生成组内压实计划预览，**不执行任何写入**（执行=期2）。

**压实规则（用户约定，固化进规划器）**：
1. **不保留**清单内影片顺序（规划可最小化搬运）；
2. **同 base 仅序号不同**的多个清单中重复出现的影片，组内**只保留一份**（顺带审计收藏错误）；
3. **不同 base** 的清单归属**全部保留**——压实只在单个 base 组内横向搬运。

### 方案与决策

**模块结构**（`src/plugins/list-reflow/`）：`lr-types.ts`（共享类型）/ `lr-planner.ts`（纯压实规划器，可单测）/ `lr-data.ts`（组发现+影片枚举，只读原生 fetch）/ `lr-plan.ts`（枚举驱动+计划预览渲染）/ `lr-panel.tsx`（面板挂载与交互）/ `list-reflow-plugin.ts`（`ListReflowPlugin`，`pageTypes:['list']`+`sites:['javdb']`+`/lists/{id}` 守卫）；另加 `components/list-reflow/reflow-panel.tsx` 外壳组件与 `styles/list-reflow/list-reflow.css`（**首个 CSS 子目录**，守 §11 扁平度门禁）。

**压实规划算法（`planCompaction`）**：①统计组内归属 `video → 清单集合`，得去重影片流与重复影片；②目标容量按序号升序每清单填满 501 再往后（复用 `LIST_FULL_THRESHOLD`）；③分配**先就近保留**（各清单现含影片在目标容量内留原位，最小化搬运），剩余影片按升序填空位，超出组总容量者记 `overflow`；④由现态/终态 diff 出搬运明细（`removeFrom` 多余归属 + `addTo` 目标清单）。

**分组规则复用**：复用 doc/200 `parseListName`/`isMergeExcluded`/`buildMergeConfig`——与详情页合并共享同一套分组配置（`listMergePattern`/`listMergeExcludeNames`），仅新增独立开关 `listReflowEnabled`（默认开启）。

**面板交互（按需触发，避免无谓请求）**：清单页注入折叠面板 →「识别编号组」抓 `/users/lists` 发现同 base 组、渲染各清单数量/满员行 →「生成整理计划」枚举组内影片+规划，渲染只读预览：汇总（去重总数/重复数/搬运次数）、目标分布、**收藏错误审计**（组内重复影片）、**溢出**（组容量不足）、搬运明细（前 100 条折叠）。面板明确标注「期1 仅预览，不执行任何写入」。

### 实施要点

新增 8 文件（list-reflow/ 6 模块 + reflow-panel.tsx + list-reflow.css）；`main.tsx` import + javdb 块注册；`plugin-registry.ts` PluginMap 增映射；`base-panel.tsx`/`setting-form-load.ts` 增 `listReflowEnabled`；`tests/lr-planner.test.ts` 新增 8 个压实规划单测。约束：§11 扁平度（`src/styles` 直接文件已达棘轮上限 38，故新 CSS 入子目录）、§9.7 零硬编码 HTML（外壳为 React 组件，动态行 createElement）、§10.3 复用（分组规则与满员阈值复用）。

### 结果

`tsc -b` 零错误；6 套件 103 用例通过（含 lr-planner 8 用例）；lint/check:structure/stylelint 通过；version `1.31.0` → `1.32.0`（新增插件，minor+1）；插件计数 40→41（javdb 38→39）。用户实测（2026-07-27）确认编号组识别、数量/满员展示、生成整理计划均正常，未发生任何服务端写入（识别链路曾因 doc/203 的链接形式误判失败，修复后验证通过）。

### 演进链与遗留

期2 实写执行展望（复用 `postJavdbListMutation` 增删 + `fetchAuthoritativeCheckboxState` 复核，带限速/中止/续传、借鉴 `vlt-server.ts` 恢复日志管线、overflow 自动新建清单复用 `createList`）→ doc/204。期1 发布后暴露组识别失败 → doc/203。

## 四、组识别失败修复（doc/203）

### 背景/根因

期1 上线后，用户在编号清单页（如 `等待更新2`）点「识别编号组」恒显示「此清单不属于编号组」。

**根因**：`fetchAllUserLists` 抓取 `/users/lists` 原始 HTML 时用 `a[href*="/lists/"]` 匹配清单标题链接，但**服务器返回的原始 HTML 里标题链接 href 是 `?id=xxx` 查询参数形式**（如 `/users/list_detail?id=xxx`），`/lists/xxx` 是 `ModMyListOpenWayPlugin` 在浏览器里**客户端改写**出来的短地址（`archetype/modMyListOpenWay.user.js` L33-34：`new URL(a.href).searchParams.get("id")` 后 `a.href = /lists/${id}`）。因此 `a[href*="/lists/"]` 在原始 HTML 上一个都匹配不到 → 清单列表为空 → `discoverGroup` 找不到当前清单 → 返回 null。

> 旁证：VLT `fetchListIdByName` 也用 `a[href*="/lists/"]` 作为 `createList` 的「最后兜底」，很可能本就经常匹配不到——这解释了它为何只是末位兜底。

### 方案与决策

改用 archetype 验证过的标题链接选择器，并从 `?id=` 查询参数提取清单 ID（兼容 `/lists/xxx`）：
- 标题链接：`div.column.is-10 > a`（`modMyListOpenWay`/`list-waterfall` SEL 共同验证），回退 `li` 内首个 `a`；
- 新增 `extractListId(href)`：优先匹配 `/lists/xxx` 路径，否则 `new URL(href, origin).searchParams.get('id')` 取 `?id=` 参数（用 `getAttribute('href')` 原始值 + 真实 origin 解析，避免 DOMParser 文档 base 为 `about:blank` 导致 `anchor.href` 不可靠）；
- 识别流程加 `clog` 诊断（识别到的清单数/未归组原因），便于日志面板核对。

### 实施要点

`lr-data.ts`：标题链接选择器改 `div.column.is-10 > a`，新增 `extractListId`（`?id=` + `/lists/` 双形式），空名跳过；`lr-panel.tsx`：识别流程加 `clog` 诊断。

### 结果

version `1.32.0` → `1.32.1`（bug 修复，patch+1）；103 用例全绿（规划器逻辑未变）；`extractListId` 依赖 `window.location.origin` 属 DOM/集成层，未纳入 node 单测，其双路径逻辑由用户登录实测（2026-07-27）验证通过。

## 五、编号整理期2：组内压实实写执行方案（doc/204）

### 背景/根因

期1（doc/202）已提供只读预览、doc/203 已修复组识别。期2 在期1 规划基础上**实际执行搬运**（调用 JavDB 加入/移除接口），把组内影片重排为「低序号清单先填满 501 才往后」，并消化组内重复。本文是期2 **完整执行方案**，重点为**回退（Fallback）**与**降级（Graceful Degradation）**。用户已确认（2026-07-27）：认同四条不变式与「先加后删」安全核心；默认参数 OK；**分期交付**；**要做整次撤销**。确认后先存档本文。

### 四条不变式（设计地基）

| # | 不变式 | 保证手段 |
|---|---|---|
| 1 | **永不丢片**：任何影片任意时刻至少在 1 个清单中 | 「先加后删」执行顺序 |
| 2 | **幂等可重入**：加已存在的片/删不存在的片均为安全 no-op | JavDB 接口语义 → 支持续传/重试 |
| 3 | **不超上限**：只向「低于目标(≤501)」的清单加片，加到目标即停 | 规划器 target≤501（doc/202 已保证） |
| 4 | **可中止可恢复**：任意时刻能安全停下并恢复 | 恢复日志 + 幂等 |

> 不变式 1 最高优先：**宁可暂时重复，绝不丢失**。重复是可清理的临时态，丢失不可接受。

### 方案与决策

**执行模型**：串行（并发锁定 1，由不变式 3 无正确性损失）+ 请求间隔默认 400ms + **批=检查点单位**（默认每 20 个操作存进度/刷新 UI，批非 API 概念）+ **试运行闸**（默认先执行前 K=10 个操作后自动暂停，展示真实结果，用户确认「继续」才跑剩余——把任何逻辑 bug 的爆炸半径限制在 10 个操作内）+ 每步复用 VLT `postJavdbListMutation`（写）+ `fetchAuthoritativeCheckboxState`（权威校验）。

**核心安全设计——先加后删**：一个「搬家」(A→B) 拆两步，顺序强制**先加 B、后删 A**：
1. 需加入目标时：POST 加入 B。`confirmed` → 进入删除；`rejected` → **不删 A**，影片留原处，该步记 `failed` 跳过；`unknown`（网络歧义）→ **强制权威校验**：已加入 B → 进入删除；未加入 → 按失败回退。
2. 纯去重时（影片在 A、C，留 A）：删 C 前**先校验 A 确有此片**；含 → 删 C；不含 → 跳过（防「删了 C 才发现 A 没有」丢片），记 `skipped_drift`。
3. 删除阶段：POST 移除来源清单。成功 → 记完成 + 写回滚日志；失败（加已成功）→ 影片暂存 A+B（临时重复，可清理），记 `pending_cleanup` 待重试，**不丢**。

> 安全性：影片任意时刻要么在 A、要么在 A+B，**绝不会两边都没有**。注意这与 doc/201/202 期2 展望中「先移除后加入」的草案方向相反——最终设计为保「永不丢片」最高优先级，依赖规划器保证目标 ≤501 来规避「目标清单满员拒绝加入」。

**回退策略（分级）**：单步加失败→不删来源、记 `failed` 继续；加 unknown→权威校验分流；删失败→`pending_cleanup` 批末/结束后统一重试；来源漂移→跳过删除防丢片；批次失败过多（>30%）→暂停该批告警等用户；全局硬限流/掉线→停止执行、存进度、可续传；**整次撤销**→按回滚日志逆序执行反向搬运（同样先加后删+限速）。回滚日志每完成一步记录 `{videoId, addedTo, removedFrom}`，既供 `pending_cleanup` 重试、也供整次撤销。

**恢复与续传**：恢复日志（复用 VLT pending-journal 模式，localStorage）执行前写 `{move, status:pending}`，成功后清除/标记 done；触发场景：页面卸载（`beforeunload` 存进度）、崩溃、手动中止、限流暂停；续传时对每个待办 move 先读权威态、已完成的自动跳过（不变式 2），日志指针不准也不会重复/出错。

**降级策略（降档阶梯，逐级降速/降范围而非一碰错整体失败）**：正常 400ms → 429/403/503 降速档（间隔×2 退避）→ 深度降速（再×2+短暂停）→ 连续失败超阈值暂停档（等用户：继续/更慢/中止）→ 单步失败跳步档（记为待处理·继续）→ 会话失效停止档（存进度·重登后续传）→ 校验接口失败降级校验（信任 POST success + 批次盘点，标注待人工复核）。限流响应分类：`429/503`→退避降速；`403`→先刷新 CSRF 重试一次、仍 403 判风控/封禁暂停等人；连续 `unknown`（超时）→疑似限流退避；检测「需登录」→停止档+续传；读 `Retry-After` 响应头作退避时长依据。**实现注记**：现 `postJavdbListMutation` 只回传 confirmed/rejected/unknown 不暴露 HTTP 状态码，期2 需一**薄封装**复用同端点+CSRF 逻辑但回传 HTTP status + Retry-After。

**执行前预检（Preflight）**：①重新枚举当前组状态与期1 规划比对，发现漂移（期间手动增删）→提示「状态已变，是否重新生成计划？」；②检查 CSRF token 存在；③检查登录态；④确认弹窗（规划摘要：搬 N 部/去重 M 部/涉及清单 + 勾选「我理解这会修改我的清单」+ 试运行数量 K）。

**配置项**（基础配置「清单收藏合并」分区追加）：`reflowInterval` 400ms / `reflowBatchSize` 20（检查点粒度）/ `reflowTrialCount` 10（试运行操作数）/ `reflowMaxRetry` 3（单步/限流连续失败上限，超过暂停）/ 并发锁定 1（不开放调高，安全优先）。

**模块拆分**（`src/plugins/list-reflow/` 新增）：`lr-execute.ts`（执行引擎：串行循环+先加后删+权威校验+中止+退避+进度回调，核心状态机可单测）/ `lr-journal.ts`（恢复日志+回滚日志）/ `lr-preflight.ts`（预检：重枚举/漂移检测/CSRF/登录）/ `lr-execute-ui.ts`（执行 UI + 接线引擎）；复用 `postJavdbListMutation`/`fetchAuthoritativeCheckboxState`/`planCompaction`/`discoverGroup`/`enumerateListVideos`/`createList`（overflow 消化，可选）。

**分期交付**：期2a 核心写路径（执行引擎+先加后删+单步权威校验+串行/间隔+中止+试运行闸）；期2b 韧性层（自适应退避+恢复日志/续传+批检查点+**整次撤销**）；期2c 体验层（执行 UI 完善+汇总报告+配置项全量）。每期独立可验证：2a 验「写得对」，2b 叠「扛得住」，2c 叠「好用」。

### 期2a 执行记录（已实现）

- 新增 `lr-execute.ts` 执行引擎：`executeCompactionPlan`（串行+切片/试运行+间隔限速+可中止）+ `executeMove`（**先加后删**：加入目标清单经权威校验成功后才移除来源；加入被拒/未确认则不删来源——不变式 1 永不丢片）。复用 VLT `postJavdbListMutation`/`fetchAuthoritativeCheckboxState`。
- `reflow-panel.tsx` 增「执行整理/中止」按钮；`lr-plan.ts` `runPlanPreview` 返回计划；`lr-panel.tsx` 接线执行（试运行 K 个 → 确认 → 续跑，`utils.q` 确认 + 中止信号）。
- 清单管理器增「🚀 压实执行」分区：`reflowInterval`/`reflowTrialCount`/`reflowBatchSize`/`reflowMaxRetry`（后两者期2b 生效），`setting-form-load.ts` 增读写。
- 新增 `tests/lr-execute.test.ts`（8 用例，vi.mock 隔离 VLT 网络层，验证先加后删/不丢片/切片/中止）。

### 结果

期2a 构建通过（391 modules）、111 用例通过、lint/check:structure 通过；version `1.34.0` → `1.35.0`（README 记录）。**期2b/2c 待实施**（建议先在小号/小组真实跑极少量验证期2a 写路径）→ doc/216。本文档状态保持 🔧待执行，注明「待 2b/2c 完成后整体置 ✅」。

### 演进链与遗留

- 本文「先加后删」是对 doc/201/202 草案「先移除后加入」的**方向性修正**（以不变式 1 为最高优先）。
- 期2 与 doc/205 交互：压实「等待更新N」期间若手动评星会触发 Feature B 移除非受保护清单，doc/205 要求期2 文档标注此点。
- 期2b/2c 由 doc/216 完成；doc/204 头部「待执行」状态标记在 2b/2c 完成后未再同步翻转（见阶段末「遗留」）。

## 六、泛化自动收藏/移除联动（doc/205）

### 背景/根因

现有清单↔评价联动以「等待更新」为中心（doc/53 加入等待更新→自动收藏；doc/124 评分/已读→移出等待更新；doc/125 加入非等待更新清单→移出等待更新）。用户希望**泛化**为「值得复盘」受保护模型：
- **需求 A**：加入「除 值得复盘\* 外的任意清单」→ 自动收藏（想看）；
- **需求 B**：将影片从「收藏」改为「任意已读星级」→ 自动移出「除 值得复盘\* 外的所有清单」。

A/B 是 doc/53/124 的**严格超集**（等待更新旧行为完全保留，范围扩大到「除值得复盘外全部」），可用现成原语实现。用户已确认全部决策（2026-07-27）。

**用户确认的决策**：D1 Feature B **覆盖**原生「我看過」按钮触发路径（双路径，互斥不重复）；D2 **0 星「已读」触发** Feature B（与 doc/124 一致）；D3 **保留** doc/125；D4 受保护关键词做成**可配置设置**（默认「值得复盘」）；D5 加 A/B 总开关 `autoFavCleanupEnabled`（默认开）。

### 方案与决策

**语义模型**：「值得复盘\*」为受保护例外（加入时**不**自动收藏；收藏→已读时**保留**不移出），其余清单为临时（加入时自动收藏；已读时移出）。「值得复盘\*」**包含匹配**（`值得复盘`/`值得复盘1`/`值得复盘-无码` 均算）。

**Feature A（加入任意清单→自动收藏）**：触发点 `vlt-checkbox.ts` `handleCheckboxChange`（`checked===true` 且非 `limit_exceeded`）；触发条件改为清单名**不含**受保护关键词（`!isProtectedList(lname)`，原为含「等待更新」）；动作 `autoFavoriteIfPendingUpdate`（保留保护）：番号已有 JHS 状态（收藏/已读/屏蔽）→ **跳过不覆盖**（防状态回退）；无状态 → `saveCar(FAVORITE_ACTION)` + 广播 + `triggerJavdbWantAndSyncRatingBar`（同步 JavDB 想看+评分条）；toast 文案从「添加至等待更新」改为实际清单名；受总开关门控。

**Feature B（收藏→已读→移出所有非值得复盘清单）**：触发点双路径且互斥不重复——①脚本评分条 `quickSetHasWatch`（点星 1–5/点「已读」0 星，用 `_wantWatchedSyncing` 阻断 observer）；②原生「我看過」按钮 → MutationObserver → `onWatchedAdded`。触发门控：**改动前 JHS 状态 === FAVORITE_ACTION（收藏）**（落实「从收藏改为」）且新状态 = 已观看（任意星级含 0 星）。动作 `removeFromNonProtectedListsOnWatch`：**DOM 优先**——遍历原生 `#modal-save-list` 中当前影片已勾选的清单，凡名称不含受保护关键词者取消勾选+派发 change（走 VLT 服务端管线真删）+同步面板勾选框；**DOM 不可用兜底**——查 `VltDb.queryMoviesLists` 得当前影片清单，过滤非受保护后服务端移除；名称含受保护关键词者**跳过保留**。

**与 doc/125 分离**：Feature B 的移除函数（移出所有非受保护清单，**on-watch**）与 doc/125 的「移出等待更新」（**on-categorize**，用 `AUTO_FAVORITE_KEYWORD='等待更新'`）是**两个独立函数**，不可混用——否则 doc/125 泛化后会把你刚加入的清单也移除。常量分工：`AUTO_FAVORITE_KEYWORD='等待更新'`（doc/125 专用）、受保护关键词（Feature A 例外 + Feature B 保留）。

**边界与补全**：已看过/已屏蔽的片加入清单不自动收藏（保留 skip 防状态回退）；评星触发时片不在任何非受保护清单 → noop；部分移除失败 → 复用 VLT 服务端管线恢复日志/重试，不静默丢操作；「从收藏改为」判定基于改动前 JHS car record 旧状态；与 doc/200 合并面板交互（`syncMergedRowsForListId` 响应式刷新）；与期2（doc/204）交互标注。

**风险**：**误移除（主要）**——Feature B 从所有非受保护清单移除（范围远大于 doc/124），实施前用户须确认「值得复盘」是唯一需保留的清单类，如需保留其他清单用 `protectedListKeywords` 追加；状态判定依赖本地 car record，若缺失/与服务端不一致「旧态===收藏」门控可能误判，建议同时参考原生想看 tag（`.review-buttons`）双重确认。

### 实施要点（已实现，D1–D5 均采纳）

- `vlt-checkbox.ts`：新增 `autoFavCleanupEnabled`/`protectedKeywords` 配置 + `isProtectedList` + setter；Feature A 将 `autoFavoriteIfPendingUpdate` 触发改为「除受保护清单外均自动收藏」；**抽出谓词核心** `uncheckListsMatching`/`findCurrentMovieListsMatching`（doc/125 等待更新与 doc/205 非保护复用）；新增 Feature B 入口 `removeFromNonProtectedListsOnWatch`（**取代 doc/124** 等待更新专属移除）；`handleCheckboxChange` 自动化受总开关门控，doc/125 逻辑保留。
- `dpb-rating-api.tsx`（脚本评分条路径）与 `dpb-want-watched.ts`（原生「我看過」路径）均加「旧态===收藏」门控调 Feature B（双路径互斥，含 0 星）。
- `vlt-plugin.ts` handle 从设置注入总开关+受保护关键词；`vlt-sync.tsx` 重导出更新。
- 清单管理器增「⭐ 自动收藏联动」分区（`autoFavCleanupEnabled` + `protectedListKeywords`），`setting-form-load.ts` 增读写。

### 结果

version `1.33.0` → `1.34.0`（minor）；103 用例通过；lint/check:structure 通过。`isProtectedList` 为 3 行纯逻辑但依赖整个 VLT 子树（IDB/DOM），单测需 jsdom 且易脆，故未单独加测，由构建+实测验证。

### 演进链与遗留

Feature A/B 超集取代 doc/53/124；doc/125 保留（D3）。doc/205 实现后暴露「JavDB 端未触发」问题（详见 doc/208/209 演进）。

## 七、对账消噪（doc/206）

### 背景/根因

用户操作清单时频繁出现 toast「⚠ 清单自动校准失败：服务端清单状态已变化，与触发对账时的状态不一致」。排查（仅读代码，未改动）确认：**这是良性安全提示，不丢数据、服务端操作照常成功**，但在本项目「自动化密集」场景下被频繁触发，构成噪音。

**根因**：对账用**模态框标签显示的数量**（`getDisplayedListCount` 读 `(501)`）作为「预期」，抓取真实服务端全量后比对，不一致即报「状态已变化」。但**显示数量滞后**：标签数量由脚本在权威校验返回后才更新（`performServerCheckboxMutation` → `fetchAuthoritativeCheckboxState` → `setListDisplayedCount`），本地 IDB `actualCount` 也在权威校验后更新，二者与「自动对账巡检」的读取**无互斥**，存在时间窗。触发时序示例：取消勾选 `等待更新2`（500→移除 1 部）→ POST 移除（服务端=500）→ `commitAuthoritativeState`（本地=500）→ 此时标签仍显示 `(501)`（`setListDisplayedCount` 尚未执行）→ 巡检读「显示=501/本地=500」误判漂移 → 以预期 501 抓真实 500 → 比对不一致 → 报错（稍后标签才刷成 500）。

**本项目更易触发**：doc/124（评星→移出等待更新，一次连删多个）、doc/53（加入→自动收藏）、doc/125（加入他清单→取消等待更新）、doc/200 合并面板（转发原生 checkbox 走同一 VLT 管线）共同制造「同一批等待更新清单上的快速连续操作」；大清单（501，约 20 页 + 双完整快照比对）抓取窗口长达数秒。

**良性判定**：本地镜像正确性由**权威校验路径**（`commitAuthoritativeState` 用 `simple_lists` 权威值校准）保证；失败的对账只是**冗余的后台/前置补校**在追一个已滞后的显示数字；`reconcileListBeforeMutation` 失败也不阻断写入（`postJavdbListMutation` 照常），操作后权威路径仍会校准本地。

### 方案与决策（用户确认 ①②③④ 全做）

核心思路：**不改任何数据行为，只把两处「机会性对账」的失败降为静默；保留真正兜底的告警；并拉长自动巡检防抖从源头减少误判。**

| # | 改动 | 位置 |
|---|---|---|
| ① | 静默后台巡检对账 | `runAutomaticReconciliation` 对账调用 `quiet: true` |
| ② | 静默变更前预校对账 | `reconcileListBeforeMutation` 对账调用 `quiet: true` |
| ③ | **保留**真兜底告警 | `reconcileAfterConfirmedMutation` **保持 `quiet: false`**（权威校验本身失败后的真兜底，值得告警） |
| ④ | 拉长自动巡检防抖 | `AUTO_RECONCILE_DELAY` 350 → 800ms（让 `setListDisplayedCount` 先刷显示再巡检） |

**安全性论证**：零数据行为变更（`snapshotMatchesExpectation` 校验 + 双完整快照比对原样保留，对账仍会拒绝写入不一致快照，仅失败时不再弹 toast）；真正的安全网仍在且有声（权威路径失败时「本地完整清单将在下次打开页面时继续校准」提示保留，③ 兜底告警保留）；所有对账失败仍 `clog.error('[JavDB][清单对账] 失败…')` 进日志；爆炸半径极小（2 处 `quiet` 参数 + 1 个常量）。

**不选的方案**：放宽 `snapshotMatchesExpectation` 计数校验（更贴近根因，但改动 doc/126 作者刻意设的严格对账语义，有隐性同步 bug 风险）；全部静默（会吞掉真正的同步失败信号）。

### 实施要点（已实现）

①②③ 按上表落地；④ `AUTO_RECONCILE_DELAY` 改为可变 `autoReconcileDelay`（默认 800）+ `setAutoReconcileDelay()`，由 VLT 插件 handle 从设置 `autoReconcileDelay` 注入（设置 UI 见 doc/207 清单管理器「对账校准」分区）。

### 结果

构建通过、103 用例通过、lint/check:structure 通过；**版本随 doc/207 清单管理器重构一并 minor+1（1.32.1→1.33.0）**。预期效果：日常操作/评星自动移出不再弹良性「校准失败」，真正同步失败仍提示。

## 八、清单管理器设置页重构（doc/207）

### 背景/根因

清单相关设置散落且不全：合并/编号整理 4 项挤在 base-panel「清单收藏合并」分区；详情页清单排序**无持久化默认值**（每次默认名称降序）；「收藏清单关系」（vlt-panel）仅导入/导出、无配置；doc/204/205/206 还将引入一批配置项。用户要求升级 vlt-panel 为「清单管理器」专页集中管理，并先做**可配置项整理**再执行。

**用户确认的决策**：①升级 vlt-panel 为「清单管理器」（保留 panelId `vlt-panel`，改标签与内容）；②要做 `listSortBy`（排序字段：名称/数量/序号）；③`autoReconcileDelay` 做成可配置；④认可执行顺序：**doc/206 → 清单管理器设置页 → doc/205 → doc/204 分期**。

### 方案与决策

**可配置项盘点**：现有（base-panel「清单收藏合并」）`listMergeEnabled`/`listMergePattern`/`listMergeExcludeNames`/`listReflowEnabled` 4 项迁入；新增 `listDefaultSort`（默认排序方式 name-desc/name-asc）+ `listSortBy`（排序字段 name/count/num）+ `autoReconcileDelay`（默认 800）；预留 doc/205（`autoFavCleanupEnabled`/`protectedListKeywords`）与 doc/204 期2（`reflowInterval`/`reflowBatchSize`/`reflowTrialCount`/`reflowMaxRetry`，并发锁 1 不开放）。

**设置页设计**：📋 清单管理器五分区——🗂️ 序号合并（listMerge* 迁入）/ 📐 排序显示（listDefaultSort/listSortBy 新增）/ ⚙️ 编号整理（listReflowEnabled 迁入）/ 🔄 对账校准（autoReconcileDelay 新增）/ 💾 数据管理（保留 `vlt-import-btn`/`vlt-export-btn`/`vlt-file-input`/`vlt-status` 导入导出）。

### 实施要点（第一阶段：doc/206 + 设置页重构 + 排序）

新增 `list-manager-panel.tsx`（5 分区 + 保留导入导出 ID）；`setting-dialog.tsx` 侧栏「收藏清单关系」→「📋 清单管理器」，vlt-panel 由 `SyncPanel` 换为 `ListManagerPanel`；`setting-form-bind.ts` vlt-panel 由「隐藏 saveBtn」改为「显示 saveBtn」（配置项需保存），导入导出绑定不变；`base-panel.tsx` 移除「清单收藏合并」分区（4 项迁出）；`setting-form-load.ts` 新增 `listDefaultSort`/`listSortBy`/`autoReconcileDelay` 读写；`dpb-list-panel.tsx` 按 `listDefaultSort` 设排序下拉默认 + 按 `listSortBy`（name/count/num）排序；`detail-page-button-plugin.tsx` 新增 `_listDisplayConfig {defaultSort, sortBy}` 加载。doc/206 ①②③④ 同步落地（见 doc/206 §实施）。

### 结果

version `1.32.1` → `1.33.0`（minor：新增清单管理器设置页 + 排序设置）；103 用例通过；check:structure OK（347 files）。doc/205/204 落地时再于本页增「自动收藏联动」「压实执行」分区（均已落实）。

### 演进链与遗留

`listDefaultSort`+`listSortBy` 双设置项在 doc/208 被合并为单个 6 选项下拉（`listSortBy` 移除）。

## 九、清单管理器三项优化（doc/208）

### 背景/根因

用户实测 doc/205/207 后反馈三个问题：
1. **排序**：「默认排序方式」仅 2 选项（方向）、「排序字段」3 选项，但改排序字段**不生效**；设计不合理，应合并为单个「默认排序方式」多选项；
2. **自动收藏联动**：只实现了脚本端（JHS IDB 标记收藏），**JavDB 端未成功触发**（doc/205 之前加入「等待更新」尚有此触发，本次修改后失效）；
3. **多项输入**：「不参与合并的清单名」「受保护清单关键词」用单个逗号分隔输入框混乱，应参考「屏蔽关键词」的**标签化**实现。

### 方案与决策

**排序合并为单个「字段-方向」控件**：移除独立 `listSortBy`；`listDefaultSort` 扩展为 **6 选项**（`name-desc/name-asc/count-desc/count-asc/num-desc/num-asc`）；详情页清单面板排序下拉同步扩展 6 项；`applyListPanelView` **直接从下拉值解析「字段+方向」**（`lastIndexOf('-')` 切分），不再依赖旁路 `dataset.listSortBy`——修复「改字段不生效」。向后兼容：旧 name-desc/name-asc 值仍是合法子集；`listSortBy` 成为孤立键（不再读取，无害）。

**自动收藏 JavDB 端（await + 暴露失败）**：排查 `autoFavoriteIfPendingUpdate` 内 `triggerJavdbWantAndSyncRatingBar` 调用未被 doc/205 改动、机制 `javdbReviewApi('wanted')` 为真实服务端调用；最可能根因是该函数末尾 `.catch(() => {})` **静默吞掉**了 `_triggerJavdbWant` 的真实失败。修复：`triggerJavdbWantAndSyncRatingBar` 改为**返回 Promise**（`_reviewChain` 仍不因单次失败中断，但错误向上抛出）；`autoFavoriteIfPendingUpdate` 改为 **`await`**，成功再弹「已自动收藏」，失败则弹「脚本已收藏但 JavDB 端失败：原因」并记 `clog.error`。说明：仅凭静态审查无法 100% 锁定根因，本修复通过「await + 暴露错误」既加固可靠性又使后续可诊断。

**多项标签化**：「不参与合并的清单名」「受保护清单关键词」改**标签容器**（`tag-box` + 输入框 + 添加按钮，复用 `filter-keyword-container` 样式与 `addLabelTag`/`addKeyword`）；`setting-tag-ops.ts` 增 `noun` 参数（移除确认文案区分「清单名/关键词」）；`setting-form-load.ts` 抽取 `bindKeywordContainer`/`readKeywordLabels` 复用，三个标签容器（屏蔽词/排除清单名/受保护关键词）统一加载/保存；存储格式仍为字符串数组（与 `buildMergeConfig`/`setProtectedKeywords` 兼容）。

### 实施要点

`components/dpb/list-panel.tsx`（下拉 6 选项）；`dpb-list-panel.tsx`（移除 `DetailListSort`/`dataset.listSortBy`，从下拉值解析字段+方向）；`dpb-types.ts`（`ListDisplayConfig` 精简为 `{defaultSort}`）；`detail-page-button-plugin.tsx`（校验 6 个合法值）；`list-manager-panel.tsx`（单个 6 项下拉 + 标签容器）；`setting-tag-ops.ts`/`setting-plugin.tsx`（`noun` 参数）；`setting-form-load.ts`（标签化加载/保存 + 移除 `listSortBy`）；`vlt-helpers.ts`（`triggerJavdbWantAndSyncRatingBar` 返回 Promise + 抛出失败）；`vlt-checkbox.ts`（await 触发 + 暴露失败）。

### 结果

version `1.35.0` → `1.35.1`（优化/修复，patch）；111 用例通过；lint/check:structure 通过。

### 演进链与遗留

「暴露错误」实为「揭示根因」——doc/208 的 await+报错让用户给出了确切错误信息（`pluginManager is not defined`），真正的根治在 doc/209。

## 十、自动收藏 JavDB 端失效根治（doc/209）

### 背景/根因

doc/208 让自动收藏的 JavDB 端触发错误**可见**，用户反馈确切错误：

> ✗ [DLDSS-192] 脚本已收藏但 JavDB 端失败：**pluginManager is not defined**

并指出：手动点收藏按钮**真的成功**——手动本质是解析当前页面 DOM 后生成内容，与直接操作网站无异，只是换了种 UI。

**根因**：`triggerJavdbWantAndSyncRatingBar`（doc/55 引入，`vlt-helpers.ts`）通过 `pluginManager?.getBean?.('DetailPageButtonPlugin')` 取插件实例。但 `pluginManager` 是 `main.tsx` 的**模块级 const**（注释明确「仅通过模块级 const + this.pluginManager 内部访问，不暴露到 unsafeWindow」），**不是运行时全局**；`globals.d.ts` 虽 `declare const pluginManager`（骗过 TypeScript 编译），运行时从 `vlt-helpers.ts` 访问即抛 **ReferenceError**。该 bug 自 doc/55 潜伏，因末尾 `.catch(() => {})` 静默吞错一直没被发现；doc/208 改为向上抛错后才暴露（故 doc/208 只「暴露」未「修复」根因）。手动按钮正常的原因：`.jhs-fav-btn` → `quickConvertToFav` 是 `DetailPageButtonPlugin` 的**方法**，插件实例由评分条构建时的闭包直接持有（`self.quickConvertToFav()`），从不经过 `pluginManager.getBean`。

### 方案与决策（按用户思路：复用收藏按钮）

让自动收藏**直接点击脚本的收藏按钮**，等价手动操作，绕开不可达的 `pluginManager`：
- `autoFavoriteIfPendingUpdate`（`vlt-checkbox.ts`）：保留「已有状态则跳过」前置判断后，**不再**自行 `saveCar`/广播/`triggerJavdbWantAndSyncRatingBar`，改为 `document.querySelector('.jhs-fav-btn').click()`，交由 `quickConvertToFav` 完成 JHS 收藏 + 三重广播 + JavDB 端想看 + 评分条同步（与手动完全一致）；
- **关键**：须先确认番号无状态再点击——否则先写了 FAVORITE，`quickConvertToFav` 会判定「已是已收藏」直接 return，反而不触发 JavDB 端；
- 移除已失效且唯一调用方已改的 `triggerJavdbWantAndSyncRatingBar`（`vlt-helpers.ts`），连同 `vlt-checkbox.ts` 中不再使用的 `getActressNames`/`broadcastWantWatchedSync` 导入。

### 结果

version `1.35.1` → `1.35.2`（bug 修复，patch）；111 用例通过；lint/check:structure 通过。后续验证：加入清单 → JHS 与 JavDB 端均收藏、评分条高亮、无报错；已「已读/屏蔽」番号加入清单跳过自动收藏；clog 不再有「pluginManager is not defined」。

### 演进链与遗留

doc/55 引入 → doc/208 暴露 → doc/209 根治（改点按钮，删除失效函数）。历史积压的「脚本已收藏、JavDB 无状态」番号需补同步工具 → doc/210。

## 十一、JHS→JavDB 批量同步（doc/210）

### 背景/根因

doc/208/209 之前，自动收藏只写进 JHS IDB（`car_list` 的 `FAVORITE_ACTION`），JavDB 端触发（`pluginManager is not defined`）一直失败，攒下一批「脚本已收藏、JavDB 无状态」的番号。doc/209 修好了新增自动收藏，但**历史积压**仍在。现有只有反方向工具（`WantAndWatchedVideosPlugin` 是 JavDB→JHS 导入），无 JHS→JavDB，故新增。

**用户确认的决策（D1–D6 全做）**：D1 同步范围仅 `FAVORITE_ACTION`（收藏）→ JavDB 想看；D2 安全检查先拉 JavDB 想看/已看列表，已想看跳过、绝不降级已看；D3 放清单管理器设置面板按钮；D4 请求间隔默认 500ms（`jhsSyncInterval` 可调）；D5 JHS 收藏但 JavDB 已看 → 跳过 + 汇总列出；D6 长期功能（随时可用）。

### 方案与决策

清单管理器新增「收藏同步」分区（按钮 + 间隔输入 + 中止 + 状态区）。流程：①读 JHS `car_list`，筛 `status === FAVORITE_ACTION`，从 `url`（`/v/{id}`）提取 videoId；②安全检查（D2）：抓取 JavDB `/users/want_watch_videos` 与 `/users/watched_videos` 全部页（`.movie-list .item a[href*="/v/"]` + `a.pagination-next` 翻页）得 videoId 集合；③分类：已想看→跳过计数；JavDB 已看→跳过并记录番号（D5，绝不降级）；其余→待同步；④逐个 `POST /v/{videoId}/reviews/want_to_watch`（带 CSRF），`jhsSyncInterval` 限速（D4），可中止，进度回调更新状态区，结束汇总（成功/失败/已想看跳过/已看跳过/失败明细）。

### 实施要点

新增 `jhs-to-javdb-sync.ts`（`syncJhsFavoritesToJavdb` 核心 + `fetchVideoIdSet`/`postWantToWatch` + `handleJhsSyncClick`/`abortJhsSync` UI 处理）；`list-manager-panel.tsx` 增「收藏同步」分区；`setting-form-bind.ts` 绑定 `#jhs-sync-btn`/`#jhs-sync-abort-btn`；`setting-form-load.ts` 增 `jhsSyncInterval` 读写（默认 500）。

### 结果

version `1.35.2` → `1.36.0`（新增功能，minor）；111 用例通过；lint/check:structure 通过。后续验证建议含「**跑前备份**」（只写 JavDB、不动 JHS，但稳妥起见）。

### 演进链与遗留

单向想看同步是 doc/213 双向增量同步的前身；原 `jhs-to-javdb-sync.ts` 在 doc/213 拆分为 `jhs-sync/` 子目录。

## 十二、周边修复（doc/211 + doc/212）

### doc/211：CSS line-clamp 兼容性警告

**背景**：诊断报告两条 warning——`rating-bar.css` 的 `.jhs-list-item__name` 用了 `-webkit-line-clamp: 2` 但缺标准 `line-clamp` 属性；`archetype/modMyListOpenWay.user.js`「File ignored because of a matching ignore pattern」。

**方案与决策**：CSS 警告**修复**——补标准 `line-clamp: 2`（前缀属性 + 标准属性并存，兼容现代浏览器）；archetype 警告**无需处理**——`archetype/` 为只读参考脚本，在 ESLint 全局 `ignores` 中，「File ignored」是 ESLint 对被忽略文件的**预期提示**，仅在编辑器对打开的忽略文件时显示；`bun run lint` 只扫 `src/` 不涉及。

**结果**：`src/styles/rating-bar.css` 一处改动；version `1.36.0` → `1.36.1`（CSS 兼容性修复，patch）。

### doc/212：scripts/check-structure.ts 编辑器类型报错

**背景**：诊断报告 `scripts/check-structure.ts` 7 个 error——`node:fs`/`node:path`/`process` 找不到（缺 Node 类型）+ `entries.filter((e) => …)` 的 `e` 隐式 any。**根因**：`scripts/` 目录未被任何带 Node 类型的 tsconfig 覆盖（`tsconfig.node.json` 只含 `vite.config.ts`，且项目未装 `@types/node`），编辑器 TS 语言服务无法解析 Node API；运行时 `bun run check:structure`（bun 直接跑 TS）不受影响。

**方案与决策**：安装 `@types/node`（devDependency）；新增独立 `scripts/tsconfig.json`（`types: ["node"]`，含 strict/noUnusedLocals 等），**不被根 `tsconfig.json` 引用**，故**不接入 `tsc -b` 构建**（保持 check-structure「不接入 build」的设计），仅供编辑器 TS 语言服务解析 `scripts/`；**不污染 src/**——`tsconfig.app.json` 已有 `"types": ["react"]`（仅自动引入 react 全局类型），装 `@types/node` 不会被 src/ 自动引入；jquery/layui-layer 走本地 shim、blueimp-md5 走模块解析，均不受影响。

**结果**：`package.json`/`bun.lock` 增 `@types/node` + 新增 `scripts/tsconfig.json`；非 `src/` 改动，按 §6.1.1 **不递增 userscript 版本**；`bunx tsc -p scripts/tsconfig.json --noEmit` 通过、build/lint/test 不受影响；编辑器中 7 个 error 消除。

## 十三、双向增量同步（doc/213）

### 背景/根因

doc/210 实现了 JHS→JavDB 单向想看同步（修复历史积压）。用户需要完整的**双向增量同步**：脚本有/网站无 → 补到网站；网站有/脚本无 → 补到脚本；冲突（双方状态不一致）→ 仅报告番号，不自动处理；顺带：同步已看时携带本地缓存评分。

### 方案与决策

**模块拆分**：原 `jhs-to-javdb-sync.ts`（235 行）拆分为 `src/plugins/setting/jhs-sync/` 子目录——`sync-common.ts`（共享类型 `SyncOptions`/`SyncResult`/`ConflictEntry` + 工具 CSRF/`fetchVideoMap`/`postWantToWatch`/`postWatched`/`readRatingCacheMap`）、`sync-to-javdb.ts`（JHS→JavDB 想看+已看）、`sync-from-javdb.ts`（JavDB→JHS 想看+已看）、`sync-ui.ts`（UI 编排：全量双向+单向兼容入口+中止+结果格式化）、`index.ts` 统一出口。

**同步逻辑（四个方向顺序执行）**：
1. JHS→JavDB 想看：`FAVORITE_ACTION` 且 JavDB 无状态 → POST want_to_watch；
2. JHS→JavDB 已看：`HAS_WATCH_ACTION` 且 JavDB 无状态 → POST reviews(watched+score)；
3. JavDB→JHS 想看：JavDB 想看但 JHS 无 FAVORITE → `saveCar(FAVORITE_ACTION)`；
4. JavDB→JHS 已看：JavDB 已看但 JHS 无 HAS_WATCH → `saveCar(HAS_WATCH_ACTION)`。

**冲突定义**：JHS 想看 vs JavDB 已看 / JHS 已看 vs JavDB 想看 → **仅报告**（番号+双方状态），不自动处理。**评分来源**（JHS→JavDB 已看）：`car.score` > localStorage 评分缓存（`jdb:rating_cache_v2`）> 0。**映射**：`fetchVideoMap` 增强版同时提取 videoId（href）和 carNum（`.video-title strong`）。

**UI 变更**：清单管理器「收藏同步」分区新增「双向增量同步」主按钮（`#jhs-sync-full-btn`）；原按钮降级为「仅 JHS→JavDB 想看」（`#jhs-sync-btn`，兼容入口）；状态区增加 maxHeight + overflowY 滚动。

**安全策略**：先备份提示（确认框）；限速（默认 500ms 可调）；可中止（模块级 signal）；冲突不自动处理；JavDB 已看绝不降级为想看。

### 实施要点

新增 jhs-sync/ 5 文件；修改 `list-manager-panel.tsx`（同步分区 UI）/`setting-form-bind.ts`（事件绑定）；删除 `jhs-to-javdb-sync.ts`（逻辑迁入子目录）。

### 结果

version `1.36.1` → `1.37.0`（README 记录）。验证记录：`tsc -b` 零错误（diagnostics 全项目刷新确认）；**vite build / ESLint 待用户本地验证**。

### 演进链与遗留

doc/210 单向 → doc/213 双向（四方向+冲突报告+评分携带）→ doc/214 引擎重写（断点续接/后台处理）。doc/213 的验证记录不完整（build/lint 待本地确认），见阶段末「遗留」。

## 十四、收藏同步独立设置页 + 引擎重写（doc/214）

### 背景/根因

doc/213 将收藏同步升级为双向增量同步，但仍嵌套在「清单管理器」面板内，且同步逻辑为**一次性全量抓取**（`fetchVideoMap` 一次拉完所有页），对 **5 万+ 条目**用户不友好：抓取阶段无法中断/恢复（关闭弹窗即丢失进度）；无法后台运行（必须保持弹窗打开）；设置页布局不合理（同步是独立操作，不属于「清单管理」配置）。

### 方案与决策

**设置页布局重排**：将「收藏同步」从清单管理器中拆出为**独立侧栏页** `fav-sync-panel`（🔄 收藏同步，位于「📋 清单管理器」与「🎬 MissAV 同步」之间）；清单管理器保留：序号合并、排序显示、编号整理、压实执行、自动收藏联动、对账校准、数据管理。收藏同步页包含：同步配置（间隔）+ 操作按钮（开始/继续/暂停/重置）+ 进度条 + 统计 + 报告。

**同步引擎重写**（原 `sync-to-javdb.ts`/`sync-from-javdb.ts`/`sync-ui.ts` 一次性全量 → 引擎驱动架构）：

| 文件 | 职责 |
|------|------|
| `sync-session.ts` | 会话持久化（localStorage），断点续接数据结构 |
| `sync-engine.ts` | 引擎核心：**tick 驱动状态机**（fetch-want → fetch-watched → compare → execute → done），模块级 `setInterval` 后台运行 |
| `sync-common.ts` | 共享工具（CSRF/fetch/postWantToWatch/postWatched/评分缓存），**重写精简** |
| `fav-sync-bind.ts` | 面板按钮绑定 + UI 实时刷新（订阅引擎状态变更） |
| `index.ts` | 统一出口 |

**关键设计**：**分页抓取**（每次 tick 只抓一页 ~24 条，保存 checkpoint 后继续）；**断点续接**（进度存 localStorage `jhs:sync_session_v1`，关闭页面/弹窗后下次打开自动恢复）；**后台处理**（模块级 `setInterval`，不依赖弹窗可见性）；**暂停/继续**（暂停仅停止 interval，进度保留，继续从断点恢复）；**重置**（清除会话+重置 UI）；**对比阶段**一次性构建四方向操作队列+冲突列表；**执行阶段**逐条执行、每 10 条保存一次 checkpoint；**进度百分比**（抓取阶段 0-20%，执行阶段 20-100%）。

**UI 设计**：进度条（绿色/红色）+ 阶段描述文本；四格统计卡片（成功/失败/跳过/冲突）；详细报告区（冲突番号+失败明细，完成时显示）；按钮状态联动（运行中禁用「开始」「继续」，非运行中禁用「暂停」）。

### 实施要点

新增 `sync-session.ts`/`sync-engine.ts`/`fav-sync-bind.ts`/`components/setting-panels/fav-sync-panel.tsx`；重写 `sync-common.ts`/`index.ts`；修改 `setting-dialog.tsx`（侧栏+面板注册）、`list-manager-panel.tsx`（移除同步区块）、`setting-form-bind.ts`（新绑定+面板切换）、`setting-form-load.ts`（`#favSyncInterval`）；删除 `sync-to-javdb.ts`/`sync-from-javdb.ts`/`sync-ui.ts`。

### 结果

version `1.37.0` → `1.38.0`。验证记录：全项目 diagnostics 零错误（`setting-form-bind.ts` 的模块解析警告为 TS 语言服务器对新文件的索引延迟，文件存在且自身零错误，编辑器重启后消失）；**待用户本地 `bun run build` 确认产物正常**。

## 十五、/users/lists 瀑布流追加条目「修改」按钮失效（doc/215）

### 背景/根因

用户反馈 `/users/lists` 清单管理页部分清单的「修改」按钮点击无响应。排查发现：`listWaterfall` 瀑布流插件追加第 2 页清单条目后，这些新 DOM 节点**未被 JavDB 原生 Stimulus handler 绑定**（原生 handler 仅在页面加载时绑定一次），导致点击「修改」按钮无法触发 `#modal-edit-list` 弹窗。VLT 插件的 capture 监听器能捕获点击（日志可见「编辑清单快照: listId=...」），但只记录快照，弹窗打开依赖原生 handler，对追加节点不生效。

### 方案与决策

在 VLT 的「修改」按钮点击监听器中，记录快照后**自行打开弹窗**：填充 `inputName`（清单名称）和 `inputId`（清单 ID）；添加 `is-active` 类显示弹窗 + `is-clipped` 锁定 body 滚动。对原生已绑定的条目，重复打开是幂等的（is-active 已存在无副作用）。

### 实施要点

`vlt-list-mgmt.ts` 新增 `openEditModal` + 监听器调用。version `1.38.0` → `1.38.1`。

### 结果

全项目 diagnostics 源码零错误零警告；**待用户本地 `bun run build` + 实际页面验证**（第 2 页追加条目可打开修改弹窗、改名保存成功、第 1 页原有清单不受影响）。

## 十六、编号整理期2b/2c：韧性层 + 体验层（doc/216）

### 背景/根因

doc/204 期2a 已实现核心写路径（先加后删+权威校验+试运行闸）。期2b 叠加**韧性层**（自适应退避+恢复日志/续传+批检查点+整次撤销），期2c 叠加**体验层**（进度条+汇总报告+续传/撤销按钮）。

### 方案与决策

**期2b 韧性层**：
- **恢复日志 + 回滚日志**（`lr-journal.ts`）：恢复日志（localStorage `jhs:reflow:journal`）执行前写 running，每批更新 nextIndex/completed/failed，完成标 done 并清除；面板初始化检测未完成日志 → 显示「继续上次整理」按钮。回滚日志（localStorage `jhs:reflow:rollback:{sessionId}`）每完成一步追加 `{videoId, addedTo, removedFrom}`，供整次撤销（逆序反向搬运）。
- **自适应退避**：失败时退避升档（间隔 ×2，最高 ×8），成功时逐步降回正常；连续失败达 maxRetry（默认 3）→ 暂停执行（status=suspended），等用户续传；进度回调暴露 `backoffLevel` 供 UI 显示当前退避档位。
- **批检查点**：每 batchSize（默认 20）个操作保存一次恢复日志（nextIndex/completed/failed）；中断后从 nextIndex 续传，幂等兜底（不变式 2）。
- **整次撤销（undoSession）**：按回滚日志逆序执行反向搬运（先加回 removedFrom，再删 addedTo）；同样串行+限速+可中止；面板「撤销本次整理」按钮触发（执行完成且有成功步骤时显示）。

**期2c 体验层**：进度条（绿色填充+百分比文本+退避档位标注，每步更新）；汇总报告（执行完成后显示：成功数/失败数/待清理重复/失败明细最多 20 条）；「继续上次整理」按钮（检测到未完成恢复日志时显示，断点续传）+「撤销本次整理」按钮（一键反向搬运）。

### 实施要点

新增 `lr-journal.ts`（恢复日志+回滚日志）；**重写** `lr-execute.ts`（期2a+2b 合并：退避/检查点/回滚/撤销）；**重写** `lr-panel.tsx`（集成续传/撤销/进度条/报告）；修改 `reflow-panel.tsx`（新增进度条/续传/撤销/报告挂载点）、`list-reflow.css`、`tests/lr-execute.test.ts`（新增 lr-journal mock）。

### 结果

version `1.38.1` → `1.39.0`。验证记录：全项目 diagnostics 源码零错误零警告、测试文件诊断通过（lr-journal mock 已添加）；**待用户本地 `bun run build` + `bun run test` 确认**。

### 演进链与遗留

doc/204 的分期交付至此全部完成（期2a 核心写路径 + 期2b 韧性层 + 期2c 体验层）。doc/204 头部「🔧 待执行」状态标记未随 2b/2c 完成而翻转（见阶段末「遗留」）。

## 十七、Git 备份通道（doc/217）

### 背景/根因

备份系统的存储目的地此前只有 **WebDav 一条通道**（手动备份+自动备份）。用户希望通过 **Git 仓库**备份数据，核心诉求是：利用 Git 托管平台的**版本历史**能力（每次备份一个 commit，网页端可 diff/回滚）——这是 WebDav 单文件覆盖做不到的。

**可行性调研结论（多轮讨论定稿）**：
1. **油猴脚本无法直连 git 协议**：git wire 协议走原生 TCP + 二进制打包，浏览器沙箱只有 HTTP(S)（`GM_xmlhttpRequest`），无法实现 push 协商；
2. **浏览器内完整 git 客户端成本不成比例**：isomorphic-git（229 KB min/68 KB gzip）技术上可行（可插拔 `http` 适配器挂 `GM_xmlhttpRequest` + lightning-fs 持久化 .git），但需本地养真仓库（IDB 膨胀/浅克隆边界）、多标签并发互斥、non-fast-forward 冲突恢复循环，工程量约为 Contents API 方案的 **3–4 倍**；wasm-git（libgit2→WASM 约 1 MB）的 HTTP 层烧死在 WASM 内部、GitHub 不发 CORS 头需额外自建代理服务器、单文件 userscript 分发 1 MB wasm 不便，出局。二者换来的增量能力（离线提交/真分支/本地历史镜像）对「备份一个 JSON」场景几乎无价值——**服务端历史版本由 Contents API 每次 PUT 一个 commit 即白送**；
3. **最终方案：Git 托管平台的 Contents REST API**。普通 HTTPS + JSON + Bearer token，正是 `GM_xmlhttpRequest` 擅长的形态；项目 `@connect` 已含 `'*'` 通配，零配置改动。

**平台范围**：「Contents API」是 GitHub 的接口名称，**并非跨平台通用**——GitHub/GitHub Enterprise 为基准实现 ✅；Gitea/Forgejo（自建）API 刻意镜像 GitHub，仅基址为 `https://host/api/v1` ✅（改 API 地址即可）；Gitee 形状相似但认证/字段有出入、单文件限 1MB ❌ 后续按需；GitLab/Bitbucket/Azure 完全不同的 API 形状 ❌ 后续按需。首期只做 **GitHub 兼容族**，但架构以 `BackupProvider` 接口抽象，后续加适配器不影响上层。

### 方案与决策

**架构**：`buildBackupPayload()`（数据源不变）→ 手动（`#webdavBackupBtn`/`#gitBackupBtn` 各通道独立按钮）/ 自动（`autoBackup()` 按 `settings.backupChannels` 开关分发）→ **`BackupProvider` 接口**（backup/getBackupList/getFileContent/deleteFile）→ `WebDavClient`（结构满足，零修改）+ `GitBackupClient`（本期新增）→ `openFileListDialog`（Tabulator 弹层，面向接口，双通道共享）。

**GitHub Contents API 操作映射**：备份创建 `PUT /repos/{o}/{r}/contents/{folder}/{file}?ref={branch}`（body `{message, content(base64), branch}`）；覆盖先 `GET` 取文件 sha，PUT body 追加 sha（乐观锁，与 git non-fast-forward 语义一致）；列目录 `GET`（404 按空目录，Git 目录隐式无需 MKCOL）；下载 `GET` 取 content(base64) 解码，>1MB 时 GitHub 省略 content 回退 `Accept: application/vnd.github.raw+json`；删除 `GET` 取 sha → `DELETE` body `{message, sha, branch}`；列表日期每文件 `GET /commits?path={file}&sha={branch}` 取最近 commit 时间（best-effort，失败回退空串，表格列回退显示当前时间）。认证头 `Authorization: Bearer <PAT>` + `Accept: application/vnd.github+json` + `X-GitHub-Api-Version: 2022-11-28`（Gitea 忽略未知头）+ `User-Agent`（防代理剥离 UA 导致 GitHub 403）。

**双通道开关与自动备份分发**：新增设置 `settings.backupChannels = { webdav: boolean; git: boolean }`（随 settings 进备份，跨设备迁移偏好）；**缺省值 `webdav: true, git: false`**（向后兼容：未设置时 WebDav 行为不变，Git 必须显式启用）；`autoBackup()` 分发：WebDav 通道 `channels.webdav !== false` 且 GM 凭据已配置 → 执行；Git 通道 `channels.git === true` 且 GM 凭据已配置 → 执行；两通道均不可用 → 静默跳过（不构建 payload，省一次 IDB 读）；**任一通道成功即 `markAutoBackupDone()`**，全部失败则不标记、下次打开重试。

**凭据存储（与 WebDav 同等待遇）**：新增 4 个 GM 私有存储键（`setting-keys.ts`），**不进备份**（与 `backup-extra-storage.ts` 白名单机制天然隔离）：`jhs_git_api_url`（默认 `https://api.github.com`）/ `jhs_git_repo`（owner/repo，必填）/ `jhs_git_branch`（默认 `main`）/ `jhs_git_token`（PAT，必填）。

**加密策略**：与 WebDav 备份一致**明文上传**（doc/171 已确立 WebDav 明文策略）；面板 UI 文案引导「请先建好私有仓库」；备份口令（V2 加密）仅作用于本地导出，云通道共用弹层的下载/导入流程已含 V2 检测解密，无需改动。

### 实施要点

**新增**：`backup-provider.ts`（`BackupProvider` 接口 + `BackupFileItem` 类型，复用 `WebDavFileItem` 形状）；`git-backup-client.ts`（`GitBackupClient` + `GitHttpError` + base64/UTF-8 编解码 + 路径编码纯函数）；`git-operations.ts`（凭据校验输入框优先/GM 回退、客户端构造、手动备份/列表查看入口，镜像 webdav-operations）；`tests/git-backup-client.test.ts`（21 用例：编解码往返/路径编码/各操作请求构造与响应解析（stub `GM_xmlhttpRequest`）/缺省值/错误传播）。

**修改**：`setting-keys.ts`（+4 `GM_KEY_GIT_*` 常量）；`webdav-operations.ts`（`openFileListDialog` 客户端参数 `WebDavClient` → `BackupProvider`，结构泛化双通道共享弹层）；`backup-panel.tsx`（+「Git 备份（GitHub 兼容）」分区：查看备份/备份数据 + API 地址/仓库/分支/Token 输入；自动备份分区 +「备份通道」双开关 `enableWebdavChannel`/`enableGitChannel`）；`setting-form-load.ts`（loadForm 回填 Git 凭据+通道开关；saveForm 写 GM + `settings.backupChannels`）；`setting-form-bind.ts`（绑定 `#gitBackupBtn`/`#gitBackupListBtn`）；`setting-plugin.tsx`（`autoBackup()` 重写为双通道分发）；`vite.config.ts`（version 1.39.0→1.40.0，description 增「Git云备份」）。

**目录约束说明**：git 客户端未放 `src/core/`（与 `webdav.ts` 同级），因 `src/core` 直接子文件数已达 check-structure 门禁上限（28）；且本模块仅 SettingPlugin 使用，放 `src/plugins/setting/` 与 `webdav-operations.ts` 同目录更内聚（setting/ 目录 11 文件 < 20 上限）。

**安全与限制**：私有仓库强引导（备份含观看记录等个人数据）；Token 权限最小化（GitHub fine-grained PAT 可精确授权单仓库 Contents 读写，面板 placeholder 提示「仅需仓库内容读写权限」）；**勿用公共加速镜像**（API 基址可配置兼作自建反代入口，如 Cloudflare Worker 转发，但带 Token 的请求经第三方公共镜像等于泄露凭据，客户端注释已注明）；单文件 100MB 上限（Contents API，备份 JSON 通常 MB 级，>1MB 读取已做 raw 回退）；限流（认证后 5000 次/小时，每日一次自动备份可忽略）；仓库需预建（脚本不代建，代建需额外 scope）。

### 结果

`tsc -b` 通过；ESLint 0 errors/0 warnings（基线保持）；**8 套件 132 用例通过**（含 git-backup-client 21 用例）；check:structure OK（358 files, 58 dirs）；version `1.39.0` → `1.40.0`（新增功能模块，minor）。

### 演进链与遗留

WebDav 单通道 → BackupProvider 抽象双通道。后续可扩展项：Gitee 适配器（认证方式 + 1MB blobs API 绕行）；GitLab 适配器（独立 API 形状）；云通道加密（与本地导出 V2 对齐，需评估 WebDav 同步加密的兼容性，属独立需求）。

## 十八、阶段演进链与遗留

### 演进链总览

**主线一：编号清单整理（ListReflow）**

doc/200 详情页序号清单合并（跨影片回填预留）→ doc/201 期0 只读调查（端点已封装，结论可行）→ doc/202 期1 只读预览（ListReflowPlugin 6 模块 + reflow-panel，压实规则确立）→ doc/203 组识别失败修复（`?id=` 链接形式）→ doc/204 期2 实写执行方案（四条不变式 + 「先加后删」+ 回退/降级/恢复日志；期2a 已实现）→ doc/216 期2b/2c（韧性层 lr-journal 恢复/回滚日志 + 自适应退避 + 批检查点 + 整次撤销；体验层进度条/汇总报告/续传撤销按钮）。

**主线二：自动收藏/移除联动与收藏同步**

doc/205 泛化「值得复盘」受保护模型（Feature A/B 超集取代 doc/53/124，保留 doc/125）→ doc/206 对账消噪（机会性对账静默，保留真兜底）→ doc/207 清单管理器设置页（vlt-panel 升级，集中管理 + 排序/对账配置；与 doc/206 同批落地 1.33.0）→ doc/208 三项优化（排序合并 6 选项、JavDB 端 await+暴露错误、标签化输入；**暴露**根因）→ doc/209 根治（pluginManager 模块级 const 非运行时全局 → 改点 `.jhs-fav-btn` 收藏按钮）→ doc/210 JHS→JavDB 单向批量同步（补历史积压）→ doc/213 双向增量同步（四方向 + 冲突仅报告 + 已看携带评分）→ doc/214 独立设置页 + 引擎重写（tick 驱动状态机、分页抓取/断点续接/后台处理，5 万+ 条目）。

**周边与扩展**：doc/211 CSS line-clamp 警告、doc/212 scripts/check-structure 编辑器类型、doc/215 瀑布流追加条目修改按钮；doc/217 Git 备份通道（BackupProvider 抽象，WebDav+Git 双通道）。

### 版本链与测试数

| 版本 | 事件 |
|---|---|
| 1.30.4 → 1.31.0 | doc/200 序号清单合并 |
| 1.31.0 → 1.32.0 | doc/202 期1 只读预览 |
| 1.32.0 → 1.32.1 | doc/203 组识别修复 |
| 1.32.1 → 1.33.0 | doc/206+207 对账消噪 + 清单管理器设置页 |
| 1.33.0 → 1.34.0 | doc/205 自动收藏/移除泛化 |
| 1.34.0 → 1.35.0 | doc/204 期2a 压实执行核心写路径 |
| 1.35.0 → 1.35.1 | doc/208 三项优化 |
| 1.35.1 → 1.35.2 | doc/209 pluginManager 根治 |
| 1.35.2 → 1.36.0 | doc/210 批量同步 |
| 1.36.0 → 1.36.1 | doc/211 CSS 修复 |
| 1.36.1 → 1.37.0 | doc/213 双向增量同步 |
| 1.37.0 → 1.38.0 | doc/214 独立页+引擎重写 |
| 1.38.0 → 1.38.1 | doc/215 修改按钮修复 |
| 1.38.1 → 1.39.0 | doc/216 期2b/2c |
| 1.39.0 → 1.40.0 | doc/217 Git 备份通道 |

测试用例数：95（doc/200，+33 dpb-list-merge）→ 103（doc/202，+8 lr-planner）→ 111（doc/204 期2a，+8 lr-execute）→ 132（doc/217，+21 git-backup-client）。doc/212 为非 `src/` 改动，不递增版本。

### 遗留 / 待确认

- **doc/204 状态标记未翻转**：期2a 实现时文档注明「待 2b/2c 完成后整体置 ✅」；doc/216 完成 2b/2c 后该头部状态（🔧 待执行）未再同步更新——功能上期2a/2b/2c 已全部落地。
- **doc/205/206 的 README 状态标签为 🔧 待执行**，与各文档头部 ✅ 已执行及正文「已实现」不一致，疑为「计划→实现」过程中 README 未同步。
- **doc/213/214/215/216 验证记录不完整**：均标注「待用户本地 `bun run build`/`bun run test` 确认」，即 ✅ 已执行主要基于编辑器 diagnostics 而非完整构建产物验证。
- **doc/201/202 草案与 doc/204 最终设计的搬运顺序相反**：期0/期1 展望建议「先移除后加入」避免目标清单满员拒绝，期2 最终采用「先加后删」以不变式 1（永不丢片）为最高优先，靠规划器保证目标 ≤501 规避满员。
- **doc/205 的 `isProtectedList` 未单独加测**（依赖整个 VLT 子树，单测易脆），由构建+实测验证；**doc/203 的 `extractListId`** 依赖 `window.location.origin`，未纳入 node 单测，由用户实测验证。
- **doc/210 建议跑前备份**（工具只写 JavDB、不动 JHS）。
- Git 备份后续可扩展项：Gitee/GitLab 适配器、云通道加密（需评估与 WebDav 同步加密的兼容性）。