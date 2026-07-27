# doc/215 — 修复 /users/lists 页面瀑布流追加条目「修改」按钮失效

> **文档类型**：🔧 开发指导
> **文档状态**：✅ 已执行

## 1. 背景

用户反馈 `/users/lists` 清单管理页部分清单的「修改」按钮点击无响应。

排查发现：`listWaterfall` 瀑布流插件追加第 2 页清单条目后，这些新 DOM 节点
未被 JavDB 原生 Stimulus handler 绑定（原生 handler 仅在页面加载时绑定一次），
导致点击「修改」按钮无法触发 `#modal-edit-list` 弹窗。

VLT 插件的 capture 监听器能捕获点击（日志可见 `编辑清单快照: listId=...`），
但只记录快照，弹窗打开依赖原生 handler，对追加节点不生效。

## 2. 方案

在 VLT 的「修改」按钮点击监听器中，记录快照后**自行打开弹窗**：
- 填充 `inputName`（清单名称）和 `inputId`（清单 ID）
- 添加 `is-active` 类显示弹窗 + `is-clipped` 锁定 body 滚动

对原生已绑定的条目，重复打开是幂等的（is-active 已存在无副作用）。

## 3. 实施

### 修改文件清单

| 操作 | 文件 |
|------|------|
| 修改 | `src/plugins/video-lists-tag/vlt-list-mgmt.ts`（新增 openEditModal + 监听器调用） |
| 修改 | `vite.config.ts`（version 1.38.0→1.38.1） |

## 4. 执行验证记录

- 全项目 diagnostics：源码零错误零警告
- 待用户本地 `bun run build` + 实际页面验证

## 5. 后续验证建议

1. 在 `/users/lists` 页面滚动触发瀑布流加载第 2 页
2. 点击第 2 页追加条目的「修改」按钮 → 确认弹窗正常打开
3. 修改名称并保存 → 确认改名成功 + IDB 同步 + toast 提示
4. 第 1 页原有清单的修改功能不受影响
