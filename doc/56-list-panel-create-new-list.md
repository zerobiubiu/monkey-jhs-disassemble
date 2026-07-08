# 56. 展开清单面板新增「新增清單」入口 + 自动同步关联

**文档类型**：🔧开发指导
**文档状态**：✅已执行

## 背景

### 问题描述

视频详情页的「存入清單」原生弹窗被 CSS 永久隐藏
（`rating-bar.css` `#modal-save-list{display:none}`），
改为 `.jhs-list-panel` 平铺展示清单 checkbox。但弹窗 footer 内的
「創建新清單」按钮因此对用户不可达，新增清单功能在展开布局下失效。

更隐蔽的问题：JavDB 原生「新增清单」流程本身已自动把当前视频关联进
新清单（表单 `#new_list` 含 `video_id` 隐藏域，服务端创建后自动勾选新
checkbox）。但因为 Stimulus 内部把新 checkbox 设为 `checked` 不派发
`change` 事件，`vlt-sync.setupCheckboxListener` 收不到，本地 IDB 的
影片-清单关联永远不会同步。**此前用户需手动「取消关联 → 再关联」**
才能让数据落地，操作冗余。

### 现有 DOM（关键结构）

```
#modal-save-list (CSS 隐藏, DOM 保留)
  .modal-card-body
    [data-list-target="listContainer"]   ← checkbox 列表（含 data-list-id）
  .modal-card-foot
    [data-list-target="newListArea"] style="display:none"
      form#new_list action="/lists/remote_create" data-remote="true" method="post"
        input[list][name]                 ← 新清单名输入
        input[type=hidden][video_id]      ← 当前视频 ID
        input[type=submit]                 ← 保存（Rails UJS 拦截发 ajax）
        a[data-action="list#cancelNewList"] ← 取消
    [data-list-target="optionsArea"]
      button[data-action="list#newList"]  ← 「創建新清單」按钮
      a[href="/users/lists"]              ← 「我的清單」
```

## 方案

### 1. 在展开面板旁补一份「➕ 新增清單」UI

在 `.jhs-list-panel` 后方插入兄弟节点 `.jhs-list-create-wrap`
（避免被 `_initListPanel` 的 `panel.innerHTML=''` 清空动作影响）。
UI 沿用 JavDB 全站的 Bulma 风格（`.button.is-info.is-small` /
`.input.is-small`），与原生弹窗视觉一致。

交互与原生一致：默认显示一个按钮，点击后切换为
「输入框 + 保存 + 取消」行内表单，回车提交、Esc 取消。

### 2. 提交时驱动原生表单（与网站原始功能相符）

**不**自行发请求、**不**自行 `_execRailsJs`，而是按原生链路驱动：

1. 点击 modal 内 `button[data-action="list#newList"]`（Stimulus 展开
   `newListArea`，与用户点原生按钮完全等价）
2. 填入 `input[data-list-target="listNewNameInput"]`
3. 点击原生 `input[type=submit]`，Rails UJS 以 ajax 方式
   `POST /lists/remote_create`（携带 `video_id`，服务端创建清单 +
   **自动把当前视频加入该清单**）
4. 服务端返回 JS，`list#onCreateSuccess` 把新 checkbox append 进
   `listContainer`（已 checked）
5. `DetailPageButtonPlugin._initListPanel` 的 MutationObserver 自动把
   新条目 clone 到 `.jhs-list-panel`

这样从 Rails UJS 视角看，与用户在原生弹窗手工操作完全等价，没有
任何旁路请求 → 「与网站原始功能相符」。

### 3. 自动同步本地 IDB 关联（核心优化，消除手动步骤）

在提交前对 `listContainer` 内 checkbox 的 `data-list-id` 集合做快照；
提交后用 MutationObserver 监听 `listContainer`，对比快照找到**新增的**
checkbox。对该 checkbox 显式调用 `handleCheckboxChange(movieInfo,
listInfo, true)`，把 `movie_inventory` 关联 add 写入本地 `VltDb`
（vlt-db.ts），并触发三重广播。

**核心收益**：彻底消除用户此前「新建后取消关联→再关联」的手动同步步骤，
新建即自动落地 IDB。

### 4. 容错

- 5s 超时兜底：若服务端无响应（Cloudflare / 网络异常），toast 报错并
  断开 observer
- 表单未就绪（用户切入页面但 listContainer 尚未 ajax 加载完成）时
  toast 引导刷新
- 完成后恢复 modal 内 `newListArea` 隐藏态（点击
  `a[data-action="list#cancelNewList"]`），保持与原生关闭一致
- 同时还原我们的展开 UI（按钮态 / 清空输入框）

## 实施

### 修改文件

| 文件 | 变更 |
|------|------|
| `src/plugins/video-lists-tag/vlt-sync.ts` | 新增 `setupCreateListButton` / `bindCreateListEvents` / `createListViaNativeForm`；幂等标记 `_createListUiInjected` |
| `src/plugins/video-lists-tag/vlt-plugin.tsx` | handle() 详情页分支调用 `setupCreateListButton()` |
| `src/styles/video-lists-tag.css` | 新增 `.jhs-list-create-wrap` / `.jhs-list-create-form` 样式 |

### 零侵入已定稿插件

- 不修改 `DetailPageButtonPlugin`（`.jhs-list-panel` 创建 / 清空逻辑）
- 不绕过 Rails UJS（不自行 fetch / 不自行 exec Rails JS）
- 仅在 `VideoListsTagPlugin` 域内单方面增强

## 执行验证记录

### 构建验证

```
$ bun run build
$ tsc -b && vite build
✓ 213 modules transformed.
✓ built in 1.17s
dist/monkey-jhs-disassemble.user.js  1,825.78 kB │ gzip: 417.60 kB
```

- `tsc -b` 类型检查通过（零错误）
- `diagnostics` 检查 `vlt-sync.ts` 零错误零警告
- 版本号 1.5.2 → 1.6.0（新增功能模块，minor 递增）

### 产物对比

| 版本 | 产物 | gzip |
|------|------|------|
| v1.5.2 | 1,820.81 kB | 416.24 kB |
| v1.6.0 | 1,825.78 kB | 417.60 kB |

## 后续验证建议

在 https://javdb.com/v/KkP2mb 详情页（脚本更新后刷新）：

1. 展开面板下方应出现「➕ 新增清單」按钮，Bulma 蓝色 is-info 风格
2. 点击 → 切换为「输入框 + 保存 + 取消」行内表单，Esc 取消、回车提交
3. 输入新清单名「测试清单」点保存：
   - 应出现 toast `✓ 清單「测试清单」已建立，已自動關聯當前影片`
   - `.jhs-list-panel` 内应自动新增该清单 checkbox 且**已勾选**
   - 控制台应出现 `[JavDB] ═══ 勾选 [番号] → 测试清单 ═══`
     + `同步(IDB): 番号 → 测试清单 (add)`
   - 控制台应出现 `同步结果: ... association=created`
     （说明本地 IDB 关联**已新建成功**，**无需**手动取消/关联）
4. 刷新页面后该 checkbox 仍勾选（JavDB 服务端 + 本地 IDB 双持久化）
5. 在列表页该番号卡片应显示「测试清单」标签
6. 不输入清单名直接保存：toast `請輸入清單名稱`
7. 与 doc/53 联动：若新建的清单名称含「等待更新」，第 3 步还会一并触发
   自动收藏（`autoFavoriteIfPendingUpdate`）