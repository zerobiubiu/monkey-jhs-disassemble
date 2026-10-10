# 遗留死件裁决记录（v1.47.4 后复核）

> **文档类型**：🧭 架构决策
> **文档状态**：📄 参考
> **影响范围**：`src/plugins/setting/jhs-sync/`、`src/plugins/other-site-plugin.tsx`、`src/plugins/new-video-plugin.tsx`、`src/plugins/detail-page-button/`、`src/plugins/auto-page/`、`src/plugins/blacklist/`、`src/plugins/list-page-button-plugin.tsx`、`src/core/storage/`
> **前置文档**：`43-dead-module-cleanup.md`（零引用模块清理）
> **替代文档**：无（本裁决替代的只是各档案中的「待清理」口吻，不替代其正文）
> **生效版本**：1.47.4（裁决基线；本轮无 `src/` 改动）

## 1. 背景

`docs/43`（v1.47.4）按 import 图删除了 7 个零引用文件。清理后仍余 6 项「疑似死件」，当时标注为「需产品裁决」。本轮对每项做**四查取证**后逐项裁决，结论：**全部保留，且不修改任何 `src/` 代码**。

## 2. 取证口径

对每个候选对象查四项，任一项成立即不足以判死：

1. **调用点**：是否存在运行期调用（含经 `getBean` 的可达面）；
2. **创建者**：其依赖的 DOM id / 选择器在当前代码中是否仍有创建者；
3. **消费方**：是否有真实导入方（规格化说明符，含 barrel 目录导入）；
4. **记录**：现有档案是否已就该对象作出「有意保留」的决策（冻结档案只读）。

## 3. 逐项裁决

| # | 对象 | 取证结果 | 裁决 |
|---|------|----------|------|
| 1 | `src/plugins/setting/jhs-sync/index.ts`（barrel） | 消费方 0（`src`/`tests`/`scripts` 全仓无 `from '…jhs-sync'`；消费方均直连 `sync-common` / `op-sync-records` / `sync-engine` / `fav-sync-bind`）。**但**其导出集合本身不足以服务现消费方（`sync-common`、`op-sync-records` 未在其中），删除不会消除任何真实重复 | **保留**：它是 doc/214 声明的模块统一出口；删掉只会让冻结档案的「模块出口」描述失配，收益仅为 15 行 |
| 2 | `other-site-plugin.tsx` 的 `renderSettingsArea` / `setupEventListeners` + `components/other-site/other-site-checkbox.tsx` | 二者恒为 no-op：`#siteCheckboxes` / `#settingsArea` 在 `other-site-plugin.tsx` 之外**无任何创建者**（已核）；`OtherSiteCheckbox` 唯一消费者是 `renderSettingsArea` | **保留**：`archetype/doc/07` 明确记为「有意死代码（DOM 已删、靠 null 静默跳过）」并**要求勿误判为 bug 或恢复设置 UI**——该空守卫本身就是这条护栏 |
| 3 | `new-video-plugin.tsx` 的 `resetBtnTip()` 空实现 | 有调用点（`setting-form-load.ts` 保存设置后调用），与 `BlacklistPlugin.resetBtnTip()` 对称；删除会同时改动 `setting-form-load` 的调用点并在 getBean 可达面上留缺口 | **保留**：属刻意的 API 表面对称（原脚本同形） |
| 4 | `dpb-helpers.ts` 的 `waitForDomChange` / `waitForEl` + 插件的 `_waitForDomChange` / `_waitForEl` 包装 | 包装方法在详情页插件类上，属既有 getBean 可达面；`archetype/doc/04` 记为有意保留 | **保留** |
| 5 | Beyond60 死分支（`auto-page/ap-fetch.ts`、`blacklist/blacklist-scraper.tsx`、`components/movie/movie-list-wrapper.tsx`） | `Beyond60Plugin` 从未注册 → 运行期 `getBean` 返回 `undefined` → 静默回退 `gmHttp`（已核）；分支不可达但**回退链完整** | **保留**：忠实死路径，保留原脚本控制流（zero-diff 原则）；删除即偏离基准脚本 |
| 6 | `list-page-button-plugin.tsx` 本地 `HAS_DOWN_TEXT` 与 `core/storage/car-list-ops.ts` 的 `HAS_DOWN_STATUS` | 前者已无 DOM 可匹配（`skipTags` 中的无害条目）；后者**不是死代码**——存量记录 `status='hasDown'` 仍需可读（迁移须保兼容） | **保留**：前者无害；后者为存量数据兼容契约（`constants/status.ts` 的同名文案常量在 FC2 弹窗仍在用） |

