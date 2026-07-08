# 57. 修复新增清单后无即时反馈、必须刷新页面才能看到

**文档类型**：🔧开发指导
**文档状态**：✅已执行

## 背景

### 问题描述

doc/56 实现「新增清單」功能后，用户反馈：

> 清单创建是成功了，但是点保存清单并没有一个正常且成功的完整效果，
> 必须刷新一下才能看到这个清单，而不是立马就看到了；而且点了保存
> 就仅仅是创建了就没再有其他任何效果了。

三个症状：

1. ✅ 服务端清单创建成功（刷新后能看到新清单）
2. ❌ 创建后 `.jhs-list-panel` 平铺面板不立即显示新清单，需手动刷新
3. ❌ 创建后无任何后续效果：无 toast、无本地 IDB 关联同步、无自动收藏

### 根因分析

doc/56 的 `createListViaNativeForm` 在提交前捕获 `listContainer` 引用，
把 `MutationObserver` 挂在该引用上：

```js
const listContainer = modal.querySelector('[data-list-target="listContainer"]');
// ...
const obs = new MutationObserver(() => { /* 对比 beforeIds 找新 checkbox */ });
obs.observe(listContainer, { childList: true, subtree: true });  // ← 挂在 listContainer
submitBtn.click();
```

但 JavDB 的 Rails/Stimulus `list#onCreateSuccess` 响应会**整个替换**
`listContainer` 元素（Turbo Stream / innerHTML 重渲染，而非向旧节点
append 子元素）。替换后：

- 旧 `listContainer` 引用变成**孤立节点**（脱离 DOM 树）
- 挂在旧节点上的 `MutationObserver` **永远不会再次触发**
- 新 `listContainer` 没有被任何 observer 监听

于是 doc/56 设计的「检测到新 checkbox → toast + handleCheckboxChange +
自动收藏」整条链路全部失效。同理，
`DetailPageButtonPlugin._initListPanel` 的 `MutationObserver` 也挂在
提交前的 `listContainer` 上，替换后同样失效，故 `.jhs-list-panel` 不
会自动 clone 新条目 → 用户必须手动刷新页面才能看到新清单。

### 影响范围

- `src/plugins/video-lists-tag/vlt-sync.ts` 的 `createListViaNativeForm`
- 间接：`DetailPageButtonPlugin._initListPanel` 的 clone 同步（不修改，
  由 vlt-sync 主动 `refreshListPanel()` 兜底）

## 方案

### 核心思路：observer 挂不可替换的 modal + 轮询兜底 + 主动刷新平铺面板

1. **MutationObserver 改挂 `#modal-save-list`（modal 本身不会被替换）**，
   而非 `listContainer`。回调内每次 `modal.querySelector('[data-list-target="listContainer"]')`
   重新查询最新节点，对比 `beforeIds` 快照找新增 checkbox。

2. **200ms 轮询兜底**：覆盖 observer 因元素替换 / `data-list-id` 延迟
   设置等边界情况漏触发的场景。与 observer 共享 `settled` 幂等守护，
   先到先执行。

3. **完成时主动 `refreshListPanel()`**：从最新 `listContainer` 克隆全部
   条目（跳过「預設清單」）到 `.jhs-list-panel`，与
   `DetailPageButtonPlugin._initListPanel` 的 sync 逻辑等价、幂等。
   即使该插件的 observer 因 listContainer 替换失效，用户也能立即在
   平铺面板看到新清单，无需刷新。

4. **超时从 5s 提升到 8s**（兼顾慢网络），超时时也尝试刷新一次平铺面板
   （服务端可能已创建但 DOM 更新方式不同）。

### 检测函数

```js
const detectNew = (): HTMLInputElement[] | null => {
    // 关键：每次重新查询，不复用旧引用
    const currentLc = modal.querySelector('[data-list-target="listContainer"]');
    if (!currentLc) return null;
    const after = Array.from(
        currentLc.querySelectorAll('input[type="checkbox"][data-list-id]')
    );
    const newOnes = after.filter((cb) => !beforeIds.has(cb.dataset.listId));
    return newOnes.length > 0 ? newOnes : null;
};
```

### 完成态

```js
const finish = (newOnes: HTMLInputElement[]): void => {
    if (settled) return;          // 幂等
    settled = true;
    clearTimeout(failTimer);
    clearInterval(pollTimer);
    obs.disconnect();
    // 还原 newListArea + 我们的展开 UI
    // toast「✓ 清單已建立，已自動關聯當前影片」
    refreshListPanel();           // 主动刷新平铺面板（核心修复）
    // 对每个新 checkbox → handleCheckboxChange(add) 同步本地 IDB
};
```

## 实施

### 修改文件

| 文件 | 变更 |
|------|------|
| `src/plugins/video-lists-tag/vlt-sync.ts` | 重构 `createListViaNativeForm`：observer 挂 modal + 轮询兜底 + `detectNew`/`finish` 拆分 + 主动 `refreshListPanel`；新增 `refreshListPanel` 辅助函数（与 `_initListPanel` sync 等价）；更新文档注释与背景说明 |

### 零侵入已定稿插件

- 不修改 `DetailPageButtonPlugin`（其 `_initListPanel` observer 失效由
  vlt-sync 的 `refreshListPanel()` 兜底覆盖）
- 不绕过 Rails UJS（仍驱动原生 submit）
- 仅在 `VideoListsTagPlugin` 域内单方面增强

## 执行验证记录

### 构建验证

```
$ bun run build
$ tsc -b && vite build
✓ 213 modules transformed.
✓ built in 2.18s
dist/monkey-jhs-disassemble.user.js  1,826.87 kB │ gzip: 417.86 kB
```

- `tsc -b` 类型检查通过（零错误）
- `diagnostics` 检查 `vlt-sync.ts` 零错误零警告
- 版本号 1.6.0 → 1.6.1（bug 修复，patch 递增）

### 产物对比

| 版本 | 产物 | gzip |
|------|------|------|
| v1.6.0 | 1,825.78 kB | 417.60 kB |
| v1.6.1 | 1,826.87 kB | 417.86 kB |

## 后续验证建议

在 https://javdb.com 详情页（脚本更新后刷新）：

1. 展开面板旁「➕ 新增清單」→ 输入新清单名 → 点保存
2. 应**立即**出现：
   - toast `✓ 清單「X」已建立，已自動關聯當前影片`
   - `.jhs-list-panel` 内**立即新增**该清单 checkbox 且已勾选（无需刷新）
   - 控制台 `[JavDB] ═══ 勾选 [番号] → X ═══` + `同步结果: ... association=created`
3. 刷新页面后该 checkbox 仍勾选（JavDB 服务端 + 本地 IDB 双持久化）
4. 若清单名含「等待更新」，还应触发自动收藏（doc/53 联动）
5. 慢网络下 8s 内应能完成；超 8s 才报 `✗ 新增清單超時`
