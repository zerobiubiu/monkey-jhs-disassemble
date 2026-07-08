# 60. 修复新增清单：改用 #save-list-button 切换重载 + 延迟优化

**文档类型**：🔧开发指导
**文档状态**：✅已执行

## 背景

### 问题描述

doc/59 引入 `fetchListIdByName`（GET `/users/lists` 解析 `/lists/{id}`
链接）作为兜底，但用户实测日志显示该方案失效：

```
[JavDB] /users/lists 未找到名称含「123333」的清单
[JavDB] 新增清单后无法定位 list-id。
响应前 300 字:   Toastr.success("已將此影片保存至清单123333");
```

用户还反映操作延迟明显（≈2.7s）。

### 根因（doc/59 诊断错误，doc/60 重新定位）

doc/59 假设 `/users/lists` 页面 HTML 包含清单列表，可解析链接提取 list-id。
实测证明：**JavDB 已将该页面改造成通过 JS（Turbo/Stimulus）动态加载
清单数据**——服务端返回的原始 HTML 不含任何 `/lists/{id}` 链接，所以
`fetchListIdByName` 永远找不到。

但日志同时证实：doc/58 的 `GM_xmlhttpRequest` POST 创建请求本身**已
成功**（响应 `Toastr.success("已将此影片保存至清单X")`）。问题只在
「创建后如何在客户端拿到新清单的 list-id / 新 checkbox」。

### 关键洞察

`#save-list-button`（详情页菜单按钮）被点击时，JavDB 原生 Stimulus
`list` 控制器会打开 `#modal-save-list` 模态框并发起 ajax 拉取用户的
完整清单列表（含 data-list-id 的 checkbox）。因此：

→ 在创建请求成功后，**关闭模态框再重新打开**，原生机制会重新拉取
含新清单的完整列表，DOM 中即出现新 checkbox。

这绕开了所有猜测响应格式/解析外部页面的脆弱做法，理论上只要 JavDB
不改变「打开模态框即 ajax 加载清单列表」这个交互，就能稳定工作。

### 延迟问题

doc/58/59 的首次轮询时间是 **2000ms**（防响应格式变化留余地），
但实测响应**永远是** `Toastr.success` 不更新 DOM，那 2 秒纯属浪费。
加 400ms 关闭延迟，整体延迟 ≈ 2.7s 用户体验差。

## 方案

### 1. 核心：切换 #save-list-button 重载清单列表

在创建请求成功、响应处理失败后，按如下顺序兜底：

1. 注入 `<script>` 执行 JS 响应（显示 JavDB 原生 Toastr 通知）
2. 快速轮询 200ms 检测 listContainer 是否被直接更新（保险位）
3. 从响应正则提取 `data-list-id`（保险位）
4. **核心兜底**：点击 `#save-list-button` 关闭模态框 → 等待 200ms →
   再次点击重新打开 → 触发 Stimulus `list` 控制器 ajax 重新拉取清单
   列表 → 轮询 5s 检测新增 checkbox
5. 最后兜底：调用 doc/59 的 `fetchListIdByName`（实测无效，保留作
   未来页面改造的保险位）
6. 完成：`refreshListPanel()` 刷新平铺面板 + `handleCheckboxChange(add)`
   同步本地 IDB + 三重广播 + 自动收藏

### 2. 延迟优化

- 首次响应轮询 `2000ms → 200ms`（响应格式实测稳定，200ms 足够保险）
- 关闭模态框延迟 `400ms → 200ms`（足够 Stimulus 处理关闭）
- 整体延迟从 ~2.7s 降至 ~0.7s

### 3. fetchListIdByName 保留

虽实测对当前 JavDB 无效，但保留它作未来页面改造的保险位（开销低、
不会阻塞主流程）。增加调试日志：打印 `/users/lists 页面解析到 N 条
/lists/ 链接` 和 `页面文本前 500 字` 便于日后排查。

## 实施

### 修改文件

| 文件 | 变更 |
|------|------|
| `src/plugins/video-lists-tag/vlt-sync.ts` | `createList` 增加第 5 级兜底（#save-list-button 双击重载）；首次轮询 2000→200ms；关闭延迟 400→200ms；`fetchListIdByName` 增加调试日志；更新文档注释（doc/60 标记） |
| `vite.config.ts` | 版本 1.6.3 → 1.6.4 → 1.6.5 |
| `changelog/CHANGELOG.md` | v1.6.4 + v1.6.5 条目 |

### 零侵入已定稿插件

- 不修改 `DetailPageButtonPlugin`（其 `_initListPanel` observer 失效由
  vlt-sync 的 `refreshListPanel()` 主动重建兜底）

## 执行验证记录

### 用户实测控制台日志（关键片段）

