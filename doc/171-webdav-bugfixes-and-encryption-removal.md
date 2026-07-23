# doc/171 — WebDAV 备份 bug 修复 + 加密移除 + 设置 UI 布局修复

> 文档类型：🐛Bug修复
> 文档状态：✅已执行

## 背景

用户反馈设置面板 3 个问题：① UI 布局混乱（输入框被 max-width 限制导致标签与输入框间距过大，密码切换按钮换行）；② WebDAV 备份 401 错误（凭据从 GM 读取而非输入框，未保存的编辑不生效）；③ WebDAV URL 被删（旧格式 settings.* 凭据未迁移到 GM 新格式）。同时用户要求移除 WebDAV 备份加密（私有服务器，无需加密）。

## 修复清单

| # | 问题 | 根因 | 修复 |
|---|------|------|------|
| 1 | 设置 UI 布局混乱 | `.form-content` 的 `max-width:220px` + `min-width:180px` 限制输入框宽度；密码切换按钮被 `width:100%` 撑满换行 | 移除 max/min-width；密码字段用 flex 容器包裹 input+button |
| 2 | WebDAV 401 | `backupDataByWebDav`/`backupListBtnByWebDav` 从 `GM_getValue` 读凭据而非输入框 | 改为优先读输入框 `$('#webDavUrl').val()`，回退 GM |
| 3 | WebDAV URL 被删 | `loadForm` 仅读 GM 新格式；旧 `settings.webDavUrl` 未迁移；用户保存时 `saveForm` 删除旧格式并写空 GM | `loadForm` 增加旧格式回退 + 首次加载自动迁移到 GM |
| 4 | WebDAV 备份加密移除 | 用户要求：私有服务器无需加密 | `backupDataByWebDav`/`autoBackup` 移除 `encryptBackupV2` 调用和 `backupPassword` 检查；直接上传明文 JSON；保留 importData 解密路径兼容旧加密备份；保留 exportData 本地加密 |
| 5 | `transition: all` 反模式 | image-recognition-plugin.css `#upload-area` 使用 `transition: all 0.3s` | 窄化为 `transition: border-color 0.3s, background-color 0.3s` |

## 实施清单

| 文件 | 操作 |
|------|------|
| src/styles/setting-plugin.css | 改（移除 .form-content 的 max-width/min-width） |
| src/components/setting-panels/backup-panel.tsx | 改（密码字段 flex 包裹） |
| src/plugins/setting-plugin.tsx | 改（loadForm 迁移 + backupDataByWebDav/backupListBtnByWebDav 读输入框 + 移除加密） |
| src/styles/image-recognition-plugin.css | 改（transition:all 窄化） |

## 验证记录

- bun run build：✅
- bun run test：✅ 28/28
- bun run lint：✅ 0 errors
- encryptBackupV2 仅出现在 importData（解密兼容）和 exportData（本地加密），不在 backupDataByWebDav/autoBackup
- backupPassword 仅出现在 loadForm/saveForm/importData/exportData，不在 backupDataByWebDav/autoBackup
