---
target: 设置弹层（SettingDialog）
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:E:\\monkey-jhs-disassemble\\src\\components\\setting\\setting-dialog.tsx"
target_fingerprint: "sha256:de7e0038366d63620da9f27064a9d9b68c392e09e32afa4923f9b22da4799893"
target_path: "E:\\monkey-jhs-disassemble\\src\\components\\setting\\setting-dialog.tsx"
timestamp: 2026-09-25T17-13-21Z
slug: src-components-setting-setting-dialog-tsx
---
⚠️ DEGRADED: single-context (no sub-agent/Task tool exposed in this session; Assessment A completed before Assessment B ran)

# 设计评审：设置弹层（SettingDialog）

目标：`src/components/setting/setting-dialog.tsx`（10 面板设置弹层，140 行结构 + `setting-plugin.css` 812 行 + `setting-panels/` 子组件）

## 设计健康度评分

| # | 启发式 | 分数 | 关键问题 |
|---|--------|------|----------|
| 1 | 系统状态可见性 | 3 | 预加载徽标四态（排队/请求/成功/失败 + 脉冲点）、进度条、Toast 反馈扎实；扣分：`#saveBtn` 无 pending 态，且按钮本身在 4 个面板被隐藏 |
| 2 | 系统与真实世界匹配 | 3 | 「番号/女优/清单/已鉴定」与站点一致；「触底加载」「瀑布流」是开发者语汇（有 tip 缓解） |
| 3 | 用户控制与自由度 | 2 | ESC 可关层、有「常见问题」；扣分：**清理全部缓存无确认无撤销**，无「恢复默认」，面板切换无键盘路径 |
| 4 | 一致性与标准 | 2 | 三套按钮系统、两套开关、两套字号体系并存（详见 P2） |
| 5 | 错误预防 | 2 | 导入有 JSON 校验、URL 有 sanitize；扣分：**破坏性操作零护栏** |
| 6 | 识别而非回忆 | 3 | 标签右对齐齐整、tip 内联、10 面板常驻可见；扣分：emoji 无语义规律、面板与底部按钮的关系不可见 |
| 7 | 灵活性与效率 | 2 | 快捷设置浮层是优秀加速器；扣分：无键盘快捷键、无设置搜索、无批量切换 |
| 8 | 美学与极简 | 3 | 密度克制、无装饰性渐变；扣分：三套按钮外观并存造成噪声 |
| 9 | 错误恢复 | 2 | 统一 toast、同步失败有报告；扣分：缓存清理不可恢复 |
| 10 | 帮助与文档 | 3 | 「常见问题」+ 内联 tip；扣分：帮助是独立弹层，非就地展开 |
| **合计** | | **25/40** | **Acceptable（20–27）** |

## 设计特异性判定

**LLM 评估**：这个弹层**不是**类别可互换的产物——`setting-item` 的 `180px 1fr` 网格、`#fbfcfd` 侧栏底、主色激活三重表态、`jhs-qs-*` 浮层，都是本项目积累出的具体语言，换到别的产品上会立刻不对味。但它有一个结构性问题：**它同时是三个不同时代的产物**。侧栏 + 面板 + 底部按钮是 Bootstrap/Bulma 时代的手写实现；`jhs-qs-*` 是后期的 Tailwind 体系；`jhs-setting-btn`/`jhs-setting-menu-btn` 又是另一轮统一运动的中间态。三者都"能用"，因此从未被迫收敛——**设计特异性在局部成立，在全局失守**。

**确定性扫描**：`impeccable detect` 对本 surface（`src/components/setting`、`setting-panels`、`setting-plugin.css`）报 **0 warning / 4 advisory**——4 条全部是未登记的字面色（`design-system-color`）。**扫描对这个 surface 基本无话可说**，因为本轮 polish 已清完全库 warning，而真正的设计问题（缺确认、缺键盘、三套体系并存）没有任何检测规则能发现。这是本次评审最重要的一条结论：**检测器干净 ≠ 设计正确**。

**视觉叠加层**：无。本会话无浏览器自动化工具，未做注入，因此**不存在用户可见的叠加层**，不予声称。

## 整体印象

一个**密度与克制都到位、但错误预防和键盘可达性欠账**的工具面板。最亮眼的是快捷设置浮层——它把 9 项高频设置压到一步可达，是真正的产品级设计判断。最大的机会是：**这个弹层缺一条"危险动作"的视觉与交互语汇**。目前「清理全部缓存」和「保存设置」以同级按钮相邻排列，前者一点即清空全部本地缓存且不可撤销。

## 做得好的地方

