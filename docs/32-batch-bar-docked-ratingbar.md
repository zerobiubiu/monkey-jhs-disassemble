# 实测反馈二轮：常驻批量操作条 + 快捷评分条同构（收藏/已读/拉黑/五星）

> **文档类型**：🧾 变更记录
> **文档状态**：✅ 已执行
> **影响范围**：列表页批量操作 UI（操作条位置/形态/操作集）、拉黑批量计划
> **前置文档**：`30-ui-polish-from-field-testing.md`
> **替代文档**：无
> **生效版本**：v1.46.25

## 1. 需求（用户实测反馈二轮）

1. 「全选 / 反选」等**不该在浮出工具栏里**（选了视频才出现不符合交互易用设计）。
2. `0星` 不能叫 0星，改叫 **已读**，且与收藏**并列**。
3. 星级不能是 1–5 的数字+星的独立按钮 —— 参考详情页自定义快捷评分组件：
   分为 **收藏 - 已读 - 拉黑** 三态 + **五颗星**（点第几颗星就是几分）。

## 2. 依据

详情页快捷评分条：`src/components/dpb/rating-bar-html.tsx`（`.jhs-stars` 五星 +
`.jhs-rating-actions` 的 收藏/已读/拉黑）与样式契约 `src/styles/rating-bar.css`
（收藏蓝 `#3273dc`、已读绿 `#48c774`、拉黑红 `#de3333`、星星 `#f5b301` / hover `#ffce3a`）。
列表页这套**完整复用同一类名契约与配色**，只做紧凑化覆盖 —— 不新增色值、不造新形。

## 3. 实施

### 3.1 常驻操作条（不再浮出）

- `renderBatchToolbar()` 改为把操作条 `appendChild` 到筛选栏 `.preload-filter-bar` **尾部**，
  与筛选芯片同级在场；筛选栏未就绪时返回，由 init 时序兜底重试。
- 操作条**始终在场**，不随勾选数出现/消失；只按 `busy / count === 0` 切换禁用态
  （操作在「无选择」时禁用；`全选/反选/清空` 不受限，否则无法开始选择）。
- 删除旧浮层（`position: fixed` 底部弹出层）与 `total` prop。

### 3.2 操作组与详情页快捷评分条同构

| 控件 | data-act | data-score | 语义 |
|---|---|---|---|
| ★★★★★（5 个 `.jhs-star`） | `watched` | 1–5 | 已读 N 星（点第 N 颗 = N 星） |
| `已读`（`.jhs-read-btn`） | `watched` | 0 | 已看 0 星（未评分） |
| `收藏`（`.jhs-fav-btn`） | `favorite` | — | 想看 |
| `拉黑`（`.jhs-block-btn`） | `filter` | — | 屏蔽 |

- 星星沿用 `rating-bar.css` 的 `.jhs-star`（`★` 文字形、hover 预览与详情页一致由
  `:hover` 链承担，这里用 `--jhs-color-warning`）；按钮态：`is-active` 亮起、
  `is-popping` 弹跳、`is-disabled` 由容器类接管（与详情页同约定）。
- 三态按钮类名与配色**原样复用** `rating-bar.css`（`is-active` 时分别亮起）。

### 3.3 拉黑批量计划

- 新增 `planFilterBatch()`：与收藏同一计划逻辑，`actionType: FILTER_ACTION`；
  已在屏蔽列表的番号跳过（存储层 `saveSingleCar` 的 FILTER 分支对重复屏蔽抛错）。
- `BatchActionKind` 增加 `'filter'`；`runBatch` 增加 filter 分支。
- **注意**：拉黑会让卡片被屏蔽插件隐藏 → `refreshAfterBatch` 已有的
  `doFilter` + `syncBatchCheckboxes` 会重建可见集，无需额外处理。

## 4. 修改文件清单

| 文件 | 变更 |
|---|---|
| `src/components/list-page/lp-batch-bar.tsx` | 常驻操作条（选择组 + 五星 + 三态按钮 + 计数），移除 `total` prop |
| `src/plugins/list-page/lp-batch.tsx` | 操作条改挂筛选栏尾部、常驻；`filter` 分支；导入 `planFilterBatch` / `FILTER_ACTION` |
| `src/plugins/list-page/lp-batch-state.ts` | `BatchActionKind` 增加 `'filter'`；新增 `planFilterBatch`；导入 `FILTER_ACTION` |
| `src/styles/list-page/lp-batch.css` | 常驻条样式（左边界线 + 紧凑组）、星星紧凑覆盖、三态按钮紧凑化 |
| `tests/batch-ui-render.test.ts` | 渲染契约同步（`filter`/已读0星/五颗星 1–5） |

## 5. 执行验证记录

| 命令 | 结果 |
|---|---|
| `bun run build` | exit 0 |
| `bun run lint` | exit 0（0 problems） |
| `bun run lint:css` | exit 0 |
| `bun run test` | exit 0；**29 文件 / 307 用例** |
| `bun run check:structure` | exit 0 |
| `bun run check:docs` | exit 0 |
| `bun run check:selectors` | exit 0（89 文件 / 275 处，与基线持平） |

## 6. 真实浏览器验证建议

1. 筛选栏尾部出现**常驻**操作条（选择组 | 星星+收藏/已读/拉黑 | 已选计数），未勾选时也在场。
2. 点星星条的第 3 颗 → 已选卡片全部变为「已读 3 星」；点 `已读` → 全部 0 星。
3. 点 `拉黑` → 卡片消失（被屏蔽插件隐藏），状态标签筛选栏计数同步变化。
4. 未勾选任何卡片时：操作按钮禁用，`全选/反选/清空` 中 `全选/反选` 仍可点。
5. 悬停星星 → 前几颗高亮（预览），与详情页快捷评分条一致。

## 7. 已知限制

- 操作条挂在 `.preload-filter-bar` 尾部：若用户关闭了预加载筛选栏（`enablePreloadStatus`），
  操作条也不会出现（需另给常驻挂载点，见 doc/26 同样依赖该栏的「请求列表」入口）。
- 拉黑未推送 JavDB（服务器侧「屏蔽」不在 `sync-common` 现有原语中）；本地屏蔽生效。
- 「全选/反选」范围 = 当前**可见**卡片（v1.46.25 口径）。
