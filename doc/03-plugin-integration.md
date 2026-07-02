---
文档类型: 🔧开发指导
文档状态: ✅已执行
---

# 03 - 插件外置集成（DetailPage / FilterTitleKeyword / HighlightMagnet / FoldCategory）

## 1. 背景

`src/legacy/jhs.ts` 由 `archetype/jhs.user.js` 原样迁入，内含若干以 `class XxxPlugin extends BasePlugin`
形式定义的插件。渐进式重构的下一步是将这些插件逐个外置为 `src/plugins/<kebab-name>.ts`
独立模块，legacy 仅保留 `import` 与 `e.register(...)` 注册调用。

本批次集成 4 个已预先创建的插件模块：

| 插件类 | 模块文件 | 原型 archetype 行 |
|--------|----------|-------------------|
| `DetailPagePlugin` | `src/plugins/detail-page-plugin.ts` | L3332-3368 |
| `FilterTitleKeywordPlugin` | `src/plugins/filter-title-keyword-plugin.ts` | L7286-7322 |
| `HighlightMagnetPlugin` | `src/plugins/highlight-magnet-plugin.ts` | L3927-4015 |
| `FoldCategoryPlugin` | `src/plugins/fold-category-plugin.ts` | L4016-4138 |

## 2. 集成模式

对每个插件执行（串行，每插件独立 build + commit）：

1. `grep -n "^class <PluginName> extends BasePlugin" src/legacy/jhs.ts` 定位当前行号
   （legacy 已有位移，必须以 grep 实测为准）。
2. `sed -i '<start>,<end>d' src/legacy/jhs.ts` 删除整段 class 定义（含闭合 `}`）。
3. legacy 顶部 import 区（`PluginManager` import 之后）追加
   `import { <PluginName> } from "../plugins/<kebab-name>";`。
4. legacy 末尾注册序列 `e.register(<PluginName>)` 不变——同名 import 即可解析。
5. `git add <插件模块> src/legacy/jhs.ts` → `npm run build` 通过 → `git commit -m "集成 <PluginName>"`。
   - 失败回滚：`git checkout src/legacy/jhs.ts`。

> 注：4 个插件模块此前为未跟踪文件（`git status` 显示 `??`）。为使每个集成 commit
> 自洽（fresh checkout 可编译），commit 时一并 `git add` 对应插件模块；这未修改
> 任何插件源码，仅将其纳入版本库。满足「只改 `src/legacy/jhs.ts`」的代码修改约束。

## 3. 执行记录

### 3.1 DetailPagePlugin

- legacy 删除范围：`L417-453`（37 行，原型 L3332-3368）。
- 上界 `})();`（L416）、下界 `const selectAvailableVideoQuality`（L454），删除后无缝相邻。
- import：`import { DetailPagePlugin } from "../plugins/detail-page-plugin";`
- build：✅ 通过（25 modules，产物 428.34 kB）。
- commit：`f1a34be` 集成 DetailPagePlugin。

### 3.2 FilterTitleKeywordPlugin

- legacy 删除范围（DetailPagePlugin 位移后）：`L4252-4288`（37 行，原型 L7286-7322）。
- 上界前一 class 闭合 `}`、下界 `class BlacklistPlugin`，删除后无缝相邻。
- import：`import { FilterTitleKeywordPlugin } from "../plugins/filter-title-keyword-plugin";`
- build：✅ 通过（26 modules，产物 428.46 kB）。
- commit：`8ad5e86` 集成 FilterTitleKeywordPlugin。

### 3.3 HighlightMagnetPlugin

- legacy 删除范围（前两步位移后）：`L894-982`（89 行，原型 L3927-4015）。
- 上界 `});`（keyup 监听结尾）、下界 `class FoldCategoryPlugin`，删除后无缝相邻。
- 残留引用 `this.getBean("HighlightMagnetPlugin")`（L2032）为运行时按名查找，因
  `getName()` 返回同名字符串仍可解析，无需改动。
- import：`import { HighlightMagnetPlugin } from "../plugins/highlight-magnet-plugin";`
- build：✅ 通过（27 modules，产物 428.94 kB）。
- commit：`7bc8a51` 集成 HighlightMagnetPlugin。

### 3.4 FoldCategoryPlugin

- legacy 删除范围（前三步位移后）：`L895-1017`（123 行，原型 L4016-4138）。
- 上界 `});`（keyup 监听结尾）、下界 `class ActressInfoPlugin`，删除后无缝相邻。
- import：`import { FoldCategoryPlugin } from "../plugins/fold-category-plugin";`
- build：✅ 通过（28 modules，产物 429.51 kB）。
- commit：`37d1e48` 集成 FoldCategoryPlugin。

## 4. 最终状态校验

集成完成后 `src/legacy/jhs.ts` 顶部 import 区（L69-74）：

```
import { BasePlugin } from "../plugins/base-plugin";
import { PluginManager } from "../plugins/plugin-manager";
import { DetailPagePlugin } from "../plugins/detail-page-plugin";
import { FilterTitleKeywordPlugin } from "../plugins/filter-title-keyword-plugin";
import { HighlightMagnetPlugin } from "../plugins/highlight-magnet-plugin";
import { FoldCategoryPlugin } from "../plugins/fold-category-plugin";
```

- `grep "^class (DetailPage|FilterTitleKeyword|HighlightMagnet|FoldCategory)Plugin "` → 无匹配（4 段内联定义已全部移除）。
- `e.register(...)` 注册序列保留（L8211/8218/8221/8223），使用同名 import 解析。
- `git status` 工作树干净。

## 5. commit 列表

| commit | 说明 |
|--------|------|
| `f1a34be` | 集成 DetailPagePlugin |
| `8ad5e86` | 集成 FilterTitleKeywordPlugin |
| `7bc8a51` | 集成 HighlightMagnetPlugin |
| `37d1e48` | 集成 FoldCategoryPlugin |

## 6. 后续

legacy 中仍有其余插件（如 `BlacklistPlugin`、`ActressInfoPlugin`、`ListPagePlugin` 等）
以内联 class 形式存在，可按本批次相同模式继续外置。本批次不涉及这些插件。
