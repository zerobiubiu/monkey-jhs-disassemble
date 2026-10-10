# 54 - 技术质量审计（`/impeccable audit src`，v1.48.5 快照）

- **状态**：参考（审计快照，不随代码演进自动更新；重跑 `/impeccable audit` 生成新快照）
- **类型**：技术质量审计（a11y / 性能 / 主题化 / 响应式 / 实现完整性）
- **审计对象**：`src/**`（389 文件 / 43 插件 / 67 核心模块）
- **工具与限制**：`impeccable detect`（bundled 规则引擎）、渲染后 HTML（`jsxToString`，仓库真实输出管线）、静态扫描脚本；**无浏览器自动化** → 未做视觉/真机渲染核验，凡需渲染的结论均标注仪器来源

## 审计健康度

| # | 维度 | 分 | 关键发现 |
|---|------|----|----------|
| 1 | 无障碍（A11y） | **2** | `.jhs-toggle` 命中区仅 40×22px 且标签是 `<span>` 非 `<label for>`（唯一命中区 22px < WCAG 2.2 AA 的 24px，且失去"点标签切换"惯例）；`#6c757d` 次级文字在 `#f8fafc`/`#f1f5f9`/`#e2e8f0` 上为 4.48 / 4.28 / 3.80（<4.5:1） |
| 2 | 性能 | **3** | 抽样未见 `will-change` 滥用、未发现循环内读写布局；`backdrop-filter`/`blur()` 各 2 处（设计系统限定为完全悬浮元素）；`loading="lazy"` 已用；单文件产物 1,284 kB（gzip 330）——7 个库已外置 CDN，用户脚本无法代码分割，属结构性约束 |
| 3 | 主题化 | **2** | TSX 字面色值 **384 处 vs 令牌 2 处（覆盖率 0.5%）**；CSS 538 vs 182（25.3%）；detect 报 71 条调色板漂移 |
| 4 | 响应式 | **2** | 硬编码宽度 27 处（设置侧栏 170px、快捷面板 340px、演员页 200/300px…）；`.setting-item` 栅格 `180px 1fr` 在窄视口被挤压 |
| 5 | 实现完整性 | **2** | 单一类别的系统性漂移 + 1 条可证伪的检测器误报；设计语言本身产品特异、非类目可互换 |
| **合计** | | **11/20** | **Acceptable（需显著工作）** |

## 实现完整性判决（先读这条）

**通过。** 实现表达的是**本产品特有**的系统而非可互换模板：统一的 `jhs-*` 类语言、`--jhs-*` 令牌族、明确的命名规则（Two-Greens / Grey-Ladder / Declared-Not-Wired / Subsystem-Fidelity…）、`jsxToString` 自有的属性序列化契约（`aria-*` 强制字符串）。detect 的 72 条命中里 **71 条同属一个类别**（调色板漂移，severity=advisory），且 DESIGN.md 自己已把"灰阶失控为 18 阶"写入规则并给出「触碰即迁移」的收敛政策 —— 这是**有账可查的存量**，不是失控。

## 详细的按严重度问题

### [P1] 开关的命中区与标签联动
- **位置**：`src/styles/setting-plugin.css:161`（`.jhs-toggle` 40×22）、`src/components/setting/setting-row.tsx:33`（`<span className="setting-label">`）
- **类别**：Accessibility ｜ **标准**：WCAG 2.2 AA 2.5.8（最低 24×24）+ 2.1 AA 1.3.1/1.4.3 惯例
- **影响**：键盘/触摸用户只有 22px 高的一条命中区；点标签文字不切换（非 `<label for>`），而设置项共 ~40 个开关
- **修法**：`.setting-label` 改 `<label for={id}>`（命中区随之扩到整行 ≈36px），或给 `.jhs-toggle` 加 `padding` 并同步视觉
- **建议命令**：`/impeccable adapt`

### [P1] 次级文字在浅底色上不足 4.5:1
- **位置**：`--jhs-color-text-secondary`（`#6c757d`）用于 `#f8fafc`（4.48）/`#f1f5f9`（4.28）/`#e2e8f0`（3.80）底；样本 25 处（`setting-panels/*`、`dpb/review-conflict-dialog.tsx` 等）
- **类别**：Accessibility ｜ **标准**：WCAG AA 1.4.3（正文 4.5:1）
- **影响**：面板说明文字在浅底分组上处于临界失效（4.28/3.80 明确不达标）
- **修法**：调深次级文字令牌一档（如 slate-600 `#475569` ≈ 7.5:1）或按底色分层取用；**改令牌属设计系统决定**，故建议走 document
- **建议命令**：`/impeccable document` → 复核 `/impeccable polish`

### [P1] `prefers-reduced-motion` 被全局压成 0.01ms
- **位置**：`src/styles/accessibility.css:21`（`*` 全选）；`src/styles/rating-bar.css:669`（`.jhs-list-panel *` 作用域内同理）
- **类别**：Accessibility ｜ **标准**：WCAG 2.3.3（动画交互）
- **影响**：降低动效偏好下**所有**状态变化反馈被压平（含加载/成功/失败过渡）——audit 明确要求 flag 这类"全局 0.01ms 杀灭"
- **修法**：保留对位移/缩放/视差的抑制，但让「状态反馈类过渡」改为非线性可感知替代（如颜色/图标的即时切换），或按选择器白名单豁免
- **建议命令**：`/impeccable animate`

