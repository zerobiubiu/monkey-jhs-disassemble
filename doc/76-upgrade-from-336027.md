# 76 - 对照 jhs.3.3.6.027 可插拔功能升级（批次 A–D）

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行
> **执行日期**：2026-07-11

## 1. 背景

对照 `archetype/jhs.3.3.6.027.user.js`（新版）相对当前工程（基于精简后的
`jhs.user.js`）的功能差异，按执行方案 `doc/78-upgrade-plan-336027.md` 落地升级。

原则：

- 全部改动带 **feature flag**（`src/core/feature-flags.ts`），默认全开
- 控制台可 `localStorage.setItem('jhs_upgrade_flags', JSON.stringify({...}))` 单项回退
- 不恢复已删除的 `TaskPlugin` 定时检测（不在升级范围）

## 2. 方案摘要

| 批次 | 内容 | flag 前缀 |
|------|------|-----------|
| A | ①–⑩ 行为优化 | upgradeSignature300s / caseInsensitiveCarNum / autoPageReplaceState / wantWatchBatchImport / movieShowTypeVisibility / storageCacheDeepCopy / webdavIdempotentMkdir / westernCarFormat / actressUserSelectAll / navBarNoPaste |
| B | ⑫ TranslatePlugin、⑬ ScreenShotPlugin、⑭ javDbApi 聚合 | translatePlugin / screenShotPlugin / javDbApiAggregate |
| C | ⑮ CoverButtonPlugin、⑰ MagnetHubPlugin、⑱ ImageRecognitionPlugin | coverButtonPlugin / magnetHubPlugin / imageRecognitionPlugin |
| D | 20 Fc2By123AvPlugin | fc2By123AvPlugin |

## 3. 实施（修改文件清单）

### 新增

| 文件 | 说明 |
|------|------|
| `src/core/feature-flags.ts` | 升级开关中心 |
| `src/resources/upgrade-icons.ts` | 封面工具栏 SVG |
| `src/plugins/translate-plugin.ts` | 标题翻译插件 |
| `src/plugins/screenshot-plugin.ts` | javstore 截图墙 |
| `src/plugins/magnet-hub-plugin.ts` | 多引擎磁链 |
| `src/plugins/cover-button-plugin.tsx` | 列表封面工具栏 |
| `src/plugins/image-recognition-plugin.tsx` | 以图识图 |
| `src/plugins/fc2-by-123av-plugin.ts` | 123Av FC2 浏览/详情 |

### 修改（核心）

| 文件 | 说明 |
|------|------|
| `src/constants/api.ts` | 签名 300s / removeSignature / javDbApi / markDataListHtml |
| `src/core/common-util.ts` | copyObj / deepFreeze |
| `src/core/storage-manager.ts` | 大小写不敏感 / 缓存深拷贝 |
| `src/core/webdav.ts` | checkFolderExists / createFolder 幂等 |
| `src/plugins/base-plugin.ts` | _formatWesternCar + 新 SVG 字段 |
| `src/plugins/auto-page-plugin.ts` | replaceState flag |
| `src/plugins/list-page-plugin.tsx` | 番号大小写 / movieShowType / CoverButton 触发 |
| `src/plugins/want-and-watched-videos-plugin.tsx` | 批量导入 |
| `src/plugins/nav-bar-plugin.tsx` | 禁 paste / 识图按钮 |
| `src/plugins/setting-plugin.tsx` | movieShowType + 5 SVG 开关读写 |
| `src/components/setting-dialog.tsx` | 对应表单项 |
| `src/components/actress-info-detail-segment.tsx` | user-select:all |
| `src/plugins/preview-video-plugin.tsx` | 导出 fetchDmmPreviewVideo |
| `src/plugins/detail-page-button-plugin.tsx` | 磁力搜索入口 |
| `src/main.tsx` | flag 条件注册 6 个新插件 |
| `vite.config.ts` | version 1.9.0 + @connect 域名 |

## 4. 对比调试

```js
// 回退某一项到旧逻辑
localStorage.setItem('jhs_upgrade_flags', JSON.stringify({ caseInsensitiveCarNum: false }));
// 恢复全部默认
localStorage.removeItem('jhs_upgrade_flags');
```

## 5. 执行验证记录

```
$ bun run build
tsc -b && vite build
✓ 222 modules transformed
dist/monkey-jhs-disassemble.user.js  2,226.11 kB │ gzip: 559.32 kB
✓ built in 1.91s
```

lightningcss IE hack 警告为既有层 CSS，非本次引入。

## 6. 后续验证建议

1. 列表页：已鉴定 hide/visibility 切换；封面工具栏 5 组按钮
2. 详情页：翻译 / 截图墙 / 磁力搜索
3. 想看导入：多页耗时与进度提示
4. WebDav 连续备份两次不报目录已存在
5. `/advanced_search?type=100`：123Av FC2 列表与详情弹窗
6. 导航栏：识图按钮；搜索框粘贴图片不自动搜索
7. 控制台关全部 flag 后行为应接近升级前

## 7. 已知简化 / 后续可补

- CoverButton 第三方域名 jable/avgle/123av 使用默认值（OtherSite 未存这些键）
- Fc2By123Av 列表解析适配 123av 多版 DOM，复杂布局可能需再校准
- 列表页标题翻译仍走 ListPagePlugin 内联逻辑（TranslatePlugin 专责详情页）
- 行为优化项旧分支已用 flag 保留，稳定后可择机删除旧代码
