# 修正批量 UI 两处回归 + 响应式布局（浮窗操作条 / 左侧选择栏）

> **文档类型**：🧾 变更记录
> **文档状态**：✅ 已执行
> **影响范围**：列表页批量操作 UI 的 DOM 结构、浮层定位、响应式断点
> **前置文档**：`32-batch-bar-docked-ratingbar.md`、`33-batch-ui-layering.md`、`34-load-all-docked-in-side-column.md`
> **替代文档**：无
> **生效版本**：v1.46.30

## 1. 实测反馈（第四、五轮）

用户在页面上取到的实际 DOM：

```html
<div class="jhs-lp-batch-side">
  <button class="jhs-load-all-btn jhs-lp-batch-side-btn is-docked">加载全部</button>
  <div class="jhs-lp-batch-side">                          <!-- ← 嵌套重复容器 -->
    <button data-act="request-list">请求列表</button>
    …
  </div>
</div>
```

反馈要点：**① 显示结构还是错的；② 没有响应式布局；③ 选中后的操作按钮不是浮窗，而是落在页面最下方。**

## 2. 根因

| 现象 | 根因 |
|---|---|
| **① 嵌套重复容器** | `LpBatchSideBar` 组件根节点自带 `jhs-lp-batch-side`（它原本**就是**容器）；doc/34 改为「控制器建容器 + 组件写入其内」后，组件仍自带同名类 → 内层又出现一份容器，带上第二份列布局与固定定位 |
| **③ 操作条落页面最下方** | doc/32 把「停靠态」的内联条样式写进 `.jhs-lp-batch-bar` 时，**误删了浮层规则 `.jhs-lp-batch-layer`**（`position: fixed` 等）；doc/33 控制器又改回「layer + bar」两层结构，但样式一直没恢复 → layer 退化为 body 末尾的普通块 |
| **② 无响应式** | 两份样式都没有断点：左侧竖排栏在窄屏会压住卡片；操作条在窄屏宽度溢出 |

## 3. 修正

### 3.1 结构：组件只渲染按钮（Fragment），容器归控制器

`LpBatchSideBar` 改为返回 **Fragment**，四枚按钮成为容器（`.jhs-lp-batch-side`）的**直接子元素**：

```html
<div class="jhs-lp-batch-side">                              <!-- 控制器创建，固定定位列 -->
  <button class="jhs-load-all-btn is-docked">加载全部</button>  <!-- 停靠方 prepend，组内第一位 -->
  <button data-act="request-list">请求列表</button>
  <button data-act="select-all">全选</button>
  <button data-act="invert">反选</button>
  <button data-act="clear">清空</button>
</div>
```

渲染契约测试新增断言：侧栏组件的 HTML **不得包含** `jhs-lp-batch-side` 容器类、**不得包含** `<div>`。

### 3.2 操作条：恢复浮窗定位

`.jhs-lp-batch-layer` 重新声明为浮层容器（与 doc/32 之前的实现一致）：

```css
.jhs-lp-batch-layer {
    position: fixed;
    z-index: var(--jhs-z-page);
    bottom: var(--jhs-space-lg);
    left: 50%;
    max-width: calc(100vw - 32px);
    transform: translateX(-50%);
    pointer-events: none; /* 只有面板接收事件，透明区域不挡卡片 */
}
```

`.jhs-lp-batch-bar` 恢复浮层面板样式：`border-radius: var(--jhs-radius-lg)` + **双影**
（`0 10px 40px rgb(15 23 42 / 0.12), 0 2px 8px rgb(15 23 42 / 0.06)`，DESIGN.md 唯一的分层阴影用法）
+ `pointer-events: auto`；并清理 doc/32 遗留的停靠态规则（`margin-left` / `border-left` /
`.jhs-lp-batch-sep` / `.jhs-lp-batch-group` / `.jhs-lp-batch-btn.a-normal` 均已无引用）。

### 3.3 响应式（按 DESIGN.md 只允许的断点，取 768px）

| | 桌面 | ≤768px |
|---|---|---|
| **左侧选择栏** | `top: 50% + translateY(-50%)`，竖向、贴左 | **转为底部横排**：`top: auto; bottom: 8px; left/right: 8px; flex-direction: row; overflow-x: auto; transform: none`；按钮加高到 `--jhs-touch-target`(44px) |
| **浮窗操作条** | 底部居中，`max-width: calc(100vw - 32px)` | `left/right: 8px`、`bottom: 60px`（**让开底部横排的选择栏**）、`transform: none`、`width: 100%`、内容居中并允许换行 |
| **按钮/星星** | 26px 高 / 20px 星 | 32px 高 / 22px 星（触控友好） |

两者在窄屏**上下堆叠、互不遮挡**：选择栏贴底，操作条在其上方。

## 4. 实施（修改文件清单）

| 文件 | 变更 |
|---|---|
| `src/components/list-page/lp-batch-bar.tsx` | `LpBatchSideBar` 返回 Fragment（去掉自带容器类），文档说明嵌套风险 |
| `src/styles/list-page/lp-batch.css` | **重写**：恢复浮层定位与面板样式；清理停靠态遗留规则；新增 ≤768px 响应式 |
| `tests/batch-ui-render.test.ts` | 新增断言：侧栏 HTML 不含容器类与 `<div>` |

## 5. 执行验证记录

| 命令 | 结果 |
|---|---|
| `bun run build` | exit 0 |
| `bun run lint` | exit 0（0 problems） |
| `bun run lint:css` | exit 0（重写后 3 处 `comment-empty-line-before` 已 `--fix`，复核为 0） |
| `bun run test` | exit 0；**30 文件 / 319 用例** |
| `bun run check:structure` | exit 0 |
| `bun run check:docs` | exit 0 |
| `bun run check:selectors` | exit 0（89 文件 / 275 处，与基线持平） |

## 6. 真实浏览器验证建议

1. 列表页 DOM：`.jhs-lp-batch-side` **只有一层**，其子节点依次为「加载全部 / 请求列表 / 全选 / 反选 / 清空」。
2. 桌面：左侧竖排栏居中不滚动；勾选卡片后**底部居中浮出**操作条（白底 + 圆角 + 阴影），不是页面底部。
3. 窄屏（≤768px）：左侧栏变为**底部横排**；勾选后操作条出现在其**上方**并占满宽度，两者不重叠。
4. 取消全部勾选 → 操作条消失，左侧栏仍在。

## 7. 已知限制

- 响应式只在 768px 处切换（沿用项目既有断点约定）；未做平板中间态细分。
- 窄屏下选择栏横排若按钮过多会横向滚动（当前 5 枚，一般无需滚动）。
- 本轮修的是我此前三处改动（doc/32 误删浮层样式、doc/33 结构回归、doc/34 组件自带容器）叠加出的问题，
  已在 §2 逐条记录根因，避免同类叠加再次发生。