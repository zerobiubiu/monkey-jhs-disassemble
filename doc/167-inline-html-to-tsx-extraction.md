# doc/167 — 内联 HTML 模板字面量提取为 TSX 组件

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

全量审计发现 `src/` 中 7 处 HIGH 级别的内联 HTML 模板字面量（~135 行），违反 AGENTS.md §3.5 的组件化约定（所有 UI 应为 `src/components/*.tsx` 中的 React 函数组件，经 `jsxToString()` 渲染）。

## 提取清单

| # | 源文件 | 新组件 | 说明 |
|---|--------|--------|------|
| 1 | `plugins/fc2-plugin.ts` → `.tsx` | `components/fc2-detail-dialog.tsx` | FC2 详情弹窗（7 工具栏按钮 + 4 容器） |
| 2 | `plugins/fc2-by-123av-plugin.ts` → `.tsx` | `components/fc2-browse-page.tsx` | 123Av FC2 浏览页（搜索表单 + 排序 select） |
| 3 | `plugins/image-recognition-plugin.tsx` | `components/image-recognition-dialog.tsx` | 以图识图上传/预览弹窗 |
| 4 | `plugins/magnet-hub-plugin.ts` → `.tsx` | `components/magnet-result-card.tsx` | 磁链结果卡片 |
| 5 | `plugins/video-lists-tag/vlt-sync.ts` → `.tsx` | `components/vlt-create-list-form.tsx` | 新建清单表单 |
| 6 | `core/plugin-diagnostics.ts` → `.tsx` | `components/diagnostics-table.tsx` | 插件诊断表格 |
| 7 | `constants/api.ts` `markDataListHtml()` | 复用 `components/hit-show-movie-item.tsx` | 删除重复函数 + `javDbApi` 聚合对象 |

## 附带修复

- `jsx-to-string.ts` `renderAttrs` 新增 `htmlFor` → `for` 属性映射（与 `className` → `class` 对称），消除 `vlt-create-list-form.tsx` 中的 `as any` hack
- 5 个插件/核心文件因 JSX 语法要求从 `.ts` 重命名为 `.tsx`（所有导入均为无扩展名引用，零破坏）

## 行为保持

- `jsxToString` 自定义渲染器的 `style={{...}}` 输出 CSS 无冒号后空格/无尾分号，与原始模板字面量格式略有差异，但 CSS 解析器对属性值间空白不敏感，DOM 等价
- 文本/属性转义（`&<>` / `&<>"`）为安全正向偏差，DOM 等价
- `sanitizeUrl` 仅阻止 `javascript:`/`data:`/`vbscript:`，`magnet:` 和相对路径不受影响
- void 标签自闭合（`<br />` vs `<br>`）DOM 等价

## 实施清单

| 文件 | 操作 |
|------|------|
| `src/components/fc2-detail-dialog.tsx` | 新增 |
| `src/components/fc2-browse-page.tsx` | 新增 |
| `src/components/image-recognition-dialog.tsx` | 新增 |
| `src/components/magnet-result-card.tsx` | 新增 |
| `src/components/vlt-create-list-form.tsx` | 新增 |
| `src/components/diagnostics-table.tsx` | 新增 |
| `src/plugins/fc2-plugin.tsx` | 重命名 + 修改（模板→jsxToString） |
| `src/plugins/fc2-by-123av-plugin.tsx` | 重命名 + 修改 |
| `src/plugins/image-recognition-plugin.tsx` | 修改 |
| `src/plugins/magnet-hub-plugin.tsx` | 重命名 + 修改 |
| `src/plugins/video-lists-tag/vlt-sync.tsx` | 重命名 + 修改 |
| `src/core/plugin-diagnostics.tsx` | 重命名 + 修改 |
| `src/core/jsx-to-string.ts` | 修改（htmlFor 映射） |
| `src/constants/api.ts` | 修改（删除 markDataListHtml + javDbApi） |
| `AGENTS.md` | 修改（§3.3/§3.4/§3.5 文件扩展名 + 组件计数） |

## 验证记录

- `bun run build`：✅ tsc -b + vite build 通过
- `bun run test`：✅ 28/28
- `bun run lint`：✅ 0 errors（warnings 因消除 `as any` 减 1）
- `bun run lint:css`：✅ 0 errors
- 组件计数：91 → 97
- 残留内联 HTML 模板字面量（HIGH）：7 → 0
