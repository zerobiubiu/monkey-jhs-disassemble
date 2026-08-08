# MissAV 视频页按钮回工具栏 + 筛选器视频页守卫 + 去分割线

> **文档类型**：🔧 开发指导
> **文档状态**：✅ 已执行
> **版本**：1.43.4 → 1.43.5（patch）
> **前置文档**：doc/226（按钮独立分组——本次回退）、doc/222（状态筛选）

## 1. 背景

用户对 doc/226 的调整反馈三点：

1. **按钮恢复原样**：复制番号 / 转到JavDB搜索 按钮应放回原生播放页工具栏
   （`div.flex.flex-wrap.justify-center.space-x-4.md:space-x-6.py-8.rounded-md.shadow-sm`），
   与网站原始组件（收藏/片单/下载/分享）**同一行**，而非独立成组；
2. **筛选器不在视频详情页显示**：实测发现筛选器在视频页出现（不该出现）；
3. **筛选栏去分割线**：`border-bottom` 分割线影响视觉，应改用间距分离。

## 2. 根因分析（Camoufox 实测）

### 2.1 筛选器为何在视频页显示

`isVideoPage()` 检测 `#sprite-plyr`，但该播放器 **DOM 延迟渲染**——Camoufox 实测
`t0/t500` 时不存在、`t1500` 才出现。handle 在 document-idle（t0 附近）执行，
`isVideoPage()` 返回 false → 守卫失效 → 筛选器经 `h1` 降级挂载点挂到视频页
（视频页无 `div.flex.justify-between.mb-6` 主挂载点，回退到 h1）。

### 2.2 按钮分组（doc/226 回退）

用户明确要求按钮与原生组件同一行，撤销 doc/226 的独立成组，恢复 prepend/append
混插（样式对齐修复保留）。

## 3. 方案

| 项 | 调整 |
|----|------|
| 按钮 | `insertButtons` 恢复 `menuBar.prepend(copyBtn)` + `menuBar.appendChild(javdbBtn)`（与原生同一行）；样式对齐保留（无 shadow-sm/mr-2、图标响应式） |
| 视频页守卫 | 新增纯函数 `isVideoDetailPath(path)`（mstf-collect）：pathname 末段为连字符番号（`mkmp-745`/`fc2-ppv-4955762`）且非 `/search/` 路径 → 视频页；`handle` 改为 `if (isVideoPage() \|\| isVideoDetailPath(location.pathname)) return;`——不依赖 `#sprite-plyr` 时序；MissavAutoPagePlugin 同步（同根因） |
| 分割线 | `.missav-status-filter-bar` 移除 `border-bottom`，`padding: 8px 0 16px 0`（底部间距自然分离） |

## 4. 实施（修改文件清单）

| 文件 | 变更 |
|------|------|
| `src/plugins/missav-quick-copy-plugin.tsx` | `insertButtons` 恢复 prepend/append（回退 doc/226 独立分组） |
| `src/plugins/missav-status-filter/mstf-collect.ts` | 新增 `isVideoDetailPath` 纯函数（URL 特征，排除 /search/） |
| `src/plugins/missav-status-filter/missav-status-filter-plugin.ts` | handle 守卫加 `isVideoDetailPath(location.pathname)` |
| `src/plugins/missav-auto-page/missav-auto-page-plugin.ts` | handle 守卫同步加 URL 判定 |
| `src/styles/missav-status-filter/missav-status-filter.css` | `.missav-status-filter-bar` 去 `border-bottom`，padding 底部 16px |
| `tests/missav-status-filter.test.ts` | +5 用例：`isVideoDetailPath`（视频页/列表页/搜索页/分类页/FC2） |
| `vite.config.ts` | version 1.43.4 → 1.43.5（patch） |

## 5. 执行验证记录

### 执行环境

Windows + Bun + Chrome（构建/静态验证）；Camoufox 实测（`.superpowers/camoufox-missav/probe-video4/5.py`）。

### 验证命令

```text
$ bun run build
$ bun run lint
$ bun run test
$ bun run check:structure
```

### 实际输出

```text
$ bun run build
✓ 407 modules transformed.
dist/monkey-jhs-disassemble.user.js  … kB │ gzip: … kB
✓ built in ~1.3s（产物 @version 1.43.5 已核对）

$ bun run lint
（无输出 = 0 errors / 0 warnings）

$ bun run test
 Test Files  11 passed (11)
      Tests  168 passed (168)   ← +5 isVideoDetailPath 用例

$ bun run check:structure
check-structure: OK (364 files, 62 dirs within limits)
```

### 前端或调用方验证（Camoufox 实测）

| 项 | 结果 |
|----|------|
| 视频页按钮同一行 | 顺序「复制番号→收藏→片单→下载→分享→转到JavDB搜索」全部 `top: 766`（同一行）✅ |
| 视频页筛选器不显示 | `filterBarDisplayed: false`；h1 兄弟为原生工具栏（无筛选栏插入）✅ |
| 列表页筛选器 | 主挂载点存在，CSS 无 border-bottom（padding 16px 底部间距）✅ |

### 验证结论

✅ 通过。构建/lint/168 测试/结构门禁全绿；Camoufox 实测按钮同一行、视频页无筛选器；
产物 `@version 1.43.5`。

### 已知限制（需用户浏览器实测）

1. 视频页按钮在工具栏中的视觉（与原生按钮间距 space-x 一致、无 shadow）；
2. 列表页筛选栏无分割线、间距观感；
3. 视频页无筛选器确认。

## 6. 后续可扩展（不纳入本期）

- 无。