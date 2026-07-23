# doc/130 — 六维度架构审计与正确性修复

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

对项目进行专业架构级深度审计，从 6 个维度并行扫描（并发竞态、DOM/事件/观察者
生命周期、数据完整性、网络与错误处理、类型安全、死代码与结构债务），共发现 60 条
findings。经逐条对抗性验证（对照 archetype 源码、feature-flags 归属、实际代码行号），
筛选出 5 类可安全修复的真实 bug，全部为项目自引入代码（非 archetype 保真逻辑），
修复后正常路径行为零变化。

## 审计维度与关键发现

### 1. 并发竞态（AuditConcurrency）

- **H4 验证安全**：processPlugins() 每个插件独立 try/catch，Promise.all 永不 reject
- **H1 大部分安全**：getBean 调用在用户交互回调中，此时所有 handle() 已完成
- **doFilter 并发**：BroadcastChannel refresh 与 checkDom observer 可并发调用 doFilter，
  但 status-tag 注入是幂等的（先 remove 再 append），最终状态一致 → 非真实 bug
- **启动序列正确**：main.tsx L324-351 确认 processCss → 页面判定 → storage merge →
  processPlugins，无启动顺序竞态

### 2. DOM/事件/观察者生命周期（AuditDomLifecycle）

- StatusTagFilter mountDebounce 竞态：经验证为**误报**（debounce 与 timeout 路径
  互斥，单线程 JS 中 clearTimeout 阻止双触发）
- ModalListDisabler body subtree observer：性能隐患但功能正确（medium，不修）
- GM_addValueChangeListener 返回值未存储：油猴脚本生命周期 = 页面生命周期，
  无需移除（faithful）

### 3. 数据完整性（AuditDataIntegrity）

- **🔴 StorageManager 缓存失效缺失**（critical，已修复）：removeCar/batchRemoveCars/
  removeFavoriteActress 写入 IDB 后未更新运行时缓存字段，storageCacheDeepCopy flag
  开启时后续 getCarList() 返回已删除的幽灵记录
- WebDav encodeURI 不一致：deleteFile 用 encodeURI 但 backup 不用 → 经验证为
  **不可观测**（文件名均为 ASCII 时间戳/UUID，encodeURI 是 no-op）
- visit-history localStorage 跨标签页竞态：LRU 淘汰 last-write-wins，数据丢失
  可接受（medium，不修）

### 4. 网络与错误处理（AuditNetworkError）

- **🔴 MagnetHub 无超时**（high，已修复）：GM_xmlhttpRequest 缺少 timeout/ontimeout，
  服务器接受连接但不响应时请求永久挂起
- **🔴 MagnetHub 竞态**（high，已修复）：快速切换引擎 tab 时旧请求响应覆盖新结果
- **🔴 Translate 无超时**（medium，已修复）：裸 fetch() 无 AbortController，
  API 无响应时「翻译中...」永久挂起
- HitShow while(!hasFocus()) 无限轮询：archetype L4653 有相同模式 → **忠实保真，不修**
- Top250/HitShow 固定 1s 重试无退避：low，不修

### 5. 类型安全（AuditTypeSafety）

- **🔴 JSON.parse 无 try-catch**（high，已修复）：list-page-plugin 类字段初始化器、
  other-site-plugin 7 处、actress-info-plugin 2 处，损坏的 localStorage 缓存导致
  插件构造/方法崩溃
- BasePlugin.getBean() 返回 any：类型增强建议（零运行时变化），归入后续优化
- globals.d.ts 全部 any：类型增强建议，归入后续优化

### 6. 死代码与结构债务（AuditDeadCode）

- **VideoTitleSpan 死亡组件**（已删除）：零 import、零引用
- api.ts 6 个零引用导出 + javDbApi 聚合对象 10/11 属性未使用：结构债务，归入后续优化
- car-status-sync 日志函数复制粘贴：可提取共享工厂，归入后续优化
- 所有 32 个 CSS 文件均被引用，无孤立文件 ✓
- icons.ts 8 个 SVG 常量全部被引用 ✓

## 方案

### 修复 1：StorageManager 缓存失效（critical）

`src/core/storage-manager.ts`：removeCar/batchRemoveCars/removeFavoriteActress
写入 forage 后添加缓存同步（与 addCar/upsertCar/batchUpsertCars 模式一致）：