### [P2] 两处"问号提示"实现，其中一处无可访问名
- **位置**：`src/components/setting/setting-row.tsx:36`（`.jhs-tooltip-icon`，**仍无** `aria-label`）vs `src/components/setting/simple-setting-panel.tsx:34`（`.jhs-qs-tip`，本轮已修 `role="img" aria-label`）
- **类别**：Accessibility ｜ **标准**：WCAG 4.1.2 名称角色值
- **影响**：读屏对设置面板里的问号只念"问号"；同一 affordance 两套实现必然继续分叉
- **修法**：收敛到一个共享 `TipIcon`（`role="img"` + `aria-label` + `data-tip`）
- **建议命令**：`/impeccable distill`

### [P2] `#f40`（#ff4400）在白底 3.45:1
- **位置**：17 处（`blacklist/blacklist-confirm-message.tsx:75`、`dpb/quick-block-confirm-message.tsx`、`log/log-colored.tsx` 等）
- **类别**：Accessibility ｜ **标准**：WCAG AA 1.4.3（若为正文色）
- **影响**：危险/错误提示色在浅底上不可达 AA（其语义正是最需要被看清的一类）
- **修法**：改用 DESIGN.md 已登记的 `danger-strong #ef4444`（白底 3.76，仍不足）或更深的 `#dc2626`（白底 4.83 ✓）
- **建议命令**：`/impeccable document`（登记合规的危险色阶）

### [P2] 主题化：TSX 里几乎不用令牌
- **位置**：全 `src/components/**`（384 处字面色 vs 2 处 `var(--jhs-*)`）
- **类别**：Theming ｜ **影响**：改一次主题色要动上百处；detect 的 71 条漂移同源
- **修法**：按 DESIGN.md 的「触碰即迁移」，新代码一律取令牌；`document` 把仍在使用的字面值登记或归一
- **建议命令**：`/impeccable document`

### [P2] 固定宽度与窄视口
- **位置**：`setting-dialog.tsx:72`（侧栏 `width:'170px'`）、`simple-setting-panel.tsx`（340px）、`setting-plugin.css:43`（`grid-template-columns: 180px 1fr`）、演员页 200/300px 共 27 处
- **类别**：Responsive ｜ **影响**：~360px 视口下 170px 侧栏 + 180px 标签列把控件列压到 <60px
- **修法**：窄视口把设置弹层切为「顶部横排 tab + 单列」，标签列改 `minmax(0, 40%)`
- **建议命令**：`/impeccable adapt`

### [P3] `#999`（ink-muted）的语义越界
- **位置**：`ink-muted #999999` 在白底 2.85:1；DESIGN.md 定位为「占位/禁用/时间戳」，但被用于信息性文本（本轮已修设置面板 2 处；项目级其余 13 处）
- **类别**：Theming / Accessibility ｜ **修法**：信息性文本改用次级令牌；占位/禁用保持
- **建议命令**：`/impeccable polish`

## 系统性问题（模式）

1. **单一类别的调色板漂移**：71/72 条命中同属「字面色不在 DESIGN.md 内」，且 TSX 令牌覆盖率 0.5% → 根因是**组件层用内联字面色代替令牌**，不是随手乱写（色值本身多来自既有阶）。
2. **同一 affordance 多实现**：问号提示 ×2（`jhs-qs-tip` / `.jhs-tooltip-icon`）、按钮 ×3、开关 ×1（已在 doc/249 收敛）→ 收敛节奏是「触碰即迁移」，缺少一次收口。
3. **窄视口未设计**：注入式 UI 按桌面宿主设计，固定宽度占多数。

## 正面发现（保持）

- **状态不只靠颜色**：预加载徽标「文字 + 符号 +（失败态）专用符号」四态；侧栏激活用底色 + 3px 左条 + 字重三重表态。
- **无障碍基建扎实**：设置弹层已是 `role="tablist"/"tab"/"tabpanel"` + `aria-selected` 字符串化 + `tabIndex` 轮询 + **方向键/Home/End 导航**（doc/248）；emoji 全部 `aria-hidden`；全局 `:focus-visible` 焦点环（`accessibility.css`）覆盖 button/a/input/select/textarea/[tabindex]。
- **性能克制**：无 `will-change`、无 `<div onClick>`、列表封面 `loading="lazy"`、7 个库 CDN 外置（`externalGlobals`）。
- **检测器误报只有 1 条**：`SFMono-Regular` 是标准等宽回退栈里的系统字体，非项目字体 —— 建议加入钩子忽略列表。

## 仪器限制（如实声明）

- 无浏览器 → 未做真机渲染/性能采样/视口实测；响应式与动效结论来自 CSS 与标记事实。
- 静态正则统计 `<img>`/`<input>` 属性会**误报**（多行 JSX）；改用渲染后 HTML 抽样复核 3 个组件（`JumpPageControl`/`TemporaryImageContainer`/`HitShowMovieItem`）→ **全部合规**（`alt`/`id` 齐备）。其余组件未逐一渲染，其 a11y 属性结论保留为"未核"。

## 推荐动作（按优先级）

1. **[P1] `/impeccable adapt`**：开关命中区与标签联动（`setting-row` + `.jhs-toggle`），顺带处理窄视口下的设置弹层布局。
2. **[P1] `/impeccable animate`**：重做 `prefers-reduced-motion` 策略（保留状态反馈，抑制位移/视差）。
3. **[P1/P2] `/impeccable document`**：把次级文字/危险色的合规阶登记进 DESIGN.md 与侧车，并给现存字面色一个收敛去向。
4. **[P2] `/impeccable distill`**：收敛双问号实现（与按钮/开关体系同批）。
5. **[P3] `/impeccable polish`**：收尾（`#999` 语义越界、其余 13 处）。