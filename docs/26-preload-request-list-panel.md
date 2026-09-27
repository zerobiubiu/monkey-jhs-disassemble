# 批量预加载请求列表面板（队列可视化 + 重试/取消/置顶）

> **文档类型**：🧾 变更记录
> **文档状态**：✅ 已执行
> **影响范围**：列表页外站预加载队列（可视化管理）、`AsyncTaskQueue` 能力扩展
> **前置文档**：`25-preload-priority-deprioritize-stated.md`
> **替代文档**：无
> **生效版本**：v1.46.18

> 本文件是「列表页批量与预加载 UX」需求（3 项）的**第 2 项（下半）**增量。
> 第 1 项（已读星级筛选 + 补渲染）见 doc/24；第 2 项上半（优先级降级）见 doc/25。

## 1. 背景与需求

预加载队列此前是**不可观察**的：卡片徽标只给出每个站点的四态（排队中/请求中/成功匹配/匹配失败），
筛选栏只有计数；一旦某条请求长时间卡在队尾或失败，用户既看不到队列全貌，也没有任何手动干预手段。

需求（用户确认 Q4b / 目标 ②）：新增**独立浮层**「批量预加载请求列表面板」，
展示队列情况，并提供**手动重试 / 取消 / 置顶**。

## 2. 方案

### 2.1 队列扩展：任务句柄（`AsyncTaskQueue`）

原队列是纯 FIFO 闭包数组（`pending: Array<() => unknown>`），无法定位、取消或重排任务。
本次为其增加**任务句柄**能力，保持向后兼容（不传键时行为与原先完全一致）：

```ts
export interface QueueTaskHandle {
    readonly key: string;
    isCancelled(): boolean;
}
export interface QueueTaskInfo {
    readonly key: string;
    readonly state: 'pending' | 'running';
}

addTask(task: (handle: QueueTaskHandle) => unknown | Promise<unknown>, key = ''): QueueTaskHandle
getTasks(): QueueTaskInfo[]           // 快照：先执行中、后等待中
cancel(key: string): boolean          // 等待中→出队并置取消位；在途→仅置取消位
prioritize(key: string): boolean      // 等待中→移到队首
```

- **取消语义**：`fetch` 无法中断，在途任务只能置位，由任务闭包在开工前 `isCancelled()` 自检退出；
  等待中的任务直接出队（闭包不再执行）。
- **`pump()` 的取消竞态**：`shift()` 出队与 `then()` 回调执行之间有窗口，`cancel()` 此时查到的是
  `running` 集合中的句柄 → 置位 → 闭包自检拦截，请求不会发出（实测覆盖该路径，见 §4 用例）。

### 2.2 任务注册表（`osp-preload-tasks.ts`）

队列只持有「键 + 状态」，面板需要的**展示信息**（番号、站点名）与**失败留存**由注册表负责：

- 成功 → 记录移除（徽标已显示「成功匹配」，无需留存）；
- 失败 / 被取消 → 记录留存，供面板展示与重试；
- 容量上限 400，超限时按最旧的**终态**记录淘汰（非终态不淘汰，避免丢队列中任务的展示信息）。

### 2.3 面板（组件 + 控制器 + 样式）

| 层 | 文件 | 职责 |
|---|---|---|
| 视图 | `src/components/other-site/preload-queue-panel.tsx` | `.jhs-pqp` 表头（计数 + 并发 + 全部重试/清空已结束/关闭）+ 行列表 + 空态；纯渲染 |
| 控制 | `src/plugins/other-site/osp-preload-panel.tsx` | 挂载/刷新/销毁 + 容器级**事件委托**（`data-act`/`data-key`） |
| 样式 | `src/styles/other-site/preload-queue-panel.css` | 固定浮层（右上角 `--jhs-z-top`）+ 入口按钮；颜色/间距走 design-tokens |
| 入口 | `src/plugins/other-site/osp-filter-bar.ts` | 筛选栏新增「请求列表」按钮（`togglePreloadQueuePanel`） |

行顺序 = **队列真实顺序**（执行中 → 排队中，来自 `getTasks()`），其后追加不在队列中的终态记录；
行内动作按状态给出：在队未执行 → 置顶 / 取消；执行中 → 取消；终态 → 重试 / 移除。

**依赖方向（无循环导入）**：`osp-preload-panel` 不导入 `osp-preload`；重试/取消经
`OtherSitePlugin.retryPreload / cancelPreload` 薄委托进入编排层（`osp-preload` → 面板/筛选栏单向）。

