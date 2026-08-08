# MissAV 视频预览弹窗宽度最大化至 1023px

> **文档类型**：🔧 开发指导
> **文档状态**：✅ 已执行
> **版本**：1.44.0 → 1.44.1（patch，小优化）
> **前置文档**：doc/228（MissAV 视频流 iframe 详情弹窗）

## 1. 背景

用户反馈 doc/228 实现的视频预览弹窗 **900px 宽度太小**，应最大化利用
**1023px（< 1024 的极限）**——missav 站点在 1024px 以下（不含 1024）自动隐藏
右侧推荐栏，弹窗宽度取极限值可在不触发右侧栏的前提下获得最大内容区。

## 2. 根因（Camoufox 实测证据，doc/228 §1.1 已确认）

| 视口 | 右侧栏 | 左侧宽度 |
|------|--------|----------|
| 900 / 1023px | `display:none` | 736px 占满 |
| 1024 / 1200px | `display:flex`（300px） | 668px |

→ 弹窗宽度上限从 900px 提升到 **1023px** 仍保持右侧栏隐藏，且左侧内容区更宽。

## 3. 方案

| 项 | 改动 |
|----|------|
| 宽度上限 | `Math.min(900, window.innerWidth - 40)` → `Math.min(1023, window.innerWidth - 40)` |
| 高度 | 保持 `90%` 不变 |
| 注释 | 插件头部 doc-comment 同步更新（900 → 1023） |

```diff
- const width = Math.min(900, window.innerWidth - 40);
+ const width = Math.min(1023, window.innerWidth - 40);
```

## 4. 实施（修改文件清单）

| 文件 | 变更 |
|------|------|
| `src/plugins/missav-video-preview/missav-video-preview-plugin.ts` | 宽度上限 900 → 1023（L72）+ 头部注释同步 |
| `vite.config.ts` | version 1.44.0 → 1.44.1（patch） |
| `doc/229-missav-video-preview-width-max.md` | 本文档 |

## 5. 执行验证记录

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
dist/monkey-jhs-disassemble.user.js  2,198.23 kB │ gzip: 509.59 kB
✓ built in ~1s（产物头部 @version 1.44.1 已核对）

$ bun run lint
（无输出 = 0 errors / 0 warnings）

$ bun run test
 Test Files  12 passed (12)
      Tests  177 passed (177)

$ bun run check:structure
check-structure: OK
```

### 前端或调用方验证

无独立前端；产物 userscript 头部 `@version 1.44.1` 已核对。

### 验证结论

✅ 通过。构建/lint/177 测试/结构门禁全绿，产物 `@version 1.44.1`。

### 已知限制

- 弹窗宽度实际值取决于视口：`min(1023, 视口宽 - 40)`——宽屏取 1023px，
  窄屏（<1063px）跟随视口收窄；
- 1023px 是 <1024 的极限值，若 missav 未来调整响应式断点需重新实测。