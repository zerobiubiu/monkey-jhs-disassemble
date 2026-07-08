# 62. 清单删除/改名监听重写：拦截原生操作 + 自行发请求 + 实时广播

**文档类型**：🔧开发指导
**文档状态**：✅已执行

## 背景

### 问题描述

doc/61 的方案用 MutationObserver 监听 `#list-<listId>` `<li>` 从 DOM
移除作为删除成功信号。用户实测发现：

1. **删除后 IDB 关联未清除** — MutationObserver 从未触发
2. **管理页面删除后 DOM 不实时消失** — JavDB 删除 AJAX 返回的 JS
   不移除 `<li>`，需刷新页面才消失
3. **删除未广播** — 因检测从未触发，广播也从未发送
4. **详情页清单 checkbox 不消失** — 无广播接收器
5. **列表页标签不清除** — 同上

### 根因

从 JavDB `app.js` 逆向确认：
- **删除链接**使用 Rails UJS（`data-remote="true"` + `data-method="delete"`），
  `dataType: "script"`，服务端返回 JS 代码。但该 JS **不移除 `<li>` 元素**，
  导致 MutationObserver 永远不触发。
- **改名保存**使用 Stimulus `list#updateList`，POST `/users/update_list`
  `{id, name}`，返回 JSON `{success, name, message}`，成功后执行
  `document.querySelector("#list-<id> .list-name").textContent = e.name`
  —**会更新 DOM**，但无法实时广播到其他页面。

### JavDB 服务端 API（从 app.js 逆向确认）

```
删除：DELETE /users/remove_list?id=<listId>
      Headers: X-CSRF-Token, X-Requested-With: XMLHttpRequest
      Response: JavaScript（dataType=script，但不移除 DOM）

改名：POST /users/update_list
      Body: id=<listId>&name=<newName>（URL-encoded）
      Headers: X-CSRF-Token, X-Requested-With: XMLHttpRequest
      Response: JSON {success: boolean, name: string, message: string}
      成功后 Stimulus 更新 #list-<id> .list-name 的 textContent
```

## 方案

### 核心原则：拦截原生操作 + 自行发 GM_xmlhttpRequest + 实时广播

不再依赖 DOM 变化作为成功信号，而是**全权接管**删除/改名操作：

| 操作 | 拦截方式 | 请求方式 | 成功信号 |
|------|---------|---------|---------|
| 删除 | 捕获阶段拦截删除链接 click + preventDefault | GM_xmlhttpRequest DELETE | HTTP 2xx/3xx |
| 改名 | 捕获阶段拦截保存按钮 click + preventDefault | GM_xmlhttpRequest POST | JSON `success: true` |

### 1. 删除：拦截 + 自行发 DELETE 请求

1. 捕获阶段监听 `a[href*="remove_list"][data-method="delete"]` 的 click
2. `preventDefault` + `stopPropagation`（阻止 Rails UJS / Turbo 处理）
3. 从 href 提取 listId（`/users/remove_list?id=<listId>`）
4. 从 `data-confirm` 读取确认消息，显示原生 `confirm()` 对话框
5. 用户确认后，GM_xmlhttpRequest 发 DELETE 请求（带 CSRF token）
6. HTTP 2xx/3xx → 成功：
   - `VltDb.deleteList(listId)` — 删除 inventory + 所有 `::listId` 关联
   - `broadcastListMgmt('delete', listId)` — 三重广播
   - 移除 DOM `<li>`（JavDB 不实时移除，我们主动移除）
   - toast 成功
7. HTTP 4xx/5xx → toast 失败，不移除 DOM

### 2. 改名：拦截 + 自行发 POST 请求

