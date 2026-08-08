# MissAV 视频预览弹窗去除过渡动画

> **文档类型**：🔧 开发指导
> **文档状态**：✅ 已执行
> **版本**：1.44.4 → 1.44.5（patch，优化）
> **前置文档**：doc/228（iframe 详情弹窗）

## 1. 背景

用户反馈：missav 的 iframe 弹出层**不要过渡动画**，像 javdb 一样**直接弹出**——
过渡动画浪费性能且无作用。

## 2. 方案

对齐 javdb `utils.openPage`（`src/core/common-util.ts` L144-156）的参数：

```diff
  layer.open({
      type: 2,
      content: url,
      scrollbar: false,
      area: [`${width}px`, '100%'],
+     isOutAnim: false,   // 无退出动画
+     anim: -1,           // 无进入动画（直接弹出）
      end: () => { ... }
  });
```

- `anim: -1`：layer.js 中 `-1` 表示**无进入动画**（直接显示）
- `isOutAnim: false`：**无退出动画**（关闭时直接消失）

## 3. 实施（修改文件清单）

| 文件 | 变更 |
|------|------|
| `src/plugins/missav-video-preview/missav-video-preview-plugin.ts` | layer.open 增加 `isOutAnim: false` + `anim: -1` |
| `vite.config.ts` | version 1.44.4 → 1.44.5（patch） |
| `doc/233-missav-video-preview-no-anim.md` | 本文档 |

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
dist/monkey-jhs-disassemble.user.js  2,198.57 kB │ gzip: 509.68 kB
✓ built in ~1s（产物头部 @version 1.44.5 已核对）

$ bun run lint
（无输出 = 0 errors / 0 warnings）

$ bun run test
 Test Files  12 passed (12)
      Tests  177 passed (177)

$ bun run check:structure
check-structure: OK
```

### 前端或调用方验证

无独立前端；产物 userscript 头部 `@version 1.44.5` 已核对。

### 验证结论

✅ 通过。构建/lint/177 测试/结构门禁全绿，产物 `@version 1.44.5`。

### 已知限制

- 弹窗直接弹出/关闭无动画，与 javdb openPage 行为一致；需用户浏览器实测确认。