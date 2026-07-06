# 46 - CarStatusSync 车辆状态跨域同步集成

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 1. 背景

### 1.1 来源

两个独立油猴脚本，原通过后端服务器（Cloudflare Workers + D1）中转数据：

| 脚本 | 行数 | 功能 |
|------|------|------|
| `archetype/jhsCarListReader.user.js` | 1320 | javdb 端：读取 JAV-JHS IndexedDB 的 car_list → 转列存 gzip → POST 到后端 |
| `archetype/missavStatusTag.user.js` | 895 | missav 端：从后端增量拉取 → 写入本地 IndexedDB → 渲染状态标签 |

### 1.2 集成目标

- 去除后端服务器依赖，改用油猴脚本原生能力跨域传递数据
- 实时刷新数据（javdb 端变更后 missav 端立即收到）
- missav 端本地 IndexedDB 数据可通过 jhs 的 WebDav 备份/恢复
- 保留后端服务器数据库内容（通过设置面板导入）

### 1.3 可行性分析（6 维度决策表）

| 维度 | 问题 | 判定 |
|------|------|------|
| 站点限定 | 多站：javdb + missav | match 增加 missav.ws/live；插件内按 isJavdbSite/isMissavSite 分支 |
| GM_API 依赖 | GM_setValue/GM_getValue/GM_addValueChangeListener/GM_registerMenuCommand | 全部已在 grant 中（doc/40 已补 GM_getValue/GM_setValue，doc/39 已补 GM_addValueChangeListener） |
| 数据源 | javdb 端读 storageManager.getCarList()（JAV-JHS/appData） | 复用全局 storageManager（不另开 IDB 连接） |
| 事件源 | GM_addValueChangeListener 跨域实时通知 | 集成后同一 userscript，GM 存储共享，remote=true 触发 |
| 网络请求 | 无（原 GM_xmlhttpRequest POST 后端已去除） | 零网络请求，纯 GM 存储传递 |
| 主项目冲突 | 无 | missav 站点不注册 javdb 的 33 个插件；javdb 端 CarListReaderPlugin 只读 car_list 不操作 DOM |

### 1.4 主项目冲突排查

**无冲突，独立运行。**

- CarListReaderPlugin 只读取 storageManager.getCarList()，不操作任何 DOM，不监听 MutationObserver
- MissavStatusTagPlugin 在 missav 站点运行，与 javdb 的 33 个插件无交集
- 两个插件通过 GM 存储通信，不共享 DOM 容器/data 属性/事件源

## 2. 方案

### 2.1 核心架构：两层同步机制（增量实时 + 全量兜底）

```
javdb 端（CarListReaderPlugin）:
  【增量 实时】storageManager.saveCar/removeCar → carListChangeCallback
    → GM_setValue('jhs_car_status_delta', {action, items, ts})  // 几十字节 不压缩
    → missav 端 GM_addValueChangeListener 实时收到 → upsert/delete 本地 IDB → 刷新标签

  【全量 兜底】页面加载延迟 2s → storageManager.getCarList → toColumnar → gzipToBase64
    → GM_setValue('jhs_car_status_data', {data, hwm, count, ts})  // ~600KB gzip+base64
    → missav 端 GM_addValueChangeListener 收到 → 解压 → 全量 upsert → 刷新标签

missav 端（MissavStatusTagPlugin）:
  GM_addValueChangeListener('jhs_car_status_delta') → 增量处理（不锁不冷却，几条记录）
  GM_addValueChangeListener('jhs_car_status_data') → 全量处理（有锁，5.5万条）
  页面加载时读 GM_getValue 获取当前全量数据初始化
  MutationObserver 监听 missav 动态加载的缩略图
```

**核心原理**：集成后 javdb 和 missav 运行的是同一个 userscript（同一打包产物），GM 存储在同一脚本的所有实例间共享，GM_addValueChangeListener 的 remote=true 表示变更来自其他标签页/域名实例。

**增量推送的触发源**：storageManager 的 5 个写方法（saveCar/updateCarInfo/removeCar/batchRemoveCars/saveCarList）内部触发 carListChangeCallback，CarListReaderPlugin 在 handle() 时注入回调。每次用户收藏/屏蔽/删除影片时立即触发，毫秒级到达 missav 端。

