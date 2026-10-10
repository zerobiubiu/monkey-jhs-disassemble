# 55 - impeccable 批处理收口：audit → document → adapt → animate → distill → polish（v1.48.6）

- **状态**：已执行
- **类型**：变更（无障碍 / 动效 / 主题化收口 + 一处既有缺陷修复）
- **生效版本**：v1.48.6（前端可见行为有变化，patch）
- **前置文档**：`54-design-audit-src.md`（本轮 audit 快照）、`53-setting-layer-polish.md`（设置弹层 polish）
- **替代/被替代**：无

## 背景

用户要求按 `/impeccable` 的六条命令依次收口：`audit`（只读审计）→ `document`（把审计结论并入设计系统）→ `adapt`（触控/命中区适应）→ `animate`（减动策略）→ `distill`（重复实现收敛）→ `polish`（收尾）。audit 的产出单独记为 `doc/54`；本文件记录其余五条的落地与验证。

审计快照的 P1/P2 是本次收口的依据：开关命中区 40×22 且标签不可点、次级文字在浅底 4.28–3.80、`prefers-reduced-motion` 全局 0.01ms 杀灭、两套问号提示实现其一无可访问名、`#f40` 白底 3.45、`#999` 语义越界。

## 方案（命令 → 结论 → 落地）

| 命令 | 结论 | 落地 |
|---|---|---|
| `document`（merge，不覆盖 DESIGN.md） | 把审计与判据**写进系统**而不是只留报告 | Colors 新增 **The Contrast-On-Subtle Rule**（`#6c757d` 仅白底达标；浅灰底改 slate-600 `#475569`）与 **The Danger-On-Light Rule**（危险文字用 `#dc2626`，含移植保真豁免清单）；The Declared-Not-Wired Rule 增补实测存量（TSX 字面色 384 处 vs 令牌 2 处＝0.5%）；Typography 标明 `ui-monospace`/`SFMono-Regular` 是平台回退项（检测器字体告警属预期） |
| `adapt` | 开关是**唯一自身命中区小于阈值**的控件：视觉 40×22、标签是 `<span>` 不可点 | `.jhs-toggle::after` 透明命中区括到 **40×44**（旋钮占用 `::before`）；`SettingRow` 增 `controlId` → 标签渲染 `<label for>`；快捷面板 `Row` 增 `htmlFor` → 11 个开关行全部联动；问号提示图标**留在 label 外**（点提示不误触控件） |
| `animate` | 全局 `*{transition-duration:.01ms}` 属「一刀切」，把有意义的反馈一起抹平 | 改为**「减少而非抹平」**：循环/入场动画立即到位（含义由并存文字与静态图形承担）、滚动改即时、**保留颜色/底色/描边/阴影/透明度/填充的状态过渡**、只把 10 处位移过渡（`transform`/`width`）摘成立即到位；删除 `rating-bar.css` 里与全局重复的作用域版本 |
| `distill` | 两套问号提示（`.jhs-tooltip-icon` / `.jhs-qs-tip`）的 CSS **逐字相同**，且前者无可访问名 | 收敛为 `src/components/setting/tip-icon.tsx` + 单一类 `.jhs-tip-icon`（`role="img"` + `aria-label` 与 `data-tip` 同源）；删除两条重复 CSS 规则 |
| `polish` | `#999`/`#f40` 的使用可分三类：登记用途、信息性文本、移植保真 | 改信息性文本 5 处（`cache-item-html`、`actress-info-detail-segment`、`review-conflict-dialog`、`fc2-plugin` 的 `.search-loading`、`new-video-plugin` 的 `.actress-card-allname`）；改浅底危险文字 3 处（`fav-sync-panel` + `fav-sync-bind` 的「建议先备份数据」、`highlight-magnet-plugin` 的 4K 行标红）；**保留**序号/时间戳（`related-item`/`review-item`）、非文字分隔线（`section-header` 渐变）、以及四个声明「与原脚本字节级相同 / DOM 等价」的移植组件（`blacklist-confirm-message`/`quick-block-confirm-message`/`confirm-warn`/`log-colored`） |

### 顺带发现并修复的既有缺陷：CSS 占位符注入静默失效

