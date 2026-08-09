# 阶段 07：架构审计、类型安全、数据迁移与 Runtime V2（doc/130—148）

> **文档类型**：📄 参考说明（历史文档融合）
> **文档状态**：✅ 已执行（融合）
> **阶段范围**：doc/130 — doc/148（19 份历史文档）
> **合并说明**：本文件由 doc/ 目录 19 份历史文档按时间线整合而成。删除过程性细节（构建命令输出、逐条验证步骤回放、产物大小记录、边缘情况穷举），保留背景/根因、方案与关键决策、实施要点、结果、演进链与遗留问题。原文细节与数字以各 doc/NN 为准，本文不新增原文未含的事实。
> **替代文档**：doc/130—148 共 19 份（合并后原文件删除）
> **前置文档**：doc/130 之前的历史阶段文档

## 阶段概览

本阶段是"架构升级"密集期：先以六维度架构审计清理真实 bug（130-131），建立 PluginMap 类型注册表与 (window as any) 归零的类型安全体系（132-134），随后完成版本化数据迁移（135）、安全边界加固与 AES-GCM 备份加密（136-138）、Runtime V2 基础设施及资源密集型插件全量收编（139-143）、StorageRevision 跨标签页缓存失效（144），最后补齐无障碍样式、GM API 类型化与 ESLint/Stylelint 工具链（145-148）。每轮均以 `tsc -b && vite build` 零错误为门禁，最终建立 tsc + ESLint + Stylelint 三重门禁，并同步 AGENTS.md 架构文档。

### 时间线索引

| doc | 主题 | 归属章节 |
|-----|------|---------|
| 130 | 六维度架构审计与正确性修复 | §1.1 |
| 131 | 第二轮：死代码/日志工厂/竞态守卫/类型收窄 | §1.2 |
| 132 | 类型安全插件注册表 + 插件诊断菜单 | §2.1 |
| 133 | (window as any) 清扫 + 诊断模块提取 + 设置面板诊断 | §2.2 |
| 134 | (window as any) 归零 + 诊断耗时统计 | §2.2 |
| 135 | 版本化数据迁移 + 15 处健壮性修复 | §3 |
| 136 | 安全边界加固 | §4.1 |
| 137 | AES-GCM 备份加密 V2 | §4.2 |
| 138 | 全量同步版本门控 | §4.3 |
| 139 | Runtime V2 基础设施 | §5.1 |
| 140 | 插件 pageTypes 声明迁移 | §5.2 |
| 141 | TaskSupervisor 迁移（5 插件） | §5.3 |
| 142 | TaskSupervisor 全量完成（9 插件）+ ListDomBus | §5.3 |
| 143 | 分页状态机 + 预加载去重/LRU | §5.4 |
| 144 | StorageRevision 跨标签页缓存失效 | §6 |
| 145 | 无障碍样式 + GM API 类型化 + package 同步 | §7.1 |
| 146 | AGENTS.md 架构文档同步 + 一致性修复 | §7.2 |
| 147 | 设计令牌 + ESLint 工具链 + transition:all 清理 | §7.3 |
| 148 | Stylelint 工具链 + AGENTS.md 工具链同步 | §7.4 |

## 1. 架构审计与正确性修复（130—131）

### 1.1 六维度架构审计（doc/130）

**背景/根因**：对项目做专业架构级深度审计，从 6 个维度并行扫描（并发竞态、DOM/事件/观察者生命周期、数据完整性、网络与错误处理、类型安全、死代码与结构债务），共发现 60 条 findings。经逐条对抗性验证（对照 archetype 源码、feature-flags 归属、实际代码行号），筛选出 5 类可安全修复的真实 bug——全部为项目自引入代码（非 archetype 保真逻辑），修复后正常路径行为零变化。

**方案与决策（5 类修复）**：

1. **StorageManager 缓存失效缺失（critical）**：`removeCar`/`batchRemoveCars`/`removeFavoriteActress` 写入 IDB 后未更新运行时缓存字段，`storageCacheDeepCopy` 开启时后续 `getCarList()` 返回已删除的幽灵记录 → 与 `addCar`/`upsertCar` 模式一致补缓存同步。
2. **MagnetHub 无超时 + 竞态（high）**：GM_xmlhttpRequest 缺 timeout/ontimeout（服务器接受连接但不响应时请求永久挂起）；快速切换引擎 tab 时旧请求响应覆盖新结果 → 加 `timeout: 15000` + ontimeout 处理器，类字段 `_searchSeq` 递增序列号，回调中守卫 `if (seq !== this._searchSeq) return;` 丢弃过期响应。
3. **JSON.parse 无 try-catch（high）**：list-page-plugin 类字段初始化器、other-site-plugin 7 处、actress-info-plugin 2 处，损坏的 localStorage 缓存可导致插件构造/方法崩溃 → 全部包裹 try-catch，损坏值回退空对象。
4. **Translate 无超时（medium）**：裸 fetch() 无 AbortController，API 无响应时「翻译中...」永久挂起 → 加 AbortController + 10s setTimeout，catch 区分 AbortError（翻译超时）与其他错误。
5. **删除 VideoTitleSpan 死亡组件**（零 import、零引用）。

**实施要点**：storage-manager.ts、magnet-hub-plugin.ts、list-page-plugin.tsx、other-site-plugin.tsx、actress-info-plugin.tsx、translate-plugin.ts 修改；`src/components/video-title-span.tsx` 整文件删除。

**审计中确认安全的项（不修）**：processPlugins 每插件独立 try/catch（Promise.all 永不 reject）；getBean 调用在用户交互回调中（此时 handle 已完成）；doFilter 并发最终状态一致（status-tag 注入幂等）；StatusTagFilter mountDebounce 竞态为误报（debounce 与 timeout 路径互斥）；GM_addValueChangeListener 返回值无需存储（油猴脚本生命周期 = 页面生命周期）；HitShow `while(!hasFocus())` 无限轮询与 archetype L4653 相同模式 → 忠实保真不修。

**遗留未修复项**：

| 类别 | 内容 | 原因 |
|------|------|------|
| 忠实保真 | HitShow 无限轮询、Beyond60Plugin 引用 | archetype 相同模式/死路径 |
| 不可观测 | WebDav deleteFile 的 encodeURI 不一致 | 文件名均 ASCII，encodeURI 是 no-op |
| 类型增强 | BasePlugin.getBean() 返回 any、globals.d.ts 全 any | 零运行时变化，后续优化 |
| 结构债务 | api.ts 10/11 属性未使用、car-status-sync 日志函数重复 | 后续优化 |
| 性能/健壮性 | ModalListDisabler body subtree observer、visit-history 跨标签竞态、Fc2By123Av/ImageRecognition 竞态 | 功能正确或影响轻微 |

