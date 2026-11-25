# 75. MissAV 同步显示 JavDB 归属清单与 MissAV 自身收藏状态

> **文档类型**：🧾 变更记录
> **文档状态**：✅ 已执行
> **影响范围**：`src/core/util/site/missav-paths.ts`、`src/plugins/video-lists-tag/`、`src/plugins/car-status-sync/`、`src/plugins/missav-status-filter/`、`src/plugins/missav-video-preview/`、`src/plugins/setting/data-import-export.ts`、`src/components/setting/setting-dialog.tsx`、`src/styles/car-status-sync/missav-card-meta.css`、`src/styles/missav-status-filter/missav-status-filter.css`
> **前置文档**：`docs/74-missav-filter-sync-and-nord-layout.md`、`docs/11-missav-and-finale.md`
> **替代文档**：无
> **生效版本**：v1.53.0

---

## 1. 背景

用户已通过 JavDB → MissAV 跨站同步在 MissAV 卡片右上角看到 JavDB 鉴定状态，但仍有两项核心需求：

1. **在 MissAV 卡片上显示 JavDB 归属清单**：要求**不遮挡**视频封面（`div.relative.aspect-w-16.aspect-h-9... > a:nth-child(2)`），而是在卡片区块（`grid > div`）内单独划出区域，沿用 JavDB 列表卡片 `.jhs-vlt-tags-display` 的胶囊配色、滚轮横向滚动与新标签页跳转逻辑。
2. **在卡片上显示 MissAV 自身的收藏状态**（而非 JavDB 收藏）：让用户在列表页无需逐个打开视频页即可分辨哪些视频已被当前 MissAV 账号收藏；同时考虑到本项目通过 `MissavVideoPreviewPlugin` 在列表页内以**同源 iframe 弹窗**打开视频详情页，用户在 iframe 内点击收藏/取消收藏时，父窗口列表页卡片也应实时更新。

基于用户在已登录 MissAV 浏览器提供的真实 DOM 采集结果：
- 收藏页 `/cn/saved` 使用与普通列表页完全一致的 `.thumbnail.group` + `a[alt]`（含版本后缀如 `royd-380-uncensored-leak`）与分页结构，普通列表页卡片 HTML 本身不含原生收藏标识；
- 视频详情页（含 iframe）原生收藏按钮绑定 `@click.prevent="toggleSave"`，运行时通过按钮类 `text-primary`（已收藏）与 `text-nord4`（未收藏）及内部 `svg[x-show="saved"]` / `svg[x-show="! saved"]` 切换状态。

---

## 2. 方案与设计决策

### 2.1 JavDB 归属清单跨站同步（零后端、水位线隔离）
- **发布挂钩**：在 `vlt-db-core.ts` 的 `withState('readwrite', ...)` 事务提交后触发 `setVltChangeCallback`，一次覆盖勾选/取消清单、清单删改名、服务端对账与迁移导入等全部写入路径。
- **独立 GM 通道**：新建 `vlt-sync-protocol.ts`，采用独立 GM 键 `jhs_vlt_lists_data` / `jhs_vlt_lists_revision`，将清单元数据与按 `normalizeCarNum(..., 'path')` 归一化的番号映射打包为紧凑 `{ lists, byCarNum }` 结构并 `gzip + base64` 压缩，避免污染既有车号状态同步水位线。
- **全帧覆盖**：`CarListReaderPlugin` 在所有帧（含 JavDB 详情页 iframe）注册 300ms 防抖合批发布；top frame 启动做 24 小时兜底发布，设置面板「🎬 MissAV 同步 → 立即同步」与 GM 菜单同步触发。

### 2.2 MissAV 本地存储升级（`MissAV-CarStatus` v2 → v3）
- 在 `car-status-db.ts` 的 `onupgradeneeded` 幂等创建两个新仓库（无损兼容既有 `cars` 与 `sync_meta`）：
  - `vlt_cars`（主键 `carNum`，存 `{ carNum, listIds }`）+ `sync_meta[vlt_inventory]` / `sync_meta[vlt_lists_revision]`；
  - `missav_saved`（主键规范小写 `slug`，如 `royd-380-uncensored-leak`，精准区分同一番号有码 / 无码流出 / 中文字幕等独立条目）+ `sync_meta[missav_saved_meta]`。