`main.tsx` 往样式表里做字符串替换注入 CSS（隐藏原站导航 / 自建滚动容器样式 / 首页隐藏封面切换）。**v1.28.15「原子化拆分」把注释统一补了内部空格**（`/*X*/` → `/* X */`），其中两处标记的替换串没同步：

| 标记 | HEAD 用旧串命中 | 修复后用新串命中 | 影响 |
|---|---|---|---|
| `__HIDENAV2__`（javdb-site.css:1） | **0** | 1 | `?hideNav=1` 的「隐藏原站导航」CSS 从未注入 |
| `__SCROLLBAR__`（common-toolbar.css） | **0** | 1 | `.jhs-scrollbar`／`.content-panel` 等自建滚动容器样式从未注入 |
| `__HIDE_COVER_SIZE__`（javdb-site.css，doc/51） | 1 | 1 | 一直正常（无空格形态与替换串一致，但被 stylelint 判为格式错误） |

修法：标记形态统一为 `/* X */` 并**单点声明**在 `style-injector.ts`（`CSS_PLACEHOLDER` + `fillCssPlaceholder`），`main.tsx` 改用它，新增 `tests/css-placeholder.test.ts` 守住契约（标记存在于宿主样式表、替换后无 `__ABC__` 残留、全量扫描禁止未登记形态）。**副作用**：两处注入恢复生效（`hideNav=1` 模式与滚动条样式开始起作用——这正是它们的既定功能）。

## 实施（改动文件清单）

| 文件 | 改动 |
|---|---|
| `DESIGN.md` | 新增 2 条 Named Rule、增补 1 条规则的存量实测、Typography 补平台回退说明、Do's 的减动条款改写为「减少而非抹平」 |
| `.impeccable/design.json` | 侧车随 DESIGN.md 重新生成（13 规则 / 7 keyCharacteristics / 12 dos / 12 donts，逐字保真核验通过） |
| `src/components/setting/tip-icon.tsx` | **新增**：唯一问号提示实现 |
| `src/components/setting/setting-row.tsx` | `controlId` → `<label for>`；问号图标改用 `TipIcon` |
| `src/components/setting/setting-toggle.tsx` | 传入 `controlId={id}` |
| `src/components/setting/simple-setting-panel.tsx` | `Row` 增 `htmlFor`；11 个开关行的标签渲染为 `<label for>`；问号提示改 `TipIcon` |
| `src/styles/setting-plugin.css` | `.jhs-toggle::after` 命中区（40×44）；联动标签手型指针；两条问号提示 CSS 合并为 `.jhs-tip-icon` |
| `src/styles/accessibility.css` | 减动策略重写（保留状态过渡 + 10 处位移载体收窄 `transition-property`） |
| `src/styles/rating-bar.css` | 删除与全局重复的作用域内减动块 |
| `src/core/style-injector.ts` | **新增** `CSS_PLACEHOLDER` + `fillCssPlaceholder`（占位符单点声明与契约说明） |
| `src/main.tsx` | 三处占位符替换改用 `fillCssPlaceholder`（修 `__HIDENAV2__`/`__SCROLLBAR__` 失效，`__HIDE_COVER_SIZE__` 保持生效） |
| `src/styles/javdb-site.css` | `__HIDE_COVER_SIZE__` 标记形态统一（供替换 + 满足 stylelint） |
| `src/components/setting/cache-item-html.tsx`、`actress/actress-info-detail-segment.tsx`、`dpb/review-conflict-dialog.tsx`、`setting-panels/fav-sync-panel.tsx` | 信息性文本 `#999` → `var(--jhs-color-text-secondary)`；浅底危险文字 `#f40` → `#dc2626` |
| `src/plugins/highlight-magnet-plugin.ts`、`src/plugins/setting/jhs-sync/fav-sync-bind.ts` | 浅底危险文字 → `#dc2626` |
| `src/styles/fc2-plugin.css`、`src/styles/new-video-plugin.css` | 信息性文本 `#999` → `var(--jhs-color-text-secondary)` |
| `tests/setting-switch-hit-area.test.ts` | **新增**：6 用例（真实组件渲染 + jsdom 点击激活） |
| `tests/css-placeholder.test.ts` | **新增**：3 用例（占位符契约） |
| `AGENTS.md` | §3.5 组件 139 → 140；§6.3 套件 41 文件/419 用例 → 43 文件/428 用例（截至 v1.48.6） |
| `package.json`、`vite.config.ts` | userscript 版本 1.48.5 → 1.48.6 |
| `changelog/CHANGELOG.md` | 新增 v1.48.6 段 |

