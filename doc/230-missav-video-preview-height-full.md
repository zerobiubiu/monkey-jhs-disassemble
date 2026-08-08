# MissAV 视频预览弹窗高度铺满 100%

> **文档类型**：🔧 开发指导
> **文档状态**：✅ 已执行
> **版本**：1.44.1 → 1.44.2（patch，小优化）
> **前置文档**：doc/228（iframe 详情弹窗）、doc/229（宽度最大化 1023px）

## 1. 背景

用户反馈：弹窗高度 `90%` 上下留白，既然宽度已最大化至 1023px（<1024 极限），
高度应**铺满 100%**——上下高度不影响左侧内容区展示（右侧推荐栏已由响应式隐藏），
铺满可获得最大可视面积。

## 2. 方案

| 项 | 改动 |
|----|------|
| 高度 | `area: [.., '90%']` → `area: [.., '100%']` |
| 宽度 | 保持 `min(1023, 视口宽 - 40)` 不变（doc/229） |
| 注释 | 插件头部 doc-comment 同步更新（90% → 100%） |

```diff
- area: [`${width}px`, '90%']
+ area: [`${width}px`, '100%']
```

## 3. 实施（修改文件清单）

| 文件 | 变更 |
|------|------|
| `src/plugins/missav-video-preview/missav-video-preview-plugin.ts` | 高度 90% → 100%（L78）+ 头部注释同步 |
| `vite.config.ts` | version 1.44.1 → 1.44.2（patch） |
| `doc/230-missav-video-preview-height-full.md` | 本文档 |

## 4. 执行验证记录

### 执行环境

Windows + Bun（构建/静态验证）。

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
dist/monkey-jhs-disassemble.user.js  2,198.23 kB │ gzip: 509.60 kB
✓ built in ~1s（产物头部 @version 1.44.2 已核对）

$ bun run lint
（无输出 = 0 errors / 0 warnings）

$ bun run test
 Test Files  12 passed (12)
      Tests  177 passed (177)

$ bun run check:structure
check-structure: OK
```

### 前端或调用方验证

无独立前端；产物 userscript 头部 `@version 1.44.2` 已核对。

### 验证结论

✅ 通过。构建/lint/177 测试/结构门禁全绿，产物 `@version 1.44.2`。

### 已知限制

- 高度 100% 即弹窗铺满视口高度（layer.js 计算），左右宽度仍受
  `min(1023, 视口宽 - 40)` 约束；
- 窄屏（<1063px）宽度跟随视口收窄，高度不变。