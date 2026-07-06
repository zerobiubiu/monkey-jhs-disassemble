# 48 - StatusTagFilter 与 jhs 屏蔽深度协同修复

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 1. 背景

### 1.1 问题

用户报告：独立脚本拆分模式下，item 筛选（statusTagFilter）和排序（pageSort）
会导致 jhs 的屏蔽（filterMovieList 的 `data-hide`）失效——被 jhs 屏蔽的卡片
在筛选/排序操作后被错误地重新显示。

### 1.2 根因分析

doc/37（PageSort 协调）和 doc/38（StatusTagFilter 集成）已解决了大部分冲突，
但残留一个**时序竞争风险**：

StatusTagFilter 的协同安全判断依赖**易变的 `style.display`**：

```js
const hiddenByOther =
    item.style.display === 'none' &&
    !item.hasAttribute(HIDDEN_ATTR);
if (hiddenByOther) return;  // 跳过 jhs 隐藏的卡片
```

`style.display` 在以下时序竞争中可能被临时清除/覆盖：

| 竞争场景 | 详情 |
|----------|------|
| filterMovieList 的 await 窗口 | PageSort 排序触发 jhs checkDom → `await doFilter()` → filterMovieList 在 `await Promise.all` 读 IndexedDB 时让出事件循环 → StatusTagFilter 的 150ms 防抖定时器到期 → applyFilter 执行，此时 jhs 可能还没重新 hide 卡片 |
| sortItems 的 empty+append | jhs sortItems 的 `n.empty().append(e)`（rateCount/date 分支）在 empty 后 append 前的瞬间，节点不在 DOM 中，`querySelectorAll('.item')` 查不到 |

虽然 doc/37 已让 jhs sortItems 在 PageSort 激活时 return（`jhs_sortMethod` 被清除），
消除了 sortItems 的 empty+append 路径，但 filterMovieList 的 await 窗口仍然存在。

### 1.3 关键洞察

jhs 的屏蔽标记是 `data-hide` 属性（两种值）：

| 来源 | 属性值 | 含义 |
|------|--------|------|
| `filterMovieList` | `data-hide="yes"` | 基于设置的屏蔽（收藏/已观看/过滤/黑名单演员/关键词） |
| `showCarNumBox` | `data-hide="<carNum>-hide"` | 临时隐藏（如批量打开时） |

**`data-hide` 属性比 `style.display` 更可靠**：
- 排序移动节点（jQuery `.append()` / `.empty().append()`）用的是同一节点引用，
  **内联 `style` 和 DOM 属性都不会丢失**
- 但 `style.display` 可能被 jQuery `.show()` / 其他脚本临时修改
- `data-hide` 是语义标记，只有 jhs 的 `removeAttr('data-hide')` 才会移除

## 2. 方案

### 2.1 核心改动：协同安全从"依赖 style.display"升级为"依赖 data-hide 属性"

把 StatusTagFilter 的协同安全判断从：

```js
// 旧：依赖易变的 style.display
const hiddenByOther =
    item.style.display === 'none' &&
    !item.hasAttribute(HIDDEN_ATTR);
if (hiddenByOther) return;
```

升级为：

```js
// 新：优先检查稳定的语义属性 data-hide
const hiddenByJhs = item.hasAttribute(JHS_HIDE_ATTR);  // data-hide
const hiddenByOther =
    item.style.display === 'none' &&
    !item.hasAttribute(HIDDEN_ATTR);  // 兼底：兼容未知脚本
if (hiddenByJhs || hiddenByOther) return;
```

**为什么这能完全解决问题**：

| 场景 | 旧方案（style.display） | 新方案（data-hide） |
|------|--------------------------|----------------------|
| 排序后卡片保留 display:none + data-hide | ✅ 跳过 | ✅ 跳过 |
| filterMovieList await 期间，display 被临时清除 | ❌ 判断失败，错误恢复显示 | ✅ data-hide 还在，仍跳过 |
| sortItems empty+append 中间态 | ❌ 节点不在 DOM，查不到 | ✅ append 后 data-hide 还在 |
| jhs 取消屏蔽（show+removeAttr） | ✅ display 恢复，不跳过 | ✅ data-hide 被移除，不跳过 |

### 2.2 增强统计函数：排除被 jhs 屏蔽的卡片

`collectStatusTagCounts` 和 `countNoStatusItems` 原本统计所有 `.item`（包括被
jhs 屏蔽的 display:none 卡片），导致芯片计数包含不可见卡片的状态标签。

改为排除有 `data-hide` 属性的卡片，芯片计数只反映实际可见的卡片。

### 2.3 增强无筛选恢复分支

`applyFilter` 的无筛选恢复分支（`selectedValues.size === 0`）原本恢复所有
`[data-status-tag-hidden]` 的卡片并设 `style.display = ''`。增加 `data-hide`
检查，避免恢复被 jhs 屏蔽的卡片。

### 2.4 改动范围

| 文件 | 改动 |
|------|------|
| `src/plugins/status-tag-filter-plugin.ts` | 新增 `JHS_HIDE_ATTR` 常量；`collectStatusTagCounts` 排除 data-hide 卡片；`countNoStatusItems` 排除 data-hide 卡片；`applyFilter` 协同安全增加 data-hide 检查；`applyFilter` 无筛选恢复分支增加 data-hide 保护；文件头注释更新 |