**演进链**：doc/131 承接其中可安全执行的 4 项；类型增强由 doc/132-134 落地；api.ts 与日志工厂由 doc/131 清理。

### 1.2 第二轮：死代码、日志工厂、竞态守卫与类型收窄（doc/131）

**背景**：对 doc/130「未修复项」中可安全执行的 4 项做第二轮优化，全部为纯重构/防护，不改变用户可见行为。

**方案与决策**：

1. **api.ts 死代码清理**：删除 `removeSignature`/`searchMovie`/`getMagnets`/`login`（top250-plugin 内联了自己的登录逻辑、fc2-plugin 内联了磁链请求）；移除 `RequestHeaders` 接口与 `DEFAULT_REQUEST_HEADERS` 的 export（仅文件内部使用）；javDbApi 12 个属性中仅 `markDataListHtml` 被外部访问（fc2-by-123av-plugin），其余 11 个零访问全移除；保留 `MovieDetail`/`RelatedCollection` 接口（函数返回类型文档价值）与所有被外部 import 的函数。
2. **car-status 日志工厂提取**：car-list-reader-plugin 与 missav-status-tag-plugin 各自定义了结构相同的 4 个日志函数（logInfo/logOk/logWarn/logErr，仅前缀不同）→ 新建 `car-status-sync/car-status-logger.ts`：`CarStatusLogger` 接口 + `createLogger(prefix)` 工厂；两个插件删除各自定义改为工厂调用，控制台输出格式统一为 car-list-reader 版。
3. **Fc2By123Av 竞态守卫**：`handleQuery()` 有 3 个 fire-and-forget 调用点（搜索/排序/分页）→ 类字段 `_querySeq`，fetch 之后、任何状态变更（maxPage）与 DOM 写入之前守卫，与 MagnetHub 的 `_searchSeq` 模式一致（doc/130）。
4. **base-plugin.ts 类型收窄**：`CarInfo` 与 `SelectorConfig` 零外部 import，去 export 收窄为模块内部类型。

**排除项**：visit-history formatDate 去重（`utils.formatDate` 返回含时间部分，格式不等价）；ModalListDisabler 页面守卫（详情页需要该插件，加守卫会破坏功能）；ImageRecognition isUploading 竞态（已有守卫，仅 UX 级影响）。

**结果**：tsc 零错误；产物 -1.87 kB（死代码删除 > 日志工厂新增）。

## 2. 类型安全工程（132—134）

### 2.1 类型安全插件注册表与诊断菜单（doc/132）

**背景/根因**：doc/130 审计发现 `BasePlugin.getBean()` 返回 `any` 是类型安全的核心盲区——66 处 getBean 调用全部丧失类型检查，方法名拼写错误、参数类型不匹配等在编译期完全不可见。

**方案与决策**：

- **PluginMap 类型注册表**：新建 `src/plugins/plugin-registry.ts`，40 个插件名 → 具体类的 `import type` 映射（全部 `import type`，编译后完全擦除，零运行时开销）：

  ```typescript
  export interface PluginMap {
      ActressInfoPlugin: ActressInfoPlugin;
      AutoPagePlugin: AutoPagePlugin;
      // ... 40 个插件名 → 具体类映射
  }
  ```

  `PluginManager.getBean` 泛型化：`getBean<K extends string>(name: K): K extends keyof PluginMap ? PluginMap[K] : BasePlugin | undefined`——已知插件名返回精确非空类型，未知名称（如 Beyond60Plugin）返回 `BasePlugin | undefined`。`BasePlugin.getBean` 同步泛型化委托 PluginManager。
- **时序诊断**：`registrationComplete` 标记在 `processCss()` 开始前置 true，之后 getBean 未命中时 console.warn 输出诊断（注册阶段不 warn，因为插件尚未全部注册）。
- **插件诊断菜单**：main.tsx 启动序列末尾注册 `GM_registerMenuCommand('📊 插件诊断')`；读取 `pluginManager.getDiagnostics()`（注册数 + CSS/handle 结果数组），layer.open 弹窗表格（状态图标 ✅/❌/⏭️ + 插件名 + 执行结果 + 标题总数/失败数）。PluginManager 增强：`processCss()`/`processPlugins()` 返回 `Plugin[]`（原 void）、内部存储 lastCssResults/lastHandleResults、新增 getDiagnostics()。
- **暴露并修复 6 个预存类型错误**（去 any 后被曝光）：

  | 文件 | 错误 | 修复 |
  |------|------|------|
  | auto-page-plugin.ts / blacklist-plugin.tsx | Beyond60Plugin 方法不在 BasePlugin 上 | 类型断言为交叉类型（忠实死路径） |
  | detail-page-button-plugin.tsx | `carNum: string \| null` 传给 string 参数 | `carNum ?? ''` |
  | fc2-by-123av-plugin.ts | `getAv123Url` 不存在于 OtherSitePlugin | 移除死调用，直接用默认域名 |
  | preview-video-plugin.tsx | `favoriteOne(event)` 多传参数（签名无参） | 移除多余参数 |

**设计决策**：所有 40 个插件在 main.tsx 无条件注册，已知名 getBean 的条件类型直接解析为非空，无需 `!` 或 `?.`；Beyond60Plugin（从未注册）保持 `if` 守卫 + 类型断言；诊断菜单复用 layer.open 弹窗基础设施，无需额外 CSS。

**结果**：产物 +1.52 kB（注册表类型擦除零开销，增量为诊断菜单 UI 代码）。

### 2.2 (window as any) 清扫与诊断面板完善（doc/133—134）

**背景/根因**：doc/132 后项目中仍有 56 处 `(window as any).` 断言。其中 40 处是页面标志（isDetailPage/isListPage/isFc2Page）与全局函数（cleanCache_*/filetreeDb/showImageViewer）的访问——这些属性已在 main.tsx 的 Window 接口中声明精确类型，断言完全多余且绕过类型检查。同时 doc/132 的插件诊断 UI 内联在 main.tsx（25 行 layer.open + HTML 模板），不符合入口文件职责边界。

**doc/133 方案**：

