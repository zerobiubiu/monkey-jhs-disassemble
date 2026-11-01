# 59 - 首页每周推荐浮层与列表隔离

> **文档类型**：🧾 变更记录
> **文档状态**：✅ 已执行
> **影响范围**：JavDB 首页推荐展示、主列表选择器与相关筛选/预加载
> **前置文档**：47、48、51、52（首页检测、筛选栏挂载与排序职责）
> **生效版本**：v1.48.9

## 1. 背景与证据

首页新增「每週推薦(週一/四更新)」，用户要求把 `body > section > div > h1`
到 `#recommend-container` 的区域移动到按钮控制的浮动层，减少首页纵向占用。
上述节点定位来自用户；本次未成功采集推荐区内部的实时 DOM。

源码检查发现主列表选择器曾全局匹配 `.movie-list`、`.item`。若推荐沿用这些类名，
单纯搬到 body 下仍会被主列表排序、翻页、批量处理及状态/清单/预加载筛选误扫描。
所以本任务同时维护推荐与主列表的边界，边界在原始下一页 HTML 中同样有效。

## 2. 方案与行为

- 沿用 `ListPagePlugin`，在首个异步操作前初始化推荐控制器；不新增插件或权限。
- 默认收起；原位置显示「每周推荐」按钮。打开非模态浮层后可内部滚动，关闭按钮、
  再次点击入口、点击外部或 Esc 均可收起。键盘关闭后焦点返回入口；尊重现有 layer 的 Esc 门闩。
- 先校验标题与容器同父级、顺序可达，再整体移动其间连续节点。标题放进浮层头部，
  其他节点放进内容区。保留节点身份、自身事件监听及容器内后续更新，不复制 innerHTML。
- 骨架尚未出现时，在首页最多观察 10 秒；成功或超时即停止观察。销毁时清理事件、
  定时器和观察器，并按注释锚点还原原节点。结构不符合约束时保留原站内容。
- 主列表、卡片及通用筛选选择器排除 `#recommend-container` 本体和后代，防止推荐参与
  主列表筛选、排序、翻页追加、批量操作、清单计数及预加载。状态标签内部选择器不再依赖
  查询根自身作为 `.item` 祖先；全局收集仍检查最近卡片身份，非卡片标签不计入。
- 浮层使用项目令牌、页面层级 z-index、44px 按钮和键盘焦点样式；适配窄屏及站点暗色主题。
  推荐原有内部布局继续由站点样式控制，无新增网络请求或持久化设置。

## 3. 实施文件

| 文件 | 改动 |
|---|---|
| `src/components/list-page/weekly-recommend-panel.tsx` | 推荐入口、非模态浮层壳与可访问语义 |
| `src/plugins/list-page/weekly-recommend.tsx` | 节点搬移、交互、延迟骨架和销毁还原 |
| `src/styles/list-page/weekly-recommend.css` | 浮层、滚动区、窄屏、暗色与焦点样式 |
| `src/plugins/list-page-plugin.tsx` | 初始化、样式注入和销毁接线 |
| `src/core/util/site/selectors.ts`、`src/plugins/base-plugin.ts` | 统一推荐边界及主列表选择器 |
| `src/plugins/status-tag-filter/stf-{apply,collect,score}.ts` | 状态筛选、计数和补渲染边界 |
| `src/plugins/other-site-plugin.tsx`、`src/plugins/other-site/osp-filter-bar.ts`、`src/plugins/other-site/osp-preload.tsx` | 预加载与筛选边界 |
| `src/plugins/video-lists-tag/vlt-{filter-apply,tag-renderer,tags}.ts` | 清单筛选与计数边界 |
| `src/plugins/list-page/lp-dom.ts`、`src/plugins/page-sort-plugin.ts`、`src/plugins/auto-page/ap-fetch.ts` | 卡片定位、排序挂载及翻页追加边界 |
| `tests/weekly-recommend-*.test.ts` | 节点/交互/生命周期与双列表边界回归 |
| `AGENTS.md`、`docs/plugin-catalog.md`、`docs/javdb-site-structure.md`、`docs/README.md` | 架构、职责、站点证据边界及索引 |
| `vite.config.ts`、`package.json`、`CHANGELOG.md` | 版本同步及发布说明 |

本任务未进行文件拆分。`osp-preload.tsx` 共 547 行，本轮仅在已有 import 中补入
`siteSelector` 并替换 3 处选择器，净行数不变；已评估暂不拆分，避免把预加载请求编排与
生命周期拆分混入本次展示适配。其余触及的 TS/TSX 源码未超过 500 行。

