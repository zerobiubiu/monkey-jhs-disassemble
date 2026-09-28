# 打开新视频弹窗被旧操作拖住：缓存失效按写入类型分流

> **文档类型**：🧾 变更记录
> **文档状态**：✅ 已执行
> **影响范围**：跨标签页/跨 iframe 缓存失效策略、列表页卡片点击打开详情弹窗的响应
> **前置文档**：`37-detail-page-status-ops-non-blocking.md`、`29-rating-persistence-and-backup-audit.md`
> **替代文档**：无
> **生效版本**：v1.47.1

## 1. 实测反馈与定位过程

> 「异步请求没有修复，现在打开新视频还是需要等待旧视频的操作加载完毕。」
> 复现路径：**关掉旧详情弹窗 → 在瀑布流点下一个卡片**。

doc/37 修掉的是「关页等后台上传」（真问题，但**不是**该症状）。本轮按证据逐层排除：

| 假设 | 排查 | 结论 |
|---|---|---|
| 残留遮罩挡住点击 | 用户实测：关闭后父页 `.layui-layer-shade / .layui-layer` = **`0 / 0`** | ✗ 排除 |
| 脚本里 await 站点请求 | 全树扫 `waitForPending* / beforeunload` | ✗ 关页路径已只剩本地写入等待 |
| 打开路径被 await 阻塞 | `list-page/lp-dom.ts` 卡片点击 | ✅ **命中**：`openPage` 前 `await storageManager.getSetting('dialogOpenDetail', YES)` |

## 2. 根因（两条链路叠加）

1. **打开路径有一次存储读取**：`lp-dom.ts:153-162` 在 `utils.openPage(...)` 之前
   `await storageManager.getSetting('dialogOpenDetail', YES)`。`getSetting` 本身**有缓存**，
   正常应命中内存 → 立即返回。
2. **缓存被无关写入清掉**：`main.tsx` 的 `storageRevision.onRemoteChange` 对**任何**远程变更都执行
   `clearCarListCache + clearSettingCache + clearFilterActorActressCarListCache`。
   于是详情页 iframe 里每做一次操作（写 `car_list` → 修订号广播）都会**清掉父页的设置缓存**；
   下一次点卡片时那次 `getSetting` 变成真正的 **IndexedDB 读**，而同源 IDB 读写串行，
   该读排在 iframe 的写事务之后 → 弹窗必须等旧操作落库完成才出现。

这也解释了该症状的体感特征：延迟不长（几十~几百 ms）、不是网络、也没有任何遮罩残留。

附带发现：`window.clean_cacheSettingObj()` 广播（`channel-refresh` 通道）**没有任何监听者**，
即"设置缓存有独立失效通道"这一前提实际不成立 —— 设置缓存此前只被上面那条粗粒度回调失效。

## 3. 修法：失效按写入类型分流

`storage-revision.ts` 由「一条修订号」拆为**两条**：

| 计数器 | 写入方 | 远程侧动作 |
|---|---|---|
| `revision`（数据） | `StorageManager` 的数据写入（car_list / 清单等，16 处） | 清 car_list + 屏蔽清单缓存 |
| `settingsRevision`（设置） | `StorageManager.saveSetting`（`incrementSettings()`） | **只**清设置缓存 |

对应新增 `core/storage-cache-invalidation.ts` 的
`invalidateCachesFor(kind: 'data' | 'settings', target)`，`main.tsx` 分别注册两个回调。
这样：

- 详情页操作写 `car_list` **不再**影响父页设置缓存 → 点卡片时设置读取仍命中内存 → 弹窗立即打开；
- 设置变更仍能跨帧传播（设置写入递增设置修订号 + 广播）→ 不引入"设置改动不同步"的回归。

## 4. 实现清单

| 文件 | 变更 |
|---|---|
| `src/core/storage-revision.ts` | 新增 `settingsRevision` / `incrementSettings()` / `currentSettings` / `onSettingsChange()` / 私有 `fireCallbacks()`；消息体加 `settingsRevision`；`destroy()` 清两个回调表 |
| `src/core/storage-cache-invalidation.ts` | **新增**：`invalidateCachesFor()` 与其 `CacheTarget` 接口（可测试） |
| `src/main.tsx` | `onRemoteChange` → 只清数据缓存；新增 `onSettingsChange` → 只清设置缓存 |
| `src/core/storage-manager.ts` | `saveSetting` 改用 `storageRevision.incrementSettings()` |
| `tests/storage-cache-invalidation.test.ts` | **新增 4 用例**：数据写入不清设置缓存（根因回归）/ 设置写入不动数据缓存 |

未改动：`lp-dom.ts` 的读取语句（缓存命中后自身即毫秒级，保持最小改动）、存储 schema（仍为 6）。

## 5. 验证

- `bun run build` 通过；`bun run lint` / `lint:css` 零告警；`bun run test` 全绿（**33 文件 / 342 用例**）。
- `check:structure` / `check:docs` / `check:selectors` 通过；`dist @version` = 1.47.1。
- **未做真实浏览器实测**（本机 chrome-devtools MCP 不可用）：请用户在真实站点复现
  「关旧弹窗 → 点下一张卡片」，确认弹窗不再等待旧操作落库。

## 6. 若症状仍在：下一步取证方向

如复现后仍有可感知延迟，按以下顺序取证（不再猜测）：

1. 父页 Console 记录点卡片到 `layer.open` 的耗时：
   `performance.mark('click')` → `performance.mark('open')` → `performance.measure('open','click','open')`；
2. 看该窗口内是否有 IndexedDB 事务排队（DevTools → Application → IndexedDB 活动）；
3. 若耗时确实出在 IDB 串行上，下一步把 `lp-dom` 的打开路径改为**同步缓存读取**
   （`getSettingSync`：命中内存缓存即返回，未命中回落到默认值并后台预热）。