1. **40 处直接替换**：`(window as any).isDetailPage` → `window.isDetailPage`（~15 处）、isListPage（~10）、isFc2Page（~2）、cleanCache_*（2）、clean_cacheSettingObj（2）、filetreeDb（1）、showImageViewer（1）。剩余 16 处（不在 Window 接口中）：libs.ts 库挂载、layer-wrapper.ts 的 `utils?.layerIndexStack` 动态属性、setting-plugin.tsx 的 imageHoverPreviewObj/encryptCredential 等，单独评估。
2. **诊断模块提取**：新建 `src/core/plugin-diagnostics.ts`——`renderDiagnosticsHtml`（渲染状态表格 HTML）、`renderDiagnosticsText`（纯文本报告供剪贴板）、`registerDiagnosticsMenu`（GM_registerMenuCommand）。main.tsx 25 行内联代码收敛为 1 行调用。
3. **设置面板「📊 插件诊断」**：setting-dialog.tsx 侧栏新增菜单项（data-panel="diagnostics-panel"）+ 内容面板（#diagnostics-content 容器 + #copy-diagnostics-btn 复制按钮）；setting-plugin.tsx 的 bindClick 新增 diagnostics-panel 分支（隐藏 saveBtn/clean-all + 调用 refreshDiagnostics）、新增 refreshDiagnostics() 方法、绑定复制按钮（renderDiagnosticsText → `navigator.clipboard.writeText`）。

**doc/134 方案（16 → 0）**：

1. **Window 接口扩展**（globals.d.ts）：新增 8 个第三方库全局——jQuery/$/layer/Tabulator/Toastify/localforage/Viewer（any）+ `md5: (s: string) => string`。
2. **代码替换**：libs.ts（6 处 `window.X = ...`）、_jquery-global.ts、layer-wrapper.ts（2 处，CommonUtil 已有 layerIndexStack 字段）、setting-plugin.tsx（7 处，含 2 处多行拆分格式）。
3. **诊断耗时统计**：Plugin 接口新增 `durationMs?: number`；processPlugins() 用 `performance.now()` 记录每个插件 handle() 耗时；renderDiagnosticsHtml 新增「耗时」列 + 总耗时统计；renderDiagnosticsText 每行附耗时；新增 `escapeHtml` 防护（插件名含特殊字符时不破坏 DOM）。

**结果**：代码中 `(window as any)` 归零（grep 验证），tsc 零错误。

**演进链**：doc/132 建立注册表 → doc/133 清扫 56→16 并落地设置面板诊断 → doc/134 归零并补耗时统计。

## 3. 版本化数据迁移（doc/135）

**背景/根因**：原 main.tsx 启动序列在每次打开 JavDB 页面时串行执行 6 个历史数据迁移方法（merge_table_name / clean_no_url_blacklist / async_merge_other / merge_blacklist / merge_favoriteActress / merge_tow_car_list_table），即使数据早已迁移完成仍全量检查。最严重的是 `merge_tow_car_list_table()` 读取并深拷贝完整 car_list（可达 5.5 万条），执行 `JSON.stringify + JSON.parse + .map()` 全量扫描。

**正确性风险（4 项）**：

1. **冻结对象修改**：`getBlacklistCarList()`/`getCarList()` 在 `storageCacheDeepCopy` 开启时返回 `deepFreeze(copyObj(...))`，迁移方法直接修改返回对象（`item.starId = ...`、`delete item.actress`）→ 严格模式抛 TypeError。
2. **缓存未失效**：`merge_tow_car_list_table()` 写入 IDB 后未清理 `cacheCarList`，当前页面继续读取迁移前的旧缓存。
3. **首条记录启发式**：`clean_no_url_blacklist()` 用 `!blacklistCars[0].actress` 判断迁移状态，混合数据（第一条已迁移、后续未迁移）会错误跳过。
4. **无错误隔离**：任一迁移抛异常会阻止 `processPlugins()`，所有插件不启动。

**方案与决策**：

- **版本化迁移**：新增 `__jhs_schema_version` 键（存同一 localforage 数据库，随备份/导入/清空一起管理），6 步映射为版本 0→6：

  | 目标版本 | 迁移内容 |
  |---------|---------|
  | 0 → 1 | 六个旧表名迁移到新键名 |
  | 1 → 2 | 清理无 URL 或失去演员关联的旧黑名单番号 |
  | 2 → 3 | 删除旧设置字段及 downPath115 |
  | 3 → 4 | 黑名单 isActor→role，补全 starId/allName/movieType |
  | 4 → 5 | 收藏演员 dbId→starId |
  | 5 → 6 | 番号记录 actress→names |

  `runMigrations()` 核心循环（版本号只在迁移成功后更新，每步幂等，失败即 break 留待下次启动重试，末尾统一清理受影响缓存）：

  ```typescript
  async runMigrations(): Promise<void> {
      const run = async () => {
          let version = (await this.forage.getItem(SCHEMA_VERSION_KEY)) ?? 0;
          if (version >= CURRENT_SCHEMA_VERSION) return;
          for (const step of steps) {
              if (version >= step.target) continue;
              try {
                  await step.fn();
                  await this.forage.setItem(SCHEMA_VERSION_KEY, step.target);
                  version = step.target;
              } catch (err) {
                  clog.error(`数据迁移 ${version}→${step.target} 失败，下次启动重试`, err);
                  break;
              }
          }
          // 统一清理受影响的缓存
          this.cacheCarList = null;
          this.cacheFavoriteActressList = null;
          this.cache_filter_actor_actress_car_list = null;
          this.cacheSettingObj = null;
      };
      if (navigator.locks) {
          await navigator.locks.request('jhs-storage-migration', { mode: 'exclusive' }, run);
      } else {
          await run();
      }
  }
  ```

  三个原则：版本号只在迁移成功后更新；每步可安全重复执行（幂等）；数据写入成功但版本号写入失败时，下次执行不破坏已迁移数据。
- **冻结对象修复**：4 个迁移方法改为直接 `this.forage.getItem(key)` 读取原始数据，绕过 `deepFreeze(copyObj(...))` 路径。
- **缓存失效修复**：每个迁移方法写入 IDB 后清理对应运行时缓存，`runMigrations()` 末尾统一清理全部 4 个缓存。
- **main.tsx 简化**：6 个串行 await → 1 次 `runMigrations()` 调用（仅 javdb 站点）。
- **15 处健壮性修复**：preview-video（3 处 JSON.parse try-catch）、screenshot（1）、setting（3 处 querySelector null guard + parseInt radix/NaN 兜底）、new-video（1 处 actress undefined guard）、common-util（3 处 .catch()/parentNode?./NaN guard）、logger（1 处 .catch()）、main（autoBackup .catch()）、api.ts（localStorage null → ''）、fc2-by-123av（parseInt NaN → 1）。

