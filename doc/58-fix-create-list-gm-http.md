# 58. 终极修复新增清单：改用 GM_xmlhttpRequest 直接发 ajax

**文档类型**：🔧开发指导
**文档状态**：✅已执行

## 背景

### 问题描述

doc/56（原生表单提交）+ doc/57（observer 挂 modal + 轮询）两次修复
均未能解决用户反馈的核心问题：

> 清单创建是成功了，但是点保存清单并没有一个正常且成功的完整效果，
> 必须刷新一下才能看到这个清单，而不是立马就看到了；而且点了保存
> 就仅仅是创建了就没再有其他任何效果了。

doc/57 的「挂 modal + 轮询」修复无效，因为**根本没有新 checkbox 出现在
DOM 中**——轮询和 observer 都检测不到任何东西。

### 根因（doc/57 诊断错误，doc/58 重新定位）

doc/57 假设 Rails/Stimulus 的 `onCreateSuccess` 响应会替换 `listContainer`
元素导致 observer 失效。实际根因更根本：

**JavDB 已从 Rails UJS 迁移到 Turbo。`form#new_list` 的
`data-remote="true"` 不再被任何 JS 拦截。** `submitBtn.click()` 触发的
是**常规表单 POST**（非 ajax），浏览器导航到 `POST /lists/remote_create`，
整个脚本环境被卸载（`setTimeout`/`MutationObserver`/`setInterval` 全部
销毁）。服务端虽创建了清单（刷新后可见），但：

- 客户端无任何后续效果（无 toast、无 IDB 同步、无自动收藏）
- `listContainer` 未被更新（无新 checkbox）
- 页面发生导航（但用户可能未察觉，或导航后回到了非清单视图）

这解释了为什么 doc/57 的「挂 modal + 轮询」完全无效——轮询的
`setTimeout` 在页面导航时已被销毁，根本没机会执行。

### 验证依据

- 用户明确反馈 doc/57 修复后仍然「清单列表里边并没有新出现这个新增的
  清单」「也没有执行普通视频加入正常清单的一系列操作」
- `data-remote="true"` 是 Rails UJS（`rails-ujs.js`）的属性，Turbo 不
  识别它；现代 JavDB 使用 Turbo（`@hotwired/turbo`），`data-remote`
  形同虚设
- 常规表单 POST 必然导致页面导航，与「无后续效果 + 需刷新」完全吻合

## 方案

### 核心思路：完全绕过原生表单提交，用 GM_xmlhttpRequest 自控请求与响应

不再驱动 `#new_list` 表单的 submit 按钮（避免触发常规 POST 导航），
改为直接用 `GM_xmlhttpRequest` 发送 ajax POST：

1. **收集表单字段**：从 `#new_list` 表单的 `input/textarea/select`
   读取 `name`+`value`（含 `list[name]`、`video_id`、
   `authenticity_token` 隐藏域），用新清单名覆盖名称字段
2. **CSRF token**：从 `<meta name="csrf-token">` 读取
3. **发请求**：`GM_xmlhttpRequest POST /lists/remote_create`，headers
   带 `Content-Type: application/x-www-form-urlencoded` +
   `X-CSRF-Token` + `X-Requested-With: XMLHttpRequest` +
   `Accept: text/javascript`（模拟 Rails UJS ajax 请求，服务端返回
   `.js.erb` 模板而非 HTML 重定向）
4. **执行 JS 响应**：将响应文本注入 `<script>` 在**页面上下文**执行
   （Rails `.js.erb` 模板可能直接 `insertAdjacentHTML` 更新
   `listContainer`）
5. **轮询检测**：3s 内每 100ms 检查 `listContainer` 是否出现新
   `data-list-id` 的 checkbox
6. **兜底构建**：若 JS 执行未产出新 checkbox（模板依赖 Stimulus 控制器
   实例而失败），从响应文本正则 `data-list-id=["']([^"']+)["']` 提取
   清单 ID，克隆已有 checkbox `<label>` 并修改属性后手动插入
   `listContainer`
7. **完成**：`refreshListPanel()` 刷新平铺面板 +
   `handleCheckboxChange(add)` 同步本地 IDB + 三重广播 + 自动收藏

### 关键设计决策

- **为何不继续用原生表单**：`data-remote` 已失效，原生 submit 必然
  导航，无法在客户端处理响应。GM_xmlhttpRequest 在 Tampermonkey
  沙箱内发请求，不触发页面导航，可完整掌控请求生命周期。
- **为何注入 `<script>` 执行 JS 响应**：Rails `.js.erb` 模板在
  Rails UJS 时代通过 `eval` 执行。我们用 `<script>` 注入等效于
  `eval`，且在页面上下文（可访问 `document`/Stimulus `application`）。
  若模板纯 DOM 操作则直接生效；若依赖 Stimulus 控制器实例可能失败，
  由轮询+兜底覆盖。