### 2.2 关键设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 跨域数据传递方式 | GM_setValue + GM_addValueChangeListener | 油猟原生能力，零网络请求，实时同步，无需后端 |
| 实时同步机制 | 增量推送（storageManager 写方法内部触发回调） | 每次用户操作立即推送单条/批量变更，几十字节不压缩，毫秒级到达 |
| 全量同步机制 | 页面加载延迟 2s 执行，无冷却期 | 兜底保证 missav 端离线后上线的数据一致性 |
| 数据压缩 | 列存 + gzip + base64 | car_list 原始 ~2.7MB → gzip ~400KB → base64 ~600KB，远低于 GM 存储限制 |
| missav 端本地存储 | 独立 IndexedDB MissAV-CarStatus/cars | 与 jhs 的 JAV-JHS 隔离，避免 missav 站点创建空 JAV-JHS 库 |
| WebDav 备份 | missav 端导出 JSON → 设置面板上传 | 复用 jhs 的 WebDav 备份链路（与 vlt-panel 模式一致） |
| 后端数据保留 | 设置面板"导入"功能 | 支持后端列存格式 + 行式格式两种导入 |
| 触发时机 | 自动（页面加载）+ 被动（BroadcastChannel refresh）+ 手动（菜单） | 多触发源确保数据及时同步 |

### 2.3 目录结构

```
src/plugins/car-status-sync/
├── car-status-config.ts        # 配置常量（GM 键名/状态映射/DB 配置/类型定义）
├── car-status-columnar.ts      # 列存转换（toColumnar/columnarToFlat/gzipToBase64/gunzipFromBase64）
├── car-status-db.ts            # missav 端 IndexedDB（openLocalDB/upsertLocalCars/queryLocalCars/export/import）
├── missav-renderer.ts          # missav 渲染（normalizeCarNum/createBadge/renderBadges/isVideoPage）
├── car-list-reader-plugin.ts   # javdb 端插件（读 car_list → 列存 → GM 存储）
└── missav-status-tag-plugin.ts # missav 端插件（监听 GM 存储 → 解压 → 渲染）
```

### 2.4 模块拆分映射

| 原脚本段 | 行号 | 本项目模块 |
|----------|------|------------|
| jhsCarListReader CONFIG | L414-437 | car-status-config.ts |
| jhsCarListReader normalizeUrl | L195-218 | car-status-columnar.ts |
| jhsCarListReader toColumnar | L241-284 | car-status-columnar.ts |
| jhsCarListReader gzipToBuffer | L399-410 | car-status-columnar.ts (gzipToBase64) |
| jhsCarListReader readCarList | L93-113 | car-list-reader-plugin.ts (用 storageManager.getCarList 替代) |
| jhsCarListReader syncDeltaCars | L899-1076 | car-list-reader-plugin.ts syncCarStatus |
| missavStatusTag CONFIG | L26-58 | car-status-config.ts |
| missavStatusTag openLocalDB | L156-173 | car-status-db.ts |
| missavStatusTag upsertLocalCars | L182-230 | car-status-db.ts |
| missavStatusTag queryLocalCars | L237-273 | car-status-db.ts |
| missavStatusTag fetchCarsSince | L337-363 | missav-status-tag-plugin.ts consumeFromGMStorage (改 GM 存储) |
| missavStatusTag columnarToFlat | L310-330 | car-status-columnar.ts |
| missavStatusTag createBadge | L475-512 | missav-renderer.ts |
| missavStatusTag renderBadges | L520-562 | missav-renderer.ts |
| missavStatusTag normalizeCarNum | L577-588 | missav-renderer.ts |
| missavStatusTag processPage | L606-677 | missav-status-tag-plugin.ts processPage |
| missavStatusTag observeAndProcess | L727-792 | missav-status-tag-plugin.ts observeAndProcess |
| missavStatusTag syncData | L372-463 | missav-status-tag-plugin.ts consumeFromGMStorage |

## 3. 实施

### 3.1 新增文件

