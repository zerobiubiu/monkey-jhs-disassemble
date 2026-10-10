# 视频详情页外部站点访问次数统计（v1.47.5）

> **文档类型**：🧾 变更记录
> **文档状态**：✅ 已执行
> **影响范围**：`src/core/storage/`（新 namespace）、`src/plugins/other-site-plugin.tsx`、`src/plugins/other-site/`、`src/components/other-site/`、`src/styles/other-site-plugin.css`、`docs/plugin-catalog.md`、`AGENTS.md`
> **前置文档**：无
> **替代文档**：无
> **生效版本**：1.47.5

## 1. 背景

详情页的第三方站点按钮（MissAV / SupJav）由 `OtherSitePlugin.loadOtherSite()` 渲染为**原生**
`<a target="_blank" class="site-btn">`：`probeSite` 只负责写入 `href` 与结果底色，
打开外站完全依赖浏览器默认行为——**仓库里没有任何点击逻辑**，因此计数无从下手，需要新增。

先查清三件事实（决定了实现位置与时机）：

1. **点击路径**：无 `click` 监听、无 `window.open`/`GM_openInTab`；按钮的 `id` 是 `missAvBtn` / `supJavBtn`
   （`siteConfigs`），显示名与 `id` 去 `Btn` 后缀一致。
2. **预加载共用键空间**：列表页预加载（`osp-preload`）不碰详情页 DOM，但**写同一个 `otherSite`
   缓存键**（`` `${carNum}_${siteId}` ``）。若把计数放在缓存写入处，每次列表页预加载都会被算成一次访问。
3. **按钮 HTML 会被反复重建**：`loadOtherSite` 有三个调用点（`handle`、设置开关切换、FC2 弹窗），
   每次都向 `.movie-panel-info` 与 `.container .info` 各 append 一份（`#otherSiteBox` id 因而可能重复）；
   元素级监听或按 `id` 更新都会重复计数 / 只更新到第一份。

需求：为每个视频统计外站访问次数、持久化、在详情页展示，且不得因刷新、重复渲染、重复请求或
重复事件而算错；不同视频互相独立。

## 2. 方案

### 2.1 计数口径（与产品确认）

**只有真实外跳才计 1 次**：该按钮已解析出可跳转 `href`（非空、非 `#` 占位），且是左键（含键盘回车）、
中键、`Ctrl+点击` 这类**会真的打开外站**的操作。未命中（没解析出链接）的点击不计；右键不触发导航，故不计。

计数时机 = **点击时**，不是预加载 / 缓存写入时（见 §1 事实 2）。

### 2.2 防重复（三个独立来源都堵住）

| 风险 | 措施 |
|------|------|
| `loadOtherSite` 反复重建按钮 → 元素级监听重复绑定 | `document` **捕获阶段** 委托 + 模块级 `bound` 门闩，只绑一次（幂等） |
| 同一事件被多个监听器/重放看到 | `WeakSet<Event>` 标记已处理的事件对象，一次点击只计一次 |
| 容器重复导致同一按钮存在两份 DOM | 计数只发生在**被点击的那个**元素上，且要求该元素自身有 `href`（探测只写第一份，第二份无 `href` → 天然不计） |

### 2.3 稳定标识

以**番号**为键（`trim().toUpperCase()` 归一，与 `car-status-journal` 的压缩口径一致），与
`car_list` / 清单 / 阅读状态同一身份体系；不依赖标题、排序或任何展示属性。

### 2.4 持久化

新增持久数据 namespace **`externalVisit`**，一条记录 = 一个视频：
`{ total, bySite: Record<siteId, number>, updatedAt }`。

- 用 **单条写入** `writePersistentEntry`（`replacePersistentMap` 是整表替换，会与其它写入者互相覆盖）。
- **不复用** `otherSite`：那里的预加载走整表替换，会把单条记录覆盖掉（丢失更新）。
- namespace 已登记 `PersistentNamespace` + `PERSISTENT_DATA_NAMESPACES`——后者是运行期白名单，
  漏登记会导致**备份导出/导入静默丢弃**（只有 `console.warn`）。
  无需 DB 版本升级（namespace 是自由索引列），也无需旧 localStorage 迁移规格（全新数据）。

### 2.5 展示（沿用既有设计系统）

- `#otherSiteBox` 内、按钮行上方一行汇总：`外部访问 共 <b>N</b> 次`（`.site-visit-total`）。
- 每个站点按钮内、站点名之后一枚计数徽标（`.site-open-count`）。
- **零值处理**：站点计数为 0 时徽标 `display:none`；总计为 0 时整行隐藏——不占位、不显示「0 次」，
  不给每个详情页添一层常驻噪音。
