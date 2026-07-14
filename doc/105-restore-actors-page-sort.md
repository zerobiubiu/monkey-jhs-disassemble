# 105 - 恢复演员页 /actors/* 排序组件

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行

## 背景

用户反馈：演员页 `/actors/*` 也应该有排序组件。doc/92/93 因显示结构混乱
把演员页的**整个按钮组**都禁用了（createMenuBtn/bindEvent 早 return），
但用户认为"隐藏的不对，排序组件应该显示出来"。

## 根因

doc/93（commit 26f108d）在 `createMenuBtn` 和 `bindEvent` 开头加了演员页早 return：

```ts
// createMenuBtn
if (currentHref.includes('/actors/')) {
    return;  // 整个按钮组都不注入（含 #sort-toggle-btn）
}
// bindEvent
if (currentHref.includes('/actors/')) {
    return;  // 所有事件都不绑定（含排序切换）
}
```

这导致演员页既没有 `#sort-toggle-btn`（jhs 排序按钮），也没有 PageSort 排序选择器
（PageSort 的 handle 不受此 return 影响，但 createSortSelector 查找的 `.toolbar`
在演员页可能存在）。

doc/92 的原始问题是"按钮组挂到 `.toolbar` 导致显示混乱"。但 doc/93 的修复过度——
把整个按钮组都禁用了，而不是只解决 `.toolbar` 显示混乱。

## 修复

移除 `createMenuBtn` 和 `bindEvent` 的演员页早 return，恢复按钮组注入。

**不会重蹈显示混乱**：doc/92 之前演员页的按钮组挂到 `.toolbar`
（`containerEl = $('.toolbar, .section-addition')`），导致与 `.toolbar` 其他子节点
混乱。现在 `createMenuBtn` 的默认 containerEl 是 `.main-tabs, .tabs`（不挂 .toolbar），
不会与 `.toolbar` 冲突。PageSort 排序选择器单独注入 `.toolbar`，也不与按钮组冲突。

## 实施

| 文件 | 改动 |
|------|------|
| `src/plugins/list-page-button-plugin.tsx` | `createMenuBtn` 移除 `/actors/` 早 return（按钮组注入 `.main-tabs/.tabs`）；`bindEvent` 移除 `/actors/` 早 return（恢复事件绑定）；头部注释 + 方法注释更新（去掉"演员页跳过"） |

## 执行验证

```
$ bun run build
$ tsc -b && vite build
✓ 219 modules transformed.
dist/monkey-jhs-disassemble.user.js  1,878.92 kB │ gzip: 432.78 kB
✓ built in 1.12s
```

- `tsc -b` 零错误，list-page-button-plugin.tsx 诊断无 error/warning
- 产物 1878.92 kB（gzip 432.78 kB），较 1.13.5 -0.10 kB
- version `1.13.5` → `1.13.6`（修复，patch 递增）

## 后续验证建议

1. 打开演员页 `/actors/{某演员ID}` → 确认 `.main-tabs/.tabs` 中出现按钮组
   （含 `#sort-toggle-btn` 排序按钮）
2. 确认 `.toolbar` 中出现 PageSort 排序选择器按钮组（按名称/评分升降序）
3. 点击 `#sort-toggle-btn` → 切换排序方式（默认/评价人数/时间）→ 列表重排
4. 点击 PageSort 排序按钮 → 按对应方式排序 → `#sort-toggle-btn` 选中态清除
   （两者互斥协调）
5. 开启瀑布流模式 → 演员页排序组件仍显示（doc/103/104 已移除 autoPage 禁用）
6. 确认按钮组不与 `.toolbar` 其他元素重叠/混乱
