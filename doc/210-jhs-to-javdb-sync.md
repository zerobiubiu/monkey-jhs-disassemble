# 210 - JHS 收藏 → JavDB 想看 批量同步工具

> **文档类型**：🔧 开发指导
> **文档状态**：✅ 已执行

## 1. 背景

doc/208/209 之前，自动收藏只写进 JHS IDB（`car_list` 的 `FAVORITE_ACTION`），JavDB 端触发
（`pluginManager is not defined`）一直失败，攒下一批「脚本已收藏、JavDB 无状态」的番号。
doc/209 修好了新增自动收藏，但**历史积压**仍在。用户需要一个工具把积压补同步到 JavDB。

现有只有反方向工具（`WantAndWatchedVideosPlugin` 是 JavDB→JHS 导入），无 JHS→JavDB，故新增。

## 2. 用户确认的决策（D1–D6 全做）

| # | 决策 | 采纳 |
|---|---|---|
| D1 | 同步范围 | 仅 `FAVORITE_ACTION`（收藏）→ JavDB 想看 |
| D2 | 安全检查 | 先拉 JavDB 想看/已看列表，已想看跳过、绝不降级已看 |
| D3 | 放置位置 | 清单管理器设置面板按钮 |
| D4 | 请求间隔 | 默认 500ms（`jhsSyncInterval` 可调） |
| D5 | JHS 收藏但 JavDB 已看 | 跳过 + 汇总列出 |
| D6 | 长期功能 | 是（随时可用） |

## 3. 方案

清单管理器新增「收藏同步」分区（按钮 + 间隔输入 + 中止 + 状态区）。流程：

1. 读 JHS `car_list`，筛 `status === FAVORITE_ACTION`，从 `url`（`/v/{id}`）提取 videoId。
2. **安全检查（D2）**：抓取 JavDB `/users/want_watch_videos` 与 `/users/watched_videos` 全部页
   （`.movie-list .item a[href*="/v/"]`，`a.pagination-next` 翻页）得 videoId 集合。
3. 分类：已想看 → 跳过计数；JavDB 已看 → 跳过并记录番号（D5，绝不降级）；其余 → 待同步。
4. 逐个 `POST /v/{videoId}/reviews/want_to_watch`（带 CSRF），`jhsSyncInterval` 限速（D4），
   可中止，进度回调更新状态区，结束汇总（成功/失败/已想看跳过/已看跳过/失败明细）。

## 4. 实施

| 文件 | 改动 |
|---|---|
| `src/plugins/setting/jhs-to-javdb-sync.ts` | **新增**：`syncJhsFavoritesToJavdb`（核心）+ `fetchVideoIdSet`/`postWantToWatch` + `handleJhsSyncClick`/`abortJhsSync`（UI 处理） |
| `src/components/setting-panels/list-manager-panel.tsx` | 清单管理器增「收藏同步」分区（按钮 + `jhsSyncInterval` + 中止 + 状态区） |
| `src/plugins/setting/setting-form-bind.ts` | 绑定 `#jhs-sync-btn`/`#jhs-sync-abort-btn` |
| `src/plugins/setting/setting-form-load.ts` | `jhsSyncInterval` 读写（默认 500） |

## 5. 执行验证记录

```
$ bun run build      # tsc -b 零错误，392 modules，✓ built
$ bun run test       # 111 passed
$ bun run lint       # 0 errors / 0 warnings
$ bun run check:structure   # OK
```

版本 1.35.2→1.36.0（新增功能，minor）。

## 6. 后续验证建议（需登录 JavDB）

1. 清单管理器「收藏同步」→ 点「同步 JHS 收藏到 JavDB」→ 确认 → 看进度与汇总。
2. 同步后到 JavDB「想看」列表（`/users/want_watch_videos`）确认积压番号已出现。
3. 构造「JHS 收藏但 JavDB 已看」的番号 → 应跳过并在汇总列出（不降级）。
4. 中止按钮可在同步中停止；间隔调大观察限速生效。
5. **跑前备份**（只写 JavDB、不动 JHS，但稳妥起见）。
