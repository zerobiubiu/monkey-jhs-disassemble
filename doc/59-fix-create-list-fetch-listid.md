# 59. 修复新增清单响应无 list-id + 全局繁简转换

**文档类型**：🔧开发指导
**文档状态**：✅已执行

## 背景

### 问题描述

doc/58 的 `GM_xmlhttpRequest` 方案成功发出请求、服务端创建清单成功，
但用户控制台日志显示：

```
[JavDB] 服务端响应（前 500 字）:   Toastr.success("已将此影片保存至清单ce123");
[JavDB] JS 响应已注入执行
[JavDB] 轮询未侦测到新 checkbox，尝试从响应提取 list-id 手动构建
[JavDB] 新增清单后无法定位新 checkbox。
```

**根因**：JavDB 的 `/lists/remote_create` 响应**仅返回
`Toastr.success("...")` JS 代码**——不含 `data-list-id`、不含 HTML 片段、
不更新 `listContainer` DOM。doc/58 设计的「从响应正则提取 data-list-id」
兜底完全无法匹配。新清单的 list-id 只能通过**额外请求 `/users/lists` 页面**
查找。

此外，用户要求插件 UI 文本统一使用简体中文，不沿用 JavDB 网站的繁体中文。

### 影响范围

- `src/plugins/video-lists-tag/vlt-sync.ts` — 新增 `fetchListIdByName`
- `src/` 全部 `.ts/.tsx` — 繁→简字符替换（21 个文件）

## 方案

### 1. 新增 `fetchListIdByName` 兜底

当响应无 `data-list-id` 时，`GET https://javdb.com/users/lists` 获取用户
清单页面 HTML，用 `DOMParser` 解析所有 `a[href*="/lists/"]` 链接，匹配
清单名称后从 `href` 提取 `/lists/{id}` 中的 id。

流程链路变为（多级兜底）：

1. 注入 `<script>` 执行 JS 响应（显示 JavDB 原生 Toastr 通知）
2. 轮询 2s 检测 `listContainer` 是否被更新（某些版本可能如此）
3. 从响应正则提取 `data-list-id`（若响应含 HTML）
4. **GET /users/lists 匹配清单名称提取 list-id**（核心兜底，doc/59 新增）
5. 用 list-id 手动克隆已有 checkbox 构建，插入 listContainer
6. 完成：refreshListPanel + handleCheckboxChange(add)

### 2. 全局繁→简转换

用 Python 脚本遍历 `src/` 全部 `.ts/.tsx` 文件，按繁简字符映射表批量
替换。覆盖 21 个文件，涉及 toast 文案、按钮文本、注释等。

## 实施

### 修改文件

| 文件 | 变更 |
|------|------|
| `src/plugins/video-lists-tag/vlt-sync.ts` | 新增 `fetchListIdByName`；`createList` 增加第 7 级兜底（GET /users/lists）；更新文档注释 |
| `src/` 全部 21 个 `.ts/.tsx` | 繁→简字符替换 |

### 零侵入已定稿插件

- 不修改 `DetailPageButtonPlugin` 逻辑（仅繁简文本替换，无功能变更）

## 执行验证记录

### 构建验证

```
$ bun run build
$ tsc -b && vite build
✓ 213 modules transformed.
✓ built in 1.14s
dist/monkey-jhs-disassemble.user.js  1,831.56 kB │ gzip: 419.17 kB
```

- `tsc -b` 类型检查通过（零错误）
- `diagnostics` 全项目零错误零警告
- 全项目无残留繁体字（脚本扫描验证）
- 版本号 1.6.2 → 1.6.3（bug 修复 + 文本统一，patch 递增）

### 产物对比

| 版本 | 产物 | gzip |
|------|------|------|
| v1.6.2 | 1,830.02 kB | 418.99 kB |
| v1.6.3 | 1,831.56 kB | 419.17 kB |

## 后续验证建议

在详情页展开面板旁「➕ 新增清单」→ 输入新清单名 → 点保存：

1. 控制台应出现 `服务端响应: Toastr.success("...")` → `JS 响应已注入执行`
   → `响应无 list-id，通过 /users/lists 查找新清单 ID` → `/users/lists
   匹配到清单「X」→ list_id=...`
2. 应出现 toast `✓ 清单「X」已建立，已自动关联当前影片`
3. `.jhs-list-panel` 应立即新增该清单 checkbox 且已勾选
4. 控制台应出现 `═══ 勾选 [番号] → X ═══` + `同步结果: ... association=created`
5. 所有 toast/按钮文案应为简体中文（无繁体）
