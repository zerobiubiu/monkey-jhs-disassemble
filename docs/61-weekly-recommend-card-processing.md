# 61 - 推荐卡片完整解析与按需预加载

> **文档类型**：🧾 变更记录
> **文档状态**：✅ 已执行
> **影响范围**：首页推荐卡片状态/标签/评分/点击/翻译、外站预加载调度及标题
> **前置文档**：[59](59-home-weekly-recommend-floating-panel.md)、[60](60-weekly-recommend-sidebar-dock.md)
> **生效版本**：v1.48.11

## 1. 背景

用户要求浮层推荐视频按普通视频流 item 解析，包括状态、预加载和清单标签；唯一预加载
条件是必须先打开浮层。同时隐藏标题后半「更新於: 2026-10-29」，仅显示推荐名称与周期。
前两轮为保护主流排序/翻页把推荐同时排除在卡片处理之外，导致状态和标签缺失。本轮按
用户要求恢复推荐的卡片处理，继续保护主列表的结构与统计边界。

## 2. 方案

### 2.1 展示处理与主列表范围

站点注册表新增 `displayItem`、`parsedItem`、`weeklyRecommendItem` 和 `preloadItem`。
主列表选择器和 `filterItem` 保持原范围，避免推荐混入排序、下一页追加、批量选择和三类筛选统计。

推荐复用 `filterMovieList` 的真实收藏/已读/屏蔽、演员黑名单、关键词、待鉴定及显示设置逻辑，
通过 `trackCounts=false` 跳过主列表计数、计时、汇总日志和统计按钮文案。推荐刷新串行执行，
精准状态同步也进入同一队列。缺少原标签槽时创建空标签挂载点后复用既有组件。

清单初始化、增量、全量与精准刷新包含推荐；同番号出现多次时刷新全部实例，未变标签也补齐新实例。
评分选择器兼容推荐没有 `.movie-list` 类的结构，保留已有用户列布局。翻译还原、图片替换与
点击委托同步覆盖推荐；点击通过命名空间 document 委托支持晚到卡片，并在销毁时解绑。

控制器比较卡片节点身份、原生番号/链接/备用 date 字段；新增/移除/晚填卡片时合批通知，
自身状态标签、清单、预加载徽标和译文不导致循环解析。未填完整的推荐骨架暂不报解析错误。

### 2.2 预加载门控与去重

- 未打开推荐浮层时不为推荐扫描入队、创建待处理徽标或发请求。打开后及打开期间新增/晚填
  卡片时复用原请求队列、缓存、并发、启用站点、总开关和预加载开关。
- 跨异步读取后、入队时及实际执行前复核卡片仍连接且满足预加载范围。关闭后尚未开始的
  推荐独占任务跳过；同番号主列表任务仍可执行。已经发出的请求可完成，不宣称关闭能撤回在途请求。
- 按业务键检查注册表、队列与在途请求，避免两区同番号及反复开关重复排队；结果和手动取消
  同步所有同番号卡片徽标，关闭推荐不按键取消主列表共享任务。
- 从 547 行的 `osp-preload.tsx` 拆出徽标/观察器与卡片定位模块，主编排降至 489 行；
  展示层通过回调调用编排，helper 只以类型引用插件，不产生反向运行时依赖。UI 组件模板未改写。

### 2.3 标题

识别原标题中「更新於/更新于/Updated at/on + 日期」后缀，只将相应 Text 内容收起；
保留原节点与前面的周期 small 元素，销毁时按节点还原原文本。没有匹配日期时保持原标题。

## 3. 实施文件

| 文件 | 改动 |
|---|---|
| `src/constants/weekly-recommend.ts` | 推荐显隐与原生卡片身份更新事件 |
| `src/core/util/site/selectors.ts` | 主流/展示/解析/按需预加载范围 |
| `src/core/util/util-status-tag.tsx` | 无原生标签槽的卡片挂载兜底 |
| `src/plugins/list-page-plugin.tsx`、`list-page/weekly-recommend.tsx` | 推荐串行解析、增量签名、标题后缀与事件派发 |
| `src/plugins/list-page/lp-filter.tsx`、`lp-dom.ts`、`lp-translate.ts` | 共用过滤规则、计数边界、委托点击、还原翻译 |
| `src/plugins/detail-page-button/dpb-want-watched.ts`、`rating-display/rating-config.ts` | 精准状态及评分覆盖推荐 |
| `src/plugins/video-lists-tag/vlt-tags.ts`、`vlt-tag-renderer.ts`、`vlt-plugin.ts` | 清单所有解析入口、晚填卡片事件、同番号多实例与缺 meta 回退 |
| `src/plugins/other-site-plugin.tsx`、`other-site/osp-preload.tsx` | 按需事件、请求门控、共享任务与徽标 |
| `src/plugins/other-site/osp-preload-items.ts`、`osp-preload-observer.ts` | 按职责拆分的卡片定位和展示/观察器 |
| `tests/weekly-recommend-*.test.ts` | 标题/事件/晚填、真实卡片规则、清单/评分/状态接线及无联网预加载回归 |
| `AGENTS.md`、`docs/plugin-catalog.md`、`docs/javdb-site-structure.md`、`docs/README.md` | 当前行为、模块职责和索引 |
| `package.json`、`vite.config.ts`、`CHANGELOG.md` | patch 同步至 1.48.11 |