### 2.3 MissAV 原生收藏采集、同步与 iframe 实时联动
- **同源分页同步（`syncAllMissavSavedPages`）**：通过页面同源 `fetch(url, { credentials: 'include' })` 抓取 `/{lang}/saved` 全部分页（页间 400ms 节流、500 页防循环保护），严格校验响应 URL 与收藏页特征（`isValidSavedPageDoc`），遇未登录跳转或风控页安全中止绝不误清本地库。
- **收藏页自动校对（`reconcileCurrentSavedPage`）**：浏览 `/{lang}/saved` 时自动记录当前页条目，单页收藏直接完成权威对账。
- **详情页与 iframe 实时监听（`observeDetailSaveButton`）**：在所有视频详情页（不跳过 `window.self !== window.top` iframe）定位 `@click.prevent="toggleSave"` 按钮并监测实时 `class` 与 `svg[x-show]` 变更：初始读到 `text-primary` 自动补录已收藏；点击按钮触发状态翻转时即时增量写库/删库，并通过同源 `BroadcastChannel('jhs-missav-saved-sync')` 毫秒级通知父窗口列表页与其他同源标签页刷新卡片与筛选栏。

### 2.4 卡片独立信息区与顶部三栏无框筛选栈
- **卡片独立信息区（`.jhs-missav-card-meta`）**：挂载在 `.thumbnail.group` 末尾（原生封面 `div.relative` 与标题之后），兼容初始页包装 DIV 与瀑布流直接追加项；左侧固定玫瑰红心形 `MissAV` 徽标（仅已收藏显示），右侧为可滚轮横向滚动的 JavDB 清单胶囊行（带 CSS `@property` + `mask` + `animation-timeline: scroll(self inline)` 溢出边渐隐提示）；无收藏且无清单时以暗色低对比度 `—` 占位保持同行高度齐平。`MissavVideoPreviewPlugin` 放行 `.jhs-missav-card-meta` 点击避免误弹预览窗。
- **多栏无框筛选栈（`.jhs-missav-filter-stack`）**：`MissavStatusFilterPlugin` 扩展为 `状态:` / `MissAV:` / `清单:` 三行 Nord 暗色无背板 `subgrid` 筛选栈，各自维护独立隐藏属性（`data-mstf-hidden` / `data-msf-saved-hidden` / `data-msf-vlt-hidden`）在 grid cell 级合成交集显隐，共享 `filter-chips.ts` 三态交互与外层空白处双击一键全清；`MissAV:` 栏附轻量「同步收藏 / 刷新收藏」按钮。

---

## 3. 实施清单

### 新增文件
- `src/plugins/car-status-sync/vlt-sync-protocol.ts` — JavDB 清单跨站紧凑快照协议、严格校验与单调修订号发布用例
- `src/plugins/car-status-sync/missav-vlt-db.ts` — MissAV 域 JavDB 清单本地 IndexedDB 读写与对账模块
- `src/plugins/car-status-sync/missav-saved-db.ts` — MissAV 原生收藏本地 IndexedDB 读写与对账模块
- `src/plugins/car-status-sync/missav-saved-sync.ts` — MissAV 原生收藏页分页同步、详情/iframe 按钮监听与 `BroadcastChannel` 跨帧联动
- `src/plugins/car-status-sync/missav-card-meta.ts` — 卡片底部独立信息区渲染与签名差量更新
- `src/styles/car-status-sync/missav-card-meta.css` — 卡片底部信息区 Nord 暗色样式与横向溢出边缘渐隐提示
- `tests/missav-vlt-and-saved.test.ts` — 11 项回归测试（路径与 slug / 跨站协议校验 / 实测 DOM 按钮与收藏页解析 / iframe 监听 / 独立区渲染 / 预览点击放行）

### 修改文件
- `src/core/util/site/missav-paths.ts` — 新增 `extractMissavSlug`、`isMissavSavedPage`、`buildMissavSavedUrl`
- `src/plugins/video-lists-tag/db/vlt-db-core.ts` & `src/plugins/video-lists-tag/vlt-db.ts` — 新增 `setChangeCallback` 与 `readListSnapshot`
- `src/plugins/car-status-sync/car-list-reader-plugin.ts` — 接入 `VltDb` 变更防抖发布、24h 兜底与菜单同步
- `src/plugins/car-status-sync/car-status-config.ts` & `car-status-db.ts` — `MissAV-CarStatus` 升级至 v3 并新增 store/lock/meta 常量
- `src/plugins/car-status-sync/missav-status-tag-plugin.ts` — 注入卡片底部样式、消费归属清单快照、接入 MissAV 收藏同步与跨帧监听、并发查询三库渲染
- `src/plugins/missav-status-filter/{mstf-collect,mstf-apply,missav-status-filter-plugin}.ts` — 扩展为状态 / MissAV / 清单三栏交集筛选栈与一键同步按钮
- `src/styles/missav-status-filter/missav-status-filter.css` — 升级为多栏无框 `subgrid` Nord 暗色样式
- `src/plugins/missav-video-preview/missav-video-preview-plugin.ts` — 放行 `.jhs-missav-card-meta` 点击事件
- `src/plugins/setting/data-import-export.ts` & `src/components/setting/setting-dialog.tsx` — 「立即同步」同步推送归属清单并更新说明文案
- `tests/missav-status-filter-ui.test.ts` — 新增三栏交集、单栏双击单选与栈空白区一键全清测试
- `vite.config.ts`、`package.json`、`CHANGELOG.md`、`docs/README.md`、`docs/plugin-catalog.md`、`AGENTS.md` — 同步版本至 `1.53.0` 与文档索引

