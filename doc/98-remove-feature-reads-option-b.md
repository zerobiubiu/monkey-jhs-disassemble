# 98 - 彻底删除 4 个设置项的功能读取逻辑（方案 B）

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行

## 背景

doc/97 删除了 hoverBigImg / enableLoadScreenShot / enableLoadPreviewVideo /
enableVerticalModel 四个设置项的 UI（`SimpleSettingPanel`）+ 绑定
（`initSimpleSettingForm`），但**保留了功能读取逻辑**（各插件中的
`getSetting` 调用），功能按默认值运行，老用户 setting 值仍生效（方案 A）。

用户确认改为**方案 B**：彻底删除功能读取逻辑，功能固定按默认值运行，
不给老用户兜底，逻辑删除即可。

## 方案

逐项删除 4 个功能读取点 + 连带清理 unused import / 孤儿 CSS。

### 逐项明细

| # | 设置项 | 读取点 | 删除内容 | 连带清理 | 固定行为 |
|---|--------|--------|----------|----------|----------|
| 1 | hoverBigImg | `list-page-plugin.tsx:709` | `getSetting('hoverBigImg', NO)` + ImagePreview 创建/绑定逻辑 | `import { ImagePreview }` + L15 注释 + replaceHdImg 方法注释 | 悬浮大图不启用 |
| 2 | enableLoadScreenShot | `screenshot-plugin.ts:19` | `if (getSetting(...) !== 'yes') return;` 判断行 | 无（用字符串 'yes'，无 import） | 长缩略图始终加载 |
| 3 | enableLoadPreviewVideo | `preview-video-plugin.tsx:459,547` | L459 条件简化（删 enableLoadPreviewVideo，保留 autoPlay 判断）；L547-549 删除 `=== NO return` 判断 | 无（YES/NO 在 L559/562 仍用） | 更高画质预览始终解析 |
| 4 | enableVerticalModel | `setting-plugin.tsx` applyImageMode | 删除 `getSetting('enableVerticalModel', NO)` + YES 分支（竖图 CSS），方法简化为固定注入横图 CSS | `import verticalImgCssRaw` + `src/styles/setting-image-mode-vertical.css` 孤儿文件 | 固定横图模式 |

## 实施

| 文件 | 改动 |
|------|------|
| `src/plugins/list-page-plugin.tsx` | 删除 `replaceHdImg` 中 `getSetting('hoverBigImg', NO).then(...)` 整段（ImagePreview 创建/bindEvents）；删除 `import { ImagePreview }`；删除 L15 注释中 ImageHoverPreview 迁移描述；`replaceHdImg` 方法注释去掉"按设置挂载悬浮大图预览" |
| `src/plugins/screenshot-plugin.ts` | `loadScreenShot` 删除 `if ((await getSetting('enableLoadScreenShot', 'yes')) !== 'yes') return;` 判断行 |
| `src/plugins/preview-video-plugin.tsx` | handle 中 `if (getSetting('enableLoadPreviewVideo', YES) === YES && !autoPlay)` 简化为 `if (!autoPlay)`；`handleVideo` 删除 `if (getSetting('enableLoadPreviewVideo', YES) === NO) return;` 3 行 |
| `src/plugins/setting-plugin.tsx` | `applyImageMode` 删除 `getSetting('enableVerticalModel', NO)` 读取 + YES 分支（竖图 CSS + objectPosition 逻辑），简化为固定注入横图 CSS；删除 `import verticalImgCssRaw`；方法注释更新为"固定横图" |
| `src/styles/setting-image-mode-vertical.css` | **删除文件**（verticalImgCssRaw import 已删，src 下无引用，孤儿文件） |

## 执行验证

```
$ bun run build
$ tsc -b && vite build
✓ 219 modules transformed.
dist/monkey-jhs-disassemble.user.js  1,876.53 kB │ gzip: 432.21 kB
✓ built in 1.11s
```

- `tsc -b` 零错误
- 4 个修改文件诊断无 error/warning（ImagePreview/verticalImgCssRaw unused import 已删）
- 产物 1876.53 kB（gzip 432.21 kB），较 doc/97 后 1883.79 kB **-7.26 kB**
- 产物残留检查（全 0）：
  - `hoverBigImg` / `enableLoadScreenShot` / `enableLoadPreviewVideo` /
    `enableVerticalModel` / `verticalImgCssRaw` 均为 **0 匹配**
- version `1.12.8` → `1.12.9`（删除功能读取逻辑 + 孤儿 CSS，patch 递增）

## 后续验证建议

1. 列表页封面悬停 → 不再弹出大图（hoverBigImg 功能彻底移除）
2. 详情页图片区 → 长缩略图始终加载（ScreenShotPlugin 不再判断设置）
3. 详情页预览视频 → 更高画质始终解析（不再受设置项控制）
4. 列表页封面 → 固定横图裁剪（applyImageMode 只注入横图 CSS）
5. 控制台执行 `storageManager.getSetting('hoverBigImg', 'no')` → 返回 'no'
   （setting 键仍在 IndexedDB，但代码不再读取，值无意义）