## 4. 未采纳方案与理由

| 方案 | 不采纳原因 |
|------|-----------|
| 删除第 1–2 项 | 跨 6+ 文件、需新增版本 + 变更文档 + AOCI 治理轮次；收益仅为行数，且与「零偏差（zero-diff）」原则及多份冻结档案的记录直接冲突 |
| 删除第 5 项（Beyond60） | 会把「保留原脚本控制流」的原则性取舍变成局部偏离，失去将来对照基准的意义 |
| 删除第 6 项后半（`HAS_DOWN_STATUS`） | 会让历史 `hasDown` 记录在 `saveSingleCar` / `updateCarInfo` 路径上抛错，属真实数据兼容回归 |

## 5. 复核触发条件（何时应重开本裁决）

1. 真要**恢复**「外站设置区 UI」（第 2 项应按新宿主复用或连同删除，而不是复活旧模板）；
2. 「零偏差」原则被正式废弃或替换（第 5 项随之可清）；
3. 存量 `hasDown` 数据完成迁移/清理（第 6 项兼容分支可退场）；
4. 模块统一出口策略变更（第 1 项 barrel 应改为删除或补齐导出并接线消费方）。

## 6. 执行验证记录

### 执行环境
- Windows（win32 10.0.26300，x64），工作目录 `E:/monkey-jhs-disassemble`；基线 HEAD 含 `docs/43`（v1.47.4）与已对齐的 AOCI 索引（535 条）

### 验证命令
```bash
# 消费方取证（barrel）
grep -rnE "from ['\"][^'\"]*jhs-sync['\"]|import\(['\"][^'\"]*jhs-sync['\"]\)" src tests scripts
# DOM 创建者取证（no-op 方法）
grep -rn "siteCheckboxes\|settingsArea" src | grep -v "other-site-plugin.tsx"
# 调用点取证
grep -rn "renderSettingsArea\|setupEventListeners\|resetBtnTip\|Beyond60Plugin" src
# 门禁（证明本轮无 src 变更、门禁不受影响）
bun run check:docs; bun run check:structure; bun run check:selectors; bun run check:version
```

### 实际输出
- barrel 消费方：`count=0`；DOM 创建者：**空**（除 `other-site-plugin.tsx` 自身的读取）；`renderSettingsArea` / `setupEventListeners` 仅在本文件 L258–259 被调用；`resetBtnTip` 调用点为 `setting-form-load.ts` L277/279；`Beyond60Plugin` 仅以 `import type` 出现在两处死分支。
- 四条门禁：`check-doc-catalog: OK (44 plugins [5 flagged], 62 core files)`、`check-structure: OK`、`check-site-selectors: OK`、`check-version-sync: OK (1.47.4 = 1.47.4)`。

### 前端或调用方验证
本轮**不含任何 `src/` 改动**，故无需 build / 运行时冒烟；受影响的只是「是否删除」的决策记录，功能面与 v1.47.4 完全一致。

### 验证结论
✅ 裁决完成：6 项全部保留，逐项给出取证与依据；未产生 `src/` 变更，故不递增 `userscript.version`。

### 已知限制
- 取证为静态分析（调用点 / 创建者 / 消费方 / 档案记录四查），未在真实站点运行确认第 2 项空守卫的实际跳过行为；如需，可在 JavDB 详情页确认「外站设置区」不存在且无控制台异常。
- 第 2 项的空守卫若被将来的重构移除，必须同时处理「恢复设置 UI」的决策（见 §5 第 1 条）。