> **文档类型**：🔧 开发指导
> **文档状态**：✅ 已执行（**补档**：2026-10-05 重建——原文件在 commit `15835d2`（v1.46.27）提交说明中声明"补写 docs/33"但未实际落盘，`docs/34`、`docs/35` 与 README 索引均已引用本文档）
> **影响范围**：列表页批量操作 UI 分层（常驻竖排选择栏 / 浮出操作条）与 document 委托白名单
> **前置文档**：`32-batch-bar-docked-ratingbar.md`
> **替代文档**：无
> **生效版本**：v1.46.27

# 批量操作 UI 分层：常驻竖排选择栏 + 浮出内容操作条

## 1. 背景（实测反馈三轮）

v1.46.26 把批量操作条合并为一条常驻工具栏后，实测反馈"选择类操作（全选/反选/清空/请求列表）"与"内容类操作（收藏/已读/拉黑/五星）"混在一起占用同一行：选择类需要随手可达（不随滚动丢失），内容类应轻量浮出（避免常驻占位）。

## 2. 方案：选择与内容分层

- **常驻竖排选择栏**（`.jhs-lp-batch-side`）：请求列表 / 全选 / 反选 / 清空，固定在视频流左侧、屏幕中部、不随滚动移动；
- **浮出操作条**（`.jhs-lp-batch-layer`）：五星 + 收藏 / 已读 / 拉黑，与详情页快捷评分条同构（复用 `rating-bar.css` 类名与配色），选中 > 0 时出现、清空即收起；
- **请求列表入口迁移**：从筛选栏迁至侧栏，经自定义事件 `jhs:toggle-preload-queue` 与 other-site 面板解耦。

## 3. 回归：侧栏按钮「点了没反应」修复（commit `15835d2`）

- **根因**：`document` 委托点击的白名单只认浮出条容器（`.jhs-lp-batch-layer`），漏了新增的侧栏容器（`.jhs-lp-batch-side`）→ 侧栏四个按钮的 click 被静默忽略。
- **修法**：白名单判定抽为纯函数 `isBatchUiControl(el)`（接受两处容器），委托处改为 `btn && isBatchUiControl(btn) && !btn.hasAttribute('disabled')`。
- **回归用例**（`tests/lp-batch-delegation.test.ts`，6 条）：两容器命中 / 子孙节点上溯 / 页面上其它 `[data-act]` 不误认 / 越权元素不算 / null 安全。

## 4. 实施（修改文件清单）

- `src/components/list-page/lp-batch-bar.tsx`：`LpBatchSideBar` 常驻竖排栏与浮出条结构分层（commit `47e86dd`）；
- `src/plugins/list-page/lp-batch.tsx`：侧栏容器接入委托 + `isBatchUiControl` 纯函数（commit `15835d2`）；
- `src/plugins/other-site/osp-filter-bar.ts`：请求列表入口经自定义事件解耦（commit `47e86dd`）；
- `src/styles/list-page/lp-batch.css`：侧栏与浮出条样式（commit `47e86dd`）；
- `tests/batch-ui-render.test.ts`：渲染契约同步（commit `47e86dd`）；
- `tests/lp-batch-delegation.test.ts`：委托白名单回归 6 用例（commit `15835d2`）；
- `docs/32-batch-bar-docked-ratingbar.md`：生效版本校正为 v1.46.26（commit `15835d2`）。

## 5. 执行验证记录

### 执行环境

- 原执行：用户浏览器实测反馈三轮驱动（2026-09-27，commit `47e86dd` + `15835d2`）；
- 补档重建：2026-10-05（依两提交的提交说明、代码现状与现时门禁复跑重建本文档）。

### 验证命令与实际输出

- 原提交门禁记录（`15835d2` 提交说明）：build / lint / lint:css / test(315) / structure / docs / selectors 全 0；
- 补档复跑（2026-10-05）：`tests/lp-batch-delegation.test.ts` 6 用例在列并通过；全量门禁见 `42-release-notes-and-version-hygiene.md` 的验证记录。

### 前端或调用方验证

侧栏四个按钮（请求列表/全选/反选/清空）点击恢复响应；修复由 6 条纯函数回归用例锁定（白名单两个容器均命中、其它 `[data-act]` 元素不越权）。

### 验证结论

UI 分层与委托白名单修复均已落地；本文档为迟到补档，语义内容与 `47e86dd` / `15835d2` 一致。

### 已知限制

- 原提交的完整验证输出未单独留档，以提交说明为凭（补档复跑提供现时证据）；
- 侧栏容器类名（`.jhs-lp-batch-side`）属于跨文件契约，后续新增容器时必须同步加入 `isBatchUiControl` 白名单（该回归即为此而设）。
