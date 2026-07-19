# 125 - 修复清单 count 漂移致误报 501 上限 & 加入他清单时自动取消等待更新

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行
> **执行日期**：2026-07-19

## 1. 背景

### Bug：迫切想看4 实际 498 条却提示「已达上限 501 条」

用户反馈：清单「迫切想看4」在 JavDB 端只有 498 条视频，但向其中添加新影片时
脚本却 toast「✗ [番号]「迫切想看4」已达收藏上限（501 条）」，其他清单正常。

### 根因

`VltDb.sync` 的 add 分支上限检查读取 `inventory[listId].count` 字段：

```ts
const currentCount = inventory[listId]?.count ?? 0;
if (currentCount >= MAX_COUNT) { associationStatus = 'limit_exceeded'; }
else { inventory[listId].count = currentCount + 1; ... }
```

`count` 字段是**手动 ±1 维护**的缓存值，不与 `movie_inventory` 实际关联数自动对账。
一旦 `count` 漂移到 ≥ 501，后续所有 add 都误报 limit_exceeded。

漂移至 ≥ 501 的最可能路径：**count 被存为字符串**（如导入数据的 JSON 中
`"count": "498"`）。此时 `currentCount + 1` 执行**字符串拼接**（`"498" + 1 = "4981"`），
下一次 add 时 `currentCount = "4981"`，`"4981" >= 501`（JS 将字符串强转数值比较）
为 true → 误报 limit_exceeded。用户看到的 498 来自 JavDB 服务端实际数，与 IDB
`count` 字段已严重不一致。

其他可能漂移路径（并发 sync 覆盖、外部直接操作清单等）也被同一对账机制覆盖。

### 新功能：加入「非等待更新」清单时自动取消「等待更新」

用户希望：当「等待更新」清单中的视频被加入到**其他**清单时，自动取消其
「等待更新」清单的勾选。

与 doc/53（加入「等待更新」时自动收藏）、doc/124（评分后移出「等待更新」）
形成闭环。「等待更新」判定沿用 `AUTO_FAVORITE_KEYWORD = '等待更新'` 关键词
**包含匹配**（如「等待更新-无码」也匹配），非精确字符匹配。

## 2. 方案

### 2.1 count 对账

在 `VltDb.sync` add/remove 分支，**每次 sync 都从 `movie_inventory` 实际关联数
重新计算 `actualCount`**，以实际值为上限检查依据，并回写 `count` 字段使其收敛：

```ts
const actualCount = Object.keys(mi).filter(k => k.endsWith(`::${listId}`)).length;
if (inventory[listId]) inventory[listId].count = actualCount; // 对账

if (action === 'add') {
    if (mi[assocKey]) associationStatus = 'existed';
    else if (actualCount >= MAX_COUNT) associationStatus = 'limit_exceeded';
    else { mi[assocKey] = true; inventory[listId].count = actualCount + 1; ... }
}
```

- 字符串 count：对账时直接覆盖为数值 `actualCount`，永久消除字符串拼接
- 并发/外部漂移：每次 sync 自动对账，count 逐步收敛到真实值
- 用户的「迫切想看4」下次 add 时 `actualCount = 498`，`498 >= 501` 为 false，正常添加

### 2.2 加入他清单时自动取消等待更新

在 `vlt-sync.ts` 的 `handleCheckboxChange`，`checked === true` 分支内，
当清单名**不含**「等待更新」关键词时，调用 doc/124 已有的
`uncheckPendingUpdateListCheckboxes()`（取消勾选所有已勾选的「等待更新」checkbox
并派发 change → Stimulus 服务端移除 + 本地 IDB 移除 + 广播 + toast）：

```ts
if (checked) {
    autoFavoriteIfPendingUpdate(movieInfo, lname).then();
    if (!lname.includes(AUTO_FAVORITE_KEYWORD)) {
        uncheckPendingUpdateListCheckboxes();
    }
}
```

`uncheckPendingUpdateListCheckboxes` 返回 0（无已勾选的「等待更新」清单）时即 noop，
符合「不在则无需处理」。复用 doc/124 函数，零新增副作用。

## 3. 实施

| 文件 | 改动 |
|------|------|
| `src/plugins/video-lists-tag/vlt-db.ts` | sync add/remove 分支：从 movie_inventory 实际数 actualCount 对账 count 字段，上限检查改用 actualCount |
| `src/plugins/video-lists-tag/vlt-sync.ts` | handleCheckboxChange 的 `checked` 分支：清单名不含「等待更新」时调 `uncheckPendingUpdateListCheckboxes()` |
| `vite.config.ts` | version `1.19.6` → `1.19.7` |

## 4. 执行验证记录

```
$ bun run build
tsc -b && vite build
✓ 219 modules transformed
dist/monkey-jhs-disassemble.user.js  1,925.13 kB │ gzip: 443.37 kB
✓ built in 1.47s
```

lightningcss IE hack 警告为既有 layer.css，非本次引入。

## 5. 后续验证建议

1. **count 修复**：在已误报 501 的清单（如「迫切想看4」）添加影片，应正常添加成功
   （actualCount 对账后 < 501）
2. **自动取消**：详情页勾选「等待更新」→ 再勾选「迫切想看」→ 应自动取消
   「等待更新」勾选 + toast「已从「等待更新」移除」
3. 加入名为「等待更新-无码」的清单时**不应**触发取消（因含关键词，视为同类）
4. 加入他清单时视频不在任何「等待更新」清单 → 无 toast、无副作用
5. 评分后移出（doc/124）仍正常工作