- **为何需要兜底手动构建 checkbox**：JS 响应格式不可控（可能是
  `controller.addListItem(...)` 调用，注入执行时 `controller` 未定义
  会抛错）。兜底从响应文本提取 `data-list-id`，克隆已有 checkbox
  保证平铺面板和 IDB 同步能拿到合法元素。
- **URL 编码**：`gmHttp.postForm` 的实现未做 `encodeURIComponent`
  （预存 bug），此处直接用 `GM_xmlhttpRequest` 并手动
  `encodeURIComponent`，避免清单名含 `&`/`=`/中文时出错。

### 函数拆分

| 函数 | 职责 |
|------|------|
| `createList(listName)` | 主流程：收集字段 → 发请求 → 执行 JS → 轮询 → 兜底 → 完成 |
| `pollForNewCheckboxes(modal, beforeIds, timeoutMs)` | 轮询检测新增 checkbox |
| `manuallyBuildCheckbox(listContainer, listId, listName, videoId)` | 兜底：克隆已有 checkbox 并修改属性 |
| `finishCreateList(newCheckboxes, listName)` | 完成态：还原 UI + toast + refreshListPanel + handleCheckboxChange |
| `restoreCreateListUi()` | 还原「新增清單」展开 UI 到按钮态（幂等） |
| `refreshListPanel()` | 刷新 `.jhs-list-panel` 平铺面板（doc/57 已有，保留） |

## 实施

### 修改文件

| 文件 | 变更 |
|------|------|
| `src/plugins/video-lists-tag/vlt-sync.ts` | 删除 `createListViaNativeForm`（原生表单提交方案）；新增 `createList`（GM_xmlhttpRequest 方案）+ `pollForNewCheckboxes` + `manuallyBuildCheckbox` + `finishCreateList` + `restoreCreateListUi`；`bindCreateListEvents` 调用改为 `createList(name).then()`；更新背景注释与文档注释 |

### 零侵入已定稿插件

- 不修改 `DetailPageButtonPlugin`（平铺面板刷新由 `refreshListPanel`
  兜底）
- 不修改 JavDB 原生 DOM 结构（仅读取表单字段，不改动原生元素属性）
- 仅在 `VideoListsTagPlugin` 域内单方面增强

## 执行验证记录

### 构建验证

```
$ bun run build
$ tsc -b && vite build
✓ 213 modules transformed.
✓ built in 1.19s
dist/monkey-jhs-disassemble.user.js  1,830.02 kB │ gzip: 418.99 kB
```

- `tsc -b` 类型检查通过（零错误）
- `diagnostics` 检查 `vlt-sync.ts` 零错误零警告
- 版本号 1.6.1 → 1.6.2（bug 修复，patch 递增）

### 产物对比

| 版本 | 产物 | gzip |
|------|------|------|
| v1.6.0 | 1,825.78 kB | 417.60 kB |
| v1.6.1 | 1,826.87 kB | 417.86 kB |
| v1.6.2 | 1,830.02 kB | 418.99 kB |

## 后续验证建议

在 https://javdb.com 详情页（脚本更新后刷新）：

1. 展开面板旁「➕ 新增清單」→ 输入新清单名 → 点保存
2. 应出现 toast `正在建立清單…` → 随后 `✓ 清單「X」已建立，已自動關聯當前影片`
3. `.jhs-list-panel` 内应**立即新增**该清单 checkbox 且已勾选（无需刷新）
4. 控制台应出现：
   - `[JavDB] ═══ 新增清單「X」(video_id=...) ═══`
   - `[JavDB] 服務端響應（前 500 字）: ...`（可确认服务端返回 JS）
   - `[JavDB] JS 響應已注入執行` 或 `輪詢未偵測到新 checkbox，嘗試從響應提取 list-id 手動構建`
   - `[JavDB] ═══ 勾选 [番号] → X ═══` + `同步结果: ... association=created`
5. 刷新页面后该 checkbox 仍勾选（JavDB 服务端 + 本地 IDB 双持久化）
6. 若清单名含「等待更新」，还应触发自动收藏（doc/53 联动）
7. 网络异常时应 toast `✗ 新增清單失敗：...` 而非静默

### 排查指引

若仍不生效，看控制台日志：

- 无 `═══ 新增清單` 日志 → `createList` 未被调用（检查 `bindCreateListEvents`）
- 有 `服務端響應` 但内容为 HTML（非 JS）→ 服务端未识别为 ajax 请求
  （检查 `X-Requested-With` / `Accept` 头是否发送）
- HTTP 422 → CSRF token 校验失败（检查 `X-CSRF-Token` 是否正确）
- `輪詢未偵測到新 checkbox` + 兜底也失败 → 响应文本中无 `data-list-id`
  （响应格式变化，需调整正则）