1. **快捷设置浮层（`jhs-qs-panel`）的密度设计**：`340px` 宽、三层嵌套（区块 → 行 → 子卡片）靠 `#f8fafc`/`#fff` 明度差分层而非阴影，36px 行高下仍保留清晰分组。禁用子卡片 `opacity: .55` + `pointer-events: none` 是干净的失效表达。
2. **状态不只靠颜色**：预加载徽标用「文字 + 专用符号」（`✓` / `✕` / 脉冲圆点）四态区分，侧栏激活态用「底色 + 3px 左条 + 字重」三重表态。这两处是真正的无障碍自觉。
3. **`tip` 的问号内联提示**：`jhs-qs-tip` 把解释贴在使用点，而不是丢进帮助文档，减少了 recall 负担。

## 优先问题

### [P1] 破坏性操作零护栏：清理全部缓存即时执行

- **What**：`#clean-all` → `handleCleanAllCache()`（`plugins/setting/cache-management.ts:141`）直接 `forEach` 清空 `plugin.cacheItems` 全部缓存，并额外 `clearPersistentNamespace('otherSiteDmm', …)`。**没有 `layer.confirm`、没有二次确认、没有撤销**，只有事后 `show.ok('全部缓存已清理')`。
- **Why it matters**：这是不可逆的数据删除。其中 `jdb:rating_cache_v2` 是评分缓存，清空后需重新发起大量请求重建；`jhs_other_site` 是外站预加载缓存（v1.46.6 刚取消 5000 条上限，意味着它可能已积累到很大规模），清空后对应影片要重新探测。用户误触一次，代价是可见的性能退化。项目**已有确认模式**（`core/util/util-popup.ts:30` 使用 `layer.confirm`），所以这不是能力缺失，是一致性缺口。
- **Fix**：`handleCleanAllCache` 前置 `layer.confirm`，文案带上代价——「将清空 N 项缓存，共 <size>；其中评分缓存清空后需重新获取。此操作不可撤销。」确认后再执行。`plugin.cacheItems` 与 `refreshAllCacheStats` 已在手边，拿到 N 与 size 无需新逻辑。
- **建议命令**：`/impeccable harden`

### [P1] 设置面板对键盘与读屏用户基本不可用

- **What**：10 个侧栏项是裸 `<div className="side-menu-item" data-panel="…">`（`setting-dialog.tsx:66–129`）——**无 `tabindex`、无 `role`、无 `keydown`**，切换面板的唯一路径是鼠标 click（`setting-form-bind.ts:38`）。面板显隐靠 `.content-panel` 的 `display: none` 切换，无 `aria-selected`/`role="tab"`。侧栏 emoji（💾⚙️🚫🌐🧹📋🎬⚡📊）无 `aria-label`。`jhs-qs-tip` 是 `<span>?</span>` + `data-tip`，无 `title`/`aria-label`，提示内容只能通过自定义 tooltip 获得。
- **Why it matters**：一个 10 分区、带破坏性操作的管理面板，键盘用户 Tab 只能落在输入框和按钮上，**无法抵达任何一个面板**——等于 90% 的功能不可用。读屏用户听到的是一串 emoji 字符名，而非「数据备份」「基础配置」。这与 PRODUCT.md 声明的「WCAG 2.1 AA 基准、键盘可达、清晰焦点」直接冲突。
- **Fix**：侧栏项改 `<button>` 或加 `role="tab"` + `tabindex` + `aria-selected`；面板容器加 `role="tabpanel"`；实现 `←/→` 或 `↑/↓` 切换；emoji 移入 `aria-hidden` 的装饰位并在同元素补文字（文字已在，只需保证 SR 只读文字）；`jhs-qs-tip` 加 `aria-label` + `role="img"`。
- **建议命令**：`/impeccable audit`

### [P2] 三套按钮 / 两套开关 / 两套字号体系并存

- **What**：
  - 按钮三套：`.jhs-setting-btn`（34px 高 / `6px 16px` / `opacity: .9` hover / `scale(.97)` active）、`.jhs-setting-menu-btn`（`7px 16px` / `translateY(-1px)` hover / 带阴影）、`.jhs-qs-btn`（`8px 12px` / `translateY(-1px)` / `8px` 圆角）。
  - 开关两套：`.mini-switch`（40×20，开态 `#4caf50`）与 `.jhs-toggle`（40×22，开态 `#22c55e`）。
  - 字号两套：`.help-section summary` 在 CSS 里写 `18px`，而同一弹层体系内的标题在 inline style 里写 `15px`/`13px`。
  - 色值双写：`#e2e8f0` 既出现在 inline style（侧栏 `borderRight`、底部 `borderTop`）又出现在 CSS。
- **Why it matters**：用户在同一弹层里会遇到三种手感不同的按钮和两种不同颜色/尺寸的开关。这直接压低「一致性与标准」（本次 2/40 的主因），也让后续修改变成三倍工作量。
- **Fix**：收敛到一套按钮基类 + 语义修饰符（`jhs-setting-btn` 是三者中最完整的，作为基准）；开关统一到 `.jhs-toggle`（尺寸更规范、`22px` 高接近 44px 触控目标的一半以上）；弹层内尺寸全部改走 CSS 类，停止 inline 写视觉值。
- **建议命令**：`/impeccable distill`

