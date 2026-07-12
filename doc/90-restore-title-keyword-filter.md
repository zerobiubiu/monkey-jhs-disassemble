# 90 - 恢复视频标题屏蔽词（修正 doc/89 误删）

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行

## 背景

doc/89 删除屏蔽相关能力时误删了「视频标题屏蔽词」整套功能。用户澄清：
设置菜单中只删明细项（划词开关、评论区屏蔽词），**标题屏蔽应保留**。

## 仍删除（保持 doc/89）

- 启用划词屏蔽 + `FilterTitleKeywordPlugin`
- 评论区屏蔽词配置/过滤/划词加入
- 列表封面右键屏蔽番号

## 恢复

| 项 | 说明 |
|----|------|
| 设置 filter-panel | 仅保留「视频标题屏蔽词」管理 |
| KeywordLabel + addLabelTag/addKeyword | 标签增删 |
| loadForm/saveForm 标题词读写 | `getTitleFilterKeyword` / `saveTitleFilterKeyword` |
| 列表关键词过滤 | 匹配标题/番号前缀 + 状态标签 + 计数 |
| 简易设置 showFilterKeywordItem | 显示已屏蔽关键词内容开关 |
| 帮助文案 | 系列番号用标题关键词 |

## 实施

| 文件 | 变更 |
|------|------|
| `src/components/setting-dialog.tsx` | 恢复 filter-panel（仅标题词） |
| `src/components/keyword-label.tsx` | 恢复组件 |
| `src/components/simple-setting-panel.tsx` | 恢复屏蔽关键词开关 |
| `src/plugins/setting-plugin.tsx` | 恢复标题词 load/save/标签 |
| `src/plugins/list-page-plugin.tsx` | 恢复关键词过滤 |
| `src/components/page-count-table.tsx` | 恢复关键词计数 |
| `src/components/help-dialog.tsx` | 恢复系列番号帮助（仅设置入口） |
| `vite.config.ts` | 1.12.0 → **1.12.1** |

## 执行验证记录

```
bun run build
✓ built in 1.14s
dist/monkey-jhs-disassemble.user.js  1,892.32 kB │ gzip: 435.32 kB
```