**结果/收益**：后续启动从 ~12 次历史检查缩减为 1 次版本读取（~1ms）；消除 5.5 万条全量扫描与启动期深拷贝；迁移可靠性提升（失败重试、逐步版本记录、多标签页互斥）。

**演进链与遗留**：doc/135 末尾预言下一个热点是 CarListReader 每页 2s 后的全量同步 → doc/138 落地为 revision 门控；存储正确性（导入原子性）部分由 doc/136 补全。

## 4. 安全加固与备份加密（136—138）

### 4.1 安全边界加固（doc/136）

**背景**：用户实施计划批次 1「安全与数据正确性热修复」的渲染与权限边界部分；存储正确性部分已在 doc/135 完成（版本化迁移 + 冻结修复 + 缓存失效）。

**方案与决策**：

1. **unsafeWindow 权限收窄**：原 main.tsx 将 12 个对象同时挂载到 `window` 和 `unsafeWindow`（页面 JS 可访问的全局对象），暴露 gmHttp（HTTP 客户端）、storageManager（IndexedDB 管理器）、encryptCredential/decryptCredential（加密函数）、pluginManager 给页面脚本是安全风险。改为仅保留页面功能必需的 3 个在 unsafeWindow 上：`utils`（页面可能调用 utils.openPage 等）、`loadGfriends`、`filetreeDb`；其余 6 个敏感对象（gmHttp、storageManager、WebDavClient、encryptCredential、decryptCredential、pluginManager）仅在沙箱 window。
2. **站点匹配精确化**：宽泛 include 子域名匹配 → match 仅官方域名精确匹配 + `noframes: true`：

  ```typescript
  // 之前：宽泛 include 匹配所有子域名
  include: ['https://javdb*.com/*', 'https://missav*.ws/*', 'https://missav*.live/*'],
  // 之后：仅官方域名精确匹配 + 禁止 iframe
  match: ['https://javdb.com/*', 'https://missav.ws/*', 'https://missav.live/*'],
  noframes: true,
  ```
3. **密码输入隐藏**：WebDAV 密码输入框 → `type="password"` + 👁 切换按钮。
4. **备份导入原子性**：原 `importData` 流程「clear() → 写入（失败时数据已丢失）」改为三阶段——验证（备份数据为对象、非 null、非数组）→ 暂存（写入临时 localforage 实例 `appData_import_staging`）→ 切换（清空主实例 → 复制暂存 → 删除临时实例）。失败时清理临时实例、主实例不变；成功后调用 `runMigrations()` 迁移老备份。
5. **附加存储白名单**：`applyBackupExtras` 新增白名单——`ALLOWED_LOCALSTORAGE_KEYS`（17 键，从 BACKUP_LOCAL_STORAGE_KEYS 派生）、`ALLOWED_GM_KEYS`（7 键，从 BACKUP_GM_KEYS 派生）；拆分为 `stripBackupExtras`（导入前剥离 __localStorage/__gmStorage）+ `applyBackupExtras`（导入成功后按白名单写回）。

**一致性审计结论**：命名一致性、导出风格（100% named export）、注释风格 ✅；遗留 3 项建议——catch 变量名/类型标注不统一（建议统一 `catch (err: unknown)`）、3 处 inline type 混用（建议独立 `import type`）、4-5 处非 fire-and-forget `.then()` 链（建议重构 async/await）。

### 4.2 AES-GCM 备份加密 V2（doc/137）

**背景/根因**：原备份加密是 Caesar 位移混淆（`webdav-crypto.ts`）：每个码点 +5/-5、固定 salt 前后包裹——不是真正的加密，任何人反向位移即可还原明文。WebDAV 凭据（URL/用户名/密码）明文存储在 settings 对象（IndexedDB），页面脚本可经 `storageManager.getSetting()` 读取。

**方案与决策**：

- **backup-crypto.ts**：AES-GCM 256 位（认证加密，防篡改）；PBKDF2-SHA-256 100,000 次迭代派生密钥；每次加密使用独立随机 salt（16 字节）+ IV（12 字节）；信封格式 BackupEnvelopeV2（v/alg/kdf/iter/salt/iv/ct/ts）。API：`encryptBackupV2(plaintext, password)` → 信封 JSON、`decryptBackupV2(envelopeJson, password)`（口令错误抛 DOMException）、`isBackupV2(content)` → 格式检测。
- **WebDAV 凭据迁移 GM 私有存储**：settings.webDavUrl/Username/Password → `GM_setValue('jhs_webdav_url'/'jhs_webdav_username'/'jhs_webdav_password')`，保存时自动 `delete` settings 中三个字段（一次性迁移）。
- **备份口令**：设置面板新增「备份口令」输入框（type=password + 👁 切换），存 `GM_setValue('jhs_backup_password')`；**永不写入备份文件**（凭据与数据分离）；新设备恢复时需重新输入口令。
- **导入流程 V2 优先、V1 兼容**：读取文件 → `isBackupV2?` 是则 decryptBackupV2 → JSON.parse；否则 decryptCredential（V1 Caesar）→ JSON.parse。本地导出：有口令时 V2 加密，无口令时明文 JSON（用户可能想直接查看）。

**安全属性对比**：

| 属性 | V1（Caesar） | V2（AES-GCM） |
|------|-------------|--------------|
| 算法强度 | 无（位移混淆） | AES-256-GCM |
| 密钥派生 | 无（固定 salt） | PBKDF2-SHA-256 100k 迭代 |
| 随机性 | 无 | 随机 salt + IV |
| 完整性校验 | 无 | GCM 认证标签 |
| 口令错误检测 | 无（静默输出乱码） | DOMException |
| 凭据存储 | IndexedDB 明文 | GM 私有存储 |

**结果**：产物 +5.71 kB（AES-GCM 模块 + 口令 UI）。

### 4.3 全量同步版本门控（doc/138）

**背景/根因**：`CarListReaderPlugin` 在每个 JavDB 页面加载后延迟 2s 无条件执行全量同步：读取 car_list（可达 5.5 万条）→ 深拷贝 → 转列存 → gzip → 写入数百 KB GM 存储。即使 car_list 零变化，每个页面仍执行全流程。项目已有增量推送机制（`carListChangeCallback` → `pushDelta` → `GM_setValue`），全量同步仅需在数据变更或兜底场景执行。

**方案与决策**：

