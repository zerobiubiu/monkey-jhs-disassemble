# 60 - 每周推荐入口停靠侧栏

> **文档类型**：🧾 变更记录
> **文档状态**：✅ 已执行
> **影响范围**：首页推荐入口、列表批量侧栏与「加载全部」停靠顺序
> **前置文档**：[59 - 首页推荐浮层](59-home-weekly-recommend-floating-panel.md)
> **生效版本**：v1.48.10

## 1. 背景

用户要求将「每周推荐」按钮并入本脚本创建的 `body > .jhs-lp-batch-side`，
只在首页显示，排在最上方，与加载全部、请求列表、全选等操作保持距离并分隔，按钮风格一致。

源码确认侧栏由 `lp-batch.tsx` 创建，选择状态刷新只同步按钮状态，不重建整个容器；
`ap-scroll.ts` 原先通过 prepend 把「加载全部」放到首位，因此只移动推荐按钮仍可能被后到的
加载全部抢占位置。需要同时明确两个入口的停靠顺序。

## 2. 方案与实施

- 导出侧栏容器创建函数 `ensureBatchSideBarContainer()`，让推荐与批量选择共用同一个
  容器。复用已存在的侧栏，不覆盖现有按钮或监听；也检查缓存容器是否已脱离文档。
- 推荐模板改为 Fragment，入口本身作为侧栏的直接子 button，复用
  `.jhs-lp-batch-side-btn`；保持首页和推荐骨架守卫。推荐标题原位置只留还原注释，不再占位。
- 推荐初始化时 prepend 到首位；加载全部停靠时放到推荐后面，无推荐时仍为首位。
  侧栏刷新不清空外部停靠按钮，已有浮层开关、关闭与焦点逻辑保持可用。
- 推荐按钮下方增加 12px 额外间距和细分隔线；移动端侧栏沿用既有横排，改为右侧间距
  和竖线。入口字体、尺寸、颜色、边框和交互态继承侧栏按钮样式，不单独覆盖。

| 文件 | 实施内容 |
|---|---|
| `src/plugins/list-page/lp-batch.tsx` | 复用侧栏容器获取/创建入口及修正停靠说明 |
| `src/plugins/list-page/weekly-recommend.tsx` | 推荐按钮直接停靠侧栏，移除首页原位置占位 |
| `src/components/list-page/weekly-recommend-panel.tsx` | 入口复用侧栏按钮类，根节点改为 Fragment |
| `src/plugins/auto-page/ap-scroll.ts` | 加载全部按推荐是否存在决定停靠顺序 |
| `src/styles/list-page/weekly-recommend.css` | 桌面与窄屏分隔样式，移除入口独立尺寸与字号 |
| `tests/weekly-recommend-panel.test.ts` | 增加 6 项侧栏归属、首页限定、刷新保活与先后停靠回归 |
| `AGENTS.md`、`docs/javdb-site-structure.md`、`docs/README.md` | 更新当前入口位置、顺序与文档索引 |
| `package.json`、`vite.config.ts`、`CHANGELOG.md` | patch 同步递增至 1.48.10 |

没有新增、删除或移动源文件，不涉及文件拆分；`lp-batch.tsx` 仍为 491 行，未超过 500 行软上限。
保留前一轮未提交改动，未提交、推送、切换分支，也未安装依赖或浏览器脚本。

## 3. 后续验证建议

在真实首页检查侧栏顺序「每周推荐 → 分隔 → 加载全部 → 请求列表 → 全选 → 反选 → 清空」，
测试点击开关、选择变化后的刷新及窄屏横排；非首页确认没有推荐入口。推荐骨架不在时
不显示空入口。历史推荐浮层的实站交互验证边界继续见 doc/59。

## 4. 执行验证记录

### 环境

Windows / PowerShell，现有 Bun、Vite 8.2.1、TypeScript、Vitest、ESLint、Stylelint；
分支 master，提交基线 1ed968a，保留任务开始时的全部未提交改动。

### 命令与实际输出

以下命令均实际执行并观察到退出码 0：

| 命令 | 关键输出与结论 |
|---|---|
| `bun run test -- tests/weekly-recommend-panel.test.ts tests/lp-batch-delegation.test.ts tests/batch-ui-render.test.ts` | 3 文件 / 42 项通过；推荐面板 18 → 24 项，新增 6 项侧栏回归 |
| `bun run test` | 49 个测试文件 / 544 项全部通过 |
| `bun run build` | `tsc -b && vite build` 通过；438 modules，产物 1,299.01 kB，gzip 335.36 kB |
| `bun run lint` | ESLint 无告警输出 |
| `bun run lint:css` | Stylelint 无告警输出 |
| `bun run check:structure` | 394 文件 / 68 目录符合门禁，未调整棘轮 |
| `bun run check:docs` | 43 plugins [5 flagged]，68 core files |
| `bun run check:selectors` | 83 files，246 literals，7 个文件低于基线；未修改基线 |
| `bun run check:version` | userscript 1.48.10 = package.json 1.48.10 |
| `impeccable.cmd detect --json`（本轮修改的推荐组件与 CSS） | `[]` |
| `git diff --check` | 无输出 |
| `Select-String -LiteralPath dist/monkey-jhs-disassemble.user.js -Pattern '^// @version'` | 第 4 行为 `// @version      1.48.10` |

首次源码构建通过后递增 patch，再重新构建并核验产物头；构建仍有第三方 layer.css
既有 IE hack 的 10 条容错提示，退出码为 0，本轮新增样式检查无告警。

### 结论与限制

本轮不操作用户浏览器，未进行实站或截图验收。侧栏位置和交互通过本地合成 DOM 回归验证；
真实样式仍需浏览器检查。当前会话未暴露 AOCI MCP 工具，未执行正式认知读取或维护，
也未改写索引；该限制延续 doc/59。
