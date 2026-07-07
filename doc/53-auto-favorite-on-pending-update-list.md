# 53. 向「等待更新」清单添加视频时自动收藏

**文档类型**：🔧开发指导
**文档状态**：✅已执行

## 背景

### 需求

用户希望：当向名称中包含「等待更新」的清单中添加视频时，
自动将未收藏的视频进行收藏（写入 JHS IndexedDB `FAVORITE_ACTION`）。

### 现状分析

清单 checkbox 勾选/取消的统一入口在 `VideoListsTagPlugin` 的
`vlt-sync.ts` 模块：

- `setupCheckboxListener()`：监听 `input[type=checkbox]` 的 change 事件
  （`data-action="change->list#listCheckboxChanged"`），防抖 300ms 后
  调用 `handleCheckboxChange`
- `handleCheckboxChange(movieInfo, listInfo, checked)`：
  - 已有完整的 `movieInfo`（含 `designation` 番号、`info.href`、`info.release_date`）
  - 已有 `listInfo.info.name`（清单名称，通过 `getListName` 从 DOM 提取）
  - 调用 `syncMoviesLists` 同步到本地 IndexedDB
  - 广播三重同步事件

收藏机制在 `DetailPageButtonPlugin`：

- `favoriteOne()`：`storageManager.saveCar({ carNum, url, names, actionType: FAVORITE_ACTION, publishTime })`
- `_saveSingleCar` 中若 `car.status === FAVORITE_ACTION` 会抛错"已在收藏列表中"
- 若 `car.status` 为其他状态（`filter`/`hasWatch`），`saveCar` 会**覆盖**为 `FAVORITE_ACTION`

### 根因

清单同步流程中未联动收藏操作。用户添加到「等待更新」清单后，
需手动再点收藏按钮，操作链路长。

## 方案

### 切入点

在 `vlt-sync.ts` 的 `handleCheckboxChange` 中，当同步成功后，
若 `checked === true`（勾选=添加到清单）且清单名称包含「等待更新」，
触发自动收藏。

### 收藏策略（保守，不覆盖用户已设置的其它状态）

| CarRecord 状态 | 行为 | 提示 |
|----------------|------|------|
| 记录不存在 / `status === ''` | 自动收藏 | `⭐ [番号] 已自动收藏（添加至「清单名」）` |
| `status === FAVORITE_ACTION` | 跳过（已收藏） | 无（避免噪音） |
| 其它状态（`filter`/`hasWatch`/`hasDown`） | 跳过（不覆盖） | `ℹ️ [番号] 已标记为「XX」，跳过自动收藏` |

不覆盖已有状态的原因：用户已主动设置了屏蔽/已观看等状态，
自动覆盖为收藏会丢失用户意图。

### 触发关键词

`AUTO_FAVORITE_KEYWORD = '等待更新'`

清单名称包含此关键词即触发（如「等待更新」「等待更新-无码」等均匹配）。

### 收藏所需字段映射

| CarSaveInput 字段 | 来源 |
|-------------------|------|
| `carNum` | `movieInfo.designation` |
| `url` | `movieInfo.info.href` |
| `names` | `getActressNames()`（从 DOM `$('.female').prev()` 提取，与 `BasePlugin.getPageInfo` 一致） |
| `actionType` | `FAVORITE_ACTION`（`'favorite'`） |
| `publishTime` | `movieInfo.info.release_date` |

### 异步处理

自动收藏以 fire-and-forget 方式执行（`.then()` 不 await），
不阻塞清单同步的三重广播。失败时仅 toast + console.error，
不影响清单同步结果。

## 实施

### 修改文件清单

| 文件 | 变更 |
|------|------|
| `src/plugins/video-lists-tag/vlt-sync.ts` | +import `FAVORITE_ACTION`；+`AUTO_FAVORITE_KEYWORD` 常量；+`getActressNames()` 辅助函数；+`autoFavoriteIfPendingUpdate()` 自动收藏函数；`handleCheckboxChange` 末尾增加勾选时调用 |

### 代码变更摘要

```typescript
// vlt-sync.ts 顶部
import { FAVORITE_ACTION } from '../../constants/status';
const AUTO_FAVORITE_KEYWORD = '等待更新';

// 新增：从 DOM 提取演员名（与 BasePlugin.getPageInfo 一致）
function getActressNames(): string { ... }

// 新增：自动收藏未收藏视频
async function autoFavoriteIfPendingUpdate(movieInfo, lname): Promise<void> {
    if (!lname.includes(AUTO_FAVORITE_KEYWORD)) return;
    const carRecord = await storageManager.getCar(des);
    if (carRecord && carRecord.status === FAVORITE_ACTION) return;  // 已收藏
    if (carRecord && carRecord.status) { showToast(...'跳过'); return; }  // 有其它状态
    await storageManager.saveCar({ carNum: des, ..., actionType: FAVORITE_ACTION });
    showToast('⭐ 已自动收藏');
}

// handleCheckboxChange 末尾（同步成功后）
if (checked) {
    autoFavoriteIfPendingUpdate(movieInfo, lname).then();
}
```

## 执行验证记录

### 构建验证

```
$ bun run build
$ tsc -b && vite build
✓ 213 modules transformed.
✓ built in 1.80s
dist/monkey-jhs-disassemble.user.js  1,819.41 kB │ gzip: 415.91 kB
```

- `tsc -b` 类型检查通过（零错误）
- `vite build` 构建成功
- `diagnostics` 检查 `vlt-sync.ts` 零错误零警告

### 产物对比

| 版本 | 产物大小 | gzip |
|------|----------|------|
| v1.4.0（修改前） | 1,818.14 kB | 415.53 kB |
| v1.5.0（修改后） | 1,819.41 kB | 415.91 kB |
| 差值 | +1.27 kB | +0.38 kB |

## 后续验证建议

1. 在 JavDB 详情页，确保清单面板已加载（`.jhs-list-panel` 有内容）
2. 找一个未收藏的视频，勾选名称含「等待更新」的清单：
   - 应出现两条 toast：①`✓ 已添加至「等待更新」` ②`⭐ 已自动收藏`
   - 刷新后详情页按钮应显示「⭐ 已收藏」状态
3. 已收藏的视频再勾选「等待更新」清单：只出现添加 toast，不出现收藏 toast
4. 已标记「已观看」的视频勾选「等待更新」清单：出现`ℹ️ 已标记为「hasWatch」，跳过自动收藏`
5. 取消勾选「等待更新」清单：不触发自动收藏（仅移除清单关联）
6. 勾选名称不含「等待更新」的清单：不触发自动收藏
