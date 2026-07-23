# doc/138 — 全量同步版本门控

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

`CarListReaderPlugin` 在每个 JavDB 页面加载后延迟 2s 执行全量同步：

```typescript
setTimeout(() => this.syncFullCarStatus(), 2000);
```

全量同步流程：读取 car_list（可达 5.5 万条）→ 深拷贝（JSON.stringify +
JSON.parse）→ 转列存 → gzip 压缩 → 写入数百 KB GM 存储。

即使 car_list 一条都没有变化，每个页面仍执行全部流程。项目已有增量推送
机制（`carListChangeCallback` → `pushDelta` → `GM_setValue`），全量同步
仅需在数据变更或兜底场景执行。

## 方案

### 变更代号（revision）

新增 3 个 GM 存储键：

| 键 | 用途 |
|----|------|
| `jhs_car_list_rev` | 变更代号，每次 `pushDelta` 递增 |
| `jhs_car_status_synced_rev` | 上次全量同步时的代号 |
| `jhs_car_status_last_sync` | 上次全量同步时间戳 |

### 门控逻辑

`handle()` 中替换无条件 `setTimeout`：

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

### 全量同步触发条件

| 条件 | 说明 |
|------|------|
| `currentRev !== syncedRev` | 数据有变更但尚未全量同步 |
| `Date.now() - lastSyncTime > 24h` | 每日兜底（防增量丢失） |
| 菜单手动触发 | `GM_registerMenuCommand` 不受门控限制 |
| 首次安装 | `syncedRev` 默认 -1，必然触发 |

### 代号递增点

`pushDelta()` 末尾（try 块内，两个分支之后）：

```typescript
GM_setValue(GM_KEY_CAR_LIST_REV, GM_getValue(GM_KEY_CAR_LIST_REV, 0) + 1);
```

### 同步完成记录

`syncFullCarStatus()` 成功后：

```typescript
GM_setValue(GM_KEY_SYNCED_REV, GM_getValue(GM_KEY_CAR_LIST_REV, 0));
GM_setValue(GM_KEY_LAST_SYNC_TIME, Date.now());
```

## 实施（修改文件清单）

| 文件 | 操作 |
|------|------|
| `src/plugins/car-status-sync/car-list-reader-plugin.ts` | 修改：门控逻辑 + 代号递增 + 同步记录 |

## 执行验证记录

```
$ bun run build
tsc -b && vite build
✓ 223 modules transformed.
dist/monkey-jhs-disassemble.user.js  2,008.79 kB │ gzip: 463.35 kB
✓ built in 1.17s
```

tsc 零错误。产物 +0.90 kB。

## 预期收益

| 场景 | 之前 | 之后 |
|------|------|------|
| 无变更页面加载 | 读取+深拷贝 55k 条 + 列存 + gzip + GM 写入 | 1 次 GM_getValue（~0.1ms） |
| 有变更页面加载 | 同上 | 同上（增量已实时推送，全量仅兜底） |
| 每日首次加载 | 同上 | 全量同步（兜底） |
| 手动触发 | 同上 | 同上（不受门控） |
