# 127 - 修复瀑布流点按钮模式只能加载一次

> **文档类型**：🔧开发指导  
> **文档状态**：✅已执行  
> **执行日期**：2026-07-19

## 1. 背景

用户反馈在瀑布流「点按钮」模式下，第一次滑到底部会正常出现「点击加载下一页」，
点击后也能追加影片，但列表明明还有多页，继续滑到底部时按钮不再出现。

在登录态浏览器打开 `https://javdb.com/lists/BdY5a` 现场复现：

- 首屏 40 条，分页下一页为 `?page=2`；
- 第一次触底时 loader 为 `jhs-scroll waterfall-click`；
- 点击后影片增加到 80 条，服务端仍有下一页；
- 第二次触底时 loader 却保持 `jhs-scroll waterfall-loading`，文案为空，按钮无法再次出现。

继续检查该清单的第 2、3 页，均各有 40 条且分别指向后续页，因此不是 JavDB
末页、分页缺失或另一个 `ListWaterfallPlugin` 的问题。`/lists/BdY5a` 使用的是
`AutoPagePlugin`；`ListWaterfallPlugin` 只处理 `/users/lists` 和
`/users/favorite_lists`。

## 2. 根因

`AutoPagePlugin.loadNextPage()` 发起请求时将 loader 切到
`waterfall-loading`。普通分页与 Beyond60 两条成功路径完成后，旧代码都执行：

```ts
this.setState('waterfall-loading', '');
```

这只清空文案，没有退出 loading 状态。随后 click 模式的 `checkLoad()` 为了防止
请求重入，会拒绝处理仍带 `waterfall-loading` 的 loader。于是 `finally` 中的检查、
后续 scroll 事件以及列表 DOM 变化触发的检查全部被同一个守卫拦截，形成稳定的状态机
死锁。

该问题由 doc/118 引入 click 模式时出现：新逻辑增加了 loading 守卫，但沿用了旧自动
模式用「loading 类 + 空文案」表示加载结束的写法。

## 3. 方案

普通分页与 Beyond60 成功后统一把 loader 切回中性空闲态：

```ts
this.setState('', '');
```

保留 `waterfall-loading` 守卫，确保真实请求期间不会再次显示按钮或重复发起请求。
之后沿用既有 `finally` 逻辑：

- 若新内容不足以把 loader 推出触发区，立即重新显示「点击加载下一页」，但不自动请求；
- 若 loader 已离开触发区，保持空闲，用户再次滑到底部时重新显示按钮；
- 没有下一页时仍进入 `waterfall-no-more`；
- 请求失败仍进入 `waterfall-error` 并允许点击重试；
- 自动模式与右下角「加载全部」流程不变。

## 4. 实施文件

| 文件 | 改动 |
|------|------|
| `src/plugins/auto-page-plugin.ts` | 普通分页和 Beyond60 成功后退出 loading、回到空闲态；补充状态参数说明 |
| `vite.config.ts` | version `1.19.8` → `1.19.9` |
| `doc/README.md` | 登记 doc/127 与阅读顺序 |
| `changelog/CHANGELOG.md` | 新增 v1.19.9 修复记录 |

本次未新增、删除或重命名源码文件，也未修改插件注册及核心架构，因此无需更新
`AGENTS.md`。

## 5. 执行验证记录

```text
$ bunx tsc -b
通过（无 TypeScript 错误）

$ bun run build
tsc -b && vite build
✓ 220 modules transformed
dist/monkey-jhs-disassemble.user.js  1,954.10 kB │ gzip: 450.68 kB
✓ built in 1.32s
```

lightningcss 对 `layer.css` IE hack 的告警为项目既有告警，不是本次引入。

浏览器行为验证：在复现后的 80 条页面上，将 loader 按修复方案恢复为空闲态并触发
scroll 检查，立即重新得到 `waterfall-click / 点击加载下一页`；第二次点击后影片增加到
120 条，证明下一页 URL、事件绑定和追加逻辑均正常，唯一阻断点就是残留 loading 类。

## 6. 后续验证建议

1. 部署 v1.19.9 后在 `/lists/BdY5a` 使用「点按钮」连续加载至少三页；
2. 验证每次请求期间只能点击一次，成功后再次触底才重新出现按钮；
3. 验证最后一页显示「已经到底了」，网络失败显示「加载失败，点击重试」；
4. 验证「自动」模式、右下角「加载全部」以及 Beyond60 分支没有回归。