- 新增 3 个 GM 存储键：`jhs_car_list_rev`（变更代号，每次 `pushDelta` 在 try 块末尾递增）、`jhs_car_status_synced_rev`（上次全量同步时代号）、`jhs_car_status_last_sync`（上次全量同步时间戳）。
- 门控逻辑：`needsSync = currentRev !== syncedRev || Date.now() - lastSyncTime > DAILY_SYNC_INTERVAL`，满足才延迟 2s 执行全量同步，否则跳过：

  ```typescript
  const currentRev = GM_getValue(GM_KEY_CAR_LIST_REV, 0);
  const syncedRev = GM_getValue(GM_KEY_SYNCED_REV, -1);
  const lastSyncTime = GM_getValue(GM_KEY_LAST_SYNC_TIME, 0);
  const needsSync =
      currentRev !== syncedRev || Date.now() - lastSyncTime > DAILY_SYNC_INTERVAL;
  if (needsSync) {
      setTimeout(() => this.syncFullCarStatus(), 2000);
  } else {
      logInfo('跳过全量同步', `数据未变更 (rev=${currentRev})`);
  }
  ```

  | 触发条件 | 说明 |
  |---------|------|
  | `currentRev !== syncedRev` | 数据有变更但尚未全量同步 |
  | 距上次同步超过 24h | 每日兜底（防增量丢失） |
  | 菜单手动触发 | GM_registerMenuCommand 不受门控限制 |
  | 首次安装 | syncedRev 默认 -1，必然触发 |

- 同步成功后记录 `syncedRev = 当前 rev` 与时间戳。

**结果**：无变更页面加载从「读取 + 深拷贝 55k 条 + 列存 + gzip + GM 写入」降为 1 次 `GM_getValue`（~0.1ms）。

**演进链**：doc/135 预言的整改落地；doc/144 将 revision 门控思想一般化为 StorageRevision 统一跨标签页修订号。

## 5. Runtime V2（139—143）

> 批次 3（Runtime V2，目标 v2.0.0）的完整实施。完整 40 插件迁移是多会话工作，本阶段建立基础设施并完成全部资源密集型插件收编。

### 5.1 基础设施（doc/139）

**背景**：批次 3 要求——新增 PageContext、RuntimeServices、PluginDefinition、TaskSupervisor；插件声明站点、页面类型、依赖、样式、启动和销毁函数；页面类型在 CSS 和插件初始化前确定，未匹配插件不实例化、不注入 CSS；后台 Promise、Observer、定时器和事件统一受 AbortSignal 管理。所有变更向后兼容（空 sites/pageTypes = 匹配所有，destroy() 默认空实现）。

**方案与决策**：

- **PageContext（core/page-context.ts）**：将 main.tsx 启动序列中散落的页面判定逻辑提取为独立模块。`detectPageContext()` 返回 site（'javdb' | 'missav' | 'unknown'）、pageType（'detail' | 'list' | 'fc2' | 'unknown'）及 isDetailPage/isListPage/isFc2Page/isJavdbSite/isMissavSite 布尔标志；`pageContext` 为全局单例；`initPageContext()` 由 main.tsx 调用一次。
- **TaskSupervisor（core/task-supervisor.ts）**：AbortSignal 统一生命周期管理：

  ```typescript
  class TaskSupervisor {
      get signal(): AbortSignal;
      setTimeout(fn, ms): number;                        // abort 时自动 clearTimeout
      setInterval(fn, ms): number;                       // abort 时自动 clearInterval
      observe(target, cb, opts): MutationObserver;       // abort 时 disconnect
      addEventListener(target, type, listener, opts): void;  // abort 时 remove
      abort(): void;                                     // 幂等，一次性清理所有资源
  }
  ```

  插件 opt-in 使用（不强制，向后兼容）：`private supervisor = new TaskSupervisor()`，handle() 中用 `this.supervisor.setTimeout/setInterval/observe/addEventListener` 替换原生 API，destroy() 中 `this.supervisor.abort()`。
- **BasePlugin 增强**：`get sites(): SiteType[]`（空 = 所有站点）、`get pageTypes(): PageType[]`（空 = 所有页面类型）、`destroy(): void`（默认空实现）。
- **PluginManager 增强**：`matchesPage(plugin)` 按 pageTypes 过滤；`processCss()`/`processPlugins()` 中不匹配当前 pageType 的插件返回 `{ status: 'skipped' }`，不执行 initCss/handle；`destroyAll()` 调用所有插件 destroy()。
- **main.tsx 启动序列重排**：`processCss → 页面判定 → 迁移 → processPlugins` → `页面判定 → processCss → 迁移 → processPlugins → beforeunload(destroyAll)`。页面判定先于 CSS 注入，使 PluginManager 在 CSS 注入时即可按 pageType 过滤；window.isDetailPage 等保持挂载（向后兼容）。

**结果**：产物 +1.25 kB（2 个新模块 + 过滤逻辑）。

**后续迁移路径**：① 逐插件添加 pageTypes 声明 → ② 逐插件将 setTimeout/MutationObserver 迁移到 TaskSupervisor → ③ 逐插件实现 destroy() → ④ 最终移除 window.isDetailPage 等全局标志，统一使用 pageContext。

### 5.2 插件 pageTypes 声明迁移（doc/140）

**背景**：doc/139 基础设施就绪，但 40 个插件的 pageTypes 均为空数组（匹配所有页面）。本轮为 19 个页面特定插件添加声明，使 processCss/processPlugins 按页面类型过滤。

**方案与决策（页面类型映射）**：

| 页面类型 | 插件 | pageTypes |
|---------|------|-----------|
| 详情页（9） | detail-page、detail-page-button、favorite-actresses、highlight-magnet、preview-video、review、screenshot、translate、visit-history | `['detail']` |
| 列表页（6） | auto-page、fold-category、list-page-button、list-page、page-sort、status-tag-filter | `['list']` |
| 混合（3） | other-site、list-reading-status、vlt | `['detail', 'list']` |
| 非详情页（1） | key-page-turning | `['list', 'fc2', 'unknown']` |
| 全局（21） | 其余插件（setting、blacklist、history、nav-bar、hit-show 等） | `[]`（匹配所有） |

> 注：doc/140 原文的「全局（21）」清单将 page-sort 与「列表页（6）」重复列出，属原文矛盾；按 9+6+3+1=19 的计数，page-sort 应归属列表页组。

**修改模式**：每个文件 2 处——① import `PageType`；② getName() 之后添加 getter：

  ```typescript
  import type { PageType } from '../core/page-context';
  // ...
  get pageTypes(): PageType[] {
      return ['detail'];  // 或 ['list'] / ['detail', 'list'] / ['list', 'fc2', 'unknown']
  }
  ```

