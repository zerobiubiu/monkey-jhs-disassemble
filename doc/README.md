# monkey-jhs-disassemble 文档

本项目将单文件混淆用户脚本 `archetype/jhs.user.js`（11605 行）拆分重构为
基于 `vite-plugin-monkey` + React + TypeScript + SWC 的工程化项目，
要求打包产物在功能逻辑与执行效果上与原始脚本零偏差。

## 文档清单

| 文件 | 类型 | 状态 | 说明 |
|------|------|------|------|
| `01-refactor-plan.md` | 🔧开发指导 | 🔧待执行 | 重构总计划：架构分析、渐进策略、提取模式、已完成/待完成清单 |
| `02-css-extraction.md` | 🔧开发指导 | 🔧待执行 | CSS 提取模式（?raw + H()/insertAdjacentHTML + 占位 replace）与待提取清单 |
| `03-plugin-integration.md` | 🔧开发指导 | ✅已执行 | 4 个插件（DetailPage/FilterTitleKeyword/HighlightMagnet/FoldCategory）外置集成记录 |
| `04-plugin-integration-final-batch.md` | 🔧开发指导 | ✅已执行 | 最终批次 3 插件（Setting/DetailPageButton/ListPage）外置集成记录 |

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

1. `01-refactor-plan.md` — 理解整体重构策略与进度
2. `02-css-extraction.md` — CSS 提取的具体模式与清单
3. `03-plugin-integration.md` — 插件外置集成模式与执行记录
4. `04-plugin-integration-final-batch.md` — 最终批次插件外置集成记录

## 相关文件

- 原始脚本：`archetype/jhs.user.js`
- 原脚本历史文档：`archetype/doc/`（已执行的历史定稿，仅作参考）
- 过渡载体：`src/legacy/jhs.ts`
- 工程入口：`src/main.tsx`
- 构建配置：`vite.config.ts`