**零侵入**：不修改 jhs 的 ListPagePlugin / ListPageButtonPlugin / PageSortPlugin，
仅 StatusTagFilter 单方面增强协同安全判断。

## 3. 实施

### 3.1 修改详情

#### 3.1.1 新增常量

```ts
/**
 * jhs 主项目的隐藏标记属性名。
 * jhs ListPagePlugin.filterMovieList 用 `$item.hide().attr('data-hide', YES)`
 * （值为 "yes"），showCarNumBox 用 `data-hide="<carNum>-hide"`（临时隐藏）。
 * 两种值都表示卡片被 jhs 隐藏，本脚本统一检查属性是否存在（不关心值）。
 */
const JHS_HIDE_ATTR = 'data-hide';
```

#### 3.2.2 collectStatusTagCounts 排除被屏蔽卡片

```ts
function collectStatusTagCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    document.querySelectorAll(STATUS_TAG_SELECTOR).forEach((el: Element) => {
        // 向上查找最近的 .item 容器，跳过被 jhs 屏蔽的卡片
        const itemEl = el.closest('.item');
        if (itemEl && itemEl.hasAttribute(JHS_HIDE_ATTR)) return;
        const text = el.textContent?.trim() || '';
        if (text) {
            counts[text] = (counts[text] || 0) + 1;
        }
    });
    return counts;
}
```

#### 3.2.3 countNoStatusItems 排除被屏蔽卡片

```ts
function countNoStatusItems(): number {
    let count = 0;
    document.querySelectorAll('.item').forEach((item: Element) => {
        // 跳过被 jhs 屏蔽的卡片
        if (item.hasAttribute(JHS_HIDE_ATTR)) return;
        if (!item.querySelector(STATUS_TAG_SELECTOR)) {
            count++;
        }
    });
    return count;
}
```

#### 3.2.4 applyFilter 协同安全增强

```ts
// 有筛选分支
const hiddenByJhs = htmlItem.hasAttribute(JHS_HIDE_ATTR);
const hiddenByOther =
    htmlItem.style.display === 'none' && !htmlItem.hasAttribute(HIDDEN_ATTR);
if (hiddenByJhs || hiddenByOther) return;

// 无筛选恢复分支
if (selectedValues.size === 0) {
    document.querySelectorAll(`.item[${HIDDEN_ATTR}]`).forEach((item) => {
        const htmlItem = item as HTMLElement;
        if (htmlItem.hasAttribute(JHS_HIDE_ATTR)) return;  // 不恢复被 jhs 屏蔽的
        htmlItem.removeAttribute(HIDDEN_ATTR);
        htmlItem.style.display = '';
    });
    return;
}
```

## 4. 执行验证记录

### 4.1 类型检查

```bash
$ npx tsc -b
（无输出，退出码 0）
```

### 4.2 构建

```bash
$ npx vite build
dist/monkey-jhs-disassemble.user.js  1,809.85 kB │ gzip: 413.45 kB
✓ built in 1.15s
```

构建成功。产物 1809.85 kB（gzip 413.45 kB），与 doc/47 基线 1809.45 kB
（gzip 413.37 kB）基本持平（+0.40 kB），为协同安全增强逻辑的合理增量。

### 4.3 逻辑验证（代码层面）

| 验证点 | 结论 |
|--------|------|
| data-hide 属性在排序移动节点后是否保留 | ✅ jQuery `.append()` / `.empty().append()` 用同一节点引用，内联 style 和 DOM 属性都不丢失 |
| jhs 取消屏蔽时 data-hide 是否同步移除 | ✅ `$item.show().removeAttr('data-hide')` 同步清除 display:none 和 data-hide |
| showCarNumBox 的 data-hide 也被覆盖 | ✅ 两种值格式（"yes" / "<carNum>-hide"）都通过 hasAttribute 检测 |
| collectStatusTagCounts 的 closest('.item') 是否正确 | ✅ STATUS_TAG_SELECTOR 已含 `.item ` 前缀，closest 向上查找最近的 .item 容器 |
| PageSort 排序是否需要额外修改 | ✅ 不需要——PageSort 只移动节点不改显隐，排序后 checkDom→doFilter→filterMovieList 重新应用屏蔽 |

## 5. 后续

### 运行时验证建议

1. **基本屏蔽**：列表页屏蔽某些卡片（确认 `data-hide="yes"` + `display:none`）
2. **PageSort 排序后屏蔽保持**：点击 PageSort 排序 → 屏蔽卡片应保持隐藏
3. **StatusTagFilter 筛选后屏蔽保持**：激活筛选芯片 → 屏蔽卡片不应被重新显示
4. **取消筛选后屏蔽保持**：取消所有筛选芯片 → 屏蔽卡片不应被恢复显示
5. **芯片计数准确**：屏蔽卡片的状态标签不计入芯片计数
6. **jhs 排序后屏蔽保持**：点击 jhs `#sort-toggle-btn` 排序 → 屏蔽卡片保持隐藏
7. **autoPage 瀑布流**：开启 autoPage → 瀑布流 append 新页 → 屏蔽状态保持