**向后兼容**：handle() 中已有页面守卫（`if (!window.isDetailPage) return;`）保留不动——pageTypes 过滤是第一层防线，handle 内守卫是第二层，双层同时存在确保零行为偏差。

**结果**：详情页 40→31 插件执行 CSS+handle、列表页 40→34、其他页面 40→39。

### 5.3 TaskSupervisor 生命周期迁移（doc/141—142）

**背景**：doc/139 创建 TaskSupervisor、doc/140 完成 pageTypes。分两轮将 9 个资源密集型插件从原生 setTimeout/MutationObserver/addEventListener 迁移到 TaskSupervisor，实现 destroy() 时一次性清理全部资源。

**迁移模式**：`private supervisor = new TaskSupervisor()` → 原生 API 逐一替换 → `destroy(): void { this.supervisor.abort(); }`。

**doc/141（5 个插件，首批）**：

| 插件 | 迁移的资源 | 保留的原有模式 |
|------|-----------|--------------|
| visit-history | setInterval(500ms) + pageshow/mouseenter/mouseleave/scroll/resize | forceRebind 的 removeEventListener（控制流需要） |
| auto-page | scroll/click addEventListener + 3× setTimeout | — |
| status-tag-filter | 2× MutationObserver + 3× setTimeout | clearTimeout 防抖逻辑 |
| page-sort | waitForContainer MutationObserver | sortGuard disconnect/reconnect（不兼容 supervisor 追踪，在 destroy() 中手动 disconnect） |
| other-site | 2× MutationObserver + 2× setTimeout | clearTimeout 防抖逻辑 |

**不迁移的资源**：jQuery `.on()` 事件绑定（jQuery 管理）、`GM_addValueChangeListener`（油猴 API）、`BroadcastChannel`（跨标签页通信）、page-sort 的 sortGuard（disconnect/reconnect 模式与 supervisor 追踪不兼容）。

**迁移中发现并修复 3 个类型问题**：status-tag-filter 移除 write-only `observer` 字段；visit-history `PageTransitionEvent` → `Event` + 内部 `as PageTransitionEvent` 断言；other-site 移除 write-only `preloadObserver` 字段 + debounce 类型 `null` → `0`。

**doc/142（4 个插件，完成剩余迁移）**：

| 插件 | 迁移的资源 |
|------|-----------|
| list-page | checkDom MutationObserver（保留 disconnect/reconnect 模式） |
| list-reading-status | MutationObserver + 7 个 addEventListener（svg click/mouseenter、container mouseleave、select change、chip click、sortSelect change、reset click） |
| modal-list-disabler | body MutationObserver（childList + subtree） |
| list-waterfall | scroll/click addEventListener + setTimeout |

**ListDomBus（core/list-dom-bus.ts）**：列表页 DOM 变更总线，集中管理 .movie-list 容器的 MutationObserver：

  ```typescript
  class ListDomBus {
      onItemsAdded(handler: (addedItems: Element[]) => void): void;
      offItemsAdded(handler): void;
      start(container: Element): void;
      stop(): void;
  }
  ```

  设计特点——**单 Observer**（替代各插件各自创建独立 Observer）；**rAF 批量分发**（新增节点累积到 pendingNodes，requestAnimationFrame 内一次性分发）；**片段支持**（瀑布流 append 整页 HTML 时自动提取片段内所有 .item）；**异常隔离**（一个 handler 失败不影响其他 handler）；**幂等 stop**。

**结果/总览**：累计 9 个插件完成 TaskSupervisor 迁移（doc/141 的 5 个 + doc/142 的 4 个），全部为资源密集型插件；其余 31 个插件以 jQuery .on() 为主（jQuery 管理生命周期），无原生 Observer/定时器/事件监听器需迁移。

**演进链**：doc/141 末尾列出后续候选（list-page、list-reading-status、modal-list-disabler、list-waterfall）→ doc/142 全部完成并新增 ListDomBus。

### 5.4 分页状态机与预加载去重（doc/143）

**背景**：批次 3 最后两个项目——① 瀑布流自动与手动加载共用分页状态机，保证有下一页时按钮持续存在；② 外站预加载增加 keyed 去重、负缓存、LRU 和容量限制。

**方案与决策**：

1. **PaginationStateMachine（core/pagination-state.ts）**：将 auto-page-plugin 散落的 `hasMore`/`isLoading` 布尔标志替换为正式状态机：

   ```
   idle ──startLoading()──→ loading ──loadSuccess(hasMore)──→ idle/exhausted
     ↑                         │
     │                    loadError()
     │                         ↓
     └──────retry()─────── error
   ```

   状态映射：idle+hasMore+auto（等待触底自动加载）、idle+hasMore+click（等待点击，waterfall-click）、loading（waterfall-loading）、error（可重试，waterfall-error）、exhausted（无更多页面，waterfall-no-more）。API：`init(hasMore)`/`startLoading(): boolean`（返回 false 表示不可加载）/`loadSuccess(hasMore)`/`loadError()`/`retry()` + `canLoad`/`hasMore`/`isLoading` 只读属性。auto-page 重构：移除布尔字段、14 处引用替换状态机调用、click handler 加 `retry()` 错误恢复、catch block 用 `loadError()` 替代 `hasMore = false`。
2. **外站预加载 keyed 去重**：other-site-plugin 新增 `inflightPreloads: Map<string, Promise<void>>`：

  ```typescript
  const dedupeKey = `${carNum}_${siteConfig.id}`;
  const existing = this.inflightPreloads.get(dedupeKey);
  if (existing) return existing;  // 复用 in-flight Promise
  const promise = this.doPreloadSite(carNum, siteConfig, $item);
  this.inflightPreloads.set(dedupeKey, promise);
  try { await promise; } finally { this.inflightPreloads.delete(dedupeKey); }
  ```

  原 preloadSite 方法体重命名为 `doPreloadSite`，新 preloadSite 作为去重包装。
3. **LRU 缓存淘汰**：`PRELOAD_CACHE_MAX = 5000`，写入缓存前检查条目数，超出时按 `ts` 排序淘汰最旧条目（无 `ts` 旧格式优先淘汰）。

**结果**：产物 +2.01 kB（状态机 + 去重/LRU 逻辑）。

**批次 3 完成总览**：139（PageContext + TaskSupervisor + 页面过滤 + destroy）→ 140（19 个插件 pageTypes 声明）→ 141（5 个插件 TaskSupervisor 迁移）→ 142（TaskSupervisor 全量完成 9 插件 + ListDomBus）→ 143（PaginationStateMachine + 预加载去重/LRU）。

