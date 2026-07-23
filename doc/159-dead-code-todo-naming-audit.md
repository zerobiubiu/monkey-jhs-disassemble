# doc/159 — 死代码 / TODO / 命名三维审计

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

第三至七轮（doc/153–158）闭合了九维结构正确性审计。本轮补充审计三个
**代码卫生**维度：死代码/未使用导出、TODO/FIXME/HACK 标记、命名约定一致性。

## 审计结果

| 维度 | 全树结果 | 说明 |
|------|----------|------|
| TODO / FIXME / HACK / XXX | **0** | 唯一匹配 `yXXXX=年份` 为格式描述，非标记 |
| snake_case 方法名 | **6** | `merge_table_name` / `clean_no_url_blacklist` / `async_merge_other` / `merge_blacklist` / `merge_favoriteActress` / `merge_tow_car_list_table`——遗留迁移方法，schema 版本化（doc/135）后为死代码但保留向后兼容 |
| snake_case 变量名 | **3** | `update_date` / `release_date` / `cover_src`——API schema 字段名，有意保留与外部数据格式一致 |
| 注释掉的代码块 | **0** | 无连续 3+ 行注释代码（文件头迁移说明注释不计） |

### snake_case 方法名明细

| 文件 | 方法 | 分类 |
|------|------|------|
| `src/core/storage-manager.ts` | `merge_table_name()` | 遗留迁移（schema v0→v1） |
| `src/core/storage-manager.ts` | `clean_no_url_blacklist()` | 遗留迁移（schema v1→v2） |
| `src/core/storage-manager.ts` | `async_merge_other()` | 遗留迁移（schema v2→v3） |
| `src/core/storage-manager.ts` | `merge_blacklist()` | 遗留迁移（schema v3→v4） |
| `src/core/storage-manager.ts` | `merge_favoriteActress()` | 遗留迁移（schema v4→v5） |
| `src/core/storage-manager.ts` | `merge_tow_car_list_table()` | 遗留迁移（schema v5→v6） |

这 6 个方法在 schema 版本化迁移（doc/135）后不再被 `main.tsx` 直接调用
（改为 `runMigrations()` 内部调度），但保留为 `private` 方法供迁移步骤内部使用。
重命名为 camelCase 会破坏 `runMigrationStep()` 中的方法引用映射，且无功能收益——
属于「有意保留的遗留命名」，非缺陷。

### snake_case 变量名明细

| 文件 | 变量 | 分类 |
|------|------|------|
| `src/plugins/car-status-sync/car-status-columnar.ts:118` | `update_date` | API schema 字段（列存格式键名） |
| `src/plugins/video-lists-tag/vlt-sync.ts:148` | `release_date` | API schema 字段（JavDB 页面提取） |
| `src/plugins/video-lists-tag/vlt-sync.ts:151` | `cover_src` | API schema 字段（JavDB 页面提取） |

这 3 个变量名与外部 API/页面 DOM 的字段名一一对应，重命名会引入不必要的
映射层，违反「与数据源格式一致」原则。

## 全树代码卫生审计闭合状态

| 维度 | 轮次 | 状态 |
|------|------|------|
| console→clog 错误统一 | R3+R4 | ✅ |
| show.error instanceof 守卫 | R3+R4 | ✅ |
| 导入六组顺序 | R3+R4+R5+R6 | ✅ |
| CSS 类名前缀 | R3 | ✅ |
| z-index 令牌 | R3 | ✅ |
| devtools 跟踪保留 | R4 | ✅ |
| 空 catch 块分类 | R7（修正） | ✅ (17 有意) |
| @ts-ignore / @ts-expect-error | R7 | ✅ (0) |
| eslint-disable 抑制 | R7 | ✅ (0 block) |
| TODO / FIXME / HACK | **R8** | ✅ (0) |
| 死代码 / 注释代码块 | **R8** | ✅ (0) |
| 命名约定 | **R8** | ✅ (9 有意保留) |

**十二维结构正确性 + 代码卫生审计闭合。**

## 版本号决策

本轮**无 src/ 变更**（全树审计清洁或有意保留）。按 §6.1.1，**不递增版本号**，
**不写 CHANGELOG 条目**。

## 实施

| 文件 | 操作 |
|------|------|
| `doc/158-silent-catch-and-type-escape-audit.md` | 修改：空 catch 计数从 0 修正为 17（有意 best-effort） |
| `doc/README.md` | 修改：doc/158 描述修正 + 追加 doc/159 |

## 执行验证记录

```
$ bun run build
tsc -b && vite build
✓ 229 modules transformed.
dist/monkey-jhs-disassemble.user.js  2,024.66 kB │ gzip: 467.32 kB
✓ built in 1.25s
```

tsc 零错误。产物大小不变。`@version` 仍为 1.28.3（未递增）。
