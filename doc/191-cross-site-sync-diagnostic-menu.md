# doc/191 — 跨站同步诊断菜单命令（javdb 发布侧 + missav 消费侧）

## 背景

跨站同步（doc/46 + doc/187 协议升级）涉及 GM 存储、IndexedDB、修订号、增量 journal
等多个状态源，出问题时难以快速定位。新增 Tampermonkey 菜单命令，一键转储全部
同步状态到控制台 + 剪贴板，方便用户反馈和开发者排查。

## 变更

### javdb 端（CarListReaderPlugin.handle()）

新增菜单命令 `🔍 诊断：跨站同步发布侧`，输出：

- `site` / `version` / `flag`（crossSiteSyncProtocol 开关）
- `gmRevision`（GM_KEY_CAR_STATUS_REVISION 修订号分配器）
- `carListRev` / `syncedRev`（本地变更代号 vs 已同步代号）
- `journal`（增量日志长度 + 最近 5 条摘要：action/revision/carNums）
- `fullSnapshot`（全量快照 revision/count/ready）

### missav 端（MissavStatusTagPlugin.handle()）

新增菜单命令 `🔍 诊断：跨站同步消费侧`，输出：

- `site` / `version` / `flag`
- `gmRevision`
- `journal`（增量日志长度 + 最近 3 条摘要）
- `fullSnapshot`
- `idb`（syncMeta 修订号元数据 / carCount 记录数 / MGT-140 抽样记录）
- `inMemory`（lastAppliedRevision / lastAppliedKind 页面实例水位线）

### 基础设施

- `src/types/globals.d.ts`：新增 `GM_info` 类型声明
- `vite.config.ts`：grant 列表新增 `GM_info`

## 约束

- 纯只读诊断，不修改任何同步逻辑
- 菜单注册包裹 try/catch（与现有菜单命令一致）
- clipboard 写入失败静默降级（仅控制台输出）
- show.ok 提示用户操作完成

## 影响范围

- `src/plugins/car-status-sync/car-list-reader-plugin.ts`（+诊断菜单）
- `src/plugins/car-status-sync/missav-status-tag-plugin.ts`（+诊断菜单 + 新导入）
- `src/types/globals.d.ts`（+GM_info 声明）
- `vite.config.ts`（+GM_info grant，version 1.28.31→1.28.32）