## 6. StorageRevision 跨标签页缓存失效（doc/144）

**背景/根因**：批次 4（Storage V2）的基础设施。StorageManager 的运行时缓存（cacheCarList/cacheSettingObj/cache_filter_actor_actress_car_list）仅在写入标签页内更新，其他标签页的缓存在写入后仍为旧数据，直到收到 BroadcastChannel('channel-refresh') 消息或页面刷新。现有 'channel-refresh' 协议仅在特定操作（收藏/屏蔽/设置变更）时触发，不覆盖所有写入路径。StorageRevision 提供统一修订号机制，确保任何写入操作都能通知其他标签页失效缓存。

**方案与决策**：

- **StorageRevision（core/storage-revision.ts）**：

  ```typescript
  class StorageRevision {
      get current(): number;
      init(): void;                    // 创建 BroadcastChannel，监听远程修订号
      increment(): number;             // 递增修订号 + 广播
      onRemoteChange(cb): void;        // 注册远程变更回调
      destroy(): void;                 // 清理资源
  }
  export const storageRevision = new StorageRevision();
  ```

  设计特点——**不持久化**（每会话从 0 开始，仅用于跨标签页信号）；**排除自身**（senderId 过滤，不处理自己发出的广播）；**单调递增**（只接受比自己大的修订号防乱序）；**静默降级**（BroadcastChannel 不可用不影响功能）；**不替代现有协议**（'channel-refresh' 保持不变，StorageRevision 是额外信号）。
- **StorageManager 集成**：16 个写入方法在 forage.setItem 成功后调用 `storageRevision.increment()`——car_list（saveCar/updateCarInfo/saveCarList/removeCar/batchRemoveCars 5 个）、blacklist（addBlacklistItem/updateBlacklistItem/deleteBlacklistItem 3 个）、blacklist_car_list（batchSaveBlacklistCarList/removeBlacklistCarList 2 个）、favorite_actresses（addFavoriteActressList/removeFavoriteActress/updateFavoriteActress 3 个）、filter_keyword_title（saveTitleFilterKeyword 1 个）、setting（saveSetting 1 个）、importData（所有键循环结束后一次）。
- **main.tsx 启动序列**：所有站点（javdb + missav）初始化 `storageRevision.init()` + `onRemoteChange(() => 清 3 个运行时缓存)`。
- **不迁移 visit-history**：保持 localStorage（5000 条，同步读取保证 tooltip 即时渲染），异步 IDB 读取会引入可见延迟，不值得迁移。

**演进链**：doc/145 修复其跨会话缺陷（修订号每会话归零导致长运行标签页修订号远大于新标签页，见 §7.1）。

## 7. 无障碍、GM 类型化与工具链（145—148）

### 7.1 无障碍样式与 GM API 类型化（doc/145）

**背景**：批次 5（UI/UX V2）与批次 6（体积/类型/工具链）的基础项目，实施零运行时风险的基础设施改进。

**方案与决策**：

1. **无障碍基础样式（src/styles/accessibility.css）**：`:focus-visible` 键盘导航焦点环（`outline: 2px solid #5d87c2; outline-offset: 2px`）；`@media (prefers-reduced-motion: reduce)` 将动画/过渡时长压至 0.01ms、`scroll-behavior: auto !important`。main.tsx 通过 `injectCss` 全局注入。
2. **GM API 类型化（globals.d.ts）**：6 个 Tampermonkey Grant API 从 any 升级为精确类型——GM_xmlhttpRequest（`(details: GMXmlHttpRequestDetails) => { abort }`）、GM_openInTab（→ `{ close }`）、GM_setValue（string/number/boolean/object）、GM_getValue（泛型 `<T>(key, defaultValue?: T) => T`）、GM_addValueChangeListener（→ number）、GM_registerMenuCommand（→ number）；新增 `GMXmlHttpRequestDetails` 接口（method/url/headers/data/timeout/responseType/anonymous/fetch/nocache + 6 个回调）。类型化后修复 4 个调用点不匹配：common-util/top250 的 `insert: 0` → `insert: false`、backup-extra-storage 的 GM_setValue 值类型断言、globals.d.ts 的 `data` 类型扩展为 `Record<string, unknown>`。
3. **StorageRevision 跨会话修复**：修订号每会话从 0 开始（不持久化），长运行标签页的修订号可能远大于新标签页 → 改为**任何远程消息都触发缓存失效**（senderId 已排除自身），修订号仅作元数据（取 max 保持本地递增）。
4. **package.json 同步**：`version` 1.0.0 → 1.27.0（与 vite.config.ts 的 userscript 版本一致，一次性元数据同步）；`description` 更新为 JavDB Power Tools 品牌名。

**结果**：产物 +0.87 kB（accessibility.css + 类型声明零运行时开销）。

### 7.2 AGENTS.md 架构文档同步（doc/146）

**背景**：doc/130-145 完成大量架构变更（Runtime V2 基础设施、版本化迁移、StorageRevision、无障碍、GM 类型化），但 AGENTS.md 的架构描述仍停留在旧版本；代码一致性审计发现 15 处不一致，其中 2 处需修复。

**方案与决策**：

- **AGENTS.md §3.1 启动序列 14 → 17 步**：CSS 注入新增 accessibility.css；插件数 33 → 40（38 javdb + 2 missav）；**新增**「页面判定先于 processCss（initPageContext）」；processCss/processPlugins 按 pageTypes 过滤；6 个迁移调用 → `runMigrations()` 单次调用；**新增** storageRevision.init() + onRemoteChange()、registerDiagnosticsMenu()、beforeunload → destroyAll()。
- **AGENTS.md §3.2 插件系统**：BasePlugin 新增 `get sites()`/`get pageTypes()`/`destroy()`；PluginManager 新增 `matchesPage()`/`destroyAll()`、诊断含耗时。
- **代码一致性修复（2 处）**：top250-plugin 的 getName() 返回 `'Top250Plugin'`（对齐 PluginMap 键）；main.tsx 插件计数注释 35 → 40。
- **不修复项（审计误报/cosmetic）**：list-waterfall 的 pageTypes 声明是**误报**——该插件运行在 `/users/lists`（pageType = 'unknown'），声明 `['list']` 会导致插件被跳过，ALLOWED_PATHS 路径守卫是正确的过滤机制；catch 块变量命名混用（5 种风格）、私有方法 `_` 前缀 vs private、constants/site.ts camelCase（运行时计算值合理，区别于字面量常量）均不影响功能。

