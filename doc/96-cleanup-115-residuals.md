# 96 - 清理 115 视频匹配相关残留模块

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行

## 背景

115 网盘三件套插件（`WangPan115TaskPlugin` 离线下载 / `WangPan115MatchPlugin`
视频匹配 / `WangPan115Plugin` 登录页）的**插件本身**在 doc/03（精简为 javdb 专用
脚本）时已删除，但其**入口与 UI 残留**仍散落在 src 的组件和插件中：

- 设置面板「启用115视频匹配」开关（`#enable115Match`）——勾选只写 IndexedDB，
  无插件消费，纯死设置项
- 评论区磁链/ed2k 旁的「115离线下载」按钮（`down-115`）——点击 `getBean`
  返回 `undefined` 静默失败
- FC2 弹窗磁链后的「115离线下载」按钮注入块——同上，`WangPan115TaskPlugin`
  未迁移，`?.handleAddTask` 静默失败
- 帮助对话框「如何多浏览器同时登录115网盘?」段落——115 登录功能已不存在
- `fc2-plugin.ts` 头部注释把 `WangPan115TaskPlugin` / `115离线` 列为缺失依赖

这些按钮/设置项/帮助**点击或勾选均无实际效果**，属无效死代码，应清理。

## 方案

清理 5 处 115 功能残留，保留 `storage-manager.ts` 的 `downPath115` 善后清理逻辑
（它在删除老用户 IndexedDB setting 中残留的 `downPath115` 键，属"清理旧数据"
的善后工作，不是功能代码，保留可让已升级用户的残留配置被自动清除）。

## 实施

| 文件 | 改动 |
|------|------|
| `src/components/simple-setting-panel.tsx` | 删除「启用115视频匹配」设置项 `<div>`（`#enable115Match`）；头部注释去掉「115匹配、」 |
| `src/plugins/setting-plugin.tsx` | 删除 `#enable115Match` 的 `prop('checked')` + `on('change')` 绑定块（8 行） |
| `src/components/review-link-content.tsx` | ed2k 分支删除 `<button class="down-115">115离线下载</button>`（保留 `<span>` 显示链接）；magnet 分支删除同款按钮（保留 `<a>` 链接）；头部 doc-comment 同步去掉 `down-115` / `data-magnet` / `+button` 描述 |
| `src/plugins/fc2-plugin.ts` | 删除 FC2 弹窗 `$('#magnets-content').html()` 后追加「115离线下载」按钮的 `.each(...)` 注入块（27 行）；头部注释 `WangPan115TaskPlugin` / `115离线` 移除，缺失依赖「5 个」→「4 个」 |
| `src/components/help-dialog.tsx` | 删除第 4 条「如何多浏览器同时登录115网盘?」`<details>` 帮助段落 |

### 保留项

| 文件 | 保留 | 理由 |
|------|------|------|
| `src/core/storage-manager.ts` | `async_merge_other` 中 `downPath115` 清理逻辑（L1049-1051） | 善后清理老用户 setting 中残留的 115 配置键，删除后旧数据将永久残留 IndexedDB；保留无害且有益 |

## 执行验证

```
$ bun run build
$ tsc -b && vite build
✓ 219 modules transformed.
dist/monkey-jhs-disassemble.user.js  1,887.86 kB │ gzip: 434.43 kB
✓ built in 1.11s
```

- `tsc -b` 零错误
- 5 个修改文件诊断无 error/warning
- 产物 1887.86 kB（gzip 434.43 kB），较清理前 1890.88 kB **-3.02 kB**
- 产物 grep 验证：`115离线下载` / `enable115Match` / `down-115` / `登录115网盘` /
  `WangPan115TaskPlugin` 均为 0 次
- version `1.12.6` → `1.12.7`（清理死代码，patch 递增）

## 后续验证建议

1. 打开 javdb 详情页，展开评论区有磁链的评论 → 磁链仍为可点击 `<a>`，
   不再有「115离线下载」按钮
2. 打开 FC2 番号弹窗（如 FC2-PPV-xxx）→ 磁链行只有「複製」按钮，
   不再有「115离线下载」按钮
3. 打开设置 → 简化设置面板 → 「启用悬浮大图」后直接接分隔线，
   不再有「启用115视频匹配」开关
4. 打开设置 → 常见问题 → 帮助列表只剩 3 条，无 115 网盘登录条目
5. 老用户 setting 中若有 `downPath115` 残留，`async_merge_other` 仍会自动清除
