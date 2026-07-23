# doc/162 — schema 迁移回归测试 + 可注入存储 seam

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

基线要求「最近完成的…转为回归测试保护」，验证矩阵要求「每个发布必须通过…测试」。
doc/135 的 `runMigrations` 版本化迁移此前**无回归测试**——doc/161 落地测试基建时
将其列为「下一目标」，原因是 `StorageManager.forage` 为构造期硬绑定的
`private readonly` 字段，无注入 seam，无法在测试中替换为可控存储。本轮闭合该缺口。

同时复核用户附件列举的存储迁移四项缺陷，结论是**四项均已被 doc/135 修复**，附件
分析针对的是 doc/135 之前 `main.tsx` 中六个独立迁移调用的旧形态。

## 附件四缺陷复核（无方法体改动）

| 附件缺陷 | 附件描述 | 当前代码 | 结论 |
|----------|----------|----------|------|
| 迁移后缓存陈旧 | `merge_tow_car_list_table` 写完不清缓存 | `runMigrations` 循环后 L177-181 无条件清空全部 4 缓存；各步骤 `changed` 时亦清 | ✅ 已修复 |
| 冻结对象 TypeError | `getBlacklistCarList` 返回 deepFreeze，迁移却改记录 | 四个迁移方法均 `this.forage.getItem` 直读，绕过 deepFreeze getter（注释「绕过 deepFreeze」） | ✅ 已修复 |
| 无错误隔离 | 一步抛错阻断全部插件 | `runMigrations` 逐步 try/catch + `break` + 仅成功写版本号 + `navigator.locks` | ✅ 已修复 |
| 首记录当版本号 | `blacklistCars[0].actress` 隐式 schema 判断 | 已改用 `SCHEMA_VERSION_KEY` + `?? 0` + 版本门控步骤；`clean_no_url_blacklist` 现为全量 `.filter/.map` 扫描，**无 `[0]` 启发式**（L1118 为「两者皆空」合法 no-op 守卫，非该启发式） | ✅ 已修复 |

故本轮**不改动**上述方法体——「修复」已工作的代码只会引入回归风险。

## 方案

### 1. 可注入存储 seam（向后兼容）

- `private readonly forage: any;` 改为**仅声明**（移除字段初始化器），实例化移入
  构造函数 `??` 回退：`this.forage = forageInstance ?? localforage.createInstance({...})`。
  生产路径（`new StorageManager()` 无参）行为不变。
- 构造函数签名 `constructor(forageInstance?: unknown)`——用 `unknown` 而非 `any`，
  遵守「禁止新增 any；触及文件时消除存量」；测试以 `as any` 在测试侧收窄。
- 新增 `static __resetForTesting(): void` 重置单例（`instance = null`，字段类型本为
  `StorageManager | null`，无需 `as any`），使各用例可独立 `new StorageManager(fake)`。

### 2. §9.2 违规修正

`merge_table_name` 6 处 `console.log('更正', oldKey)` → `clog.debug('更正', oldKey)`。
storage-manager 属项目核心基础设施，不适用「集成脚本跟踪保留 console」例外。

### 3. 回归套件 `tests/storage-migration.test.ts`

- `// @vitest-environment jsdom`：`constants/site.ts` 在模块加载期读
  `window.location.href`，node 环境无 `window`，故该套件单独用 jsdom（其余两套件仍 node）。
- 手写 `FakeForage`（`Map` 后端，实现 getItem/setItem/removeItem/clear + seed/has/get
  测试辅助），**不引入 fake-indexeddb**，精确覆盖迁移所用契约。
- `beforeEach` 注入 `globalThis.clog`（noop）与 `globalThis.utils`
  （`copyObj`/`deepFreeze`），因步骤 2 调 `clog.debug`、步骤 3 的 `getSetting` 在
  `storageCacheDeepCopy` 默认开启时调 `utils.copyObj`；设置种子不含废弃键，使步骤 3
  `changed===false` 从而不调 `saveSetting`/`window`。
- 5 用例：
  1. **幂等**：seed version=6 → 零步骤，car_list 不变。
  2. **门控**：seed version=3 → 仅 4-6；断言 isActor→role、url→starId、补 allName/movieType、
     dbId→starId、actress→names。
  3. **全量 0→6**：seed 旧键 → 新键填充、旧键删除、version=6。
  4. **缓存失效**：version=5 跑步骤 6 后 `getBlacklistCarList()` 返回迁移后数据。
  5. **失败重试**：步骤 4 读 blacklist 返回非数组致 `.map` 抛错 → version 停留 3。
- 断言采用**字段级**（`bl[0].name` 等），容忍步骤 4 追加的 allName/movieType/starId，
  避免对迁移后对象做整对象 `toEqual` 的脆弱断言。

## 实施

| 文件 | 操作 |
|------|------|
| `src/core/storage-manager.ts` | 修改：forage 改声明+构造注入；`__resetForTesting`；6× console.log→clog.debug |
| `tests/storage-migration.test.ts` | 新增：迁移回归套件（5 用例） |
| `package.json` | 修改：version 字段 1.28.3→1.28.4 |
| `vite.config.ts` | 修改：userscript.version 1.28.3→1.28.4 |
| `changelog/CHANGELOG.md` | 修改：新增 v1.28.4 |
| `doc/README.md` | 修改：阅读顺序追加 doc/162 |

## 版本号决策

本轮有 `src/` 逻辑变更（seam + clog 修正）→ 按 §6.1.1 递增 patch：1.28.3→1.28.4。
`package.json` version 字段同步（批次 6 元数据一致性）。

## 执行验证记录

```
$ bun run test
 Test Files  3 passed (3)
      Tests  26 passed (26)        # 21 既有 + 5 迁移

$ bun run build
✓ built in 1.18s
// @version      1.28.4

$ bun run lint        # eslint src/
✖ 805 problems (0 errors, 805 warnings)   # 移除 seam 引入的 2 个 any 后回到基线 805

$ bun run lint:css    # stylelint 0 errors
```

## 后续验证建议

- CI 在 `tsc -b && vite build` 后追加 `bun run test` 作为发布门禁。
- 可为步骤 3 补「含废弃键设置被清理」的正向用例（需额外 stub `window.clean_cacheSettingObj`）。
