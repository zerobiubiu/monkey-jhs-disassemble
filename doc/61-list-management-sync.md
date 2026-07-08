# 61. /users/lists 清单删除/改名监听 → 同步本地 IDB

**文档类型**：🔧开发指导
**文档状态**：✅已执行

## 背景

### 问题描述

用户在 `https://javdb.com/users/lists` 管理页面删除或改名清单后，JavDB
服务端数据已变更，但本地 IndexedDB（VltDb 的 `vlt_inventory` /
`vlt_movie_inventory`）仍保留旧数据：

- **删除清单**：`vlt_inventory` 中的清单记录和 `vlt_movie_inventory` 中
  所有该清单的关联（`designation::listId`）不会被清除，导致列表页标签
  显示已不存在的清单名、筛选条目残留。
- **改名清单**：`vlt_inventory` 中的 `name` 字段不更新，列表页标签仍
  显示旧名称，与服务端不一致。

此前用户需手动「导出 → 编辑 JSON → 重新导入」才能修正，操作冗余且
易出错。

### 现有 DOM（关键结构）

```
<ul class="user-lists-container">
  <li class="list-item columns" id="list-zK1MNE">
    <div class="column is-10">
      <a href="/lists/zK1MNE"><strong class="list-name">精选合集</strong></a>
      <span class="meta">306 部影片, 被點擊了 52 次</span>
    </div>
    <div class="column is-2">
      <div class="operation field has-addons">
        <p class="control"><button class="... copy-to-clipboard">分享</button></p>
        <p class="control">
          <button data-target="modal-edit-list" data-list-id="zK1MNE"
                  class="... modal-edit-list-button">修改</button>
        </p>
        <p class="control">
          <a data-confirm="..." data-remote="true" data-method="delete"
             href="/users/remove_list?id=zK1MNE">刪除</a>
        </p>
      </div>
    </div>
  </li>
  ...
</ul>

<!-- 编辑弹窗（全局唯一，由 Stimulus list 控制器管理） -->
<div id="modal-edit-list" class="modal" data-controller="list">
  <div class="modal-card">
    <section class="modal-card-body">
      <input class="input" data-list-target="inputName">    ← 清单名称
      <input type="hidden" data-list-target="inputId">       ← 清单 ID
    </section>
    <footer class="modal-card-foot">
      <button data-action="list#updateList">保存</button>
    </footer>
  </div>
</div>
```

## 方案

### 核心原则：事件驱动 + DOM 成功信号，不猜测 AJAX 时序

不拦截/猜测 Rails UJS 或 Stimulus 的 ajax 请求时序，而是以**DOM 变化
作为服务端操作成功的信号**：

| 操作 | DOM 成功信号 | IDB 同步动作 |
|------|-------------|-------------|
| 删除 | `#list-<listId>` `<li>` 从 DOM 移除 | `VltDb.deleteList(listId)` |
| 改名 | `#list-<listId>` 内 `.list-name` 文本变化 | `VltDb.renameList(listId, newName)` |

### 1. 删除监听：MutationObserver 监听 `<li>` 移除

`MutationObserver` 观察 `document.body` 的 `childList + subtree`，
检测 `removedNodes` 中是否有 `id^="list-"` 的元素。匹配后从 id 提取
`listId`（如 `list-zK1MNE` → `zK1MNE`），调用 `VltDb.deleteList()`。

**为何不拦截删除链接 click**：删除链接有 `data-confirm`（Rails UJS
原生 `confirm()` 对话框），用户可能取消；且 `data-remote` ajax 可能
失败。直接监听 DOM 移除是零误报的成功信号——只有 ajax 成功后服务端
返回的 JS 才会移除节点。

### 2. 改名监听：捕获阶段 click 快照 + MutationObserver 等 DOM 更新

改名流程分两步：

**步骤 A — 快照旧名**：捕获阶段（`useCapture: true`）监听
`.modal-edit-list-button` 的 click，抢在 Stimulus 打开弹窗前从同 `<li>`
内的 `.list-name` 读取旧名 + 从 `data-list-id` 读取 listId，存入
`editing` 缓存。

**步骤 B — 检测保存 + 等待 DOM 更新**：捕获阶段监听
`[data-action="list#updateList"]`（保存按钮）的 click，从
`#modal-edit-list [data-list-target="inputName"]` 读取新名。若新旧名
相同则跳过。否则用 `waitForListNameChange()` 等 `.list-name` 文本变为
新名（MutationObserver + 5s 超时兜底），确认后调用
`VltDb.renameList()`。

**为何用捕获阶段**：Stimulus 的 `data-action` 在冒泡阶段处理 click，
捕获阶段先执行，确保我们在 Stimulus 之前读到弹窗输入框的值。

### 3. VltDb 新增方法

- `deleteList(listId)`：删除 `vlt_inventory[listId]` + 删除
  `vlt_movie_inventory` 中所有 `::listId` 结尾的键。不删 `vlt_movies`
  （影片可能还关联其他清单）。
- `renameList(listId, newName)`：仅更新 `vlt_inventory[listId].name`。
  清单不存在时返回 `false`（可能从未关联过影片，IDB 无记录）。

### 4. 三重广播触发列表页全量刷新

删除/改名后通过 `broadcastListMgmt()` 三重广播（GM_setValue /
localStorage / CustomEvent），payload 中 `designation: '*'` 表示
全量刷新信号。`VltTags.handleSyncNotify` 收到 `designation === '*'`
时调用 `refreshAllTags()`（而非 `refreshDesignation`），让所有打开的
列表页标签同步更新。

