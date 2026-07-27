# 203 - 修复清单页编号组识别失败（/users/lists 链接形式误判）

> **文档类型**：🔧 开发指导
> **文档状态**：✅ 已执行

## 1. 背景

doc/202 期1 上线后，用户在编号清单页（如 `等待更新2`）点「识别编号组」恒显示
「此清单不属于编号组」，无法识别出编号组。

### 根因

`fetchAllUserLists` 抓取 `/users/lists` 原始 HTML 时，用 `a[href*="/lists/"]` 匹配清单
标题链接。但**服务器返回的原始 HTML 里，清单标题链接 href 是 `?id=xxx` 查询参数形式**
（如 `/users/list_detail?id=xxx`），`/lists/xxx` 是 `ModMyListOpenWayPlugin` 在浏览器里
**客户端改写**出来的短地址（见 `archetype/modMyListOpenWay.user.js` L33-34：
`new URL(a.href).searchParams.get("id")` 后 `a.href = /lists/${id}`）。

因此 `a[href*="/lists/"]` 在原始 HTML 上**一个都匹配不到** → 抓回清单列表为空 →
`discoverGroup` 找不到当前清单 → 返回 null → 显示「不属于编号组」。

> 旁证：VLT `vlt-create-list-api.ts` `fetchListIdByName` 也用了 `a[href*="/lists/"]`，
> 作为 `createList` 的「最后兜底」很可能本就经常匹配不到——这解释了它为何只是末位兜底。

## 2. 方案

改用 archetype 验证过的标题链接选择器，并从 `?id=` 查询参数提取清单 ID（兼容 `/lists/xxx`）：

- 标题链接：`div.column.is-10 > a`（`modMyListOpenWay` / `list-waterfall` SEL 共同验证），
  回退到 `li` 内首个 `a`。
- 新增 `extractListId(href)`：优先匹配 `/lists/xxx` 路径，否则 `new URL(href, origin)
  .searchParams.get('id')` 取 `?id=` 参数（用 `getAttribute('href')` 原始值 + 真实 origin
  解析，避免 DOMParser 文档 base 为 about:blank 导致 `anchor.href` 属性不可靠）。

并在识别流程加 `clog` 诊断（识别到的清单数 / 未归组原因），便于日志面板核对。

## 3. 实施

| 文件 | 改动 |
|------|------|
| `src/plugins/list-reflow/lr-data.ts` | `fetchAllUserLists` 标题链接选择器改 `div.column.is-10 > a`；新增 `extractListId`（`?id=` + `/lists/` 双形式）；空名跳过 |
| `src/plugins/list-reflow/lr-panel.tsx` | 识别流程加 `clog` 诊断（清单数 / 未归组原因） |
| `vite.config.ts` | version `1.32.0` → `1.32.1`（bug 修复，patch+1） |
| `doc/README.md` / `changelog` | 登记 doc/203 + v1.32.1 |

## 4. 执行验证记录

```
$ bun run build      # tsc -b 零错误，✓ built
$ bun run test       # 103 passed（规划器逻辑未变，仍全绿）
$ bun run lint       # 0 errors / 0 warnings
```

`extractListId` 依赖 `window.location.origin`，属 DOM/集成层，未纳入 node 单测；
其 `?id=` / `/lists/` 双路径逻辑由用户登录 JavDB 实测验证（见 §5）。

## 5. 后续验证建议（需登录 JavDB）

1. `等待更新2` 清单页点「识别编号组」→ 应列出 `等待更新1/2/3` 各成员（不再误报「不属于编号组」）。
2. 开 clog 日志面板 → 应见「[编号整理] /users/lists 识别到 N 个清单」。
3. 「生成整理计划」→ 枚举与压实预览正常（验证 `/lists/{id}` 影片枚举链路）。
4. 清单数较多（多页 `/users/lists`）→ 翻页抓取完整，当前清单能被找到。

## 6. 用户实测验证（2026-07-27）

用户登录 JavDB 实测确认：`等待更新2` 等编号清单页「识别编号组」正常列出组成员，
不再误报「不属于编号组」，修复生效。
