# 评价/收藏/清单与 JavDB 状态自动校验同步

> **文档类型**：🔧 开发指导
> **文档状态**：✅ 已执行
> **版本**：1.44.5 → 1.45.0（minor，新增功能模块）
> **前置文档**：doc/210（JHS→JavDB 批量同步）、doc/206（清单自动对账）

## 1. 背景

用户反馈两类数据错位问题：

1. **评分/已读/收藏**：点击时脚本先写本地 IndexedDB（JHS），再推送 JavDB。网络抖动等原因
   可能「脚本已写入、服务器未写入」。再次打开该影片时，脚本与 JavDB 状态不一致。
2. **误拦截 bug**：脚本已存下评分但服务器未同步时，用户再点相同评分会被脚本拦截提示
   「评分未变化」（`quickSetHasWatch` 只看本地记录）；收藏同理（`quickConvertToFav` 拦住
   「已是已收藏」）。此时服务器其实没有该状态，用户无法通过脚本补推。
3. **视频清单同理**：清单 checkbox 变更在服务器未确认时本地不写（`postJavdbListMutation`
   需 `confirmed`），但存在「本地已有关联、服务器未勾选」的错位场景（如恢复日志重推路径、
   历史数据），原有 `runAutomaticReconciliation` 只做服务器 → 本地方向，会把本地独有关联
   反向抹掉。

要求：**打开影片时自动核实服务器与脚本状态匹配，按脚本记录向 JavDB 自动同步**，
不便时反向（服务器 → 本地）。

## 2. 方案

### 2.1 评价状态自动校验（新模块 `dpb-review-sync.ts`）

详情页 `.review-buttons` 出现后延迟 1.2s 执行一次比对（`plugin._autoSyncChecked` 单页一次）：

- **已完全一致** → 跳过。
- **方向 1（首选）**：脚本有记录、服务器完全没有评价（无想看/无已看）→
  按脚本记录推送：`favorite → triggerJavdbWant()`、`hasWatch → triggerJavdbReview(score)`。
- **方向 2（反向）**：服务器有评价、脚本无记录 → 拉取服务器状态写入本地（含评分）。
- **方向 3（冲突）**：双方均有但状态不一致 → 跳过并 `clog.warn`（沿用 doc/210「绝不降级」原则，
  避免误覆盖）。
- 推送经 `_reviewChain` 串行化 + `_wantWatchedSyncing` 阻断 MutationObserver 防递归。

### 2.2 修复误拦截 bug（`dpb-rating-api.tsx`）

- `quickSetHasWatch`：拦截条件由「本地已 hasWatch + 同分」改为「**服务器**已确认
  watched + 同分」；服务器未同步时不再拦截，正常推送。
- `quickConvertToFav`：拦截条件由「本地已 favorite」改为「**服务器**已确认 want」；
  服务器未同步时先移除本地再重存，触发重新推送（避免 `saveCar` 抛「已在收藏列表中」）。

### 2.3 清单本地独有关联自动补推（`vlt-reconcile.ts`）

`runAutomaticReconciliation` 按「当前影片归属」判断方向：

- **归属一致 + 数量一致** → 跳过。
- **归属一致 + 数量不一致** → 既有全量校准（服务器 → 本地）。
- **本地有关联、服务器未勾选** → 新增 `pushLocalOnlyAssociation`：
  `postJavdbListMutation(videoId, listId, true)` 补推 JavDB（经 `enqueueAssociationTask`
  串行 + Web Lock），成功后按本地 `actualCount` 更新服务器数量显示；失败保留本地并提示。
- **服务器已勾选、本地无关联** → 既有全量校准（服务器 → 本地）。

### 2.4 恢复日志重推（`vlt-server-recover.ts`）

`commitAuthoritativeState` 增加：权威状态与 `entry.desiredChecked` 相反时（服务器大概率未
写入该项变更），重试 `postJavdbListMutation` 推送期望状态，重推确认后才提交本地；重推未
确认则保留恢复日志（下次打开页面再试），避免反向把用户期望抹掉。

### 2.5 设置开关（`autoServerSync`，默认开启）

两种自动同步共用同一开关，见「对账校准」面板；关闭后：
- 评价状态自动校验不再执行（`setupAutoReviewSync` 直接不注册）。
- 清单本地独有关联不再补推（保留日志提示）。

## 3. 实施（修改文件清单）

| 文件 | 变更 |
|------|------|
| `src/plugins/detail-page-button/dpb-review-sync.ts` | **新增**：`readServerReviewState` / `setupAutoReviewSync` / `autoSyncReviewState` / `enqueuePush` |
| `src/plugins/detail-page-button/dpb-rating-api.tsx` | 修复 `quickSetHasWatch` / `quickConvertToFav` 拦截条件为服务器状态 |
| `src/plugins/detail-page-button-plugin.tsx` | 新增 `_autoSyncChecked` 标志；`handle()` 读 `autoServerSync` 并注册 `setupAutoReviewSync`；头部注释补模块 |
| `src/plugins/video-lists-tag/vlt-reconcile.ts` | 新增 `setAutoServerSyncEnabled` / `pushLocalOnlyAssociation`；`runAutomaticReconciliation` 分方向处理 |
| `src/plugins/video-lists-tag/server/vlt-server-recover.ts` | `commitAuthoritativeState` 权威状态与期望相反时重推 |
| `src/plugins/video-lists-tag/vlt-plugin.ts` | `handle()` 注入 `autoServerSync` 到 `setAutoServerSyncEnabled` |
| `src/components/setting-panels/list-manager-panel.tsx` | 「对账校准」新增 `autoServerSync` 开关 |
| `src/plugins/setting/setting-form-load.ts` | `autoServerSync` 读写（默认开启） |
| `vite.config.ts` | version 1.44.5 → 1.45.0（minor） |
| `package.json` | version 字段同步 1.45.0（元数据修正） |
| `doc/234-eval-review-list-auto-sync.md` | 本文档 |

## 4. 执行验证记录

### 执行环境

Windows + Bun（构建/静态验证）。

### 验证命令

```text
$ bun run build
$ bun run lint
$ bun run test
$ bun run check:structure
```

### 实际输出

```text
$ bun run build
dist/monkey-jhs-disassemble.user.js  2,206.89 kB │ gzip: 511.53 kB
✓ built in ~1.5s

$ bun run lint
（无输出 = 0 errors / 0 warnings）

$ bun run test
 Test Files  12 passed (12)
      Tests  177 passed (177)

$ bun run check:structure
check-structure: OK (367 files, 63 dirs within limits; 4 file-ceilings, 3 dir-ceilings in ratchet)
```

### 前端或调用方验证

无独立前端；产物 userscript 头部 `@version 1.45.0` 已核对。

### 验证结论

✅ 通过。构建/lint/177 测试/结构门禁全绿，产物 `@version 1.45.0`。

### 已知限制

- 自动校验的「本地优先」方向需要用户浏览器实测确认（网络/登录态正常时）。
- 冲突（本地想看 vs 服务器已看等）默认跳过，需用户手动处理或使用「收藏同步」面板（doc/210）
  批量核对。
- 频繁打开大量详情页时会逐页出现同步 toast，属预期提示。