### 2.4 编排层改动（`osp-preload.tsx`）

- 抽出 `enqueuePreloadTask(plugin, carNum, siteConfig, itemEl)` —— **首轮预加载与面板「重试」共用**
  （避免重复实现）：写注册表 → 置徽标「排队中」→ 入队（带键）→ 闭包内自检取消/拦截/在途状态 →
  按结果同步注册表。
- 新增 `retryPreloadTask` / `cancelPreloadTask` / `clearPreloadStatus` / `findListItemByCarNum`。
- **取消时清除卡片徽标**：否则该卡片的「排队中」计数会永久残留，筛选栏计数失真。
  卡片已翻页/被重排找不到时，重试仍会预热缓存，只是不再更新徽标。
- `findListItemByCarNum` 走注册表选择器 `siteQuery('listItem')`，**未引入新的裸站点字面量**
  （`check:selectors` 保持 89 文件 / 275 处）。

## 3. 实施（修改文件清单）

| 文件 | 变更 |
|---|---|
| `src/core/async-task-queue.ts` | 任务句柄（key / isCancelled / getTasks / cancel / prioritize），`addTask` 返回句柄 |
| `src/plugins/other-site/osp-preload-tasks.ts` | **新增** `PreloadTaskRegistry` + 状态文案/判定纯函数 |
| `src/plugins/other-site/osp-preload-panel.tsx` | **新增** 面板控制器（挂载/防抖刷新/销毁/事件委托） |
| `src/components/other-site/preload-queue-panel.tsx` | **新增** 面板 React 组件（jsxToString 渲染） |
| `src/styles/other-site/preload-queue-panel.css` | **新增** 浮层与入口按钮样式（含 `:root` 状态色令牌） |
| `src/plugins/other-site/osp-preload.tsx` | `enqueuePreloadTask` 抽取 + retry/cancel/clear badge + 取消自检；导出 `updatePreloadStatus` |
| `src/plugins/other-site/osp-filter-bar.ts` | 「请求列表」入口按钮 |
| `src/plugins/other-site-plugin.tsx` | `preloadTasks` / 面板字段 / `retryPreload` / `cancelPreload` / CSS + destroy 清理 |
| `tests/async-task-queue.test.ts` | **新增** 11 用例（串行/并发/抛错隔离/快照/取消两种/置顶/空等待/动态并发） |
| `tests/preload-task-registry.test.ts` | **新增** 9 用例（写读/重试语义/计数/排序/清理/容量淘汰/终态判定） |

**数据安全**：只读缓存与 `car_list`，不迁移、不覆盖；取消/重试只影响本轮内存队列与卡片徽标。

## 4. 执行验证记录

### 验证命令与实际输出

| 命令 | 结果 |
|---|---|
| `bun run build` | exit 0 |
| `bun run lint` | exit 0（0 problems） |
| `bun run lint:css` | exit 0 |
| `bun run test` | exit 0；**21 文件 / 254 用例**（原 19 / 235，新增 19） |
| `bun run check:structure` | exit 0 |
| `bun run check:docs` | exit 0 |
| `bun run check:selectors` | exit 0（89 文件 / 275 处，与基线持平 —— 无新增裸站点字面量） |

### 验证结论

队列可被外部观察与干预：快照顺序、取消（等待中出队 / 在途置位自检）、置顶重排、动态并发
提升后立即启动，均有单测覆盖；注册表的失败留存、计数、容量淘汰行为符合设计。

## 5. 后续验证建议（真实浏览器）

1. 列表页出现「请求列表」按钮；点击打开右下角浮层，行顺序与卡片徽标进度一致。
2. 排队中的行点「置顶」→ 该番号先进入「请求中」。
3. 执行中/排队中点「取消」→ 行变「已取消」，**卡片对应徽标消失**，筛选栏计数同步下降。
4. 制造失败（如断开 missav 域名）→ 行变「失败」→「重试」可重新入队；「全部重试」批量重跑。
5. 关闭面板再打开：队列仍在（面板只是视图）；页面卸载（beforeunload）时面板随 destroy 移除。

## 6. 已知限制

- **在途请求无法真正中止**：取消仅阻止「尚未发出」的请求；已在途的请求会跑完并写缓存，
  其行状态随后变为成功/失败（面板不再显示「已取消」）。
- 「并发」只读展示，修改仍需设置面板的 `preloadConcurrency`（运行时改并发不在本项范围）。
- 面板不跨页面存活（单页应用内的浮层）；刷新页面即重建队列。