- removeCar L429: `this.cacheCarList = filtered;`
- batchRemoveCars L449: `this.cacheCarList = filtered;`
- removeFavoriteActress L694: `this.cacheFavoriteActressList = filtered;`

### 修复 2：MagnetHub 超时 + 竞态（high）

`src/plugins/magnet-hub-plugin.ts`：

- GM_xmlhttpRequest 添加 `timeout: 15000` + `ontimeout` 处理器
- 类字段 `_searchSeq` 递增序列号，onload/onerror/ontimeout 回调中守卫
  `if (seq !== this._searchSeq) return;` 丢弃过期响应

### 修复 3：ListPagePlugin JSON.parse 防护（high）

`src/plugins/list-page-plugin.tsx`：类字段初始化器 `cache` 的 JSON.parse
包裹 IIFE + try-catch，损坏值回退空对象。

### 修复 4：OtherSite/ActressInfo JSON.parse 防护（high）

`src/plugins/other-site-plugin.tsx`（7 处）+ `src/plugins/actress-info-plugin.tsx`（2 处）：
所有 `JSON.parse(localStorage.getItem(...))` 包裹 try-catch，损坏缓存回退空对象。

### 修复 5：Translate 超时 + 删除死亡组件（medium）

`src/plugins/translate-plugin.ts`：fetch 添加 AbortController + 10s setTimeout，
catch 区分 AbortError（翻译超时）与其他错误。

`src/components/video-title-span.tsx`：整文件删除（零引用死亡组件）。

## 实施（修改文件清单）

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/core/storage-manager.ts` | 修改 | 3 处删除方法添加缓存同步 |
| `src/plugins/magnet-hub-plugin.ts` | 修改 | timeout + 竞态守卫 |
| `src/plugins/list-page-plugin.tsx` | 修改 | JSON.parse try-catch |
| `src/plugins/other-site-plugin.tsx` | 修改 | 7 处 JSON.parse try-catch |
| `src/plugins/actress-info-plugin.tsx` | 修改 | 2 处 JSON.parse try-catch |
| `src/plugins/translate-plugin.ts` | 修改 | fetch AbortController 超时 |
| `src/components/video-title-span.tsx` | 删除 | 零引用死亡组件 |

## 执行验证记录

```
$ bun run build
tsc -b && vite build
✓ 220 modules transformed.
dist/monkey-jhs-disassemble.user.js  1,994.65 kB │ gzip: 459.86 kB
✓ built in 1.44s
```

tsc 零错误，vite build 成功。产物 +1.16 kB（try-catch/timeout/竞态守卫增量）。

## 未修复项（归入后续优化）

| 类别 | 内容 | 原因 |
|------|------|------|
| 忠实保真 | HitShow while(!hasFocus()) 无限轮询 | archetype L4653 相同模式 |
| 忠实保真 | Beyond60Plugin 引用 | archetype 相同死路径 |
| 不可观测 | WebDav encodeURI 不一致 | ASCII 文件名 encodeURI 是 no-op |
| 类型增强 | BasePlugin.getBean() 返回 any | 零运行时变化，后续优化 |
| 类型增强 | globals.d.ts 全部 any | 零运行时变化，后续优化 |
| 结构债务 | api.ts 10/11 属性未使用 | 需评估是否保留 API 聚合设计 |
| 结构债务 | car-status-sync 日志函数重复 | 可提取共享工厂 |
| 性能 | ModalListDisabler body subtree observer | 功能正确，性能可接受 |
| 健壮性 | visit-history localStorage 跨标签页竞态 | LRU last-write-wins 可接受 |
| 健壮性 | Fc2By123Av/ImageRecognition 竞态 | 低频操作，影响轻微 |

## 后续验证建议

1. 在 JavDB 列表页执行收藏→取消收藏→刷新，确认 status-tag 不显示幽灵记录
2. 在详情页打开磁力搜索面板，快速切换引擎 tab，确认无错误结果闪现
3. 在控制台执行 `localStorage.setItem('jhs_translate', '{invalid')` 后刷新列表页，
   确认插件正常加载
4. 断开网络后触发翻译，确认 10s 后显示「翻译超时」而非永久挂起
