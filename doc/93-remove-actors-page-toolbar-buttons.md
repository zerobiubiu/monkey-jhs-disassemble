# 93 - 移除演员页（/actors/）菜单按钮组

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行

## 背景

用户要求清理 `https://javdb.com/actors/*` 页面 `.toolbar` 内脚本注入的两个
按钮组 div（`div:nth-child(3)` / `div:nth-child(4)`）：

- 第 3 子节点：打开待鉴定 / 打开已收藏 / 加入黑名单 / 一键屏蔽所有作品
- 第 4 子节点：新作品检测 / 演员黑名单 / 排序方式切换

二者均由 `ListPageButtonPlugin.createMenuBtn` 经 `MenuButtonBoxHtml` 组件
注入。doc/92 曾描述此清理但实际提交未改动 `list-page-button-plugin.tsx` /
`page-sort-plugin.ts`（仅改了 hotkey/filter 相关文件），演员页按钮仍渲染。
本文档补完实际落地。

## 方案

演员页不再渲染 `MenuButtonBoxHtml`，`createMenuBtn` / `bindEvent` 在
`currentHref.includes('/actors/')` 时直接 return。由此产生的死代码一并清理。

## 实施

### 修改文件清单

| 文件 | 改动 |
|------|------|
| `src/plugins/list-page-button-plugin.tsx` | `createMenuBtn` 演员页早返回；`bindEvent` 演员页早返回；删除已失效的 `#filterAllVideo` 点击绑定（filterAllVideo 仅演员页渲染，现已无节点）；删除 `loadObj` 属性（仅 filterAllVideo 绑定使用）；调用处去掉 `actorsPage` prop |
| `src/components/menu-button-box-html.tsx` | 删除 `actorsPage` prop + 其渲染分支（addBlacklistBtn + filterAllVideo 的演员页变体）；删除 `FILTER_ALL_TIP` 常量；更新 JSDoc |
| `src/plugins/fold-category-plugin.tsx` | `loopDetector` 轮询条件加 `currentHref.includes('/actors/') \|\|` 前置，演员页立即命中避免 10s 空轮（createFoldBtn 在演员页无 `#tags` 自然早返回） |

### 未改动（保留）

- `BlacklistPlugin.filterAllVideo` 方法保留（仅失去外部调用入口，方法本身
  递归调用仍在，TS 不报错；属跨插件清理，留待后续）
- `PageSortPlugin` 仍按原逻辑注入 `.toolbar`（用户本次仅要求清理
  MenuButtonBoxHtml 两个 div，PageSort 排序条是独立控件，不在本次范围）
- 演员页 `sortItems` 仍执行（依 localStorage 排序列表项，不依赖按钮）

## 执行验证

```
$ bun run build
$ tsc -b && vite build
✓ 219 modules transformed.
dist/monkey-jhs-disassemble.user.js  1,890.52 kB │ gzip: 435.00 kB
✓ built in 1.20s
```

tsc -b 零错误，vite build 成功。

## 后续验证建议

- 访问 `https://javdb.com/actors/12`（任意演员页），确认 `.toolbar` 下不再
  出现 `#waitCheckBtn` / `#waitDownBtn` / `#addBlacklistBtn` / `#filterAllVideo`
  / `#newVideoBtn` / `#blacklistBtn` / `#sort-toggle-btn`
- 确认其他列表页（首页 `/`、标签页 `/tags`、搜索页）按钮组正常渲染
- 确认 fold-category 在演员页不产生 10s 控制台延迟
