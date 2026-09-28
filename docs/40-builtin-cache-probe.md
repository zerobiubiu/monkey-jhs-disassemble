# 内置缓存诊断探针（沙箱内可执行）

> **文档类型**：🧾 变更记录
> **文档状态**：✅ 已执行
> **影响范围**：诊断入口（Tampermonkey 菜单）、跨帧缓存失效的可验证性
> **前置文档**：`39-cache-invalidation-split-by-write-kind.md`
> **替代文档**：无
> **生效版本**：v1.47.2

## 1. 问题：手打探针拿不到脚本全局

doc/39 修复后需要用户复核「数据写入是否还会连带清掉设置缓存」。我先给的是一段控制台代码，实测失败：

```
Uncaught TypeError: Cannot read properties of undefined (reading 'getSetting')
```

原因：油猴脚本运行在**沙箱**中（`@grant` 非 none），`storageManager` 等全局只存在于脚本作用域，
**devtools 控制台（页面主世界）看不到它们** —— 所以「在控制台手打探针」这条路在本项目天然走不通。

结论：诊断入口必须由脚本自己提供，并在**脚本作用域内**执行。

## 2. 实现：GM 菜单两条命令

`src/core/plugin-diagnostics.tsx` 新增（与既有的「📊 插件诊断」菜单并列）：

| 菜单命令 | 行为 |
|---|---|
| 🧪 缓存诊断 ①：记录当前状态 | 读一次设置（填充缓存）→ 记录「帧 / 缓存是否就绪 / 读取耗时」到 GM 存储，并提示 |
| 🧪 缓存诊断 ②：检查是否被清 | 对比快照与当前缓存状态，输出报告：`当前缓存=空/已就绪`、本次读取耗时、`OK/BAD/WARN` 判据；结果进 **日志面板** + 复制到剪贴板 |

导出（可测）：`captureCacheProbe(sm)` / `checkCacheProbe(sm)` / `readCacheProbeSnapshot()` /
`SettingsReader` / `CacheProbeSnapshot`。

判据（对应 doc/39 的根因）：

- `缓存=已就绪` + 读取 ≈ 内存量级 → **修复生效**（数据写入没有连带清设置缓存）；
- `缓存=空` 且刚在 iframe 做过操作 → 仍被数据写入连带清除（BUG 未修复）；
- 读取耗时 > 5ms → 走了 IndexedDB（而非内存命中）。

用法（复现一次即可）：

1. 在**父页**（列表页）执行「① 记录当前状态」；
2. 打开一个详情弹窗，点一次「收藏 / 已读」，关掉弹窗；
3. 回到**父页**执行「② 检查是否被清」，把结果发我。

## 3. 实现清单

| 文件 | 变更 |
|---|---|
| `src/core/plugin-diagnostics.tsx` | 新增缓存探针（`SettingsReader` / `CacheProbeSnapshot` / `captureCacheProbe` / `readCacheProbeSnapshot` / `checkCacheProbe`）与两条 GM 菜单命令 |
| `tests/cache-probe.test.ts` | **新增 7 用例**：快照读写、冷/热缓存判定、`OK` / `BAD` / `WARN` 判据分支 |

不改动：`StorageManager`（探针只**读**其运行时私有字段 `cacheSettingObj`，不写）；
存储 schema（仍为 6）；`perf-trace`（完整的跨帧「点卡片 → 设置读取 → layer 创建 → iframe load」
埋点仍是可选下一步，本次先给能直接判定 doc/39 是否生效的最小探针）。

## 4. 验证

- `bun run build` / `lint` / `lint:css` / `test`（**34 文件 / 349 用例**）/ `check:structure` /
  `check:docs` / `check:selectors` 全绿；`dist @version` = 1.47.2。
- 探针本身未被真实浏览器执行过（本机无可用浏览器自动化）→ 需用户按 §2 步骤跑一次并回传结果。
