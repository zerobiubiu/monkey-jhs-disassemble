# doc/182 — 修复 pageTypes 与内部路径守卫不匹配（第二轮）

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

doc/181 修复了 VideoListsTagPlugin 和 ListReadingStatusPlugin 的 pageTypes 不匹配问题后，对全部声明 pageTypes 的插件做了系统性交叉审计，发现另外两个插件存在同类 bug。

## 根因

与 doc/181 相同：commit 5b4f447（v1.28.15）添加 matchesPage() 门控后，pageTypes 声明与 handle() 内部路径守卫不一致的插件会在某些页面被静默跳过。

## 修复

| 插件 | 原 pageTypes | 问题 | 修复 |
|------|-------------|------|------|
| FavoriteActressesPlugin | ['detail'] | bindEvent() 绑定 /actors/xxx 页面的收藏/取消收藏按钮，但演员页 pageType 为 'list' 或 'unknown'，导致按钮失效 | 移除 pageTypes 覆写 |
| VisitHistoryPlugin | ['detail'] | recordVisit() 应记录所有 javdb 页面访问，但 pageTypes 限制导致非详情页访问不被记录 | 移除 pageTypes 覆写；内部 if(window.isDetailPage) 已限定 tooltip 注入 |

## 实施清单

| 文件 | 操作 |
|------|------|
| src/plugins/favorite-actresses-plugin.tsx | 删除 get pageTypes() + import type { PageType } |
| src/plugins/visit-history-plugin.ts | 删除 get pageTypes() + import type { PageType } |

## 验证

tsc 0 错 / vitest 28/28 / eslint 0 错 / stylelint 干净 / check:structure OK。
