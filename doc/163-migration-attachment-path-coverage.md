# doc/163 — 迁移附件分析路径的正向回归补全

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

用户附件对存储迁移路径做了逐方法成本/正确性分析，其中**两个方法的行为被重点剖析**：

- `clean_no_url_blacklist`：跨 `blacklist`（演员）与 `blacklist_car_list`（番号）两个清单
  的相互过滤，以及 `key`/`recordTime` 冗余字段删除、`recordTime`→`createTime` 迁移。
- `async_merge_other`：设置对象中 17 个废弃定时任务键 + `downPath115` 的删除。

doc/162 落地的迁移套件（5 用例）覆盖了 `runMigrations` 的**集成契约**（幂等/门控/
全量/缓存失效/失败重试），但上述两个方法的具体转换逻辑只在全量 0→6 用例中被**顺带**
经过、未被**断言**——即基线「转为回归测试保护」在最被 scrutinize 的代码路径上仍留缺口。
本轮以**聚焦的直接调用**补两个正向用例，精确守护这两段逻辑，且不重复集成路径。

## 方案

- 在 `tests/storage-migration.test.ts` 追加第二个 `describe`，**直接调用**公开方法
  `clean_no_url_blacklist()` / `async_merge_other()`（非经 `runMigrations`），隔离被测行为。
- 复用既有 `FakeForage`（Map 后端）与 `stubGlobals()`；为 `async_merge_other` 的
  `saveSetting` 路径追加 `window.clean_cacheSettingObj` noop 替身（`saveSetting` 无条件
  调用该钩子；`storageRevision.increment()` 经可选链 + try/catch 对未初始化通道安全，
  无需额外替身）。`restoreGlobals()` 对称还原。
- 修正文件头注释中过时的 `environment: node` 描述为 `jsdom`（与实际文件级 pragma 一致）。

### 用例 6：clean_no_url_blacklist 跨清单过滤

种子：演员 `[{name:'Alice',key,recordTime:1000},{name:'Orphan',key,recordTime:2000}]`；
番号 `[{carNum:'C1',actress:'Alice'},{carNum:'C2',actress:'Ghost'},{carNum:'C3'}]`。
断言：

- 番号侧保留 `['C1','C3']`（`C2` 的 actress `Ghost` 不在演员 nameSet → 清除）。
- 演员侧仅余 `Alice`（`Orphan` 的 name 不在保留番号的 actressSet → 清除）；
  `Alice` 的 `createTime===1000`，且不再含 `key`/`recordTime`。

### 用例 7：async_merge_other 废弃键删除

种子设置 `{theme:'dark', enableCheckBlacklist:true, checkRequestSleep:500, downPath115:'/old/path'}`。
断言：`theme` 保留；三个废弃键均被删除。该路径触发 `saveSetting`，验证
`window.clean_cacheSettingObj` 替身使调用不抛错。

## 实施

| 文件 | 操作 |
|------|------|
| `tests/storage-migration.test.ts` | 修改：头注释更正 + `stubGlobals`/`restoreGlobals` 增 window 钩子 + 追加第二 describe（2 用例） |
| `AGENTS.md` | 修改：§6.3 迁移套件 5→7 用例 + window 替身说明 |
| `doc/README.md` | 修改：阅读顺序追加 doc/163 |

## 版本号决策

本轮**无 `src/` 变更**（仅 `tests/` + 文档）→ 按 §6.1.1 **不递增 `userscript.version`**，
**不写 CHANGELOG 条目**（CHANGELOG 按版本键控；与 R5/R7/R8/R9/R10 纯文档/测试轮次一致）。
构建产物字节不变（`@version` 仍 1.28.4）。

## 执行验证记录

```
$ bun run test
 Test Files  3 passed (3)
      Tests  28 passed (28)        # 26 既有 + 2 新增

$ bun run build
✓ built in 1.20s
// @version      1.28.4            # 未递增（tests/-only）

$ bun run lint        # eslint src/，不扫描 tests/
✖ 805 problems (0 errors, 805 warnings)

$ bun run lint:css    # stylelint 0 errors
```

## 迁移套件覆盖矩阵（闭合）

| 方法 | 覆盖用例 |
|------|----------|
| `merge_table_name` | 全量 0→6（旧键迁移+删除） |
| `clean_no_url_blacklist` | **用例 6（正向）** + 门控/全量经过 |
| `async_merge_other` | **用例 7（正向）** + 门控/全量经过 |
| `merge_blacklist` | 门控（isActor→role/url→starId/allName/movieType） |
| `merge_favoriteActress` | 门控（dbId→starId） |
| `merge_tow_car_list_table` | 门控 + 缓存失效（actress→names） |
| `runMigrations` 编排 | 幂等 / 门控 / 全量 / 失败重试 |

附件分析的全部六步迁移 + 编排逻辑现均有断言级回归保护。
