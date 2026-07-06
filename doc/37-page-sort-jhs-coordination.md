# 37 - PageSort 与 jhs 排序系统协调优化

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 1. 背景

### 1.1 问题
doc/36 集成的 `PageSortPlugin` 与 jhs 主项目的排序系统存在深度耦合冲突：

| 冲突 | 详情 | 严重度 |
|------|------|--------|
| 双重排序 | jhs `ListPageButtonPlugin.sortItems()`（default/rateCount/date）vs `PageSortPlugin.applySort()`（名称/评分升降序）都操作 `.movie-list .item`，互相覆盖排序结果 | 严重 |
| Observer 互相触发 | `ListPagePlugin.checkDom()` 的 MutationObserver 监听 `.movie-list` childList → 触发 `sortItems()`；`PageSortPlugin.sortGuard` 监听同一 childList → 触发 `applySort()`；两者互相触发可能死循环 | 严重 |
| autoPage 冲突 | `sortItems` 在 autoPage=YES 时跳过；`PageSortPlugin` 无此守卫，`AutoPagePlugin` 瀑布流 append 新页会触发 sortGuard 重新排序，打乱分页内容 | 严重 |
| data 属性 | jhs 用 `data-original-index`，pageSort 用 `data-sort-original-index`，两套标记 | 轻微 |

### 1.2 根因
`PageSortPlugin` 作为独立油猴脚本集成时，未考虑 jhs 主项目已有排序系统（`sortItems` + `checkDom` MutationObserver + `#sort-toggle-btn` 按钮），两个排序系统各自独立运行，互相打架。

## 2. 方案

### 2.1 协调策略（本插件单方面适配，不改 jhs 排序系统）

| 决策点 | 选择 | 理由 |
|--------|------|------|
| autoPage 守卫 | autoPage=YES 时不注入 | 与 `sortItems` 一致，避免打乱瀑布流；`AutoPagePlugin` append 新页不触发 sortGuard |
| isListPage 守卫 | 仅 isListPage 时注入 | 与 jhs 排序按钮 `#sort-toggle-btn` 一致 |
| data 属性 | 复用 jhs 的 `data-original-index` | 避免两套标记混乱；仅当 item 未标记时才打标，不覆盖 jhs 已标记的索引 |
| 排序互斥（pageSort→jhs） | 点击 pageSort 按钮时 `localStorage.removeItem('jhs_sortMethod')` | 让 jhs `sortItems` 不再生效（sortMethod 为空时直接 return） |
| 排序互斥（jhs→pageSort） | 监听 `#sort-toggle-btn` click，清除 `activeSort` + 选中态 | jhs 排序时 pageSort 不再生效；同一时刻仅一个排序系统生效 |
| sortGuard 暂停 | applySort 前 disconnect sortGuard，排序完成 + takeRecords 后 reconnect | 避免自身 append 触发守卫；jhs sortItems 触发的 childList 仍会触发 sortGuard，但因 jhs_sortMethod 已被清除，sortGuard 重新应用 pageSort 排序是正确的 |

### 2.2 协调后的运行时行为

**场景 1：用户仅用 pageSort 排序**
1. 用户点击"按照名称升序" → 清除 `jhs_sortMethod` + activeSort=名称升序 + applySort
2. jhs `checkDom` MutationObserver 触发 → `sortItems` → `jhs_sortMethod` 为空 → 直接 return（不影响）
3. sortGuard 监听到 childList 变动（jhs sortItems 的 return 不操作 DOM，不触发）→ 无反应

**场景 2：用户从 pageSort 切换到 jhs 排序**
1. 用户点击 `#sort-toggle-btn` → 清除 pageSort activeSort + 选中态 + jhs 设置 `jhs_sortMethod`
2. jhs `sortItems` 排序 → append .item → 触发 pageSort sortGuard
3. sortGuard 检查 activeSort → 已被清除为 null → 不排序（正确，让 jhs 排序生效）

**场景 3：用户从 jhs 切换到 pageSort 排序**
1. 用户点击 pageSort 按钮 → 清除 `jhs_sortMethod` + activeSort=新方式 + applySort
2. jhs `checkDom` 触发 → `sortItems` → `jhs_sortMethod` 为空 → return（不影响）
3. pageSort 排序生效

**场景 4：autoPage 瀑布流**
1. autoPage=YES → pageSort 不注入（handle 直接 return）
2. `AutoPagePlugin` append 新页 → `checkDom` 触发 → `sortItems` → autoPage=YES 时 return
3. 瀑布流不受影响

## 3. 实施

### 3.1 修改文件

| 文件 | 改动 |
|------|------|
| `src/plugins/page-sort-plugin.ts` | 加 autoPage/isListPage 守卫；复用 `data-original-index`；点击 pageSort 按钮清除 `jhs_sortMethod`；监听 `#sort-toggle-btn` 清除 activeSort；applySort 内 disconnect/reconnect sortGuard；加 `YES` import |

### 3.2 不修改的文件
- `src/plugins/list-page-button-plugin.ts`（jhs 排序系统，本插件单方面适配，零侵入）
- `src/plugins/list-page-plugin.ts`（jhs checkDom，零侵入）
- `src/plugins/auto-page-plugin.ts`（瀑布流，零侵入）

## 4. 执行验证记录

### 4.1 类型检查
```bash
$ bunx tsc -b
（无输出，退出码 0）
```

### 4.2 构建
```bash
$ bunx vite build
dist/monkey-jhs-disassemble.user.js  1,715.10 kB │ gzip: 409.15 kB
✓ built in 1.00s
```
构建成功。产物 1715.10 kB（gzip 409.15 kB），较 doc/36 基线 1714.58 kB
（gzip 409.04 kB）+0.52 kB（gzip +0.11 kB），为协调逻辑的合理增量。

## 5. 后续

- **运行时验证**：建议在 Tampermonkey 加载构建产物，测试：
  - 列表页 pageSort 按钮注入（autoPage 关闭时）
  - 点击 pageSort 排序 → jhs 排序按钮文案变为"默认"（jhs_sortMethod 被清除）
  - 点击 jhs 排序按钮 → pageSort 选中态清除
  - autoPage 开启时 pageSort 按钮不注入
  - 瀑布流 append 新页不触发 pageSort 排序
  - 两个 MutationObserver 不死循环
- **选择器兼容性**：pageSort 选择器 `div.movie-list.h.cols-4.vcols-8` 在搜索页可能不匹配（搜索页 `.movie-list` 不带 `.h.cols-4.vcols-8`），此时跳过注入（原脚本行为，保留）
