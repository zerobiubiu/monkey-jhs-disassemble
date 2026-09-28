# 批量操作条：与详情页快捷评分条完全同构（视觉 + 悬停预览）

> **文档类型**：🧾 变更记录
> **文档状态**：✅ 已执行
> **影响范围**：列表页批量操作条的视觉契约、星级悬停预览行为、列表页注入的样式表
> **前置文档**：`32-batch-bar-docked-ratingbar.md`、`35-batch-ui-structure-and-responsive-fix.md`
> **替代文档**：无
> **生效版本**：v1.46.31

## 1. 实测反馈

> 「选中之后弹出的操作框 UI 风格不符合页面设计；鼠标放上去预览的星标也不正确，
> 正确的是鼠标放上去就显示第几个及前几个，现在只高亮了第几个。」

并附上详情页参照 DOM：`.jhs-rating-bar > .jhs-stars(data-score) + .jhs-rating-actions`
（星为 `.jhs-star[data-score=1..5]`，动作为 `.jhs-fav-btn` ♥ 收藏 / `.jhs-read-btn` 已读 /
`.jhs-block-btn` 🚫 拉黑）。

## 2. 两个问题的根因

### 2.1 视觉不符：我另造了一套「紧凑版」

doc/33 起，批量操作条给星与三态按钮加了**本地紧凑类**（`jhs-lp-batch-star` /
`jhs-lp-batch-btn`）并在 `lp-batch.css` 里覆写尺寸：

| | 我的紧凑版 | 详情页（rating-bar.css） |
|---|---|---|
| 星 | 20px、宽 24px | **26px**、`padding: 2px 4px` |
| 三态按钮 | 26px 高、`padding: 0 10px`、12px 字、4px 圆角 | **`padding: 5px 16px`、14px 字、6px 圆角、`1px solid #dbdbdb`** |
| 结构 | 单行（计数 + 星 + 按钮） | **两行**：星在上、动作在下（`.jhs-rating-bar` 为纵向） |

即：本该「同构」却做成了两套视觉。

### 2.2 悬停预览不符：只用 CSS `:hover`

详情页是 JS（`dpb-rating.tsx`）：

```ts
starsEl.addEventListener('pointerover', (e) => {
    const score = +star.dataset.score!;
    stars.forEach((s, i) => s.classList.toggle('is-preview', i < score));
});
```

**第 N 颗及其前面所有**都加 `is-preview`。批量条只靠 CSS `:hover` → 只亮悬停那一颗。

## 3. 修正

### 3.1 视觉：完全交还 `rating-bar.css`（含列表页注入）

- 组件里星与三态按钮**只保留 rating-bar 类名**（`jhs-star` / `jhs-fav-btn` / `jhs-read-btn` /
  `jhs-block-btn`），删除本地紧凑类；文案也对齐参照（`♥ 收藏` / `已读` / `🚫 拉黑`）。
- 结构改为**两行**（对齐 `.jhs-rating-bar` 的纵向布局）：第一行 `.jhs-stars`，
  第二行 `.jhs-lp-batch-actions`（计数 + 三态按钮，间隙对齐 `.jhs-rating-actions`）。
- `lp-batch.css` 删除全部紧凑覆盖；只保留容器（浮层定位/圆角/双影/`font-size: 13px`）、
  计数样式、以及 `rating-bar.css` 未定义的 **`[disabled]` 禁用态**。
- **关键前提**：`rating-bar.css` 原本只由 DetailPageButtonPlugin 在**详情页**注入 ——
  列表页没有这些类名就完全没样式。现由 `ListPagePlugin.initCss()` 一并注入
  （`${ratingBarCssRaw}\n${lpBatchCssRaw}`），列表页与详情页共享同一套视觉契约。

### 3.2 悬停预览：补 JS，与详情页逐行同构

`renderActionBar()` 渲染后调用 `bindStarPreview(barEl)`：

```ts
starsEl.addEventListener('pointerover', (event) => {
    const score = Number(star.dataset.score ?? 0);
    stars.forEach((el, index) => el.classList.toggle('is-preview', index < score));
});
starsEl.addEventListener('pointerleave', () => stars.forEach((el) => el.classList.remove('is-preview')));
```

