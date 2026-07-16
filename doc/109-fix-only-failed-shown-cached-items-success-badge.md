# 109 - 修复仅匹配失败显示徽标（已缓存项补「成功匹配」）

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 1. 背景

doc/108 上线后用户反馈：「为什么只有匹配失败了的，显示了，其他状态都没显示」。

live 调研（`/lists/Azm8DM?f=download`）确认根因：73 个 item 中 56 个已缓存
（`jhs_other_site` 有 `carNum_missAv` 键 = missav 曾命中），但 doc/108 的
`syncAllBadges` 对已缓存项**不创建徽标**（仅未缓存项预填「排队中」）。故
已缓存项徽标为空，仅未命中（未缓存 + 本轮 missav 未找到）的 17 项显示
「匹配失败」——视觉上「其他状态都没显示」。

## 2. 方案

已缓存 = missav 曾命中 = 成功。给已缓存项补「成功匹配」徽标：

- `syncAllBadges`：已缓存项 → `updatePreloadStatus(success)`（无徽标则创建，
  陈旧「排队中」纠正为成功；已是成功则跳过避免重复写）。
- `handle()` 列表页分支：在 `preloadListPage` 前同步调 `syncAllBadges`，
  使首屏已缓存项立即显示「成功匹配」（不必等预加载）。
- 筛选栏去掉「已缓存」芯片（已缓存即成功，语义合并），保留 4 档：
  排队中/请求中/成功匹配/匹配失败。
- `getItemPreloadStatus`：无徽标返回 `'none'`（原 `'cached'`），`collectPreloadCounts`
  只计 4 档（`none` 不计入），CSS 删除 `cached` 芯片样式。

## 3. 实施

| 文件 | 改动 |
|------|------|
| `src/plugins/other-site-plugin.tsx` | `PRELOAD_CHIPS` 去 cached 项（4 档）；`syncAllBadges` 已缓存→success（无/陈旧才写）；`handle` 列表页分支 preloadListPage 前调 syncAllBadges；`getItemPreloadStatus` 无徽标返回 'none'；`collectPreloadCounts` 去 cached 键、`if(st in counts)` 守卫 |
| `src/styles/preload-status-badge.css` | 删除 `cached` 芯片的 `.pf-dot` 与 `.active` 样式（未使用） |
| `vite.config.ts` | version 1.15.0→1.15.1 |
| `doc/README.md` | 文档清单新增 doc/109 |
| `changelog/CHANGELOG.md` | 新增 v1.15.1 条目 |

## 4. 执行验证记录

### 4.1 类型检查 + 构建

```bash
$ npx tsc -b            # 通过
$ npx vite build        # @version 1.15.1
```

### 4.2 live 逻辑验证（在真机 item 上模拟新 syncAllBadges）

对 `/lists/Azm8DM` 真实 item 运行 cached→success 补徽标逻辑：

- 28 个已缓存 item → 创建「成功匹配」徽标
- 新分布：成功匹配 28 / 匹配失败 12 / none 0（全部 item 均有徽标，无空窗）
- 徽标 HTML 正确：`<span class="jhs-preload-status" data-site-id="missAvBtn">
  <span class="jhs-ps-name">missAv</span><span class="jhs-ps-badge jhs-ps-success">
  成功匹配</span></span>`

## 5. 后续验证建议

1. **全部状态可见**：重新安装 v1.15.1 后，列表页每个 item 都有徽标
   （已缓存→绿色「成功匹配」✓；未命中→红色「匹配失败」✕；预加载中→
   琥珀「请求中」脉冲/灰色「排队中」），不再有空白 item
2. **筛选栏 4 档**：芯片为 排队中/请求中/成功匹配/匹配失败，计数实时
3. **点击「成功匹配」**：仅显示 missav 已命中的卡片；点「匹配失败」仅显示未命中的
