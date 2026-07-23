# doc/176 — Wave 3 复用合并

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

原子化→复用循环第三轮（Wave 3）。在 Wave 1（doc/174）/ Wave 2（doc/175）完成大文件
原子化拆分与首轮组件复用合并后，本轮执行 Round-2 复用审计发现的 2×H + 3×M 合并项，
持续消除跨文件重复、收敛内联 any，并对一处审计高估的合并项做出「不合并」的判定。

## 1. 三重广播总线统一（H×2，~140 行去重）

新建 `src/core/util/broadcast.ts`（`broadcastSend` + `broadcastSubscribe`），统一 4 处
发送点 + 3 处订阅点的 GM_setValue / localStorage / CustomEvent 三通道收发。

**线格式逐字节保留**：

- `JSON.stringify` 写 GM / localStorage，对象传 CustomEvent `detail`；
- `eventName` / `eventDetail` / `raw` 选项保留各站点差异：
  - `jdb:last-sync` vs `jdb:sync-complete` 事件名差异；
  - dpb 的 CustomEvent `detail` 不含 `time` 差异；
  - dpb 的 `raw` 自解析模式。

**与原始一致的边界**：无 senderId、无跨通道去重、无 teardown。

迁移文件：`vlt-broadcast` / `vlt-remote-sync` / `vlt-sync-listener` / `dpb-want-watched`。
消除「修 bug 须改 4 处」隐患。

## 2. failWithToast 补全（M，11 对）

`car-list-ops.ts` 10 对 + `keyword-ops.ts` 1 对的 `show.error` + `throw` 改为
`failWithToast`。1 处独立 `show.error` + `return`（无 throw）保留不动。

## 3. 红色 span 组件合并（M）

- `LogColored` 删除（零 JSX 导入者），`logColoredHtml` 重定义为
  `ColoredTextCell(color='#f40')` 的薄包装；
- `ConfirmWarn` 重定义为 `<br/>` + `ColoredTextCell` 的薄包装；
- `colored-text-cell.tsx` 不变。

经 `jsxToString` 实证输出逐字节相同。

## 4. Fc2 对话框骨架合并（M→DEFERRED）

经详细对比，两对话框共享骨架仅 ~6-10 行（非审计估计的 ~40 行），干净合并需 ≥3 个
slot prop，总代码量反增且可读性下降；按 AGENTS §10.2 判定为有害过度抽象，标记为
resolved-by-deferral（N/A），不强制合并。

## 5. broadcast.ts 归入 core/util/

修复 `src/core` 直接文件数 29→28（ratchet 上限内）。

## 6. 副作用：eslint 警告下降

eslint 警告 74→60。`failWithToast` + `broadcast` 类型化消除内联 any。

## 实施清单

| 文件 | 操作 |
|------|------|
| src/core/util/broadcast.ts | 新增（三重广播总线，归入 core/util/） |
| src/plugins/video-lists-tag/vlt-broadcast.ts | 迁移至 broadcastSend/broadcastSubscribe |
| src/plugins/video-lists-tag/vlt-remote-sync.ts | 迁移至 broadcastSubscribe |
| src/plugins/video-lists-tag/vlt-sync-listener.ts | 迁移至 broadcastSubscribe |
| src/plugins/detail-page-button/dpb-want-watched.ts | 迁移至 broadcastSend（raw 自解析保留） |
| src/core/storage/car-list-ops.ts | 10 对 show.error+throw → failWithToast |
| src/core/storage/keyword-ops.ts | 1 对 show.error+throw → failWithToast |
| src/components/log/log-colored.tsx | logColoredHtml 重定义为 ColoredTextCell 薄包装 |
| src/components/misc/confirm-warn.tsx | ConfirmWarn 重定义为 <br/> + ColoredTextCell 薄包装 |

## 验证记录

- tsc：0 错
- vitest：28/28
- eslint：0 错（60 warn）
- stylelint：干净
- check:structure：OK（295 文件 46 目录）
