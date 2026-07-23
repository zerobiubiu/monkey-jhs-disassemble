# doc/135 — 版本化数据迁移 + 健壮性修复

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

原 main.tsx 启动序列在每次打开 JavDB 页面时串行执行 6 个历史数据迁移方法：

```typescript
await storageManager.merge_table_name();        // 6 旧键检查 + 6 removeItem
await storageManager.clean_no_url_blacklist();   // 读黑名单番号 + 黑名单演员
await storageManager.async_merge_other();        // 读设置 + 检查 19 个废弃字段
await storageManager.merge_blacklist();          // 遍历黑名单演员 + 关联番号
await storageManager.merge_favoriteActress();    // 遍历全部收藏演员
await storageManager.merge_tow_car_list_table(); // 遍历黑名单番号 + 完整 car_list
```

即使数据早已迁移完成，每次启动仍执行全部检查。最严重的是
`merge_tow_car_list_table()` 会读取并深拷贝完整 `car_list`（可达 5.5 万条），
执行 `JSON.stringify + JSON.parse + .map()` 全量扫描。

### 正确性风险

1. **冻结对象修改**：`getBlacklistCarList()`/`getCarList()` 在 `storageCacheDeepCopy`
   开启时返回 `deepFreeze(copyObj(...))`，但迁移方法直接修改返回的对象
   （`item.starId = ...`、`delete item.actress`），严格模式下抛 TypeError。
2. **缓存未失效**：`merge_tow_car_list_table()` 写入 IDB 后未清理 `cacheCarList`，
   当前页面继续读取迁移前的旧缓存。
3. **首条记录启发式**：`clean_no_url_blacklist()` 用 `!blacklistCars[0].actress`
   判断迁移状态，混合数据（第一条已迁移、后续未迁移）会错误跳过。
4. **无错误隔离**：任一迁移抛异常会阻止 `processPlugins()`，所有插件不启动。

## 方案

### 版本化迁移

新增 `__jhs_schema_version` 键（存储在同一个 localforage 数据库中，
随备份/导入/清空一起管理）：

| 目标版本 | 迁移内容 |
|---------|---------|
| 0 → 1 | 六个旧表名迁移到新键名 |
| 1 → 2 | 清理无 URL 或失去演员关联的旧黑名单番号 |
| 2 → 3 | 删除旧设置字段及 downPath115 |
| 3 → 4 | 黑名单 isActor→role，补全 starId/allName/movieType |
| 4 → 5 | 收藏演员 dbId→starId |
| 5 → 6 | 番号记录 actress→names |

`runMigrations()` 入口：

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

三个原则：
1. 版本号只在迁移成功后更新
2. 每步可安全重复执行（幂等）
3. 数据写入成功但版本号写入失败时，下次执行不破坏已迁移数据

### 冻结对象修复

4 个迁移方法改为直接 `this.forage.getItem(key)` 读取原始数据，
绕过 `deepFreeze(copyObj(...))` 路径。

### 缓存失效修复

每个迁移方法写入 IDB 后清理对应的运行时缓存字段。
`runMigrations()` 末尾统一清理全部 4 个缓存。

### main.tsx 简化

```typescript
// 之前：6 个串行 await
if (isJavdbSite) {
    await storageManager.runMigrations();  // 之后：1 个调用
}
```

### 健壮性修复（15 处）

| 文件 | 修复 |
|------|------|
| preview-video-plugin.tsx (3处) | JSON.parse try-catch |
| screenshot-plugin.ts (1处) | JSON.parse try-catch |
| setting-plugin.tsx (3处) | querySelector null guard + parseInt radix/NaN |
| new-video-plugin.tsx (1处) | actress undefined guard |
| common-util.ts (3处) | .catch() + parentNode?. + NaN guard |
| logger.tsx (1处) | .catch() |
| main.tsx (1处) | autoBackup .catch() |
| api.ts (1处) | localStorage null → '' |
| fc2-by-123av-plugin.ts (1处) | parseInt NaN → 1 |

## 实施（修改文件清单）

| 文件 | 操作 |
|------|------|
| `src/core/storage-manager.ts` | 修改：runMigrations + 4 方法冻结/缓存修复 |
| `src/main.tsx` | 修改：6 调用 → 1 调用 + autoBackup .catch() |
| `src/plugins/preview-video-plugin.tsx` | 修改：3 处 JSON.parse try-catch |
| `src/plugins/screenshot-plugin.ts` | 修改：1 处 JSON.parse try-catch |
| `src/plugins/setting-plugin.tsx` | 修改：3 处 null 安全 |
| `src/plugins/new-video-plugin.tsx` | 修改：1 处 undefined guard |
| `src/core/common-util.ts` | 修改：3 处健壮性 |
| `src/core/logger.tsx` | 修改：1 处 .catch() |
| `src/constants/api.ts` | 修改：1 处 null 处理 |
| `src/plugins/fc2-by-123av-plugin.ts` | 修改：1 处 NaN 兜底 |

## 执行验证记录

```
$ bun run build
tsc -b && vite build
✓ 222 modules transformed.
dist/monkey-jhs-disassemble.user.js  2,000.32 kB │ gzip: 461.46 kB
✓ built in 1.16s
```

tsc 零错误。

## 预期收益

| 收益 | 说明 |
|------|------|
| 减少 IndexedDB 调用 | 后续启动从 ~12 次历史检查缩减为 1 次版本读取 |
| 消除重复全量扫描 | 不再为检查旧字段遍历 5.5 万条番号 |
| 减少深拷贝 | 避免启动阶段额外 JSON.stringify + JSON.parse |
| 更早启动插件 | 列表过滤和详情页工具不再等待无效迁移 |
| 迁移可靠性 | 失败重试、逐步版本记录、多标签页互斥 |

## 后续热点

完成版本化迁移后，下一个热点是 `CarListReaderPlugin` 每页 2s 后的全量同步
（读取 + 深拷贝 5.5 万条 → 列存 → gzip → GM_setValue），应改为 revision 门控。
