# 92 - 清理 .toolbar 内脚本注入控件

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行

## 背景

用户要求不再显示：

```
body > section > div > div.toolbar > div:nth-child(3)
body > section > div > div.toolbar > div:nth-child(4)
```

二者均由本脚本注入到 JavDB 二级工具栏 `.toolbar`。

## 来源

| 注入源 | 行为 |
|--------|------|
| `PageSortPlugin` | `$('body > section > div > div.toolbar').append(排序按钮组)` |
| `ListPageButtonPlugin`（演员页） | `$('.toolbar, .section-addition')` 追加 `MenuButtonBoxHtml` 两个 flex 行 |

## 修复

1. **PageSortPlugin**：`handle` 直接 return，不再注入 toolbar 排序条（列表仍可用
   `#sort-toggle-btn` jhs 排序）
2. **ListPageButtonPlugin**：演员页不再挂 `.toolbar`，改为
   `section-addition` → `h2.section-title` → `main-tabs/tabs`

## 验证

```
bun run build
version 1.12.2 → 1.12.3
```