```
[JavDB] ═══ 新增清单「1231231」(video_id=KkP2mb) ═══
[JavDB] 服务端响应（前 500 字）:   Toastr.success("已將此影片保存至清单1231231");
[JavDB] JS 响应已注入执行
[JavDB] 响应无 list-id，通过切换 #save-list-button 重载清单列表
[modalListDisabler] 已禁用清单 #501                ← 模态框重载触发
[modalListDisabler] 已禁用清单 #501
[JavDB] 重载后侦测到 1 个新 checkbox，走正常完成流程  ← 成功
[JavDB] ═══ 勾选 [JAC-236] → 1231231 ═══
[JavDB] 同步(IDB): JAC-236 → 1231231 (add)
[JavDB] 同步结果: movie=existed list=created association=created
[JavDB] ═══ 完成 ═══
```

完整链路成功：服务端创建 + 客户端检测新 checkbox + 本地 IDB 关联新建
(`association=created`)，用户无需手动取消/再关联。

### 构建验证

```
$ bun run build
$ tsc -b && vite build
✓ 213 modules transformed.
✓ built in 1.43s
dist/monkey-jhs-disassemble.user.js  1,832.52 kB │ gzip: 419.41 kB
```

- `tsc -b` 类型检查通过（零错误）
- `diagnostics` 检查 `vlt-sync.ts` 零错误零警告

### 用户报错澄清

用户控制台除上述成功链路外，还存在以下非本功能报错，全部**预存**
（与新增清单无关）：

| 报错 | 来源 | 说明 |
|------|------|------|
| `c0.jdbstatic.com/ads/... ERR_BLOCKED_BY_CLIENT` | JavDB 广告 | 浏览器广告拦截器拦截 JavDB 自家广告图，属浏览器扩展行为 |
| `index.js:4 Error connecting controller TypeError: Cannot read properties of null (reading 'querySelector')` | JavDB 自身 Stimulus | `movie_detail_controller.connect()` 在 `.video-detail` 找不到元素，JavDB 自家代码 bug |
| `请求失败,状态码: 404 https://missav.ws/cn/search/` + 长 HTML | `OtherSitePlugin` 预存功能 | 番号搜索 MissAV 返回 404，仅日志噪音 |
| `[modalListDisabler] 已禁用清单 #501` | `ModalListDisablerPlugin` 预存功能 | 正常工作日志，非错误 |

### 版本对比

| 版本 | 产物 | gzip | 关键变更 |
|------|------|------|----------|
| v1.6.0 | 1,825.78 kB | 417.60 kB | doc/56 新增清单功能（原生表单失败） |
| v1.6.1 | 1,826.87 kB | 417.86 kB | doc/57 observer 挂 modal（无效）|
| v1.6.2 | 1,830.02 kB | 418.99 kB | doc/58 GM_xmlhttpRequest 绕过原生表单 |
| v1.6.3 | 1,831.56 kB | 419.17 kB | doc/59 GET /users/lists 解析（无效）|
| v1.6.4 | 1,832.52 kB | 419.41 kB | doc/60 #save-list-button 双击重载（成功）|
| v1.6.5 | 1,832.52 kB | 419.41 kB | doc/60 延迟优化（首次轮询 2s→200ms，关闭延迟 400→200ms）|

## 后续验证建议

在 https://javdb.com 详情页（v1.6.5 版本刷新后）：

1. 展开面板旁「➕ 新增清单」→ 输入清单名 → 点保存
2. 应在 **< 1s 内**看到：
   - toast `✓ 清单「X」已建立，已自动关联当前影片`
   - `.jhs-list-panel` 立即新增勾选的 checkbox（无需刷新）
3. 控制台应依次出现：
   - `服务端响应: Toastr.success("...")` → `JS 响应已注入执行`
   - `响应无 list-id，通过切换 #save-list-button 重载清单列表`
   - `重载后侦测到 1 个新 checkbox，走正常完成流程`
   - `═══ 勾选 [番号] → X ═══` + `同步结果: ... association=created`
4. 刷新后该 checkbox 仍勾选（JavDB 服务端 + 本地 IDB 双持久化）

## 历史路径回顾

本次「新增清单」功能共历经 5 次迭代，最终在 doc/60 找到稳定方案：

```
doc/56  原生表单提交       → 失败（data-remote 在 Turbo 下不被拦截，常规 POST 页面导航）
doc/57  observer 挂 modal  → 失败（根本无新 checkbox 出现在 DOM 中）
doc/58  GM_xmlhttpRequest → 请求成功，但响应无 list-id 无法定位新 checkbox
doc/59  GET /users/lists  → 失败（页面 JS 动态加载，HTML 不含清单列表）
doc/60  #save-list-button  → ✓ 成功（利用 JavDB 原生 Stimulus 重载机制）
        双击重载 + 延迟优化
```

教训：**优先复用 JavDB 原生交互**（打开模态框即 ajax 加载清单列表），
比猜测响应格式/解析外部页面 HTML 更可靠。