1. 捕获阶段监听 `.modal-edit-list-button` 的 click → 快照 listId + oldName
2. 捕获阶段监听 `[data-action="list#updateList"]`（保存按钮）的 click
3. `preventDefault` + `stopPropagation`（阻止 Stimulus 处理）
4. 从 `#modal-edit-list [data-list-target="inputName"]` 读取新名
5. 新旧名相同 → 关闭弹窗，跳过
6. GM_xmlhttpRequest 发 POST `/users/update_list`（`id=<listId>&name=<newName>`）
7. JSON `success: true` → 成功：
   - `VltDb.renameList(listId, finalName)` — 更新 inventory name
   - `broadcastListMgmt('rename', listId, {newName})` — 三重广播
   - 更新 DOM `.list-name` 的 textContent
   - 关闭弹窗（移除 `is-active` 类）
   - toast 成功
8. `success: false` → toast 显示服务端错误消息

### 3. 独立广播通道 jdb:list-mgmt

不再复用 `jdb:last-sync`（designation='*'），改用独立通道 `jdb:list-mgmt`：

```json
{
  "type": "delete" | "rename",
  "listId": "zK1MNE",
  "newName": "新名称",
  "time": 1234567890
}
```

三重广播：GM_setValue（跨标签页）/ localStorage（跨脚本）/ CustomEvent（同页面）。

### 4. 广播接收器（新增 setupListMgmtBroadcastListener）

在**详情页**和**列表页**都注册接收器：

| 页面 | onDelete | onRename |
|------|----------|----------|
| 详情页 | `removeDetailPageCheckbox(listId)` — 从 `.jhs-list-panel` 和 `#modal-save-list` 移除 checkbox | `updateDetailPageCheckboxLabel(listId, newName)` — 更新 checkbox 标签文本（保留 `(count)` 部分） |
| 列表页 | `refreshAllTags()` — 从 IDB 重新查询并渲染所有标签 | `refreshAllTags()` — 同上 |

详情页 checkbox DOM 结构：
```html
<p class="control">
  <label class="checkbox">
    <input type="checkbox" data-list-id="<listId>" ...>
    清单名&nbsp;
    <span>(count)</span>
  </label>
</p>
```

`removeDetailPageCheckbox` 移除整个 `<p class="control">`；
`updateDetailPageCheckboxLabel` 清空文本节点后插入新名称，保留 `<span>(count)</span>`。

### 5. 零侵入已定稿插件

- 不修改 `DetailPageButtonPlugin`（checkbox 移除/更新在 VideoListsTagPlugin 域内）
- 拦截 JavDB 原生删除/改名操作（preventDefault），但用等效的 GM_xmlhttpRequest
  发送相同请求，行为与服务端一致
- 不修改 `vlt-tags.ts`（撤回 doc/61 的 `designation='*'` 分支，改用独立通道）

## 实施

### 修改文件

| 文件 | 变更 |
|------|------|
| `src/plugins/video-lists-tag/vlt-sync.ts` | **重写** `setupListManagementListener()`：删除改用拦截 click + GM_xmlhttpRequest DELETE；改名改用拦截 click + GM_xmlhttpRequest POST；新增 `handleListDeletion()` / `handleListRename()` / `closeEditModal()` / `getCsrfToken()` / `extractListIdFromHref()`；新增 `setupListMgmtBroadcastListener()` / `removeDetailPageCheckbox()` / `updateDetailPageCheckboxLabel()`；广播改用独立键 `jdb:list-mgmt`；删除 `waitForListNameChange()` / `extractListIdFromListItem()` |
| `src/plugins/video-lists-tag/vlt-plugin.tsx` | `handle()` 详情页分支新增 `setupListMgmtBroadcastListener`（onDelete → removeDetailPageCheckbox，onRename → updateDetailPageCheckboxLabel）；列表页分支新增 `setupListMgmtBroadcastListener`（onDelete/onRename → refreshAllTags） |
| `src/plugins/video-lists-tag/vlt-tags.ts` | 撤回 doc/61 的 `handleSyncNotify` `designation='*'` 分支（改用独立通道，不再需要） |
| `vite.config.ts` | 版本 1.7.0 → 1.7.1（bug 修复，patch 递增） |

### 插件 handle() 分支顺序（更新）

