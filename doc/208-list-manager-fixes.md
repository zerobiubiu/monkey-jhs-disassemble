# 208 - 清单管理器三项优化（排序合并 / 自动收藏 JavDB 端 / 多项标签化）

> **文档类型**：🔧 开发指导
> **文档状态**：✅ 已执行

## 1. 背景

用户实测 doc/205/207 后反馈三个问题，本次逐一修复：

1. **排序**：「默认排序方式」仅 2 选项（方向），「排序字段」3 选项，但改排序字段**不生效**；
   设计也不合理——应合并为**单个**「默认排序方式」，按内容扩展为多选项。
2. **自动收藏联动**：只实现了脚本端（JHS IDB 标记收藏），**JavDB 端未成功触发**（等价手动点
   收藏按钮的那一步）；doc/205 之前加入「等待更新」尚有此触发，本次修改后失效。
3. **多项输入**：「不参与合并的清单名」「受保护清单关键词」用单个逗号分隔输入框，混乱；
   应参考「屏蔽关键词」的**标签化**实现。

## 2. 方案与根因

### 2.1 排序：合并为单个「字段-方向」控件

- 移除独立的 `listSortBy`（排序字段）设置项。
- `listDefaultSort` 由 2 选项（name-desc/name-asc）扩展为 **6 选项**：
  `name-desc/name-asc/count-desc/count-asc/num-desc/num-asc`（名称/数量/序号 × 降/升）。
- 详情页清单面板排序下拉同步扩展为 6 项；`ensureListPanel` 按设置设下拉默认值。
- `applyListPanelView` **直接从下拉值解析「字段+方向」**（`lastIndexOf('-')` 切分），不再依赖
  旁路的 `dataset.listSortBy`——改字段必然生效（修复原「改字段不生效」）。
- 向后兼容：旧 `listDefaultSort` 值（name-desc/name-asc）仍是合法子集；`listSortBy` 成为孤立键
  （不再读取，无害）。

### 2.2 自动收藏 JavDB 端：await + 暴露失败

排查：`autoFavoriteIfPendingUpdate` 内 `triggerJavdbWantAndSyncRatingBar(des)` 调用在 doc/205
diff 中**未被改动**（ intact ），机制 `javdbReviewApi('wanted')` 为真实服务端调用。最可能根因是
`triggerJavdbWantAndSyncRatingBar` 末尾 `.catch(() => {})` **静默吞掉**了 `_triggerJavdbWant` 的
真实失败，表现为「脚本端已收藏、JavDB 端无反应且无报错」。

修复：
- `triggerJavdbWantAndSyncRatingBar`（`vlt-helpers.ts`）改为**返回 Promise**：`_reviewChain` 仍不因
  单次失败中断（`task.catch(()=>{})` 续链），但**本次错误向上抛出**供调用方感知。
- `autoFavoriteIfPendingUpdate`（`vlt-checkbox.ts`）改为 **`await triggerJavdbWantAndSyncRatingBar`**，
  成功后再弹「已自动收藏」，失败则弹「脚本已收藏但 JavDB 端失败：原因」并记 `clog.error`——
  既提升可靠性，又让任何失败可诊断。

> 说明：仅凭静态审查无法 100% 锁定原始触发失败的根因（调用链完整）；本修复通过「await + 暴露
> 错误」既加固可靠性，又使后续若再现可在 clog 直接看到具体错误。

### 2.3 多项标签化（参考屏蔽关键词）

- 「不参与合并的清单名」「受保护清单关键词」由逗号输入框改为**标签容器**（`tag-box` + 输入框 +
  添加按钮，复用 `filter-keyword-container` 样式与 `addLabelTag`/`addKeyword`）。
- `setting-tag-ops.ts` `addLabelTag`/`addKeyword` 增 `noun` 参数（移除确认文案区分「清单名/关键词」），
  `setting-plugin.tsx` 包装方法同步。
- `setting-form-load.ts` 抽取 `bindKeywordContainer`/`readKeywordLabels` 复用；三个标签容器
  （屏蔽词/排除清单名/受保护关键词）统一加载/保存；存储格式仍为字符串数组（与
  `buildMergeConfig`/`setProtectedKeywords` 兼容）。

## 3. 实施

| 文件 | 改动 |
|---|---|
| `src/components/dpb/list-panel.tsx` | 排序下拉扩展为 6 选项 |
| `src/plugins/detail-page-button/dpb-list-panel.tsx` | 移除 `DetailListSort`/`dataset.listSortBy`；`applyListPanelView` 从下拉值解析字段+方向；`ensureListPanel` 用 `defaultSort` 设默认 |
| `src/plugins/detail-page-button/dpb-types.ts` | `ListDisplayConfig` 精简为 `{ defaultSort }` |
| `src/plugins/detail-page-button-plugin.tsx` | `_listDisplayConfig` 加载校验 6 个合法值 |
| `src/components/setting-panels/list-manager-panel.tsx` | 排序合并为单个 6 项下拉；两个多项输入改标签容器 |
| `src/plugins/setting/setting-tag-ops.ts` | `addLabelTag`/`addKeyword` 增 `noun` 参数 |
| `src/plugins/setting-plugin.tsx` | 包装方法传递 `noun` |
| `src/plugins/setting/setting-form-load.ts` | 抽取 `bindKeywordContainer`/`readKeywordLabels`；标签化加载/保存；移除 `listSortBy` |
| `src/plugins/video-lists-tag/vlt-helpers.ts` | `triggerJavdbWantAndSyncRatingBar` 返回 Promise + 抛出失败 |
| `src/plugins/video-lists-tag/vlt-checkbox.ts` | `autoFavoriteIfPendingUpdate` await 触发 + 暴露失败 |

## 4. 执行验证记录

```
$ bun run build      # tsc -b 零错误，391 modules，✓ built
$ bun run test       # 111 passed
$ bun run lint       # 0 errors / 0 warnings
$ bun run check:structure   # OK
```

版本 1.35.0→1.35.1（优化/修复，patch）。

## 5. 后续验证建议（需登录 JavDB）

1. 清单管理器「排序显示」仅一个下拉（6 选项）；选「数量降序」保存刷新 → 详情页清单面板按数量排。
2. 加入「等待更新」→ JHS 与 JavDB 端**均**收藏；若 JavDB 端失败，clog 有具体错误。
3. 「不参与合并的清单名」「受保护清单关键词」为标签输入（回车/添加按钮加标签，点 × 移除）。