## 执行验证记录

- **执行环境**：Windows 10.0.26300 / bun / vitest 4.1.10；无浏览器自动化（无 Tampermonkey 实机环境）。
- **验证命令与输出**：

  | 命令 | 实际输出 |
  |---|---|
  | `bun run test` | `Test Files 43 passed (43)` / `Tests 428 passed (428)`（含新增 6 + 3 用例） |
  | `bun run lint`（eslint src/） | 通过（0 problem） |
  | `bun run lint:css`（stylelint） | 通过（修复前 `javdb-site.css:66` 有 3 条格式错误——即占位符标记形态，已随之修好） |
  | `bun run check:docs` | `check-doc-catalog: OK (43 plugins [5 flagged], 67 core files)` |
  | `bun run check:structure` | `check-structure: OK (390 files, 68 dirs within limits; 0 file-ceilings, 3 dir-ceilings in ratchet)` |
  | `bun run check:selectors` | `check-site-selectors: OK (85 files, 258 literals; 0 file(s) below baseline)` |
  | `bun run check:version` | `check-version-sync: OK (userscript 1.48.6 = package.json 1.48.6)` |
  | `bunx tsc -b` + `bunx vite build` | `✓ 434 modules transformed` / `dist/monkey-jhs-disassemble.user.js 1,286.75 kB │ gzip: 331.76 kB` |
  | `bunx vitest run tests/setting-switch-hit-area.test.ts` | `Tests 6 passed (6)`：快捷面板 11 个开关**全部**有配对 `label[for]`；点标签文案即切换；点问号提示不切换（`closest('label') === null`）；两个表面同用 `.jhs-tip-icon` 且 `aria-label === data-tip`；旧类名 0 残留；未给 `controlId` 时退回纯文本标签 |
  | 占位符修复前后（`git show HEAD:` 版 vs 工作区版对比） | `__HIDENAV2__` 旧串命中 **0 → 1**；`__SCROLLBAR__` 旧串命中 **0 → 1**；`__HIDE_COVER_SIZE__` 1 → 1 |
  | 侧车保真核验（`check-narrative.ts`） | `verdict: narrative 与 DESIGN.md 逐字一致`（13 规则 / 7 keyCharacteristics / 12 dos / 12 donts） |

- **验证结论**：五条命令的改动均以真实渲染产物（`jsxToString`）或真实文件/构建产物核验；开关命中区与标签联动有 jsdom 行为断言；占位符失效有 HEAD↔修复后对照实证；门禁、lint、类型检查与构建全绿。
- **已知限制**：
  1. **无浏览器**：视觉结果（40×44 命中区的实际触感、减动下的观感、浅底文字的实际对比）未做真机核验，对比度为计算值。
  2. 命中区向外 11px，在相邻行间距约 34px 的密集面板里与邻行最多重叠 ≤1px（重叠处由绘制顺序更后者胜出，影响可忽略）。
  3. 两处恢复生效的注入（`hideNav=1` 的隐藏导航、滚动条样式）**属于行为变化**，其实机观感未核；若与原脚本预期不符，回退点是 `main.tsx` 的 `fillCssPlaceholder` 两行。
  4. `highlight-magnet-plugin` 的 4K 标红由 `#f40` 改 `#dc2626`，是对原脚本视觉字面值的**有意偏离**（原脚本无颜色冻结契约声明）；如需严格保真可回退。

## 后续验证建议

1. 实机（Tampermonkey + JavDB）：设置弹层与快捷面板各点若干开关的**标签文案**，确认能切换；触摸设备确认开关易点。
2. 系统开启「减弱动态效果」后：确认脉冲点/骨架/spinner 静止、「请求中」等文字仍在、hover 底色变化仍可见。
3. `?hideNav=1` 打开一次（确认原站导航隐藏恢复生效）、并在自建滚动容器上确认 6px 滚动条出现。
4. 4K 磁链行标红、`fav-sync-panel` 的「建议先备份数据」颜色观感确认。