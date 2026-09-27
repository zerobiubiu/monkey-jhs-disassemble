# 预加载优先级：带状态标签的卡片降级到队尾

> **文档类型**：🧾 变更记录
> **文档状态**：✅ 已执行
> **影响范围**：列表页外站预加载（other-site 预加载队列的任务顺序）
> **前置文档**：`24-read-status-score-filter.md`
> **替代文档**：无
> **生效版本**：v1.46.17

> 本文件是「列表页批量与预加载 UX」需求（3 项）的**第 2 项（上半）**增量：
> 预加载优先级降级。「批量预加载请求列表面板」（第 2 项下半）在后续增量中另行记录。

## 1. 背景

列表页预加载（`other-site/osp-preload.tsx` 的 `preloadListPage`）会遍历 `.movie-list .item`，
对无缓存的番号入队串行请求外站搜索页并写缓存。

原实现按 **DOM 顺序**依次入队，不区分卡片状态。而用户判定口径是：**已读 / 已收藏的卡片
已经被处理过，预热价值最低**，不该占用队列前段。

用户明确澄清（doc/25 Q3 答复）：此处「有标签」指**状态标签（已读、已收藏）**，
不是 vlt 清单标签；「最低」指**排到队列末尾**，而不是直接跳过。

## 2. 方案

新增纯函数 `src/plugins/other-site/osp-preload-order.ts`：

```ts
export function orderItemsByPreloadPriority(
    items: HTMLElement[],
    statedCarNums: ReadonlySet<string>,
    getCarNum: (item: HTMLElement) => string
): HTMLElement[]
```

- **稳定分区**：常规卡片保持原序在前，带状态标签的卡片保持原序在后；
- 无降级卡片时**直接返回原数组引用**（零开销，调用方可据此判断是否发生了重排）；
- 番号取不到（空串）的卡片按**常规**优先级处理 —— 解析失败不代表它已被用户标记过；
- 番号比较统一小写化，避免 `car_list` 与页面大小写不一致导致漏判。

`preloadListPage` 的接入方式：

1. 读一次 `car_list`，收集状态为 `FAVORITE_ACTION` / `HAS_WATCH_ACTION` 的番号（小写化）成 `Set`；
   读取失败只记日志并跳过降级，不阻断预加载。
2. 用 `orderItemsByPreloadPriority` 重排卡片（番号经既有
   `listPagePlugin.findCarNumAndHref` 提取，异常时按常规优先级）。
3. 把原来的 `$items.each(...)` 改为 `$(orderedItems).each(...)` —— 保留 `each` 回调内
   `return` 的语义（若改成 `for` 循环，回调里的 `return` 会变成退出整个函数，属语义变更）。

**判定依据为什么用 car_list 而不是 DOM 标签**：DOM 上的 `.status-tag` 由
`list-page/lp-filter` 渲染，且本需求第 1 项还要求「从缓存补渲染」——渲染时序不确定；
以 `car_list` 为准才能稳定识别「应当降级」的卡片。

## 3. 实施（修改文件清单）

| 文件 | 变更 |
|---|---|
| `src/plugins/other-site/osp-preload-order.ts` | **新增** 纯函数 `orderItemsByPreloadPriority` |
| `src/plugins/other-site/osp-preload.tsx` | 读 `car_list` 建降级 Set；用纯函数重排后再逐卡入队；导入 `FAVORITE_ACTION`/`HAS_WATCH_ACTION` |
| `tests/osp-preload-order.test.ts` | **新增** 5 用例（稳定分区、大小写、番号缺失、空集合原样返回、无命中原样返回） |

**数据安全**：只读 `car_list`，不写入、不迁移。

## 4. 执行验证记录

### 验证命令与实际输出

| 命令 | 结果 |
|---|---|
| `bun run build` | exit 0 |
| `bun run lint` | exit 0（0 problems） |
| `bun run lint:css` | exit 0 |
| `bun run test` | exit 0；**19 文件 / 235 用例**（原 18 / 230，新增 5） |
| `bun run check:structure` | exit 0 |
| `bun run check:docs` | exit 0 |
| `bun run check:selectors` | exit 0（无新增裸站点字面量：番号读取走既有 `findCarNumAndHref`） |

### 验证结论

带状态标签（已读/已收藏）的卡片被稳定重排到队列末尾，其余顺序不变；无降级卡片时零开销。

## 5. 后续验证建议

1. 真实列表页：确认控制台出现「预加载优先级：带状态标签（已读/已收藏）的卡片已排到队尾」，
   且无状态卡片的徽标先进入 `请求中 / 成功匹配`。
2. 交叉验证：找一张已读卡片与一张未处理卡片，观察队列先处理后者。
3. 回归：`car_list` 为空或无状态记录时，预加载行为与原先完全一致。

## 6. 已知限制

- 降级仅按 `car_list` 的 `status`；未读但有其他标记（如关键词/演员屏蔽）的卡片不参与降级。
- 「置顶/取消」等**队列手动干预**属于第 2 项下半（请求列表面板），当前队列仍是纯 FIFO，
  不支持取消或重新排序；相关能力见后续增量。