---

## 4. 后续验证建议

1. 安装 `dist/monkey-jhs-disassemble.user.js`（v1.53.0）后，先在任意 JavDB 页面等待 3 秒（或在设置 → 🎬 MissAV 同步点击「立即同步」）完成首次归属清单快照推送；
2. 打开 MissAV 列表页，确认：
   - 卡片底部独立区展示 JavDB 归属清单胶囊（不遮盖视频封面），点击胶囊在新标签页打开对应 JavDB 清单而非弹出预览窗；
   - 点击顶部 `MissAV:` 栏「同步收藏」（或浏览一次 `https://missav.ws/cn/saved`）后，已收藏卡片底部左侧亮起玫瑰红心形 `MissAV` 徽标；
   - 点击某卡片打开 **iframe 视频预览弹窗**，在弹窗内点击原生「收藏 / 取消收藏」，关闭或直接观察背后列表卡片是否秒级联动变化；
   - 验证顶部 `状态:` / `MissAV:` / `清单:` 三栏左键包含、右键排除、各栏独立双击单选与空白处双击一键全清。

---

## 5. 执行验证记录

### 执行环境
- OS：Windows x64
- 运行时与构建工具：Bun / Node v26.13.1 / Vite 8.2.1 / TypeScript 6.0.3 / Vitest 4.1.10 / ESLint 10.8.1 / Stylelint 17.14.1
- 视觉验收浏览器：`chrome-devtools` MCP（1280×720 桌面与 375×812 移动端独立预览页）

### 验证命令
```pwsh
bun run build && Select-String -Path dist/monkey-jhs-disassemble.user.js -Pattern "@version" | Select-Object -First 2
bun run lint
bun run lint:css
bun run check:version
bun run check:docs
bun run check:structure
bun run check:selectors
npx.cmd vitest run tests/missav-vlt-and-saved.test.ts tests/missav-status-filter.test.ts tests/missav-status-filter-ui.test.ts tests/missav-video-preview.test.ts tests/car-status-consume.test.ts tests/car-status-publish.test.ts tests/filter-chip-interactions.test.ts tests/vlt-live-sync.test.ts
```

### 实际输出
- `tsc -b && vite build`：475 modules transformed，`dist/monkey-jhs-disassemble.user.js 1,509.61 kB │ gzip: 386.63 kB`，产物头 `// @version 1.53.0`（lightningcss 警告均为 layer.css 已知无害 IE hack）。
- `eslint src/`：0 errors / 0 warnings。
- `stylelint "src/styles/**/*.css"`：0 errors / 0 warnings。
- `check:version`：`OK (userscript 1.53.0 = package.json 1.53.0)`。
- `check:docs`：`OK (44 plugins [5 flagged], 70 core files)`。
- `check:structure`：`OK (431 files, 72 dirs within limits; 0 file-ceilings, 3 dir-ceilings in ratchet)`。
- `check:selectors`：`OK (81 files, 241 literals)`。
- `vitest run`：8 个测试文件 103 项用例全部通过（含新增 `tests/missav-vlt-and-saved.test.ts` 11 项与 `tests/missav-status-filter-ui.test.ts` 三栏交集回归）。

### 前端或调用方验证
- 使用 `chrome-devtools` MCP 对离线高保真 MissAV 暗色列表页进行 1280×720 与 375×812 双视口截图审查：
  - 顶部三栏无框筛选栈在桌面端经 `subgrid` 垂直对齐标签与芯片左缘，移动端 375px 自动折叠为标签置顶单列堆叠；
  - 卡片底部独立区位于标题下方不侵入视频封面，左侧玫瑰红心形 `MissAV` 徽标与右上角蓝色 JavDB 徽标清晰区隔，右侧多清单胶囊呈现横向溢出渐隐提示，无数据卡片以暗色 `—` 占位保持整行齐平。

### 验证结论
- 构建、类型、静态规范、结构/版本/文档/选择器门禁、103 项自动化测试与双视口视觉审查全部通过。

### 已知限制
- 本机隔离模式 `chrome-devtools` MCP 无用户 MissAV 登录态，未直接在线访问 `https://missav.ws/cn/saved` 实抓真实账号分页；详情页收藏按钮与收藏页解析规则均严格锚定用户提供的实时登录态 DOM 输出，待用户更新安装 v1.53.0 后在真实站点做端到端复核。
