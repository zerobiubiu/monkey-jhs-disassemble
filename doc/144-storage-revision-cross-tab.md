# doc/144 — StorageRevision 跨标签页缓存失效

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

批次 4（Storage V2）的基础设施。当前 StorageManager 的运行时缓存
（cacheCarList/cacheSettingObj/cache_filter_actor_actress_car_list）
仅在写入标签页内更新。其他标签页的缓存在写入后仍为旧数据，
直到收到 BroadcastChannel('channel-refresh') 消息或页面刷新。

现有的 'channel-refresh' 协议仅在特定操作（收藏/屏蔽/设置变更）时触发，
不覆盖所有写入路径。StorageRevision 提供统一的修订号机制，
确保任何写入操作都能通知其他标签页失效缓存。

## 方案

### StorageRevision（src/core/storage-revision.ts）

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

设计特点：
- **不持久化**：修订号每会话从 0 开始，仅用于跨标签页信号
- **排除自身**：senderId 过滤，不处理自己发出的广播
- **单调递增**：只接受比自己大的修订号（防乱序）
- **静默降级**：BroadcastChannel 不可用时不影响功能
- **不替代现有协议**：'channel-refresh' 保持不变，StorageRevision 是额外信号

### StorageManager 集成

16 个写入方法在 `forage.setItem` 成功后调用 `storageRevision.increment()`：

| 方法 | 写入键 |
|------|--------|
| saveCar / updateCarInfo / saveCarList / removeCar / batchRemoveCars | car_list |
| addBlacklistItem / updateBlacklistItem / deleteBlacklistItem | blacklist |
| batchSaveBlacklistCarList / removeBlacklistCarList | blacklist_car_list |
| addFavoriteActressList / removeFavoriteActress / updateFavoriteActress | favorite_actresses |
| saveTitleFilterKeyword | filter_keyword_title |
| saveSetting | setting |
| importData | 所有键（循环结束后一次 increment） |

### main.tsx 启动序列

```typescript
storageRevision.init();
storageRevision.onRemoteChange(() => {
    storageManager.clearCarListCache();
    storageManager.clearSettingCache();
    storageManager.clearFilterActorActressCarListCache();
});
```

在所有站点（javdb + missav）启动时初始化。

### 不迁移 visit-history

visit-history 保持 localStorage（5000 条，同步读取保证 tooltip 即时渲染）。
异步 IDB 读取会引入可见延迟，不值得迁移。

## 实施（修改文件清单）

| 文件 | 操作 |
|------|------|
| `src/core/storage-revision.ts` | 新建 |
| `src/core/storage-manager.ts` | 修改：16 个写入方法添加 increment |
| `src/main.tsx` | 修改：init + onRemoteChange |
| `AGENTS.md` | 修改：§3.4 核心模块表新增 storage-revision.ts |

## 执行验证记录

```
$ bun run build
tsc -b && vite build
✓ 226 modules transformed.
dist/monkey-jhs-disassemble.user.js  2,017.46 kB │ gzip: 465.65 kB
✓ built in 1.22s
```

tsc 零错误。产物 +1.93 kB（StorageRevision 模块 + 16 处 increment 调用）。