- **读取失败**：按零值展示 + `clog.warn`（无 `clog` 时 `console.warn`），**且不写入**——
  宁可少计一次，也不把已有计数覆盖成从 1 开始。
- **即时更新**：点击后同步读回自己刚写入的镜像值并就地刷新所有副本（含重复容器），无异步窗口。

徽标用白底 + 正文色（`var(--jhs-color-bg)` / `var(--jhs-color-text)`）：按钮底色会随探测结果
在绿/黄/红之间变化，白底徽标的对比度不随状态色波动。

### 2.6 未采纳的替代方案

| 方案 | 不采纳原因 |
|------|-----------|
| 在 `probeSite` / 缓存写入处计数 | 列表页预加载写同一键空间 → 每次预加载都算一次访问（假计数） |
| 复用 `otherSite` namespace | 预加载的整表替换会覆盖单条记录（丢失更新） |
| 用 localStorage 计数 | 脱离项目持久数据架构，不进备份、不随迁移 |
| 元素级 `click` 监听 | `loadOtherSite` 反复重建 DOM → 重复绑定 / 重复计数 |
| 按 `#siteId` 更新徽标 | 容器重复时 `id` 冲突，只能更新到第一份 |
| 做「清空统计」入口 | 产品本轮不要（后续需要再加） |

## 3. 实施（文件清单）

| 文件 | 改动 |
|------|------|
| `src/core/storage/external-visit-ops.ts` | **新增**：统计类型/读写（`readExternalVisitStat` / `recordExternalSiteVisit`）、番号归一、测试注入缝 `__setExternalVisitStoreForTest` |
| `src/plugins/other-site/osp-visit-count.ts` | **新增**：委托绑定（幂等 + `WeakSet` 去重）、真实外跳判定、就地渲染 |
| `src/core/storage/persistent-data-store.ts` | 注册 namespace `externalVisit`（union + `PERSISTENT_DATA_NAMESPACES`） |
| `src/components/other-site/other-site-btn.tsx` | 新增 `count` 属性、`data-site-id`、计数徽标；导出 class/属性常量 |
| `src/components/other-site/other-site-box.tsx` | 新增 `visitTotal` 属性与汇总行；导出汇总行 class 常量 |
| `src/plugins/other-site-plugin.tsx` | `loadOtherSite` 读统计、传属性、登记番号并挂计数 |
| `src/styles/other-site-plugin.css` | `.site-visit-total` / `.site-open-count`（全部走 `--jhs-*` 令牌） |
| `tests/external-visit-count.test.ts` | **新增**：8 用例（jsdom，用真实组件渲染夹具） |
| `docs/plugin-catalog.md` / `AGENTS.md` | 核心模块 62 → 63；测试套件 35/362 → 36/370 |
| `vite.config.ts` / `package.json` / `changelog/CHANGELOG.md` | 版本 1.47.4 → 1.47.5 |

结构约束：`src/plugins`（39/39）与 `src/core/util`（20/20）已到目录扁平度棘轮上限，
故新文件落在 `src/core/storage/`（10/20）与 `src/plugins/other-site/`（9/20）。

## 4. 执行验证记录

### 执行环境

- Windows（win32 10.0.26300，x64），工作目录 `E:/monkey-jhs-disassemble`；基线 `5e998a9`（v1.47.4）

### 验证命令

```bash
bunx vitest run tests/external-visit-count.test.ts   # 新用例
bun run test                                          # 全量
bun run lint; bun run lint:css                        # 静态检查
bun run check:structure; bun run check:docs; bun run check:selectors; bun run check:version
bun run build                                         # tsc -b && vite build
# 机械检测器（本仓库 UI 在 TSX 里，故先用真实组件渲染出标记再检测）
bun .impeccable/tmp-visit-preview/build.tsx
impeccable.cmd detect --json .impeccable/tmp-visit-preview/preview.html
```

### 实际输出

