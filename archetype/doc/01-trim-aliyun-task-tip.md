# 01 - 精简 jhs.user.js：删除阿里云盘备份/定时任务/打赏作者

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行
> **执行日期**：2026-07-01

## 1. 背景

`jhs.user.js`（16000+ 行）承载过多功能，用户要求精简：删除**阿里云盘备份**、**定时任务**、**打赏作者**三块，只保留 WebDav 备份。

## 2. 删除清单

### 2.1 阿里云盘备份（全部删除）

- 脚本头 `@include https://www.aliyundrive.com/*`、`@include https://www.alipan.com/*`、`@connect aliyundrive.com`、`@connect aliyundrive.net`
- `class AliyunPanPlugin`（获取 refresh_token 悬浮按钮）
- `class Pe`（阿里云盘 API 封装：鉴权/上传/下载/列表/删除）
- 注册 `if (t.includes("aliyundrive") || t.includes("alipan")) e.register(AliyunPanPlugin)`
- 设置面板 backup-panel 内阿里云盘区块：`getRefreshTokenBtn`/`backupBtn`/`backupListBtn` 按钮、`refresh_token` 输入框、分隔 hr
- `SettingPlugin.backupData`、`SettingPlugin.backupListBtn` 方法
- bindClick 中 `#backupBtn`/`#backupListBtn`/`#getRefreshTokenBtn` 绑定
- loadForm/saveForm 中 `refresh_token` 字段读写
- `openFileListDialog` 三处 `if (n === "阿里云盘")` 分支（删除提示、下载、导入）简化为只保留 WebDav 通用逻辑
- `async_merge_other` 清理废弃配置字段（含 `refresh_token` 残留）

### 2.2 打赏作者（全部删除）

- 侧边菜单项 `tip-author-panel`
- 整个 `#tip-author-panel` 面板（TRC20-USDT 二维码与地址）

### 2.3 定时任务（全部删除）

- `class TaskPlugin`（定时调度 + 黑名单/演员/新片检测执行逻辑，整类删除，17631 字符）
- 注册 `e.register(TaskPlugin)` × 2
- 设置面板侧边菜单项 `task-panel` + 整个 `#task-panel` 面板（并发数/间隔/自动检测黑名单/同步演员/检测新片配置）
- loadForm/saveForm 中定时任务字段（`checkConcurrencyCount`/`checkRequestSleep`/`enableCheckBlacklist`/`checkBlacklist_intervalTime`/`checkBlacklist_ruleTime`/`enableCheckFavoriteActress`/`checkFavoriteActress_IntervalTime`/`enableCheckNewVideo`/`checkNewVideo_intervalTime`/`checkNewVideo_ruleTime`）

## 3. 连带处理（方案 1：移除所有依赖 TaskPlugin 方法的入口）

删除 `class TaskPlugin` 后，以下两处会因调用 TaskPlugin **方法**（非属性）而 TypeError，需连带清理：

### 3.1 BlacklistPlugin

- `addBlacklist`：`e.singleTaskKey` → 硬编码 `"checkNewActressActorFilterCar"`（锁机制保留，防跨标签页并发）
- `resetBtnTip`：精简为只读 `checkBlacklist_ruleTime`（原 `#checkBlacklistBtn` 按钮已删，attr 设置无意义）
- `openBlacklistDialog`：删 `#checkBlacklistBtn`（手动检测）按钮 + handler（含 `e.loadConfig()`/`e.checkBlacklist(true)`）、删 `#toSetting` 按钮 + handler（`openSettingDialog("task-panel")`）
- `getTableData`：`e.isUnnecessaryCheck(...)` → `utils.isUnnecessaryCheck(...)`

### 3.2 NewVideoPlugin（清单未提及，深度依赖 TaskPlugin）

- `resetBtnTip`：简化为空（按钮已删）
- `openDialog`：删变量声明 + 模板删 `#checkFavoriteActress`/`#checkNewVideo`/`#toSetting` 三个按钮，保留 `#checkNewVideoMsg`
- `bindClick`：删三个手动检测 handler（含 `e.checkFavoriteActress()`/`e.checkNewVideo(true)`/`e.singleTaskKey`）
- `renderActressCards`：删 `const d = this.getBean("TaskPlugin")`、`d.isUnnecessaryCheck` → `utils.isUnnecessaryCheck`、删 `.btn-check-actress` 按钮 + handler（含 `d.checkOneNewVideo(i)`）

### 3.3 isUnnecessaryCheck 迁移

`isUnnecessaryCheck(e, t)` 是纯函数（`utils.getHourDifference(new Date(e), new Date()) < t`），被 `BlacklistPlugin.getTableData` 和 `NewVideoPlugin.renderActressCards` 用于**停更展示**（非定时调度）。迁移到 `class J`（即 `utils`）的 `getHourDifference` 之后，调用方改用 `utils.isUnnecessaryCheck`，保留停更卡片样式。

### 3.4 保留项

- `class De`（WebDav 备份）、`backupDataByWebDav`、`backupListBtnByWebDav`、`#webdavBackupBtn`/`#webdavBackupListBtn` 绑定
- `class ve`（异步队列，`OtherSitePlugin.handleSite` 也用）
- `WangPan115TaskPlugin`（115 网盘任务插件，独立于 TaskPlugin，Fc2Plugin/ReviewPlugin/MagnetHubPlugin 依赖）

## 4. 验证记录

- `diagnostics`：无错误无警告 ✅
- `grep` 残留检查（`AliyunPanPlugin`/`class Pe`/`\bTaskPlugin\b`/`refresh_token`/`tip-author`/`task-panel`/`阿里云`）：**0 匹配** ✅
- WebDav 保留确认（`class De`/`backupDataByWebDav`/`backupListBtnByWebDav`）✅
- `isUnnecessaryCheck` 迁移确认（`class J` 定义 + 两处 `utils.isUnnecessaryCheck` 调用）✅

## 5. 实施备注

- 超长模板字符串行（`SettingPlugin.openSettingDialog` 的 `let s`、`NewVideoPlugin` 卡片模板）edit_file fuzzy 匹配失效，改用 node 脚本基于锚点切割（`String.fromCharCode(92)` 构造字面反斜杠避免转义）精确替换
- `async_merge_other` 改为清理废弃配置字段数组（含定时任务字段 + `downPath115`），帮用户清理存量垃圾
- AGENTS.md 已同步：jhs.user.js 描述行（"新片检测/云盘备份" → "新片展示/WebDav 备份"）、设计决策 13/17（"WebDAV/阿里云盘备份" → "WebDAV 备份"）

## 6. 后续注意

- **手动检测功能消失**：黑名单手动检测、演员手动同步、单演员重新检测入口随 TaskPlugin 一并移除。BlacklistPlugin 退化为纯展示/管理（表格+搜索+筛选），NewVideoPlugin 退化为纯展示（历史 newVideoList 数据 + 编辑/取消收藏）
- **停更展示保留**：卡片"停更 N 年"样式仍工作（基于 `utils.isUnnecessaryCheck` + `lastPublishTime`），但不再有检测写入新的 `lastPublishTime`，存量数据耗尽后停更判断会失效
- 若需恢复手动检测，需重建 TaskPlugin 的检测方法或迁移到 BlacklistPlugin/NewVideoPlugin（参考方案 2）
