# 111 - 预加载面板加强 + 缓存去重优化

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 1. 背景

doc/110 上线「⚡ 预加载配置」面板后用户两点反馈：

1. **设置不够详细，需要进一步加强**：面板配置项偏少、说明偏简。
2. **第三方站点缓存与预加载是同一缓存，需优化**：doc/110 在预加载面板加了
   「清理预加载缓存」按钮清 `jhs_other_site`，而「缓存管理」面板的
   `cacheItems` 本就含 `{ key:'jhs_other_site', text:'🌍 第三方站点缓存' }`
   （setting-plugin.tsx:134），两处清理同一缓存——重复且令人困惑。

## 2. 方案

### 2.1 缓存去重优化（消除重复清理动作）

- 预加载面板**移除**「清理预加载缓存」按钮（不再重复缓存管理面板的清理动作）。
- 改为**只读缓存状态**展示（`#preload-cache-stats`）：总数 + MissAv/SupJav 分站
  计数 + 占用，切到该面板时 `refreshPreloadCacheStats()` 刷新（镜像 cache-panel
  切换时调 `refreshAllCacheStats`）。
- 面板内文案指明「此缓存即『缓存管理』面板的『第三方站点缓存』，清理请前往该面板」，
  明确二者关系，消除困惑。
- 清理动作唯一入口回归「缓存管理」面板（`jhs_other_site` 仍在 `cacheItems`，
  clean-all / clean-btn 覆盖）。

### 2.2 新增「预加载缓存有效期」配置（preloadCacheTTL，加强）

新增设置项 `preloadCacheTTL`（天数，0=永不过期，缺省 0）。命中缓存超过此天数
视为过期，下次打开列表页重新预加载，平衡新鲜度与请求量。

实现：缓存条目写入时附 `ts: Date.now()` 时间戳；读取处统一经新方法
`isCacheEntryValid(entry)` 判定——TTL=0 永久有效、旧条目无 ts 视为有效（向后
兼容）、有 ts 且未过期才有效。涉及 5 处缓存读/写：

| 位置 | 文件:行 | 改动 |
|------|---------|------|
| handleSite 读（详情页命中回填） | other-site-plugin.tsx | `if(cachedResult)` → `if(isCacheEntryValid(cachedResult))` |
| handleSite 写（详情页命中存缓存） | other-site-plugin.tsx | `cache[k]=resultData` → `{...resultData, ts:Date.now()}` |
| preloadListPage 跳过 | other-site-plugin.tsx | `if(cache[k])` → `if(isCacheEntryValid(cache[k]))` |
| preloadSite 写（列表页命中存缓存） | other-site-plugin.tsx | `cache[k]=resultData` → `{...resultData, ts:Date.now()}` |
| syncAllBadges 已缓存→成功徽标 | other-site-plugin.tsx | `if(cache[k])` → `if(isCacheEntryValid(cache[k]))` |

`preloadCacheTTLDays` 字段在 `handle()` 列表页分支读取（`getSetting('preloadCacheTTL',0)`，
`Number() \|\| 0`，0=永不过期）。

### 2.3 加强说明文案

各配置项 `data-tip` help 文案细化（防抖/有效期/状态显隐/站点选择的用途与影响），
TTL 项给出「建议 7-30 天」参考。

## 3. 实施

### 修改文件

| 文件 | 改动 |
|------|------|
| `src/components/setting-dialog.tsx` | 预加载面板：preloadDebounce 后新增 preloadCacheTTL 数字输入 + help；清理按钮块改为只读 `#preload-cache-stats` 状态 + 指向缓存管理面板的文案 |
| `src/plugins/setting-plugin.tsx` | loadForm 加载 preloadCacheTTL + 调 refreshPreloadCacheStats；bindClick 删 clear-preload-cache-btn 绑定、新增 `else if(preload-panel)` 切换时刷新统计；saveForm 收集 preloadCacheTTL；新增 refreshPreloadCacheStats 方法（getCacheStats + 分站计数） |
| `src/plugins/other-site-plugin.tsx` | 新增 preloadCacheTTLDays 字段 + isCacheEntryValid 方法；handle 读取 preloadCacheTTL；5 处缓存读/写改用 isCacheEntryValid / 附 ts |
| `vite.config.ts` | version 1.16.0→1.16.1 |
| `doc/README.md` | 文档清单新增 doc/111 |
| `changelog/CHANGELOG.md` | 新增 v1.16.1 条目 |

## 4. 执行验证记录

### 4.1 类型检查 + 构建

```bash
$ npx tsc -b            # 通过
$ npx vite build        # 1,902.93 kB / gzip 437.82 kB；@version 1.16.1
```

### 4.2 产物含新元素

`dist` 检索 `preloadCacheTTL`/`preload-cache-stats`/`refreshPreloadCacheStats`/
`isCacheEntryValid` 共 16 处命中。

## 5. 后续验证建议

1. **缓存去重**：预加载面板无清理按钮，显示「共 N 条（MissAv X / SupJav Y）｜占用」；
   清理仅在「缓存管理」面板的「第三方站点缓存」
2. **TTL 生效**：设 preloadCacheTTL=1 → 保存 → 手动把某条缓存 ts 改为 2 天前 →
   刷新列表页 → 该 item 重新预加载（徽标走 排队中→请求中→终态）
3. **TTL=0 永久**：缺省 0 → 缓存永不过期（与改动前行为一致，向后兼容）
4. **统计实时**：切到预加载面板即刷新统计；清理缓存后切回该面板计数归零
5. **详情页一致**：详情页命中缓存仍在有效期才直接变绿，过期则重新探测