| 文件 | 行数 | 职责 |
|------|------|------|
| `src/plugins/car-status-sync/car-status-config.ts` | ~70 | 配置常量 + 类型定义 |
| `src/plugins/car-status-sync/car-status-columnar.ts` | ~210 | 列存转换 + gzip/base64 压缩 |
| `src/plugins/car-status-sync/car-status-db.ts` | ~190 | missav 端 IndexedDB CRUD |
| `src/plugins/car-status-sync/missav-renderer.ts` | ~150 | 番号归一化 + 标签渲染 |
| `src/plugins/car-status-sync/car-list-reader-plugin.ts` | ~130 | javdb 端插件 |
| `src/plugins/car-status-sync/missav-status-tag-plugin.ts` | ~250 | missav 端插件 |

### 3.2 修改文件

| 文件 | 改动 |
|------|------|
| `src/constants/site.ts` | 新增 `isMissavSite` 常量 |
| `src/main.tsx` | 注册 CarListReaderPlugin（javdb）+ MissavStatusTagPlugin（missav）；storageManager 合并操作加 isJavdbSite 守卫 |
| `vite.config.ts` | match 增加 missav.ws/live；include 增加 missav*.ws/live |
| `src/components/setting-dialog.tsx` | 新增"🎬 MissAV 同步"面板（侧栏 + 面板内容） |
| `src/plugins/setting-plugin.tsx` | 新增 missav-panel 事件绑定（立即同步/导入/导出） |

### 3.3 控制流保留要点

1. **javdb 端自动同步**：页面加载时静默执行（受 60s 冷却期），保留原 jhsCarListReader 的 onReady 逻辑
2. **missav 端 MutationObserver**：完整保留原 observeAndProcess 的 childList + attributes(alt) 监听 + 防抖
3. **missav 端视频页/列表页分支**：保留 processVideoPage（底部推荐 + 侧边推荐）+ processListPage
4. **番号归一化**：保留 normalizeCarNum 的 FC2 特殊处理 + 下划线/横线拆分
5. **gzip 压缩**：保留 CompressionStream/DecompressionStream，base64 编码适配 GM 存储
6. **批量写入**：保留 3000 条/批的 IDB 写入策略

## 4. 执行验证记录

### 4.1 类型检查

```
$ bunx tsc -b
（无输出，退出码 0）
```

### 4.2 构建
| 4.2 构建（增量推送改造后） |

```
$ bunx vite build
dist/monkey-jhs-disassemble.user.js  1,850.01 kB │ gzip: 441.06 kB
✓ built in 1.17s
```

与基线（1,816.07 kB / gzip 433.20 kB）相比，增量约 34 kB（新增 6 模块 + storageManager 回调机制）。

### 4.3 userscript metadata 验证

- `@match`：包含 `https://javdb.com/*`、`https://missav.ws/*`、`https://missav.live/*`
- `@grant`：包含 `GM_setValue`、`GM_getValue`、`GM_addValueChangeListener`、`GM_registerMenuCommand`、`GM_xmlhttpRequest`
- `@connect`：包含 `*`（通配符，覆盖 missav 域名）
- `@run-at`：`document-idle`

## 5. 后续

### 运行时验证建议

1. **javdb 端**：打开 javdb 列表页 → 控制台应显示 `[JHS CarSync] 4-完成` → 检查 GM 存储有 `jhs_car_status_data` 键
2. **missav 端**：打开 missav.ws → 控制台应显示 `[MissAV] ✓ 已注册 GM 存储变更监听` → 缩略图上应出现状态标签
3. **跨域实时同步**：javdb 端修改 car_list（如收藏/屏蔽）→ missav 端刷新页面应显示新标签
4. **设置面板**：javdb 设置 → "🎬 MissAV 同步" → "立即同步" → 检查状态显示
5. **数据导入**：从后端服务器导出的 JSON 通过"导入数据"按钮导入 → 检查 missav 端标签显示
6. **数据导出**：missav 端导出 JSON → 通过 jhs 的 WebDav 备份链路上传

### dead code 说明

- 原后端服务器（`E:\cloudflare-javdb-video-status-table-server`）已无需运行，可保留为冷存储备份
- 原脚本的 HWM 增量过滤、失败重试队列、pending queue 等机制已去除（GM 存储是本地操作，不会失败）
- 原脚本的 API Key 配置、健康检查、extractApiError 等后端相关逻辑已去除