### 5. 零侵入已定稿插件

- 不修改 `DetailPageButtonPlugin`
- 不修改 JavDB 原生交互（不拦截/阻止删除/改名请求）
- 仅在 `VideoListsTagPlugin` 域内单方面增强

## 实施

### 修改文件

| 文件 | 变更 |
|------|------|
| `src/plugins/video-lists-tag/vlt-db.ts` | 新增 `deleteList()` + `renameList()` 静态方法 |
| `src/plugins/video-lists-tag/vlt-sync.ts` | 新增 `setupListManagementListener()` + `broadcastListMgmt()` + `waitForListNameChange()` + `handleListDeleted()` + `handleListRenamed()` + `extractListIdFromListItem()` |
| `src/plugins/video-lists-tag/vlt-plugin.tsx` | `handle()` 新增 `/users/lists` 分支调用 `setupListManagementListener()` |
| `src/plugins/video-lists-tag/vlt-tags.ts` | `handleSyncNotify` 新增 `designation === '*'` 全量刷新分支 → `refreshAllTags()` |
| `vite.config.ts` | 版本 1.6.5 → 1.7.0（新增功能模块，minor 递增） |

### 插件 handle() 分支顺序

```
handle():
  1. isDetailPage → setupCheckboxListener + setupCreateListButton → return
  2. /users/lists → setupListManagementListener → return    ← 新增
  3. !isListPage → return
  4. 列表页：VltTags 标签显示 + 筛选 + Observer + 自动刷新
```

## 执行验证记录

### 构建验证

```
$ bun run build
$ tsc -b && vite build
✓ 213 modules transformed.
✓ built in 1.24s
dist/monkey-jhs-disassemble.user.js  1,839.05 kB │ gzip: 420.78 kB
```

- `tsc -b` 类型检查通过（零错误）
- `diagnostics` 检查 vlt-sync.ts / vlt-db.ts / vlt-plugin.tsx / vlt-tags.ts
  零错误零警告

### 逻辑验证（浏览器实测，未触碰用户真实数据）

在 `https://javdb.com/users/lists` 页面用 `evaluate_script` 模拟测试：

**1. VltDb 数据结构确认**：
- `vlt_inventory` 16 个清单记录，结构与 `InventoryRecord` 一致
  （listId/name/url/count/style）
- `vlt_movie_inventory` 3567 条关联，键格式 `designation::listId`
  （如 `CJOB-128::zK1MNE`），与 `deleteList` 的 `endsWith('::listId')`
  逻辑匹配
- `zK1MNE`（精选合集）有 306 条关联，与 inventory.count=306 一致

**2. deleteList/renameList 对不存在的 listId 安全**：
- `renameList('TESTFAKE', ...)` 返回 `false`（不存在）
- `deleteList('TESTFAKE')` 返回 `{ inventory: false, associations: 0 }`
- 不影响任何真实数据

**3. 删除检测 MutationObserver**：
- 创建虚拟 `#list-TESTFAKE` 元素 → 添加到 DOM → 移除
- MutationObserver 正确检测到移除并提取 listId=`TESTFAKE` ✅

**4. 改名检测（快照 + waitForListNameChange）**：
- 创建虚拟 `#list-TESTFAKE2`（含 `.modal-edit-list-button` +
  `.list-name`="旧名称"）
- 点击修改按钮 → 捕获阶段正确快照 listId=`TESTFAKE2` oldName=`旧名称` ✅
- 修改 `.list-name` 文本为 `新名称` → MutationObserver 正确检测到
  文本变化 ✅

### 版本对比

| 版本 | 产物 | gzip | 关键变更 |
|------|------|------|----------|
| v1.6.5 | 1,832.52 kB | 419.41 kB | doc/60 新增清单 #save-list-button 重载 |
| v1.7.0 | 1,839.05 kB | 420.78 kB | doc/61 /users/lists 删除/改名监听 |

## 后续验证建议

在 `https://javdb.com/users/lists` 页面（脚本更新后刷新）：

**删除测试**（建议新建一个临时测试清单再删，不动现有清单）：
1. 新建一个名为「测试删除用」的清单（通过详情页「新增清单」功能）
2. 在 `/users/lists` 页面找到该清单，点击「刪除」→ 确认
3. 控制台应出现：
   - `[JavDB] 检测到清单删除: listId=<testListId>`
   - `[JavDB] IDB 清单删除完成: listId=<testListId> inventory=true associations=N`
   - toast `✓ 清单 <testListId> 已从本地数据删除（N 条关联）`
4. 打开列表页，该清单的标签应消失（若其他标签页已打开则自动刷新）

**改名测试**（建议新建临时清单再改名，不动现有清单）：
1. 新建一个名为「测试改名前」的清单
2. 在 `/users/lists` 页面点击「修改」→ 弹窗中改名为「测试改名后」→ 保存
3. 控制台应出现：
   - `[JavDB] 编辑清单快照: listId=<testListId> oldName=测试改名前`
   - `[JavDB] 检测到清单改名: listId=<testListId> newName=测试改名后`
   - `[JavDB] IDB 清单改名完成: listId=<testListId> newName=测试改名后`
   - toast `✓ 清单已改名为「测试改名后」`
4. 打开列表页，标签应显示新名称

**取消删除/取消改名**：
- 删除时点击 confirm 对话框「取消」→ `<li>` 不移除 → 不触发同步 ✅
- 改名时打开弹窗但不保存直接关闭 → `.list-name` 不变 → 不触发同步 ✅
- 改名时输入相同名称保存 → `newName === oldName` → 跳过同步 ✅
