# JavDB 简体中文（?locale=zh-CN）适配

> **文档类型**：🧾 变更记录
> **文档状态**：✅ 已执行
> **影响范围**：详情页番号读取、演员页名称/性别判定、发布日期读取（跨站点语言）
> **前置文档**：`22-site-selector-registry.md`（站点选择器注册表）
> **替代文档**：无
> **生效版本**：v1.46.14

## 1. 背景

JavDB 已支持多语言：`?locale=zh`（正體中文）/ **`?locale=zh-CN`（简体中文）** / `?locale=en`（English）。
本脚本此前只按**繁体**页面写死了若干**文本依赖**选择器，切到简体/英文即失效。

用**不带 cookie 的 `fetch`**（不改变用户语言设置）对同一页面拉取三种语言实测，证据如下：

| 依赖 | zh（繁） | zh-CN（简） | en |
|---|---|---|---|
| `a[title="複製番號"]`（`getPageInfo().carNum` 的数据源） | ✓ 1 | **✗ 0** | **✗ 0** |
| `a[title="复制番号"]` | 0 | ✓ 1 | 0 |
| `.panel-block.first-block a[data-clipboard-text]` | ✓ 1 | ✓ 1 | ✓ 1 |
| `.section-meta` 文本（男演员页） | `男優, 3345 部影片` | `男优, 3345 部影片` | `Actor, 3345 movie(s)` |
| `.section-meta` 文本（女演员页影片数行） | `77 部影片` | `77 部影片` | `77 movie(s)` |
| 详情页信息栏标签 | 番號/日期/時長/片商/評分/類別/**演員** | 番号/日期/时长/片商/评分/类别/**演员** | ID/Released Date/…/**Actor(s)** |
| 类名类（`a.actor-female` / `strong.current-title` / `.tag-expand` / `#button-collect-actor` …） | ✓ | ✓ | ✓ |

**结论**：
- **类名类选择器跨语言稳定**，无需改动；
- **文本依赖**（`title=` 属性、`:contains(...)`）随语言漂移；
- 其中 `a[title="複製番號"]` 失效是**致命**的——`carNum` 是详情页/清单/评分/影评写入的公共前置，简体用户下整条链路会断。

## 2. 方案

### 2.1 番号读取改走语言无关锚点

`base-plugin.getPageInfo()` 由 `$('a[title="複製番號"]')` 改为注册表的
`detailMetaClipboard`（`.panel-block.first-block a[data-clipboard-text]`）——三语言实测均命中且
`data-clipboard-text` 值一致（`DAZD-314`）。

### 2.2 注册表新增「多语言文案变体」+ 跨语言查询函数

`src/core/util/site/selectors.ts` 新增：

```ts
export const SITE_TEXT_VARIANTS = {
    movieCount: ['影片', 'movie'],          // 演员页「影片数量」行后缀（用于排除）
    actorMale: ['男優', '男优', 'Actor'],   // 演员页男性角色标记（用于性别判定）
    publishDate: ['日期', 'Released Date']  // 详情页「发布日期」行标签
} as const;

export function textMatchesAny(text: string, key: SiteTextKey): boolean;

// 跨语言查询封装（调用点不再持有站点字面量）
export function queryActorMetaNameRows(root?: ParentNode): HTMLElement[];
export function isMaleActorPage(root?: ParentNode): boolean;
export function queryPublishTimeText(root?: ParentNode): string;
```

**约束**：`SiteSelector.legacy` 必须是**合法 CSS**——`siteQueryCompat` 走 `querySelectorAll`，
jQuery 专有伪类（`:contains(...)`）不得写入。原 `detailPublishTime.legacy = 'strong:contains("日期:")'`
因此移除，文本回退改由 `publishDate` 变体承担。该约束由单测的不变式用例守护。

### 2.3 调用点收敛

- `base-plugin.getActressPageInfo()`：`.section-meta:not(:contains('影片'))` → `queryActorMetaNameRows()`；
  `.section-meta:contains('男優')` → `isMaleActorPage()`；发布日期 → `queryPublishTimeText()`。
- `favorite-actresses-plugin`：同款 `.section-meta` 过滤 → `queryActorMetaNameRows()`。
- 语言逻辑全部内聚在注册表，调用点**零站点字面量**（门禁因此不报新增）。

**未改动**：`actress-info-plugin.tsx`（已弃置，仍用繁体 `strong:contains("演員")`，不在本次范围）。

## 3. 实施（修改文件清单）

| 文件 | 变更 |
|---|---|
| `src/core/util/site/selectors.ts` | 新增 `SITE_TEXT_VARIANTS` / `SiteTextKey` / `textMatchesAny` / `queryActorMetaNameRows` / `isMaleActorPage` / `queryPublishTimeText`；移除 jQuery 专有的 `legacy`；`legacy` 文档补 CSS 约束 |
| `src/plugins/base-plugin.ts` | carNum 改语言无关锚点；演员名/性别/发布日期改注册表函数 |
| `src/plugins/favorite-actresses-plugin.tsx` | 演员名元信息行改 `queryActorMetaNameRows()` |
| `tests/site-selectors.test.ts` | **新增** 11 用例（多语言变体命中/不误判 + 注册表 API + `legacy` CSS 合法性不变式） |
| `scripts/site-selector-baseline.json` | 基线 284 → **275**（迁移 + 收敛） |

## 4. 执行验证记录

### 验证命令与实际输出

| 命令 | 结果 |
|---|---|
| `bun run build` | exit 0（`tsc -b` 无 error） |
| `bun run lint` | exit 0 |
| `bun run test` | exit 0；**17 文件 / 217 用例**（原 16 / 206，新增 11） |
| `bun run check:selectors` | exit 0；`89 files, 275 literals`（原 284） |

### 浏览器实测（三语言 fetch 对比）

见 §1 表格——`a[title="複製番號"]` 在 zh-CN / en 下为 0，`detailMetaClipboard` 三语言均为 1，
`.section-meta` 文本随语言变化。

### 验证结论

番号读取恢复语言无关；演员页名称/性别/发布日期判定跨繁/简/英三语言可用；类名类选择器无需改动。

## 5. 后续验证建议

1. 真实浏览器把站点切到简体（`?locale=zh-CN`），确认详情页番号、演员页名称/性别、发布日期读取正常。
2. 英文（`?locale=en`）同样复测一遍（本次仅 fetch 对比，未做真实交互）。
3. 若站点再增语言，只需往 `SITE_TEXT_VARIANTS` 对应数组追加 token。
4. `actress-info` 插件若日后恢复使用，其 `strong:contains("演員")` 需按本方案改写。

## 6. 已知限制

- `SITE_TEXT_VARIANTS` 只覆盖当前**活跃**功能用到的三处文本依赖；其他文本依赖（如 FC2 专名、用户自定义标签名）
  本身与语言无关或已弃置，未纳入。
- 本次为 **fetch 对比**验证，未在真实简体/英文会话中做完整交互回归（见 §5 建议 1、2）。
