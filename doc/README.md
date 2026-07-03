# monkey-jhs-disassemble 文档

本项目将单文件混淆用户脚本 `archetype/jhs.user.js`（11605 行）拆分重构为
基于 `vite-plugin-monkey` + React + TypeScript + SWC 的工程化项目，
要求打包产物在功能逻辑与执行效果上与原始脚本零偏差。

## 文档清单

| 文件 | 类型 | 状态 | 说明 |
|------|------|------|------|
| `01-refactor-plan.md` | 🔧开发指导 | 🔧待执行 | 重构总计划：架构分析、渐进策略、提取模式、进度追踪（core/插件/CSS/常量/资源已完成，legacy 废弃、启动序列移 `main.tsx`、全量去 `@ts-nocheck` 完成，余 HTML→React 组件化） |
| `02-css-extraction.md` | 🔧开发指导 | 🔧待执行 | CSS 提取模式（`?raw` + `H()`/`insertAdjacentHTML` + 占位 `replace`）；顶层 5 + 插件 `initCss` 9 共 14 个 CSS 提取模式与清单 |
| `03-plugin-integration.md` | 🔧开发指导 | ✅已执行 | 首批 4 插件（DetailPage/FilterTitleKeyword/HighlightMagnet/FoldCategory）外置集成记录 |
| `04-plugin-integration-final-batch.md` | 🔧开发指导 | ✅已执行 | 最终批次 3 插件（Setting/DetailPageButton/ListPage）外置集成记录 |
| `05-legacy-helpers-extraction.md` | 🔧开发指导 | ✅已执行 | legacy 残留辅助（layer 包装/tooltip/webdav 加密）提取到 core |
| `06-component-html-string.md` | 🔧开发指导 | ✅已执行 | 组件返回 HTML 字符串，移除 react-dom/server（避免 react-dom/server 打包致 911 kB 膨胀）；确立 HTML→组件统一规定 |
| `07-login-dialog-component.md` | 🔧开发指导 | ✅已执行 | Top250 登录表单（openLoginDialog 的 layer.open content）提取为 LoginDialog 组件（返回 HTML 字符串） |
| `08-subtitle-dialogs-component.md` | 🔧开发指导 | ✅已执行 | DetailPageButton 字幕弹窗（searchXunLeiSubtitle 表格容器 / previewSubtitle 预览容器）提取为 SubtitleTableDialog / SubtitlePreviewDialog 组件（返回 HTML 字符串） |
| `09-history-dialogs-component.md` | 🔧开发指导 | ✅已执行 | HistoryPlugin 鉴定记录弹窗（openHistory 筛选/批量/表格容器 / editRecord 编辑表单）提取为 HistoryDialog / EditRecordDialog 组件（返回 HTML 字符串） |

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
6. `06-component-html-string.md` — 组件返回 HTML 字符串，移除 react-dom/server
7. `07-login-dialog-component.md` — Top250 登录表单提取为 LoginDialog 组件
8. `08-subtitle-dialogs-component.md` — DetailPageButton 字幕弹窗提取为 SubtitleTableDialog / SubtitlePreviewDialog 组件
9. `09-history-dialogs-component.md` — HistoryPlugin 鉴定记录弹窗提取为 HistoryDialog / EditRecordDialog 组件

## 当前进度概览

- core：15 个模块全部提取（`common-util`/`storage-manager`/`gm-http`/`toast`/
  `loading`/`logger`/`hotkey`/`image-preview`/`viewer`/`webdav`/`gfriends`/
  `async-task-queue`/`layer-wrapper`/`tooltip`/`webdav-crypto`）
- plugins：`base-plugin` + `plugin-manager` + 21 个插件模块全部外置
- constants：`site`/`status`/`video-quality`/`api`/`tabulator-zh`
- resources：`gfriends`
- styles：14 个 CSS（5 顶层 + 9 插件 `initCss`）全部提取
- components：3 个 React 组件示范（`menu-button-box`/`rating-bar`/`status-tag`）+ `temporary-image-container`/`login-dialog`/`subtitle-table-dialog`/`subtitle-preview-dialog`/`history-dialog`/`edit-record-dialog`（返回 HTML 字符串的函数组件，非 JSX）
- 入口：`src/main.tsx`（367 行，完整启动序列，强类型）；legacy 已废弃删除
- 类型：全量去 `@ts-nocheck` 完成，工程内无任何 `@ts-nocheck`
- build：`tsc -b && vite build` 通过，67 modules，产物 458.99 kB（gzip 114.67 kB）；HTML→组件统一规定：返回 HTML 字符串，禁用 react-dom/server

## 相关文件

- 原始脚本：`archetype/jhs.user.js`
- 原脚本历史文档：`archetype/doc/`（已执行的历史定稿，仅作参考）
- 工程入口：`src/main.tsx`（完整启动序列）
- 构建配置：`vite.config.ts`