## 4. 后续真实页面验证建议

1. 首页不打开浮层，确认只有主流番号进入预加载；打开后推荐出现状态、清单及预加载徽标。
2. 反复打开/关闭，同番号两区同时存在时检查队列去重；关闭时主流请求不受影响。
3. 推荐切换/站点异步补卡片后，状态和清单自动补齐；详情页操作同步两处实例。
4. 验证封面弹窗、FC2、标题新标签页、翻译还原、高清封面及只显示标题前半。
5. 保持主流筛选/排序/翻页/批量选择独立，分别检查暗色与窄屏真实显示。

## 5. 执行验证记录

### 环境

Windows / PowerShell，master，起始 Git 提交 1ed968a；保留此前全部未提交改动。
使用已有 Bun/TypeScript/Vite/Vitest/ESLint/Stylelint，没有安装工具或依赖。

### 命令与实际输出

最终验证均实际执行并观察到退出码 0：

| 命令 | 实际输出 / 结论 |
|---|---|
| `bun run test` | `Test Files 52 passed (52)`；`Tests 588 passed (588)`，本轮新增 44 项回归 |
| `bun run build` | `tsc -b && vite build` 通过；Vite 8.2.1，441 modules，产物 1,307.94 kB，gzip 337.81 kB |
| `bun run lint`、`bun run lint:css` | ESLint / Stylelint 无告警输出 |
| `bun run check:structure` | `OK (397 files, 68 dirs within limits; 0 file-ceilings, 3 dir-ceilings in ratchet)`，未抬高棘轮 |
| `bun run check:docs` | `OK (43 plugins [5 flagged], 68 core files)` |
| `bun run check:selectors` | `OK (82 files, 245 literals; 8 file(s) below baseline)`，未修改基线 |
| `bun run check:version` | `userscript 1.48.11 = package.json 1.48.11` |
| `git diff --check` | 无输出 |
| `Select-String -LiteralPath dist/monkey-jhs-disassemble.user.js -Pattern '^// @version'` | 第 4 行为 `// @version      1.48.11` |
| `impeccable.cmd detect --json`（控制器、状态标签工具） | 退出 0，1 项 advisory：状态工具既有第 72 行颜色 `#cd5c5c` 未列入设计色板；非本轮新增颜色，未扩大范围修改 |

回归组成：推荐面板 24 → 32（标题、显隐事件、身份签名与销毁），新增卡片适配 10 项、
真实过滤/点击处理 15 项、按需预加载 11 项。预加载使用真实任务队列与 HTTP 替身，
覆盖默认不请求、打开/关闭/重开、设置开关、跨 await 门控、同番号去重与结果/取消同步、
内容晚填事件、隐藏重试不假报成功。普通卡片仍复用原标签/徽标组件，拆分不改 UI 模板。

迭代验证曾发现并修复：jQuery 4 的 document 委托 seed 路径不支持 `:is()`，
改为展开逗号选择器并通过真实点击回归；缺少标签槽时状态不落地，补空挂载点后通过；
新增标签锚点字面量使选择器棘轮失败，改走注册表后通过。单文件 ESLint `.cmd` 启动器
不存在，改用项目配置的 `bun run lint`，最终退出 0。构建仍有第三方 layer.css
既有 IE hack 的 10 条容错提示，未影响成功构建。

源码稳定后构建通过，再递增 patch 并重新构建核验产物版本；未提交、推送或安装脚本。

### 结论与已知限制

本轮不操作用户浏览器；HTTP 调用为无联网替身，任务队列与 DOM 处理使用真实项目实现。
测试不代替真实站点、第三方连通性和移动端渲染验收。AOCI 工具仍未向当前会话暴露，
未执行正式认知读取/维护，未改写索引；前两轮限制见 doc/59、60。