### [P2] 危险动作与常规动作同权重相邻

- **What**：底部操作区把 `#saveBtn`（`--success`，绿）与 `#clean-all`（`--danger`，红）以同样 `padding`、同样 `34px` 高、同样圆角并列，`gap: 10px`。且顶部悬浮面板的「💾 更多设置」与底部「💾 保存设置」**共用同一个软盘 emoji**。
- **Why it matters**：破坏性动作在视觉上没有与常规动作隔离，用户的手在相邻位置滑动即可命中。共用 emoji 让两个语义完全不同的入口在快速扫视下难以区分。
- **Fix**：危险按钮与常规动作之间加分隔（`margin-left: auto` 推到最右 + 前置间距），或降级为文字型危险操作；给两个「💾」之一换语义正确的图标（`src/resources/icons.ts` 已有 SVG 资产）。另：`#saveBtn` 在 cache/missav/fav-sync/diagnostics 四个面板被隐藏（`setting-form-bind.ts:42–62`），用户在这些面板改完设置后**看不到任何保存入口**，容易误以为改动已丢失——建议改为常驻但禁用，或在这些面板内提供就地保存。
- **建议命令**：`/impeccable layout`

### [P3] 面板与底部按钮的从属关系不可见

- **What**：「更多设置」与「常见问题」在快捷面板底部，点击后打开这个 10 面板弹层；但弹层本身没有任何「你从哪里来」的线索，也没有返回快捷面板的路径。
- **Why it matters**：两个界面是渐进披露关系，却被呈现为两个独立弹层；用户按 ESC 关掉大弹层后回到页面，而不是回到快捷面板——上一层的上下文丢失。
- **Fix**：大弹层顶部标注来源，或在关闭大弹层后恢复快捷面板。
- **建议命令**：`/impeccable clarify`

## 角色红旗

**Alex（不耐烦的高级用户）**：快捷设置浮层是给他的礼物（9 项一步可达），但大弹层里他没有任何加速器——无法用键盘在 10 个面板间跳转，无法搜索设置项，无法批量切换开关。更要命的是他在「MissAV 同步」或「插件诊断」面板改完东西后，**底部没有保存按钮**（`saveBtn` 被隐藏），他会花时间找「保存在哪」，或者干脆以为白改了。

**Sam（依赖辅助技术）**：Tab 键穿过整个弹层也**到不了任何一个面板**——侧栏项是 `div`，不可聚焦。读屏输出把侧栏念成一串 emoji 名（「floppy disk 数据备份」「gear 基础配置」）。`jhs-qs-tip` 的 `?` 没有可访问名称，问号提示的内容对它不可达。面板切换没有 `aria-selected` 播报，SR 用户不知道自己现在在哪个面板。

**Riley（刻意压测者）**：`#clean-all` 一击清空全部缓存且不可撤销——他的第一个动作就会是点它，然后发现评分缓存没了、外站预加载要重新跑。导入 JSON 的失败路径只覆盖「空数据」，畸形但非空的 JSON 会走到哪一步不明确。`#cache-data-display` 直接 `JSON.stringify(cachedData, null, 2)` 渲染，大缓存会把 `pre` 撑成一条长滚动。

## 次要观察

- 侧栏 `title` 属性只给了 preload/diagnostics 两项，其余 8 项没有 tooltip，不一致。
- `jhs-qs-tip` 与 `.tooltip-icon`（`setting-plugin.css:26`）是两个功能相同、命名与实现都不同的问号图标。
- `.console-logger-*` 与弹层同属「浮层」家族，但用的是 Flat-UI 配色，和设置弹层的 Tailwind 灰阶不是一路。
- 侧栏项 `text-overflow: ellipsis` 保证了长名不换行，但面板名上限（「MissAV 同步」）远未触及该边界，属预防性写法。
- `.side-menu-item.active` 的 `3px` 左条已登记为结构性例外，但它是全弹层唯一的左色条——层级表达仅此一处，未形成体系。

## 值得思考的问题

- 「清理全部缓存」已经在没有确认的情况下存在了很久。是**没人误触过**，还是**误触过但没归因到这里**？
- 10 个面板平铺在侧栏，是因为它们同等重要，还是因为**没有人为它们排过序**？高频的是哪 3 个？
- 侧栏 emoji 到底承载了语义还是噪声？「📊 插件诊断」与「⚡ 预加载配置」之间，用户能推出可学的规律吗？如果不能，它是在帮人还是在拖慢扫视？
- 如果这个弹层只能有 3 个面板，会是哪 3 个？剩下的应该藏到哪里？