- `pointerover`（冒泡）内用 `closest('.jhs-star')` 取目标星 → 前面的都加 `is-preview`；
- `pointerleave`（不冒泡，直接绑在星级容器上）离开整块时清除；
- 每次渲染都是新元素，监听器随旧元素回收，不重复叠加。

## 4. 实施（修改文件清单）

| 文件 | 变更 |
|---|---|
| `src/components/list-page/lp-batch-bar.tsx` | 星/按钮只带 rating-bar 类名；改两行结构；文案对齐参照 |
| `src/plugins/list-page/lp-batch.tsx` | 新增 `bindStarPreview`（`pointerover` 前 N 颗预览 + `pointerleave` 清除），渲染后绑定 |
| `src/plugins/list-page-plugin.tsx` | `initCss()` 追加注入 `rating-bar.css`（列表页需要同一套评分条样式） |
| `src/styles/list-page/lp-batch.css` | 删除全部紧凑覆盖（星/按钮/移动端尺寸）；容器改纵向两行；保留浮层与响应式布局；补 `[disabled]` |
| `tests/batch-ui-render.test.ts` | **新增** 2 用例：类名契约（只有 rating-bar 类 + 两行结构）、文案契约 |

## 5. 执行验证记录

| 命令 | 结果 |
|---|---|
| `bun run build` | exit 0 |
| `bun run lint` | exit 0（0 problems） |
| `bun run lint:css` | exit 0（清理后 1 处注释空行已 `--fix`，复核 0） |
| `bun run test` | exit 0；**30 文件 / 321 用例**（新增 2） |
| `bun run check:structure` | exit 0 |
| `bun run check:docs` | exit 0 |
| `bun run check:selectors` | exit 0（89 文件 / 275 处，与基线持平） |

## 6. 真实浏览器验证建议

1. 勾选卡片 → 底部浮出操作条：**上行星（26px）、下行 计数 + ♥ 收藏 / 已读 / 🚫 拉黑**
   （按钮 `padding 5px 16px` / 14px 字 / 6px 圆角 / 灰描边），与详情页快捷评分条**看起来是同一套控件**。
2. 悬停第 4 颗星 → **前 4 颗全部**变金色（`#f5b301`），不是只亮第 4 颗；移出星级区域全部复原。
3. 点第 3 颗 → 已选卡片全部变「已读 3 星」；点「已读」→ 0 星；点「♥ 收藏」/「🚫 拉黑」→ 对应状态。
4. 窄屏下：选择栏在底部横排，操作条在其上方，两者不重叠。

## 7. 已知限制

## 7.1 后续修正（同类问题的收尾）

**现象**：星改为 `<button>` 后，每颗星外出现一圈**黑框**，五颗星看着不像一个整体。

**根因**：参照实现里星是 `<span>`（无 UA 装饰）；本项目用 `<button>` 换取键盘可达，
而 `rating-bar.css` 的 `.jhs-star` 只定义字号/颜色/内边距，**没有抹掉按钮默认的
`border: 2px outset` 与底色** —— 旧紧凑版覆盖里曾带着 `border: none`，
doc/36 删除覆盖后就暴露出来了。同理，`<button>` 默认**不继承页面字体栈**，
所以星形与三态按钮文案的字体也与页面不一致（“不像一个整体”的另一半）。

**修正**（不动参照样式表，只在列表页侧补齐）：

```css
.jhs-lp-batch-bar button.jhs-star {
    appearance: none;
    -webkit-appearance: none;
    border: none;
    background: none;
    font-family: inherit;
}

.jhs-lp-batch-bar .jhs-fav-btn,
.jhs-lp-batch-bar .jhs-read-btn,
.jhs-lp-batch-bar .jhs-block-btn {
    font-family: inherit;
}
```

并给星补显式 `:focus-visible` 焦点环（仅键盘触发，不再用默认黑框当焦点提示）。

- 三态按钮的 `is-active`（详情页会按当前影片状态亮起蓝/绿/红）在批量场景下**未使用**：
  多选卡片的状态可能各不相同，无法用单一 active 表示；如需「全部同态才高亮」可后续补。
- 星与按钮尺寸不再随断点缩放（沿用详情页尺寸）；窄屏靠 `flex-wrap` 换行适配。