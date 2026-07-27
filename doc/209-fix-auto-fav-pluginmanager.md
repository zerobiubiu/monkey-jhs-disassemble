# 209 - 修复自动收藏 JavDB 端失效（pluginManager 不可达，改点收藏按钮）

> **文档类型**：🔧 开发指导
> **文档状态**：✅ 已执行

## 1. 背景

doc/208 让自动收藏的 JavDB 端触发错误**可见**，用户据此反馈确切错误：

> ✗ [DLDSS-192] 脚本已收藏但 JavDB 端失败：**pluginManager is not defined**

并指出：手动点收藏按钮**真的成功**——手动本质是解析当前页面 DOM 后生成内容，与直接操作
网站无异，只是换了种 UI；每次打开详情页都会重新加载扫描。

## 2. 根因

- `triggerJavdbWantAndSyncRatingBar`（doc/55 引入，`vlt-helpers.ts`）通过
  `pluginManager?.getBean?.('DetailPageButtonPlugin')` 取插件实例。
- 但 `pluginManager` 是 `main.tsx` 的**模块级 const**（注释明确「仅通过模块级 const +
  this.pluginManager 内部访问，不暴露到 unsafeWindow」），**不是运行时全局**。`globals.d.ts`
  虽 `declare const pluginManager`（骗过 TypeScript 编译），运行时从 `vlt-helpers.ts` 访问即抛
  **ReferenceError: pluginManager is not defined**。
- 该 bug 自 doc/55 潜伏，因末尾 `.catch(() => {})` 静默吞错一直没被发现；doc/208 改为向上抛错
  后才暴露（故 doc/208 只「暴露」未「修复」根因）。
- 手动按钮正常的原因：`.jhs-fav-btn` → `quickConvertToFav` 是 `DetailPageButtonPlugin` 的**方法**，
  插件实例由评分条构建时的闭包直接持有（`self.quickConvertToFav()`），从不经过 `pluginManager.getBean`。

## 3. 方案（按用户思路：复用收藏按钮）

让自动收藏**直接点击脚本的收藏按钮**，等价手动操作，绕开不可达的 `pluginManager`：

- `autoFavoriteIfPendingUpdate`（`vlt-checkbox.ts`）：保留「已有状态则跳过」前置判断后，
  **不再**自行 `saveCar`/广播/`triggerJavdbWantAndSyncRatingBar`，改为
  `document.querySelector('.jhs-fav-btn').click()`，交由 `quickConvertToFav` 完成
  JHS 收藏 + 三重广播 + JavDB 端想看 + 评分条同步（与手动完全一致）。
- **关键**：须先确认番号无状态再点击。否则先写了 FAVORITE，`quickConvertToFav` 会判定
  「已是已收藏」直接 return，反而不触发 JavDB 端。
- 移除已失效且唯一调用方已改的 `triggerJavdbWantAndSyncRatingBar`（`vlt-helpers.ts`），
  连同 `vlt-checkbox.ts` 中随之不再使用的 `getActressNames`/`broadcastWantWatchedSync` 导入。

## 4. 实施

| 文件 | 改动 |
|---|---|
| `src/plugins/video-lists-tag/vlt-checkbox.ts` | `autoFavoriteIfPendingUpdate` 改为点击 `.jhs-fav-btn`（前置跳过判断保留）；移除 `triggerJavdbWantAndSyncRatingBar`/`getActressNames`/`broadcastWantWatchedSync` 导入 |
| `src/plugins/video-lists-tag/vlt-helpers.ts` | 删除失效的 `triggerJavdbWantAndSyncRatingBar`（引用不可达的 pluginManager） |

## 5. 执行验证记录

```
$ bun run build      # tsc -b 零错误，391 modules，✓ built
$ bun run test       # 111 passed
$ bun run lint       # 0 errors / 0 warnings
$ bun run check:structure   # OK
```

版本 1.35.1→1.35.2（bug 修复，patch）。

## 6. 后续验证建议（需登录 JavDB）

1. 详情页把影片加入「等待更新」（或任意非受保护清单）→ JHS 与 **JavDB 端均收藏**
   （JavDB「想看」列表 `/users/want_watch_videos` 可见），评分条收藏高亮，无报错。
2. 番号已「已读/屏蔽」时加入清单 → 跳过自动收藏（不覆盖），提示「已标记为…跳过」。
3. clog 不再有「pluginManager is not defined」。
