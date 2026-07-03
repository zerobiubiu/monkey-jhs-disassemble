---
文档类型: 🔧开发指导
文档状态: ✅已执行
---

# 04 - 插件外置集成·最终批次（Setting / DetailPageButton / ListPage）

## 1. 背景

继 `03-plugin-integration.md`（首批 4 插件）及此后多批次（AutoPage、Blacklist、
WantAndWatchedVideos、FavoriteActresses、NewVideo、History 等）之后，本批次为
**最终 3 个插件**，集成完成后所有可外置插件均以独立模块形式存在于 `src/plugins/`。

本批次集成 3 个已预先创建的插件模块：

| 插件类 | 模块文件 | 原型 archetype 行 |
|--------|----------|-------------------|
| `SettingPlugin` | `src/plugins/setting-plugin.ts` | L9429-10564 |
| `DetailPageButtonPlugin` | `src/plugins/detail-page-button-plugin.ts` | L5118-6440 |
| `ListPagePlugin` | `src/plugins/list-page-plugin.ts` | L8279-9069 |

## 2. 集成模式

与 `03` 文档一致，对每个插件串行执行（每插件独立 build + commit）：

1. `grep -n "class <PluginName>" src/legacy/jhs.ts` 定位当前行号（legacy 已有位移，以 grep 实测为准）。
2. legacy 顶部 import 区追加 `import { <PluginName> } from "../plugins/<kebab-name>";`。
3. 重新 grep 确认 import 引入后位移 +1 的精确行号范围。
4. `sed -i '<start>,<end>d' src/legacy/jhs.ts` 删除整段 class 定义（含闭合 `}`）。
5. legacy 末尾注册序列 `e.register(<PluginName>)` 不变——同名 import 即可解析。
6. `pnpm run build`（`tsc -b && vite build`）通过 → `git commit -m "集成 <PluginName>"`。
   - 失败回滚：`git checkout src/legacy/jhs.ts`。

**删除顺序**：先删后段（SettingPlugin，最靠后），再中段（DetailPageButtonPlugin），
再前段（ListPagePlugin），以减少行号位移干扰（每步仍 grep 重新确认）。

> 注：3 个插件模块此前为未跟踪文件（`git status` 显示 `??`）。commit 时一并
> `git add` 对应插件模块；未修改任何插件源码，仅纳入版本库。

## 3. 执行记录

### 3.1 SettingPlugin

- 本批次起始 legacy 行数：4426 行。
- grep 定位：`class SettingPlugin` L3171，下界 `const Le` L4307 → 原始范围 L3171-4306。
- 加 import 后位移 +1 → `class SettingPlugin` L3172，`const Le` L4308。
- **legacy 删除范围：`L3172-4307`（1136 行）**。
- 上界前一 class `De` 闭合 `}`（L3170）、下界 `const Le`（L4308），删除后无缝相邻。
- import：`import { SettingPlugin } from "../plugins/setting-plugin";`（L88）
- build：✅ 通过（42 modules，产物 441.23 kB / gzip 108.25 kB）。
- commit：`cfb8720` 集成 SettingPlugin。

### 3.2 DetailPageButtonPlugin

- SettingPlugin 删除后行数：3291 行（L927 以上未受影响，仅 +1 import 位移）。
- grep 定位：`class DetailPageButtonPlugin` L927，下界 `class ListPagePlugin` L2250 → 原始范围 L927-2249。
- 加 import 后位移 +1 → `class DetailPageButtonPlugin` L928，`class ListPagePlugin` L2251。
- **legacy 删除范围：`L928-2250`（1323 行）**。
- 上界前一 class `ve` 闭合 `}`（L925→L926→L927 区间）、下界 `class ListPagePlugin`，删除后无缝相邻。
- import：`import { DetailPageButtonPlugin } from "../plugins/detail-page-button-plugin";`（L89）
- build：✅ 通过（43 modules，产物 444.20 kB / gzip 108.81 kB）。
- commit：`b9af9f4` 集成 DetailPageButtonPlugin。

### 3.3 ListPagePlugin

- DetailPageButtonPlugin 删除后行数：1969 行（L928 以上位移 -1323）。
- grep 定位：`class ListPagePlugin` L928，下界 `class De` L1719 → 原始范围 L928-1718。
- 加 import 后位移 +1 → `class ListPagePlugin` L929，`class De` L1720。
- **legacy 删除范围：`L929-1719`（791 行）**。
- 上界前一 class `PreviewVideoPlugin`/`ve` 闭合 `}`（L927）、下界 `class De`，删除后无缝相邻。
- import：`import { ListPagePlugin } from "../plugins/list-page-plugin";`（L90）
- build：✅ 通过（44 modules，产物 449.83 kB / gzip 110.13 kB）。
- commit：`56f7d14` 集成 ListPagePlugin。

## 4. 最终状态校验

集成完成后 `src/legacy/jhs.ts` 顶部 import 区末尾（L88-90）：

```
import { SettingPlugin } from "../plugins/setting-plugin";
import { DetailPageButtonPlugin } from "../plugins/detail-page-button-plugin";
import { ListPagePlugin } from "../plugins/list-page-plugin";
```

- `grep "class.*Plugin extends BasePlugin" src/legacy/jhs.ts` → 仅剩 `PreviewVideoPlugin`（L701），
  该插件为 legacy 内部预览视频解析器，不在外置清单内。
- `e.register(...)` 注册序列保留（L1118/1123/1129），使用同名 import 解析。
- 外置插件模块文件数：20 个（`src/plugins/*-plugin.ts` 排除 `base-plugin`/`plugin-manager`）。
- legacy 最终行数：**1179 行**（起始 4426 行，本批次净减 3247 行含 3 import）。
- 产物体积：**449.83 kB**（gzip 110.13 kB）。
- `git status` 工作树干净。

## 5. commit 列表

| commit | 说明 |
|--------|------|
| `cfb8720` | 集成 SettingPlugin |
| `b9af9f4` | 集成 DetailPageButtonPlugin |
| `56f7d14` | 集成 ListPagePlugin |

## 6. 后续

所有 21 个插件中，20 个已外置为 `src/plugins/` 独立模块，legacy 仅余
`PreviewVideoPlugin`（L701，预览视频解析器）以内联 class 形式存在。若需进一步
外置该插件，可按本批次相同模式独立执行。
