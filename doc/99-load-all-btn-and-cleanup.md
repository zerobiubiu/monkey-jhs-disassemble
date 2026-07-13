# 99 - 清理瀑布流遗留调用 + 新增「加载全部」按钮

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行

## 背景

两处改动：

1. **清理遗留调用**：`AutoPagePlugin.shouldDisablePaging()` 中
   `await storageManager.getSetting('autoPage', YES)` 读取了 setting 但
   **完全没使用返回值**——方法实际只检查「是否列表页」+「URL 是否命中特殊
   路径」。是原脚本遗留代码（曾用 autoPage 值决定是否禁用，后逻辑移到
   loadNextPage 但这行忘了删），属无效 IndexedDB 读取死代码。

2. **新增「加载全部」按钮**：瀑布流模式（autoPage=YES）下，原机制需滚动到
   底部才触发下一页加载。用户需要一个按钮，点击后自动加载后续所有内容，
   无需逐页滚动。

## 方案

### 1. 清理遗留调用

删除 `shouldDisablePaging()` 中的 `await storageManager.getSetting('autoPage', YES)`
行。方法签名保持 `async`（不影响调用方），仅去掉无效读取。

### 2. 新增「加载全部」浮动按钮

在 `AutoPagePlugin` 中新增浮动按钮，瀑布流启动且有下一页时创建：

**触发条件**：`waterfall()` 末尾，`hasMore` 为 true 且 `autoPage === YES` 时
调用 `createLoadAllBtn()`。

**按钮行为**：
- 固定定位在页面右下角（`position:fixed; right:20px; bottom:80px`）
- 点击 → `loadAllPages()`：循环 `await loadNextPage()` 直到无更多页
- 加载中：文案「加载中...（第 N 页）」+ 禁用态样式（`opacity:0.6; cursor:wait`）
- 加载完成：文案「✓ 已全部加载」，2 秒后淡出移除
- 加载失败：文案「加载失败，点击重试」，可点击重试

**防死循环**：`loadAllPages` 的 while 循环通过 `pageItems.length` 变化检测
无进展——若 `loadNextPage` 未追加新页（autoPage 被关闭 / isLoading 重入 /
错误），`pageItems.length` 不变 → `break` 退出循环。

**防重入**：`isLoadingAll` 标志 + 按钮点击事件检查 `!this.isLoadingAll`。

**与 scroll 触发共存**：`loadAllPages` 用 `await` 串行调用 `loadNextPage`，
每次 `loadNextPage` 内部的 `isLoading` 防重入会拦截 scroll 事件触发的并发请求。

## 实施

| 文件 | 改动 |
|------|------|
| `src/plugins/auto-page-plugin.ts` | 删除 `shouldDisablePaging` 中遗留 `await getSetting('autoPage', YES)` 行；新增 `loadAllBtn`/`isLoadingAll` 字段；`waterfall()` 末尾 autoPage=YES 且 hasMore 时调 `createLoadAllBtn()`；新增 `createLoadAllBtn()`/`loadAllPages()`/`updateLoadAllBtn()` 三方法 |
| `src/styles/auto-page-plugin.css` | 新增 `.jhs-load-all-btn` 浮动按钮样式（fixed 定位 + 渐变背景 + hover 上浮 + disabled 半透明 + fadeout 淡出） |

### 新增方法说明

| 方法 | 职责 |
|------|------|
| `createLoadAllBtn()` | 创建 div 按钮 → appendChild body → 绑定 click → loadAllPages |
| `loadAllPages()` | 循环 `await loadNextPage()` 直到 `!hasMore` / 无进展 / 出错；完成淡出移除；失败可重试 |
| `updateLoadAllBtn(text, disabled)` | 更新按钮文案 + 切换 disabled class |

## 执行验证

```
$ bun run build
$ tsc -b && vite build
✓ 219 modules transformed.
dist/monkey-jhs-disassemble.user.js  1,878.65 kB │ gzip: 432.79 kB
✓ built in 1.11s
```

- `tsc -b` 零错误，`auto-page-plugin.ts` 诊断无 error/warning
- 产物 1878.65 kB（gzip 432.79 kB），较 1.12.9 的 1876.53 kB **+2.12 kB**
  （新增按钮 + 方法 + CSS）
- version `1.12.9` → `1.13.0`（新增功能，minor 递增）

## 后续验证建议

1. 打开 javdb 列表页（非搜索/播放/已观看页），确保快捷设置中「瀑布流模式」开启
2. 页面右下角应出现蓝色「加载全部」浮动按钮
3. 点击按钮 → 文案变为「加载中...（第 N 页）」→ 持续加载 → 「✓ 已全部加载」→ 淡出
4. 加载过程中滚动页面 → 不影响按钮加载（scroll 触发的 loadNextPage 被 isLoading 拦截）
5. 关闭「瀑布流模式」→ 刷新 → 按钮不再出现
6. 搜索页 / 已观看页 → 瀑布流不启动 → 按钮不出现
