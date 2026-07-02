# 01 - 删除「已下载」(hasDown) 状态的 UI 和功能

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行
> **脚本**：`jhs.user.js`
> **日期**：2026-07-01

## 1. 需求描述

删除 `jhs.user.js` 中「已下载」（hasDown）状态标签的所有 UI 和功能代码。

**保留项**：
- `const g = "hasDown"`（L71）
- `const y = "📥️ 已下载"`（L80）
- `const x = "#7bc73b"`（L81）

三个常量定义保留，防止其他地方间接引用导致报错。

**保留 storageManager 兼容**：`_saveSingleCar` / `updateCarInfo` 内部的 `case g: l.status = g;` 分支不动，以兼容历史已保存的 hasDown 记录（历史数据可能含 status='hasDown'）。仅删除所有调用 `actionType: g` 的 UI 入口。

## 2. 删除清单（按区域）

### 2.1 详情页 `DetailPageButtonPlugin`

| 位置 | 删除内容 |
|------|----------|
| `createMenuBtn` 模板 | `<a id="hasDownBtn">` 按钮 HTML |
| `createMenuBtn` 绑定 | `$("#hasDownBtn").on("click", async () => this.hasDownOne());` |
| `showStatus` | `const a = $("#hasDownBtn span");` / `a.text(...)` / `case g:` 分支 |
| `hasDownOne` 方法 | 整个方法 |
| `handle` | `this.hasDownHotKey = e.hasDownHotKey;` |
| `bindHotkey` | `if (this.hasDownHotKey) { ... this.hasDownOne() }` |

### 2.2 历史记录 `HistoryPlugin`

| 位置 | 删除内容 |
|------|----------|
| `openHistory` 模板 | `<option value="hasDown">` 筛选选项；`multiple-history-hasDownBtn` 批量按钮 |
| `bindClick` 选择器1 | 移除 `.history-hasDownBtn, ` |
| `bindClick` 分支1 | `else if (t.hasClass("history-hasDownBtn")) { s(g).then(); }` |
| `bindClick` 选择器2 | 移除 `.multiple-history-hasDownBtn, ` |
| `bindClick` 分支2 | `else if (t.hasClass("multiple-history-hasDownBtn")) { a="已下载"; i=g; }` |
| `getDataList` | `this.hasDownCount = 0;` / `case g:` / `$('#dataType option[value="hasDown"]').text(...)` |
| `loadTableData` formatter | `case "hasDown":` 分支；操作按钮模板中 `history-hasDownBtn` |
| `editRecord` | 状态数组 `{ value: g, text: y }` 选项 |

### 2.3 状态标签定义 `Te`

删除 `IS_HAS_DOWN` 对象（`text/color/reasonType/isCounted/countKey`）。

### 2.4 列表页 `ListPagePlugin`

| 位置 | 删除内容 |
|------|----------|
| `constructor` | `i(this, "currentPageHasDownCount", 0);` |
| `renderItemStatusTag` | `else if (a === g) N = Te.IS_HAS_DOWN;` |
| `filterMovieList` | `const S` (showHasDownItem) / `currentPageHasDownCount` 重置 / 解构 `hasDown: d` / `const p = d.has(a);` / 隐藏判断 `(S===C && p)` 与 `!p` / `else if (p)` 分支 / 统计表「已下载」行 |
| `bindListPageHotKey` | `this.hasDownHotKey = e.hasDownHotKey;` / `if (this.hasDownHotKey) {...}` |

### 2.5 设置面板 `SettingPlugin`

| 位置 | 删除内容 |
|------|----------|
| `openSettingDialog` hotkey-panel | `hasDownHotKey` 配置项 `<div>` |
| `simpleSetting` | `showHasDownItem` 显示开关 |
| `initSimpleSettingForm` | prop / on-change / 选择器 `#showHasDownItem, ` |

**说明**：`loadForm` / `saveForm` 用通用遍历 `$("#hotkey-panel [id]")` 处理所有 hotkey input，`showHasDownItem` 由 `initSimpleSettingForm` 的 change 事件单独保存。删除模板里的 input 元素和事件绑定即自动不再读写，无需改 `loadForm` / `saveForm`。

### 2.6 脚本头

`@description` 去掉「标记已下载」：`收藏、屏蔽、标记已下载; ` → `收藏、屏蔽; `

## 3. 执行步骤

1. grep 全局搜索 `hasDown` 及关联符号（`hasDownBtn`/`hasDownOne`/`hasDownHotKey`/`hasDownCount`/`showHasDownItem`/`history-hasDownBtn`/`multiple-history-hasDownBtn`/`IS_HAS_DOWN`/`currentPageHasDownCount`），定位所有引用。
2. 读取各区域完整上下文，确认删除范围与变量引用关系。
3. **关键判断**：`filterMovieList` 中变量 `S`（showHasDownItem）仅用于 hasDown 隐藏逻辑，安全删除；变量 `p`（d.has(a)）除 hasDown 外被 L8632 `!p` 引用，删除 `const p` 时需一并移除 `(w === C && b && !g && !p && !u)` 中的 `&& !p`（已下载状态不再存在，filter 隐藏判断无需排除已下载项）。
4. **实现方式**：超长模板字符串内片段（`createMenuBtn`/`openHistory`/`loadTableData` formatter/统计表/`openSettingDialog`/`simpleSetting`）用 node 脚本正则删除（`\n\s+<a id="hasDownBtn".*?</a>` 等非贪婪匹配 + `\$\{y\}` 转义），普通代码用精确字符串替换。每处替换均校验「恰好匹配 1 次」，避免误删或漏删。
5. node 脚本执行：37 处替换全部成功。
6. `editRecord` 的 `{value:g, text:y}` 选项单独用 edit_file 删除（普通代码，可精确匹配）。
7. 清理临时脚本 `_remove_hasdown.js`。

## 4. 执行验证记录

### 4.1 grep 残留检查

```
grep hasDown javdb-tools/jhs.user.js
→ 仅剩 const g = "hasDown";（L71）✓
```

```
grep "hasDownBtn|hasDownOne|hasDownHotKey|hasDownCount|showHasDownItem|history-hasDownBtn|multiple-history-hasDownBtn|IS_HAS_DOWN|currentPageHasDownCount"
→ No matches found ✓
```

### 4.2 常量与 storageManager 保留检查

```
grep "const y =|const x =|const g =|actionType: g|case g:"
→ const g/y/x 定义保留 ✓
→ _saveSingleCar / updateCarInfo 的 case g: l.status = g; 保留 ✓（兼容历史数据）
→ 所有 actionType 调用为 h/p/d，无 g ✓
```

### 4.3 语法检查

```
diagnostics javdb-tools/jhs.user.js
→ File doesn't have errors or warnings! ✓
```

### 4.4 结论

「已下载」(hasDown) 状态的 UI 和功能代码已全部删除，三个常量定义保留，storageManager 兼容逻辑保留，语法无错误。
