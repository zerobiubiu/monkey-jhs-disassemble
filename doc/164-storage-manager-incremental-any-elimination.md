# doc/164 — storage-manager 迁移方法增量 any 消除

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

批次 6 规则「禁止新增 any；存量在每次触及相关文件时消除」。`storage-manager.ts` 在
doc/162 因加可注入 seam 已被触及，故本轮按**增量**节奏消除其迁移路径上的显式 any——
这是 805-any 大项的**规定推进方式**（每次触及消除一批），而非需 jQuery/layer/Tabulator
类型声明的多会话 big-bang（后者仍属 backlog）。

「类型/结构正确性」是用户命名轴之一；本变更为纯类型收紧，由 `tsc -b` 严格模式裁决，
非「find-0」式审计。

## 方案：重类型到既有接口

四个迁移方法的数组元素与既有接口一一对应，且接口已含旧迁移字段为**可选属性** +
`[key: string]: any` 索引签名，故：

- 数组读取 `as Promise<any[]>` → `as Promise<CarRecord[]>` / `BlacklistItem[]` /
  `FavoriteActress[]`；局部 `const list: any[]` 同理收紧。
- 回调参数 `(item: any) =>` 的 `: any` **删除**，改由数组元素类型推断。
- 迁移体的 `delete item.actress` / `item.role = …` / `item.starId = …` /
  `const cleaned: BlacklistItem = { ...item }` 等，因可选属性 + 索引签名仍类型合法，
  **无需任何 `as any` 回填**，亦不触发 `noImplicitAny`。

| 方法 | 数组重类型 |
|------|-----------|
| `clean_no_url_blacklist` | `blacklist_car_list`→`CarRecord[]`；`blacklist`→`BlacklistItem[]` |
| `merge_blacklist` | `blacklist`→`BlacklistItem[]`；`blacklist_car_list`→`CarRecord[]` |
| `merge_favoriteActress` | `favorite_actresses`→`FavoriteActress[]` |
| `merge_tow_car_list_table` | 两个清单均→`CarRecord[]` |

### 有意保留为 backlog（非 scope shrink，附理由）

- `merge_table_name`：六个旧键各自形状不同（演员/番号/收藏/关键词/标签混合），无单一
  接口可承载，强转需联合类型或逐键分支，收益不抵复杂度。
- `async_merge_other`：操作对象为 `Setting`（`getSetting` 返回），其废弃键删除本就经
  `Setting` 的索引签名表达，无独立 `any[]` 可消。
- `getBlacklistCarList` 原始读 `fresh`：其唯一 `as Promise<any[]>` 经 `utils.copyObj` /
  `utils.deepFreeze`（二者签名本身为 `any`）流转，局部收紧**不产生下游类型安全收益**，
  故不在本轮触及（避免无收益 churn）。

## 实施

| 文件 | 操作 |
|------|------|
| `src/core/storage-manager.ts` | 修改：4 方法 18 处显式 any 标注移除/收紧（4 数组类型 + 14 回调/读取标注） |
| `vite.config.ts` / `package.json` | 修改：version 1.28.4→1.28.5 |
| `changelog/CHANGELOG.md` | 修改：新增 v1.28.5 |
| `doc/README.md` | 修改：阅读顺序追加 doc/164 |
| `AGENTS.md` | 修改：§6.3 注记增量 any 消除示范 + 残留 backlog |

## 验证（编译器/检查器裁决，非自述）

```
$ bun run build          # tsc -b && vite build
✓ built in 1.19s         # 严格模式编译通过 → 重类型无隐式 any、无类型错误

$ bun run lint           # eslint src/
✖ 786 problems (0 errors, 786 warnings)   # no-explicit-any 由 805 降至 786（−19）

$ bun run test
 Test Files  3 passed (3)
      Tests  28 passed (28)                # 行为不变（纯类型变更）
```

`storage-manager.ts` 残留含 `any` 行 ≈ 21（字段 `forage: any`、`getSetting`/`saveSetting`
的 `any`、`Setting` 与各接口索引签名、上述三项 backlog 方法），属已知多会话 backlog。

## 版本号决策

本变更为 `src/` 类型修改 → 按 §6.1.1 递增 patch：1.28.4→**1.28.5**；`package.json`
version 字段同步。

## 后续

- 805→786 后，继续按「触及即消除」在每次编辑某文件时收紧其 any；big-bang 消除需先补
  jQuery/layer/Tabulator 类型声明（多会话）。
- 若未来为 `utils.copyObj`/`deepFreeze` 引入泛型签名，可顺势收紧 `getBlacklistCarList`
  原始读等当前保留项。
