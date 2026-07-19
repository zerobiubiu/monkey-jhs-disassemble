# 126 - 修复 JavDB 清单服务端/本地关联分叉

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行
> **执行日期**：2026-07-19

## 1. 背景

用户反馈详情页 `https://javdb.com/v/ne8nk9` 向「迫切想看4」添加影片时提示
已达 501 条，但 JavDB 清单页面当时只显示 498 条。

登录态浏览器现场核对得到：

- JavDB 服务端：498 条、498 个唯一番号；
- 本地 `vlt_movie_inventory`：501 条、501 个唯一番号；
- 本地独有：`EBWH-144`、`EBWH-100`、`EBWH-164`；
- 服务端独有：0 条。

因此本次事故并不是 doc/125 推测的 `inventory.count` 字符串拼接，而是三个
**真实的本地关联**未成功写入 JavDB。doc/125 已执行文档按 migration 原则不回改；
v1.19.7 对 count 缓存的修复仍然有效，但无法解决“服务端请求未确认、本地先写”问题。

用户手动把三条补到 JavDB 后再次完整读取 13 页，结果为：服务端标题 501、
服务端 501 个唯一番号、本地 501 个关联，双向差集均为 0。

## 2. 根因

JavDB 原生 `list_controller#listCheckboxChanged` 会 POST：

```json
{
  "video_id": "影片 ID",
  "checked": true,
  "list_id": "清单 ID"
}
```

只有响应 `data.success === true` 才代表站内写入成功；失败时原生代码会回退
checkbox。

旧版 `setupCheckboxListener` 与原生 Stimulus 请求互不关联：它监听同一个 change，
固定延迟 300ms 后直接调用 `VltDb.sync()`。因此下列情况都会让本地先增加、服务端
没有对应关联：

1. JavDB 返回业务失败（包括 501 上限）；
2. 网络失败、超时或响应解析失败；
3. POST 尚未结束时关闭/跳转页面；
4. 快速操作或多标签页导致独立 IDB 读写互相覆盖。

此外，评分后自动移出「等待更新」的 DOM 不可用兜底曾明确“仅删除本地”，以及清单
删除曾在 JavDB 请求和本地删除之间使用 `Promise.all`，也存在同类分叉风险。

## 3. 方案

### 3.1 服务端成功后才写本地

- 在捕获阶段仅接管 `#modal-save-list` 的原生 checkbox change；平铺面板仍先按
  `data-list-id` 映射到 modal，避免索引错位；
- 阻止 Stimulus 重复请求，由插件发送与 JavDB 原生一致的
  `/users/save_video_to_list` JSON POST；
- `success=true` 后再读取 `/users/simple_lists?vid=...` 的权威勾选态和数量，随后
  提交 IDB；`success=false` 不写本地并恢复 UI；
- `/users/simple_lists` 按响应 `page` 中 `a[rel=next]` 完整翻页，只有耗尽分页后
  才能把“未找到清单”判为未勾选；
- 网络结果不确定时不写本地、不清恢复日志，避免“GET 读到仍在处理中的旧状态”后
  误判；下次打开页面再读取最终权威状态。

### 3.2 崩溃恢复与并发串行

- POST 前同步写入独立 localStorage 恢复日志；日志写入失败则取消本次操作；
- 只有 JavDB 权威状态已读取且本地提交/完整对账成功后才删除日志；
- 页面启动时恢复遗留日志，恢复动作与实时操作共用同一 association 队列；
- 用 `navigator.locks` 对 `designation::listId` 加同源跨标签页排他锁，覆盖
  POST → 权威读取 → IDB 提交的整个流程。

### 3.3 原子 IDB 与安全对账

- `movies`、`inventory`、`movie_inventory`、`meta` 在同一个 IndexedDB
  readwrite transaction 内读取、计算、写回，消除多标签页“旧对象后写覆盖”；
- `meta` 增加 `epoch + listRevisions`，完整分页抓取期间若本地发生变化，则 guard
  冲突并零写入重试；
- 详情页清单内容稳定后，比较 JavDB 显示数量、当前影片勾选态与本地真实关联；
  有差异才触发全量对账；
- 单次对账连续抓取两份完整分页快照，要求标题总数、原始条数、唯一番号数、全量
  番号顺序完全一致；任一分页失败、503/登录页/Cloudflare 页、重复番号、循环分页或
  两次快照变化均零写入；
- 对账只替换目标 listId 的关联，保留其他清单、清单 style 和影片 createdAt。

### 3.4 其他一致性修复

- 评分后自动移出「等待更新」的 DOM 兜底也改走同一服务端确认链路，删除“仅本地
  remove”；
- 清单删除改为 JavDB DELETE 成功后再删除本地 IDB 和 DOM；
- 平铺面板到 modal 的 checkbox 映射由数组下标改为 `data-list-id`。

## 4. 实施文件

| 文件 | 改动 |
|------|------|
| `src/plugins/video-lists-tag/vlt-sync.ts` | 接管 JavDB checkbox 请求、权威状态分页读取、持久化恢复日志、同页队列、Web Locks、失败 UI 回滚；等待更新兜底与清单删除改为服务端成功优先 |
| `src/plugins/video-lists-tag/vlt-db.ts` | 四逻辑对象单事务写入；revision/epoch/fingerprint guard；完整清单快照对账；服务端确认写入模式 |
| `src/plugins/video-lists-tag/vlt-reconcile.ts` | 新增完整分页双快照抓取、严格校验、差异检测和自动对账模块 |
| `src/plugins/video-lists-tag/vlt-plugin.tsx` | 更新模块说明 |
| `src/plugins/detail-page-button-plugin.tsx` | 平铺清单 checkbox 按 `data-list-id` 映射 |
| `AGENTS.md` | VideoListsTagPlugin 子目录模块数 5 → 6 |
| `doc/README.md` | 登记 doc/126 与阅读顺序 |
| `changelog/CHANGELOG.md` | 新增 v1.19.8 修复记录 |
| `vite.config.ts` | version `1.19.7` → `1.19.8` |

## 5. 执行验证记录

```text
$ bunx tsc -b
通过（无 TypeScript 错误）

$ bun run build
tsc -b && vite build
✓ 220 modules transformed
dist/monkey-jhs-disassemble.user.js  1,954.13 kB │ gzip: 450.68 kB
✓ built in 1.36s

$ git diff --check
通过（仅既有 CHANGELOG CRLF 提示，无 whitespace error）
```

lightningcss 对 `layer.css` IE hack 的告警为既有告警，不是本次引入。

线上只读验证（用户手动补齐三条后）：

```text
expected=501, pages=13
serverCount=501, serverUnique=501
localCount=501
localOnly=[]
serverOnly=[]
```

## 6. 后续验证建议

1. 在未满清单正常勾选/取消：JavDB 数量、checkbox、本地真实关联数同步变化；
2. 在 501 条清单勾选新影片：JavDB 拒绝后 UI 回滚，本地关联数保持 501；
3. DevTools 模拟 `/users/save_video_to_list` 网络失败：本地不写入且保留恢复日志；
4. POST 发出后立即关闭页面，再打开任一详情页：脚本按 `/users/simple_lists`
   最终状态恢复本地并清日志；
5. 两个标签页快速操作同一影片/清单：Web Lock 串行，最终服务端与 IDB 一致；
6. 人为制造本地 501、服务端 498：打开详情页后触发双快照对账，精确移除本地多余
   三条，不影响其他清单。
