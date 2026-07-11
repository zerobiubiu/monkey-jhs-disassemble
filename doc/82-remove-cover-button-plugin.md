# 82 - 删除封面工具栏全套（CoverButtonPlugin）

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行
> **执行日期**：2026-07-11

## 1. 背景

设置 → 基础配置中「封面工具栏 - *」五开关配套 CoverButtonPlugin（列表封面悬浮
快捷按钮：长缩略图 / 预览视频 / 鉴定处理 / 第三方网站 / 复制）。用户要求将该
全套内容深度清理。对齐 archetype 侧 `archetype/doc/02-remove-cover-button-plugin.md`
对 `jhs.user.js` 的删除策略：只要不干扰其他功能的相关代码一律删除。

历史文档 doc/76（落地）、doc/80（可见性排查）、doc/81（撤销加固）**保持不变**
（已执行文档不可回头改），仅作溯源。

## 2. 删除清单

### 2.1 插件本体

| 路径 | 说明 |
|------|------|
| `src/plugins/cover-button-plugin.tsx` | CoverButtonPlugin 整文件删除（initCss/handle/addSvgBtn/enableSvgBtn/bindClick/showImg/showVideo） |

### 2.2 注册与调用

| 路径 | 改动 |
|------|------|
| `src/main.tsx` | 移除 `CoverButtonPlugin` import 与 `featureFlags.coverButtonPlugin` 注册 |
| `src/plugins/list-page-plugin.tsx` | `doFilter` 末尾移除 `getBean('CoverButtonPlugin')?.addSvgBtn?.()` |
| `src/core/feature-flags.ts` | 移除 `coverButtonPlugin: true` |

### 2.3 设置面板（基础配置）

| 路径 | 改动 |
|------|------|
| `src/components/setting-dialog.tsx` | 删除 5 个「封面工具栏 - *」setting-item + 两侧 `<hr>` 中多余一条 |
| `src/plugins/setting-plugin.tsx` | `loadForm` / `saveForm` 删除 `enableScreenSvg` 等 5 键读写 |

### 2.4 SVG 与样式（仅 CoverButton 使用）

| 路径 | 改动 |
|------|------|
| `src/resources/upgrade-icons.ts` | 整文件删除（COPY/DOWN/HANDLE/SITE/VIDEO/SCREEN/RECOVERY_VIDEO） |
| `src/plugins/base-plugin.ts` | 移除 upgrade-icons import 及 7 个 class 字段 |
| `src/styles/common-toolbar.css` | 移除 `.tool-box .jhs-icon`（榜单页 tool-box 空容器不受影响） |

### 2.5 文档与版本

| 路径 | 改动 |
|------|------|
| `AGENTS.md` | 插件计数 41→40（JavDB 39→38）；升级新插件 6→5；去掉 CoverButton 行 |
| `doc/README.md` | 计数同步 + 本条清单 |
| `changelog/CHANGELOG.md` | v1.10.0 移除条目 |
| `vite.config.ts` | version `1.9.4` → `1.10.0`（minor：删除整插件模块） |

## 3. 明确保留（不删）

- **ScreenShotPlugin**：详情页/其它入口仍可长缩略图，仅封面栏调用点消失
- **PreviewVideoPlugin**、详情页鉴定/复制、OtherSite 等既有路径
- **ranking-containers** 的 `.tool-box` 空容器（HitShow/Top250 工具栏挂载点）
- 历史 doc/76–81、archetype 对照脚本（只读参考）

## 4. 深度搜索验证关键词

清理后 `src/` 内应 **0 命中**：

```
CoverButtonPlugin|coverButtonPlugin|cover-button-plugin
enableScreenSvg|enableVideoSvg|enableHandleSvg|enableSiteSvg|enableCopySvg
封面工具栏|upgrade-icons|addSvgBtn|enableSvgBtn
screenSvg|recoveryVideoSvg|VIDEO_SVG|SCREEN_SVG
```

## 5. 执行验证记录

- `bun run build`（`tsc -b && vite build`）通过
- 产物 `dist/monkey-jhs-disassemble.user.js` **1,905.91 kB**（gzip 437.47 kB），`@version 1.10.0`
- lightningcss IE hack 警告为既有 layer.css 容错，与本次无关
- `src/` 与 `dist/` 对删除关键词 grep 均为 0 命中
- `cover-button-plugin.tsx` / `upgrade-icons.ts` 文件已不存在

## 6. 后续验证建议

1. 设置 → 基础配置：确认无「封面工具栏」五项，其余开关正常保存
2. 列表页卡片：封面区域无悬浮 tool-box 图标
3. 详情页截图墙 / 预览视频 / 鉴定按钮仍可用
4. HitShow / Top250 工具栏布局正常