## 4. 后续真实页面验证建议

1. 安装新构建后打开首页，确认原推荐区域只留下入口，主列表与筛选栏位置正常。
2. 打开浮层，检查推荐原标签切换、内容加载、懒加载图片与链接；特别核对依赖原祖先的
   站点事件委托（节点自身监听保留不等于所有祖先委托必然保留）。
3. 桌面、窄屏与暗色各检查一次：内部可滚动、关闭按钮始终可见、Esc 与焦点行为正常。
4. 激活主列表状态/清单/预加载筛选、切换排序并加载下一页，推荐内容不应被隐藏、移走或重复追加。

## 5. 执行验证记录

### 执行环境

Windows / PowerShell，分支 `master`，起始提交 `1ed968a`，开工工作区干净。
使用项目已有 Bun、TypeScript、Vite、Vitest、ESLint、Stylelint；未安装、升级工具或依赖。

### 验证命令、实际输出与结论

下列最终验证均实际执行并观察到退出码 0：

| 命令 | 关键输出 / 结论 |
|---|---|
| `bun run build` | `tsc -b && vite build` 通过；Vite 8.2.1，438 modules transformed，产物 1,298.23 kB，gzip 335.20 kB |
| `bun run test` | `Test Files 49 passed (49)`；`Tests 538 passed (538)`，本任务新增 33 项回归 |
| `bun run lint` | ESLint 退出 0，无告警输出 |
| `bun run lint:css` | Stylelint 退出 0，无告警输出 |
| `bun run check:structure` | `OK (394 files, 68 dirs within limits; 0 file-ceilings, 3 dir-ceilings in ratchet)`，未抬高棘轮 |
| `bun run check:docs` | `OK (43 plugins [5 flagged], 68 core files)` |
| `bun run check:selectors` | `OK (83 files, 246 literals; 7 file(s) below baseline)`；未修改基线 |
| `bun run check:version` | `OK (userscript 1.48.9 = package.json 1.48.9)` |
| `git diff --check` | 无输出，退出 0 |
| `impeccable.cmd detect --json`（目标为新增组件、控制器、CSS） | `[]`，退出 0 |
| `Select-String -LiteralPath dist/monkey-jhs-disassemble.user.js -Pattern '^// @version'` | 第 4 行为 `// @version      1.48.9` |
| `Get-FileHash -LiteralPath dist/monkey-jhs-disassemble.user.js -Algorithm SHA256` | `96B4B3795C849AB0D09C1595670A0CFB3129EE37FBC8D9FEEB3A117CC744BAE2` |

构建继续出现第三方 layer.css 既有 IE hack 的 10 条 `Unexpected token Semicolon`
容错提示；构建退出码为 0，本任务新增 CSS 的 Stylelint 与检测器无告警。

迭代中实际遇到并修正的问题：首轮构建因控制器未读字段 `closeButton` 报 TS6133，移除
冗余字段后通过；新隔离测试首轮 2 项标签筛选失败，定位到 JSDOM 卡片作用域下冗余祖先
选择器匹配差异，收敛内部标签选择器后定向与全套回归通过；新增 CSS 契约测试首轮因
`import.meta.url` 非 file URL 失败，测试读取改用 `node:path.resolve` 后通过。

新增回归覆盖 18 项浮层交互/生命周期/CSS 显隐契约、9 项主列表与状态筛选隔离、6 项
清单/预加载/增量卡片边界。版本在源码构建通过后由 1.48.8 递增至 1.48.9，随后重新
构建验证产物头。未提交、推送、切换分支，也未安装到用户浏览器。

### 前端或调用方验证及已知限制

- 最初使用 Ego 请求首页时停在 Cloudflare；用户明确要求后停止 Ego，改用 Codex 默认 Chrome 插件。
- 默认 Chrome 连接真实首页先超时，再返回 `Debugger unattached`；随后 Computer Use 因无法
  可靠确定 Windows 浏览器当前网址而停止。本次未继续尝试浏览器操作，也未用其他技术绕过该限制。
- 因此没有真实页面、截图或移动端渲染验收，JSDOM 合成结构通过不代表站点全部原生交互已验证。
- 本会话未暴露 AOCI MCP 工具。只读 CLI `capabilities --json` 确认本机 AOCI 为 `0.1.0-rc22`；
  未执行 `aoci_rules`、`aoci_overview` 或 `aoci_maintain`，未改写正式认知索引，需有工具的会话完成维护。
- impeccable 提示 `.impeccable/design.json` 比 `DESIGN.md` 旧；本任务按现有设计文档实现，未扩大范围刷新其侧车数据。