**结果**：产物无变化（纯注释/文档修改）。

### 7.3 设计令牌与 ESLint 工具链（doc/147）

**背景**：批次 5/6 基础项目——建立设计令牌词汇表、代码一致性工具链、清理 CSS 反模式。

**方案与决策**：

1. **设计令牌（src/styles/design-tokens.css）**：`:root` 定义 CSS 自定义属性，令牌值与项目实际调色板一致：

   | 类别 | 令牌 | 值 |
   |------|------|-----|
   | 主色 | `--jhs-color-primary` | `#5d87c2`（14 处硬编码的实际主色） |
   | 语义色 | success/warning/error/info | `#64bb69`/`#d7a80c`/`#de3333`/`#25b1dc` |
   | 中性色 | text/border/bg | `#363636`/`#e2e8f0`/`#fff` 等 |
   | 间距 | xs→2xl | 4px→24px |
   | 圆角 | sm→full | 4px→9999px |
   | z-index | dropdown→tooltip | 100→600（统一管理，避免超大 z-index 散落） |
   | 过渡 | fast/normal | 150ms/250ms ease |
   | 触控 | touch-target | 44px |

   令牌一致性说明：令牌值取自实际硬编码调色板；rating-bar.css 的 `--jhs-list-*` 命名空间使用 Bulma 默认蓝 `#3273dc`（4 处），是独立的列表强调色，与主色不同。main.tsx 在所有其他 CSS 之前注入（令牌对全局可用）。硬编码值迁移到令牌是增量后续工作。
2. **ESLint 工具链**：eslint.config.js（flat config）——`@eslint/js` recommended + `typescript-eslint` recommended、`@typescript-eslint/no-explicit-any: warn`（禁止新增 any，存量 warn）、`consistent-type-imports`（强制 import type）、`no-unused-vars`（忽略 `_` 前缀）、忽略 dist/archetype/node_modules。package.json 新增 `"lint": "eslint src/"` + 3 个 devDependencies。首次运行基线 852 problems（78 errors + 774 warnings，主要为 no-explicit-any 存量警告与 no-unused-vars 错误）；手动修复存量 15 处 prefer-const/no-useless-escape 后 ESLint 0 errors、806 warnings（no-explicit-any 存量，后续逐步消除，新增代码不允许引入 any）。
3. **CSS transition: all 清理**：12 个 CSS 文件 19 处 `transition: all` 替换为具体过渡属性（a-normal-buttons/back-to-top-button/common-toolbar/list-reading-status-plugin/list-waterfall-plugin/logger/new-video-plugin/preload-status-badge/rating-bar/setting-plugin/status-tag-filter-plugin/visit-history-tooltip），保留原 duration 与 timing-function，仅替换属性列表。

**结果**：tsc 零错误；ESLint 0 errors；`transition: all` 归零（grep 验证）。

### 7.4 Stylelint 工具链（doc/148）

**背景**：批次 6 的 CSS 一致性工具。doc/147 已建立 ESLint（TypeScript 一致性），本轮补充 Stylelint（CSS 一致性），并同步 AGENTS.md 中 doc/143-147 新增的工具链和样式信息。

**方案与决策**：

- **.stylelintrc.json**（stylelint-config-standard 基础）：禁用与项目风格冲突的规则（selector-class-pattern、custom-property-pattern、no-descending-specificity、vendor-prefix 相关等）；排除 dist/archetype/node_modules（layer-fix.css 已验证 lint 干净，无需排除）。
- **package.json**：新增 `"lint:css": "stylelint \"src/styles/**/*.css\""` + stylelint/stylelint-config-standard devDependencies。
- **自动修复**：`stylelint --fix` 修复 442 处——`rgba(r,g,b,a)` → `rgb(r,g,b,a)`（CSS Color Level 4 语法，渲染完全一致）、规则间空行格式化；无语义变更（已逐条验证 diff）。基线 0 errors（3 处不可自动修复的 deprecated 规则已禁用）。
- **AGENTS.md 工具链同步**：§3.1 CSS 注入枚举补充 `design-tokens`（最先注入）；§3.6 补充 design-tokens/accessibility 注入说明 + transition:all 清理记录；§3.7 补充 GM API 类型化说明（GMXmlHttpRequestDetails 接口）；§3.8 新增工具链节（build/lint/lint:css 三重门禁）；原 §3.8 PRODUCT.md 重编号为 §3.9。

**结果**：三重门禁全绿——tsc ✅ · ESLint 0 errors ✅ · Stylelint 0 errors ✅。

## 8. 演进链与遗留问题汇总

### 演进链（主要线索）

| 线索 | 路径 |
|------|------|
| 审计 → 修复 | doc/130（六维度审计）→ doc/131（承接未修复项） |
| 类型安全 | doc/132（PluginMap/诊断菜单）→ doc/133（window 清扫 + 诊断面板）→ doc/134（window 归零 + 耗时） |
| 数据正确性 | doc/135（版本化迁移）→ doc/136（导入原子性等安全边界）→ doc/138（同步 revision 门控） |
| 备份加密 | doc/137（AES-GCM V2，兼容 V1 Caesar） |
| Runtime V2 | doc/139（基础设施）→ doc/140（19 插件 pageTypes）→ doc/141/142（TaskSupervisor 9 插件 + ListDomBus）→ doc/143（状态机 + 预加载去重） |
| 跨标签页 | doc/144（StorageRevision）→ doc/145（跨会话修复） |
| 工具链 | doc/147（ESLint + 设计令牌）→ doc/148（Stylelint + AGENTS.md 同步） |
| 文档同步 | doc/146（AGENTS.md 补 doc/130-145）→ doc/148（AGENTS.md 补 doc/143-147） |

### 遗留问题

- **类型**：no-explicit-any 存量 806 warnings 待逐步消除（doc/147）；Window 接口中第三方库全局仍为 any（doc/134）。
- **样式**：硬编码颜色迁移到设计令牌是增量后续工作（doc/147）。
- **Runtime**：最终移除 window.isDetailPage 等全局标志、统一使用 pageContext（doc/139 后续路径）。
- **一致性**：catch 变量命名统一为 `catch (err: unknown)`、inline type 混用、非 fire-and-forget `.then()` 链重构 async/await（doc/136）。
- **忠实保真保留**：HitShow `while(!hasFocus())` 无限轮询、Beyond60Plugin 引用（doc/130）。
- **有意不迁移**：31 个插件以 jQuery .on() 为主无需迁移（doc/142）；visit-history 保持 localStorage 同步读取（doc/144）。