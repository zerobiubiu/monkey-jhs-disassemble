# doc/214 — 收藏同步独立设置页 + 引擎重写（断点续接/后台处理）

> **文档类型**：🔧 开发指导
> **文档状态**：✅ 已执行

## 1. 背景

doc/213 将收藏同步升级为双向增量同步，但仍嵌套在「清单管理器」面板内，
且同步逻辑为一次性全量抓取（`fetchVideoMap` 一次拉完所有页），对 5 万+
条目用户不友好：

- 抓取阶段无法中断/恢复（关闭弹窗即丢失进度）
- 无法后台运行（必须保持弹窗打开）
- 设置页布局不合理：同步是独立操作，不属于「清单管理」配置

## 2. 方案

### 2.1 设置页布局重排

将「收藏同步」从清单管理器中拆出，作为独立侧栏页 `fav-sync-panel`：

```
侧栏顺序：
💾 数据备份
⚙️ 基础配置
🚫 屏蔽配置
🌐 外部网站
🧹 缓存管理
📋 清单管理器  ← 移除「收藏同步」区块
🔄 收藏同步    ← 新增独立页
🎬 MissAV 同步
⚡ 预加载配置
📊 插件诊断
```

清单管理器保留：序号合并、排序显示、编号整理、压实执行、自动收藏联动、对账校准、数据管理。
收藏同步页包含：同步配置（间隔）+ 操作按钮（开始/继续/暂停/重置）+ 进度条 + 统计 + 报告。

### 2.2 同步引擎重写

原 `sync-to-javdb.ts` / `sync-from-javdb.ts` / `sync-ui.ts`（一次性全量）
替换为引擎驱动架构：

| 文件 | 职责 |
|------|------|
| `sync-session.ts` | 会话持久化（localStorage），断点续接数据结构 |
| `sync-engine.ts` | 引擎核心：tick 驱动状态机（fetch-want → fetch-watched → compare → execute → done），模块级 setInterval 后台运行 |
| `sync-common.ts` | 共享工具（CSRF/fetch/postWantToWatch/postWatched/评分缓存） |
| `fav-sync-bind.ts` | 面板按钮绑定 + UI 实时刷新（订阅引擎状态变更） |
| `index.ts` | 统一出口 |

**关键设计**：
- **分页抓取**：每次 tick 只抓一页（~24 条），保存 checkpoint 后继续
- **断点续接**：进度存 localStorage（`jhs:sync_session_v1`），关闭页面/弹窗后下次打开自动恢复
- **后台处理**：引擎在模块级 `setInterval` 中运行，不依赖弹窗可见性
- **暂停/继续**：暂停仅停止 interval，进度保留；继续从断点恢复
- **重置**：清除会话 + 重置 UI
- **对比阶段**：一次性构建四方向操作队列 + 冲突列表
- **执行阶段**：逐条执行，每 10 条保存一次 checkpoint
- **进度百分比**：抓取阶段 0-20%，执行阶段 20-100%

### 2.3 UI 设计

- 进度条（绿色/红色）+ 阶段描述文本
- 四格统计卡片：成功/失败/跳过/冲突
- 详细报告区（冲突番号 + 失败明细，完成时显示）
- 按钮状态联动：运行中禁用「开始」「继续」，非运行中禁用「暂停」

## 3. 实施

### 修改文件清单

| 操作 | 文件 |
|------|------|
| 新增 | `src/plugins/setting/jhs-sync/sync-session.ts` |
| 新增 | `src/plugins/setting/jhs-sync/sync-engine.ts` |
| 新增 | `src/plugins/setting/jhs-sync/fav-sync-bind.ts` |
| 新增 | `src/components/setting-panels/fav-sync-panel.tsx` |
| 重写 | `src/plugins/setting/jhs-sync/sync-common.ts`（精简） |
| 重写 | `src/plugins/setting/jhs-sync/index.ts`（新出口） |
| 修改 | `src/components/setting/setting-dialog.tsx`（侧栏 + 面板注册） |
| 修改 | `src/components/setting-panels/list-manager-panel.tsx`（移除同步区块） |
| 修改 | `src/plugins/setting/setting-form-bind.ts`（新绑定 + 面板切换） |
| 修改 | `src/plugins/setting/setting-form-load.ts`（#favSyncInterval） |
| 修改 | `vite.config.ts`（version 1.37.0→1.38.0） |
| 删除 | `src/plugins/setting/jhs-sync/sync-to-javdb.ts` |
| 删除 | `src/plugins/setting/jhs-sync/sync-from-javdb.ts` |
| 删除 | `src/plugins/setting/jhs-sync/sync-ui.ts` |

## 4. 执行验证记录

- 全项目 diagnostics：零错误（`setting-form-bind.ts` 的模块解析警告为 TS 语言服务器对新文件的索引延迟，文件存在且自身零错误，编辑器重启后消失）
- `dist/` 警告为构建产物 lint 提示，非源码问题
- 待用户本地 `bun run build` 确认产物正常

## 5. 后续验证建议

1. 在 JavDB 站点打开设置 → 侧栏确认「🔄 收藏同步」独立页存在
2. 清单管理器中确认「收藏同步」区块已移除
3. 点击「开始同步」→ 确认进度条逐页推进
4. 中途点击「暂停」→ 关闭弹窗 → 重新打开 → 点击「继续同步」→ 确认从断点恢复
5. 同步完成后确认统计卡片和冲突报告正确显示
6. 点击「重置」确认进度清零
