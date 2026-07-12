# 89 - 移除屏蔽配置面板与划词/封面右键屏蔽

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行

## 背景

用户要求进一步删除：
1. 设置中的「屏蔽配置」面板
2. 列表页视频封面右键屏蔽番号
3. 评论区屏蔽词（配置 + 过滤 + 划词加入）
4. 划词屏蔽（标题选中右键加入关键词）

**保留**：详情页按钮「屏蔽」单番号、演员黑名单、简易设置中「屏蔽单番号/演员」显示开关。

## 方案

| 项 | 处理 |
|----|------|
| 设置 filter-panel | 整面板删除（划词开关 + 评论/标题关键词管理） |
| FilterTitleKeywordPlugin | 删除插件 + main 注销 |
| 列表 contextmenu 右键屏蔽 | 删除 |
| 列表标题关键词过滤 | 删除匹配/标签/计数 |
| 评论关键词过滤 + 右键加入 | 删除 |
| 简易设置「屏蔽关键词」开关 | 删除 |
| keyword-label 组件 | 删除（无引用） |
| 帮助文案「系列番号关键词」 | 删除对应章节 |

## 实施

| 文件 | 变更 |
|------|------|
| `src/components/setting-dialog.tsx` | 删 filter-panel |
| `src/components/simple-setting-panel.tsx` | 删 showFilterKeywordItem |
| `src/plugins/setting-plugin.tsx` | 删关键词 load/save/addLabelTag |
| `src/plugins/list-page-plugin.tsx` | 删右键屏蔽 + 关键词过滤 |
| `src/plugins/review-plugin.tsx` | 删关键词过滤与 rightClickFilter |
| `src/plugins/filter-title-keyword-plugin.ts` | **删除** |
| `src/components/keyword-label.tsx` | **删除** |
| `src/components/page-count-table.tsx` | 去关键词计数列 |
| `src/components/help-dialog.tsx` | 删系列关键词帮助 |
| `src/main.tsx` | 注销 FilterTitleKeywordPlugin |
| `AGENTS.md` / `vite.config.ts` | 同步；version **1.11.0→1.12.0** |

## 执行验证记录

```
bun run build
✓ built in 1.18s
dist/monkey-jhs-disassemble.user.js  1,886.01 kB │ gzip: 434.06 kB
```

## 后续验证建议

1. 设置无「屏蔽配置」侧栏
2. 列表封面右键不再弹屏蔽确认
3. 详情标题/评论划词右键不再加入屏蔽词
4. 详情页「屏蔽」按钮、演员黑名单仍可用