| 命令 | 输出 |
|------|------|
| 新用例 | `Test Files 1 passed (1)` / `Tests 8 passed (8)` |
| 全量测试 | `Test Files 36 passed (36)` / `Tests 370 passed (370)`（原 35 / 362） |
| `lint` / `lint:css` | 均 exit 0，无 error/warning |
| `check:structure` | `OK (386 files, 67 dirs within limits; 4 file-ceilings, 3 dir-ceilings in ratchet)` |
| `check:docs` | `OK (44 plugins [5 flagged], 63 core files)` |
| `check:selectors` | `OK (88 files, 274 literals; 0 file(s) below baseline)` |
| `check:version` | `OK (userscript 1.47.5 = package.json 1.47.5)` |
| `build` | `✓ 430 modules transformed` → `dist/monkey-jhs-disassemble.user.js 1,291.21 kB │ gzip: 331.66 kB`，`✓ built in 802ms` |
| `detect` | 1 条 advisory：`rgb(123, 199, 59)` 不在 DESIGN.md 调色板内 |
| 对比度（WCAG 相对亮度计算） | 徽标 `#363636` on `#fff` = **12.08:1**；汇总行文字 `#6c757d` on `#fff` = **4.69:1**；数字 `#363636` on `#fff` = **12.08:1** |

**detect 那条 advisory 的处置**：`rgb(123, 199, 59)`（`#7bc73b`）是 `OtherSitePlugin.okBackgroundColor`
（探测命中时的按钮底色）的**既有值**，不是本次新增的颜色；预览里为了不失真而模拟了探测结果态，
它才出现在检测范围内。按设计系统规则「存量字面量按触碰即迁移、不做一次性机械替换」，
本次不动它（属既有漂移，如实报告不顺手修）。

**渲染证据**：本仓库 UI 写在 TSX 组件里（经 `jsxToString` 渲染成 HTML 字符串），仓库内没有页面 HTML，
因此证据链是「真实组件渲染出的标记 + 真实 CSS → 检测器」：

```html
<div class="site-visit-total" data-total="3" data-tip="…">外部访问 共 <b>3</b> 次</div>
<a target="_blank" class="site-btn" id="missAvBtn" data-site-id="missAvBtn">
  <span>missAv</span><span class="site-open-count" data-tip="…">3</span></a>
```

### 前端或调用方验证

- **自动化**：8 条 jsdom 用例直接驱动**真实组件渲染出的 DOM**，覆盖：单次外跳只计 1 次并即时刷新；
  同一事件重放 / 重复绑定不重复计数；无 `href` 与 `#` 占位不计；中键算、右键不算；
  多视频多站点互相独立且番号大小写归一；「刷新」后读回已存值；读取失败降级为零且不覆盖；
  零值不出现徽标与汇总行。
- **视觉/运行时限制**：本机没有浏览器自动化能力（未挂载 chrome-devtools 之类 MCP），
  userscript 又必须在 JavDB 页面里由 Tampermonkey 注入、且依赖已登录会话与真实站点 DOM，
  因此**未能做真机截图核对**。替代证据为：真实组件标记 + 真实 CSS 的检测器结果、
  上述对比度实测值、以及全量测试与构建。建议用户在一次真实详情页浏览中确认
  汇总行/徽标的排版与「多结果」角标不冲突（角标在 `top:-15px` 的按钮上方，本次元素都在按钮内与上方一行）。

### 验证结论

✅ 已执行。需求 1–5 全部落地：计数口径唯一且防重复、持久化走既有架构并已登记备份白名单、
详情页展示沿用设计系统（0 值不占位、失败降级、点击即时更新）、结构门禁与全部测试通过。

### 已知限制

1. **跨 frame 极限竞态**：持久数据镜像按 realm 各存一份，且没有「刷新他人镜像」的 API。
   同一视频在两个 frame 里同时点击（例如详情页 iframe 与 FC2 弹窗同时打开同一番号）时，
   极短时间内可能各有一次读改写 → 少计一次。不同视频之间不受影响（键不同）。
2. **备份/恢复**：namespace 已进白名单，故 WebDAV/Git/本地 JSON 备份会带上它；但恢复依赖
   导入流程 `applyBackupExtras`（`PERSISTENT_DATA_NAMESPACES` 校验通过）。
3. **列表页不显示**：本轮只做详情页展示；列表页卡片未加计数（需求未要求，且会与既有徽标争夺空间）。
4. 未做真机浏览器核对（见上「视觉/运行时限制」）。

## 5. 后续验证建议

1. 在 JavDB 详情页实测：点击 MissAV / SupJav 按钮（左键、中键、Ctrl+点击）各计一次；
   刷新页面后徽标与汇总行数字不变；同一番号在设置里切开关触发 `loadOtherSite` 重建后仍不翻倍。
2. 观察与「多结果」黄色角标、预加载状态徽标在同一按钮上的共存是否拥挤（三者位置不同：
   角标在按钮上沿、状态徽标在列表页卡片、计数徽标在按钮内）。
3. 若后续要做「清空统计」或列表页展示，按 doc/43 的口径新增后继文档（本档不可回改）。