```
handle():
  1. isDetailPage → setupCheckboxListener + setupCreateListButton
     + setupListMgmtBroadcastListener(checkbox 移除/更新) → return
  2. /users/lists → setupListManagementListener → return
  3. !isListPage → return
  4. 列表页：VltTags 标签显示 + 筛选 + Observer
     + setupListMgmtBroadcastListener(refreshAllTags)
     + setupAutoRefreshListener → return
```

## 执行验证记录

### 构建验证

```
$ bun run build
$ tsc -b && vite build
✓ 213 modules transformed.
✓ built in 1.63s
dist/monkey-jhs-disassemble.user.js  1,842.98 kB │ gzip: 421.58 kB
```

- `tsc -b` 类型检查通过（零错误）
- `diagnostics` 全项目零错误零警告

### 逻辑验证（浏览器实测，未触碰用户真实数据）

**1. CSRF token 可用**：
- `meta[name="csrf-token"]` 存在，content 非空 ✅

**2. 删除链接属性确认**：
- `href="/users/remove_list?id=zK1MNE"` ✅
- `data-method="delete"` ✅
- `data-remote="true"` ✅
- `data-confirm="此清單將會從別人的收藏列表中一起被移除，確認移除嗎?"` ✅

**3. 改名 API 确认（从 app.js 逆向）**：
- `updateList` → POST `/users/update_list` `{id, name}` ✅
- 返回 JSON `{success, name, message}` ✅
- 成功后更新 `#list-<id> .list-name` textContent ✅

**4. 详情页 checkbox DOM 结构确认**：
- `<p class="control">` 包裹 `<label class="checkbox">` 包裹 `<input data-list-id>` ✅
- `.jhs-list-panel` 和 `#modal-save-list` 两处都有 checkbox ✅
- `closest('p.control')` 正确找到父元素 ✅

**5. 广播机制验证**：
- CustomEvent `jdb:list-mgmt` 正确发送和接收 ✅
- payload 结构 `{type, listId, newName, time}` ✅

**6. 标签文本更新逻辑验证**：
- `updateDetailPageCheckboxLabel` 正确替换名称文本，保留 `<span>(count)</span>` ✅

### 版本对比

| 版本 | 产物 | gzip | 关键变更 |
|------|------|------|----------|
| v1.7.0 | 1,839.05 kB | 420.78 kB | doc/61 MutationObserver 方案（失效） |
| v1.7.1 | 1,842.98 kB | 421.58 kB | doc/62 重写：拦截 + GM_xmlhttpRequest + 独立广播 |

## 后续验证建议

在 `https://javdb.com/users/lists` 页面（脚本更新后刷新）：

**删除测试**（建议新建临时清单再删）：
1. 新建一个名为「测试删除用」的清单
2. 在 `/users/lists` 点击「刪除」→ 确认
3. 控制台应出现：
   - `[JavDB] ═══ 删除清单 listId=<testListId> ═══`
   - `[JavDB] 服务端删除成功: listId=<testListId>`
   - `[JavDB] IDB 清单删除完成: listId=<testListId> inventory=true associations=N`
   - toast `✓ 清单已删除（本地数据：N 条关联已清除）`
4. DOM `<li>` 应**立即消失**（无需刷新）
5. 打开的详情页清单 checkbox 应**立即消失**
6. 打开的列表页标签应**立即清除**

**改名测试**（建议新建临时清单再改名）：
1. 新建一个名为「测试改名前」的清单
2. 在 `/users/lists` 点击「修改」→ 改名「测试改名后」→ 保存
3. 控制台应出现：
   - `[JavDB] 编辑清单快照: listId=<testListId> oldName=测试改名前`
   - `[JavDB] 服务端改名成功: listId=<testListId> name=测试改名后`
   - toast `✓ 清单已改名为「测试改名后」`
4. DOM `.list-name` 应立即更新
5. 打开的详情页 checkbox 标签应立即更新
6. 打开的列表页标签应立即更新

**取消操作**：
- 删除时 confirm 点「取消」→ 不发请求，DOM 不变 ✅
- 改名时输入相同名称保存 → 关闭弹窗，跳过 ✅
