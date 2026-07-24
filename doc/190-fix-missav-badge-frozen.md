# doc/190 — 修复 MissAV 徽章状态冻结（renderBadges 跳过已有徽章）

## 问题

`renderBadges()`（`missav-renderer.ts`）在遍历缩略图时，对已挂载 `.missav-status-tag`
徽章的缩略图直接 `continue`，不检查状态是否变更。跨站同步后 `processAll()` 在同一
页面再次调用时，IDB 数据已正确更新、`queryLocalCars` 也返回了新状态，但
`renderBadges` 发现徽章已存在就跳过，导致徽章永远冻结在初始状态。

## 根因

```ts
// 旧代码（L107-108）
if (item.querySelector('.missav-status-tag')) continue;
```

原始脚本（archetype/missavStatusTag.user.js）有同样的 skip 逻辑，但原始脚本无跨站
同步功能——徽章只在页面加载时创建一次，skip 在其场景无害。本项目新增的跨站同步
（doc/46）使 `processAll()` 在页面生命周期内被多次调用（增量消费 / 全量消费 /
MutationObserver），skip 逻辑与多次渲染产生冲突。

## 修复

1. `createBadge()` 在 `<a>` 元素上写入 `a.dataset.status = status`，记录当前徽章
   对应的状态值（`data-status` 属性不可见，不影响 DOM 外观）。

2. `renderBadges()` 将 skip 逻辑改为：
   - 先查番号 → 归一化 → 查 carMap 得 record（无 record 则 continue，与原行为一致）
   - 找到已有徽章 `existing`：
     - `existing.dataset.status === record.status` → 状态未变，`continue`
     - 否则 → `existing.remove()`，走正常的 createBadge + appendChild 重建流程
   - 无已有徽章 → 正常创建

3. `total++` 移至 skip 判定之后：已有徽章且状态未变的项不计入 total（与原语义一致），
   状态变更的项计入 total（被重新处理）。

## 与原始脚本的偏差说明

本修复改变了 `renderBadges` 对已有徽章的行为（原：无条件跳过 → 新：状态变更时替换）。
这不违反零偏差原则：原始脚本无跨站同步，`renderBadges` 在页面生命周期内只被
`processAll` 调用一次（页面加载 + MutationObserver 仅处理新增缩略图），skip 逻辑
从未被"状态变更后再次渲染"的场景触发。本修复是让本项目新增的跨站同步功能正确工作。

## 影响范围

- 仅改 `src/plugins/car-status-sync/missav-renderer.ts`（`createBadge` + `renderBadges`）
- 无新导入、无 API 变更、无其他文件改动
- 版本：1.28.30 → 1.28.31
