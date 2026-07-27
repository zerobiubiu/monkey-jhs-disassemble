# 202 - 清单页编号清单整理（组内压实）期1：只读预览

> **文档类型**：🔧 开发指导
> **文档状态**：✅ 已执行

## 1. 背景

doc/201 调查确认：加入/移除端点已由 VLT `postJavdbListMutation`（`POST /users/save_video_to_list`，
页面内 same-origin fetch）封装，组发现走 `/users/lists`，影片枚举走 `/lists/{id}` 的
`.movie-list .item` + `.pagination-next`，端点逆向风险消解。本期实现**期1 只读预览**：
在清单页识别同前缀编号组、生成组内压实计划预览，**不执行任何写入**（执行=期2）。

### 压实规则（用户约定，固化进规划器）

1. **不保留**清单内影片顺序（规划可最小化搬运）。
2. **同 base 仅序号不同**的多个清单中重复出现的影片，组内**只保留一份**（顺带审计收藏错误）。
3. **不同 base** 的清单归属**全部保留**——压实只在单个 base 组内横向搬运。

## 2. 方案

### 2.1 模块结构（`src/plugins/list-reflow/`）

| 模块 | 职责 |
|------|------|
| `lr-types.ts` | 共享类型 |
| `lr-planner.ts` | 纯压实规划器（可单测） |
| `lr-data.ts` | `/users/lists` 组发现 + `/lists/{id}` 影片枚举（只读原生 fetch） |
| `lr-plan.ts` | 枚举驱动 + 计划预览渲染 |
| `lr-panel.tsx` | 面板挂载与交互（JSX 外壳 + 命令式动态内容） |
| `list-reflow-plugin.ts` | `ListReflowPlugin`（`pageTypes:['list']` + `sites:['javdb']` + `/lists/{id}` 守卫） |
| `components/list-reflow/reflow-panel.tsx` | 面板外壳组件（jsxToString） |
| `styles/list-reflow/list-reflow.css` | 面板样式（**首个 CSS 子目录**，守 §11 扁平度门禁） |

### 2.2 压实规划算法（`planCompaction`，纯逻辑）

1. 统计组内归属 `video → 所在清单集合`，得去重影片流与重复影片。
2. 目标容量：按序号升序每清单填满 501 再往后（复用 doc/200 `LIST_FULL_THRESHOLD`）。
3. 分配：**先就近保留**（各清单现含影片在目标容量内留原位，最小化搬运），剩余影片按升序
   填空位；超出组总容量者记 `overflow`。
4. 由现态/终态 diff 出搬运明细（`removeFrom` 多余归属 + `addTo` 目标清单）。

### 2.3 分组规则复用

复用 doc/200 `parseListName` / `isMergeExcluded` / `buildMergeConfig`——**与详情页合并共享
同一套分组配置**（`listMergePattern` / `listMergeExcludeNames`），仅新增独立开关
`listReflowEnabled`（默认开启）。

### 2.4 面板交互（按需触发，避免无谓请求）

清单页注入折叠面板 →「识别编号组」抓 `/users/lists` 发现同 base 组、渲染各清单数量/满员行 →
「生成整理计划」枚举组内影片 + 规划，渲染只读预览：汇总（去重总数/重复数/搬运次数）、
目标分布、**收藏错误审计**（组内重复影片）、**溢出**（组容量不足）、搬运明细（前 100 条折叠）。
面板明确标注「期1 仅预览，不执行任何写入」。

## 3. 实施

### 3.1 修改文件

| 文件 | 改动 |
|------|------|
| `src/plugins/list-reflow/lr-types.ts` | **新增** 共享类型 |
| `src/plugins/list-reflow/lr-planner.ts` | **新增** 纯压实规划器 |
| `src/plugins/list-reflow/lr-data.ts` | **新增** 组发现 + 影片枚举（只读 fetch） |
| `src/plugins/list-reflow/lr-plan.ts` | **新增** 枚举驱动 + 计划预览渲染 |
| `src/plugins/list-reflow/lr-panel.tsx` | **新增** 面板挂载与交互 |
| `src/plugins/list-reflow/list-reflow-plugin.ts` | **新增** ListReflowPlugin |
| `src/components/list-reflow/reflow-panel.tsx` | **新增** 面板外壳组件 |
| `src/styles/list-reflow/list-reflow.css` | **新增** 面板样式（首个 CSS 子目录） |
| `src/main.tsx` | import + javdb 块注册 ListReflowPlugin |
| `src/plugins/plugin-registry.ts` | PluginMap 增 ListReflowPlugin 映射 |
| `src/components/setting-panels/base-panel.tsx` | 「清单收藏合并」分区增 `listReflowEnabled` 开关 |
| `src/plugins/setting/setting-form-load.ts` | loadForm/saveForm 增 `listReflowEnabled` |
| `tests/lr-planner.test.ts` | **新增** 8 个压实规划单测 |
| `vite.config.ts` | version `1.31.0` → `1.32.0`（新增插件，minor+1） |
| `doc/README.md` / `AGENTS.md` / `changelog` | 插件计数 40→41（javdb 38→39）、组件 135→136/26 子目录、样式 39（含子目录）、测试 6 套件 |

### 3.2 约束遵守

- **§11 扁平度**：`src/styles` 直接文件已达棘轮上限 38（不可抬高），故新 CSS 放入
  `src/styles/list-reflow/` 子目录（首个 CSS 子目录），`check:structure` 通过。
- **§9.7 零硬编码 HTML**：外壳为 React 组件（jsxToString），动态行用 createElement
  （与 dpb 面板一致的豁免 idiom）。
- **§10.3 复用**：分组规则复用 doc/200 `dpb-list-merge`，满员阈值复用 `LIST_FULL_THRESHOLD`。

## 4. 执行验证记录

```
$ bun run build
✓ 389 modules transformed.
dist/monkey-jhs-disassemble.user.js  2,116.09 kB │ gzip: 490.04 kB
✓ built in 1.42s            # tsc -b 零错误

$ bun run test
 Test Files  6 passed (6)
      Tests  103 passed (103)   # 含 lr-planner 8 用例

$ bun run lint               # 0 errors / 0 warnings
$ bun run check:structure    # OK (346 files, 57 dirs within limits)
$ bunx stylelint src/styles/list-reflow/list-reflow.css   # 通过
```

lightningcss 的 `Unexpected token Semicolon` 全部来自 `layer.css` IE hack（既有预期容错）。

## 5. 后续验证建议（需登录 JavDB 人工验证）

1. 打开某编号清单页（如 `/lists/xxx` 的 `等待更新2`），面板出现，点「识别编号组」→
   列出 `等待更新1/2/3` 各自数量/满员标记。
2. 点「生成整理计划」→ 核对汇总/目标分布/搬运明细是否符合预期；确认**未发生任何服务端写入**。
3. 构造组内重复（同片在 `等待更新1` 和 `等待更新3`）→ 验证「收藏错误审计」列出该番号。
4. 非编号清单页 → 「识别编号组」提示「此清单不属于编号组」。
5. 设置关闭 `listReflowEnabled` → 清单页不再出现面板。
6. 大组（多清单 × 数百部）→ 枚举进度正常、明细折叠、无超时。

## 6. 期2 展望（未实施）

实写执行：复用 `postJavdbListMutation` 增删 + `fetchAuthoritativeCheckboxState` 复核，
带限速/中止/续传（借鉴 `vlt-server.ts` 恢复日志管线）、先移除后加入避开 501 卡口、
overflow 自动新建清单（复用 `createList`）。需先定期2 细节：批量大小、退避策略。
