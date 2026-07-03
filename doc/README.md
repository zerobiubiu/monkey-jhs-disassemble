# monkey-jhs-disassemble 文档

本项目将单文件混淆用户脚本 `archetype/jhs.user.js`（11605 行）拆分重构为
基于 `vite-plugin-monkey` + React + TypeScript + SWC 的工程化项目，
要求打包产物在功能逻辑与执行效果上与原始脚本零偏差。

## 文档清单

| 文件 | 类型 | 状态 | 说明 |
|------|------|------|------|
| `01-refactor-plan.md` | 🔧开发指导 | 🔧待执行 | 重构总计划：架构分析、渐进策略、提取模式、进度追踪（core/插件/CSS/常量/资源已完成，余 legacy 启动序列收尾与去 `@ts-nocheck`） |
| `02-css-extraction.md` | 🔧开发指导 | 🔧待执行 | CSS 提取模式（`?raw` + `H()`/`insertAdjacentHTML` + 占位 `replace`）；顶层 CSS 已提取，余各插件 `initCss` |
| `03-plugin-integration.md` | 🔧开发指导 | ✅已执行 | 首批 4 插件（DetailPage/FilterTitleKeyword/HighlightMagnet/FoldCategory）外置集成记录 |
| `04-plugin-integration-final-batch.md` | 🔧开发指导 | ✅已执行 | 最终批次 3 插件（Setting/DetailPageButton/ListPage）外置集成记录 |
| `05-legacy-helpers-extraction.md` | 🔧开发指导 | ✅已执行 | legacy 残留辅助（layer 包装/tooltip/webdav 加密）提取到 core |

## 类型图例

- 📋 接口契约：前后端对接的 API 规格
- 🔧 开发指导：待执行/已执行的技术修改方案
- 📄 参考说明：调试记录、设计规格、备忘信息
- 🚀 部署运维：部署步骤、环境配置、密钥管理

## 状态图例

- ✅ 已执行：历史定稿，永不可改
- 🔧 待执行：尚未实施或进行中
- 📄 参考：仅供参考
- ⚠️ 已过期：不再适用

## 阅读顺序

1. `01-refactor-plan.md` — 理解整体重构策略与当前进度
2. `02-css-extraction.md` — CSS 提取的具体模式与清单
3. `03-plugin-integration.md` — 插件外置集成模式与首批执行记录
4. `04-plugin-integration-final-batch.md` — 最终批次插件外置集成记录
5. `05-legacy-helpers-extraction.md` — legacy 残留辅助代码提取到 core

## 当前进度概览

- core：15 个模块全部提取（`common-util`/`storage-manager`/`gm-http`/`toast`/
  `loading`/`logger`/`hotkey`/`image-preview`/`viewer`/`webdav`/`gfriends`/
  `async-task-queue`/`layer-wrapper`/`tooltip`/`webdav-crypto`）
- plugins：`base-plugin` + `plugin-manager` + 21 个插件模块全部外置
- constants：`site`/`status`/`video-quality`/`api`/`tabulator-zh`
- resources：`gfriends`
- styles：`loading`/`javbus-masonry`/`javdb-site`/`common-toolbar`/`a-normal-buttons`
- legacy：仅余 405 行（启动序列 + CSS replace + BroadcastChannel + 库 CSS
  `importResource`）
- build：`tsc -b && vite build` 通过，51 modules，产物 462.66 kB（gzip 113.30 kB）

## 相关文件

- 原始脚本：`archetype/jhs.user.js`
- 原脚本历史文档：`archetype/doc/`（已执行的历史定稿，仅作参考）
- 过渡载体：`src/legacy/jhs.ts`
- 工程入口：`src/main.tsx`
- 构建配置：`vite.config.ts`
