# 26 - 单字母标识符语义化重命名

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 1. 背景

### 1.1 问题
项目由单文件混淆脚本 `archetype/jhs.user.js`（11605 行）拆分重构而来，早期迁移为
保留与原脚本逐行对应、降低引入风险，沿用了大量原始混淆产物的单字母命名
（`E/N/M/F/G/j`、`r/l`、`e/t/n/a/i/s`、`vt/se/ie`、`gt/lt/De/Me/Ne/Le` 等）。
这些命名无含义、不可读，成为工程化的长期债。

### 1.2 目标
按场景与项目语义，将无意义单字母标识符替换为有意义、可读的名字，覆盖：
- 顶层导入别名（`r/l/ie/H/gt/lt/De/Me/Ne`）
- CSS 区段常量（`M/N/j/E/F`）与 `generateScrollbarCss` 内部（`e/t/n/a/i`）
- `BroadcastChannel`（`G`）
- 各 IIFE 内局部变量与回调参数（ImageViewer / clog / PluginManager / 启动序列）
- `Hotkey` 类全部静态方法参数（`e/t/n`）
- `webdav-crypto` 模块导出（`Le/Me/Ne`）及对应的 `window` 全局属性 + 访问点
- 其他零星单字母（`libs.ts`/`list-page-plugin.tsx` 的 `w`、`common-util.ts` 的 `d/a`、
  `image-preview.tsx` 的 `x/y`、`rating-*` 的 `m/n/t/v/r/e` 等）

约定俗成保留不动：循环计数器 `i/j/k`、泛型类型参数 `T/A`。

## 2. 修改范围

### 2.1 涉及文件（13 个）

| 文件 | 改动 |
|------|------|
| `src/core/webdav-crypto.ts` | 导出 `Le/Me/Ne` → `WEBDAV_SALT/encryptCredential/decryptCredential` |
| `src/core/hotkey.ts` | 静态方法参数 `e/t/n` → `hotkeyStr/keydownCallback/keyupCallback`、`id`、`event` |
| `src/core/common-util.ts` | `d`(Date) → `date`、`a`(锚点) → `anchor` |
| `src/core/image-preview.tsx` | `x/y`(坐标) → `left/top` |
| `src/core/libs.ts` | `w`(window 别名) → `win` |
| `src/main.tsx` | 导入别名清理 + CSS 区段 + IIFE 内全部单字母 + window 全局属性名 |
| `src/plugins/setting-plugin.tsx` | `(window as any).Me/.Ne/.De` 访问点 + 注释 |
| `src/plugins/new-video-plugin.tsx` | `(window as any).lt` 访问点 + 注释 |
| `src/plugins/list-page-plugin.tsx` | `w`(window 别名) → `win` |
| `src/plugins/rating-display/rating-display-plugin.tsx` | MutationObserver 回调 `m/n/t/i` → `mutation/addedNode/node/item` |
| `src/plugins/rating-display/rating-net.ts` | `v`(评分值) → `ratingValue`、`e`(catch) → `err`、`r`(resolve) → `resolve` |
| `src/plugins/rating-display/rating-utils.ts` | `t`(定时器) → `timer`、类型参数 `v/e` → `value/error` |

### 2.2 `main.tsx` 命名映射表

| 原名 | 新名 | 语义 |
|------|------|------|
| `r`(isJavdbSite 别名) | `isJavdbSite` | 直接用导出名 |
| `l`(误写为 isJavdbSite) | `isJavbusSite` | **修正导入笔误**（见 §3） |
| `ie`(Hotkey 别名) | `Hotkey` | 直接用导出名 |
| `H`(injectCss 别名) | `injectCss` | 直接用导出名 |
| `gt/lt/De` | `loadGfriends/filetreeDb/WebDavClient` | 直接用导出名 |
| `Me/Ne` | `encryptCredential/decryptCredential` | 跟随 webdav-crypto 重命名 |
| `M`(javbus hideNav CSS) | `javbusHideNavCss` | javbus 隐藏导航栏样式片段 |
| `N`(替换后 javbus masonry CSS) | `javbusMasonryCss` | |
| `j`(javdb hideNav CSS) | `javdbHideNavCss` | |
| `E`(替换后 javdb site CSS) | `javdbSiteCss` | |
| `F`(替换后 common toolbar CSS) | `commonToolbarCss` | |
| `generateScrollbarCss` 内 `e/t/n/a/i` | `scrollbarSelectors/appendPseudo/trackPseudo/thumbPseudo/thumbHoverPseudo` | 滚动条选择器与伪类 |
| `G`(BroadcastChannel) | `refreshChannel` | 跨标签刷新通道 |
| ImageViewer `e(e=10)` | `resetOverflow(delay=10)` | 重置 body overflow |
| ImageViewer `e`(shade 数量) | `shadeCount` | |
| ImageViewer `t/n`(src/alt) | `src/alt` | |
| ImageViewer `a/i/s` | `container/isTemporary/viewerOptions` | |
| clog `e`(logger) | `logger` | |
| clog error `t/n/a` | `event/filename/message` | |
| clog reject `t/n/a/i` | `event/reason/reasonMessage/logMessage` | |
| clog mousedown `e/t/n/a` | `event/clog/target/loggerSelectors` | |
| `se`(Hotkey 别名) | 删除，直接用 `Hotkey` | 静态类无需实例别名 |
| `vt`(PluginManager) | `pluginManager` | |
| PluginManager IIFE `e` | `manager` | |
| 启动序列 `e`(href) ×3 | `href` | |
| window 全局属性 `gt/lt/De/Me/Ne` | `loadGfriends/filetreeDb/WebDavClient/encryptCredential/decryptCredential` | window API 语义化 |

### 2.3 `webdav-crypto.ts` 导出映射

| 原导出 | 新导出 | 语义 |
|--------|--------|------|
| `Le` | `WEBDAV_SALT` | 加密 salt 常量 |
| `Me` | `encryptCredential` | WebDav 凭据加密 |
| `Ne` | `decryptCredential` | WebDav 凭据解密 |

联动更新 `setting-plugin.tsx`（5 处 `(window as any).Me/.Ne/.De` 访问）与
`new-video-plugin.tsx`（1 处 `(window as any).lt` 访问）的访问点与注释。

## 3. 关键发现：`main.tsx:13` 导入笔误（已修正）

### 3.1 现象
原 `src/main.tsx` 第 13 行：
```ts
import { isJavdbSite as r, isJavdbSite as l } from './constants/site';
```
`l` 本应是 `isJavbusSite`（`src/constants/site.ts` 明确导出 `isJavdbSite`/`isJavbusSite`
两个不同常量，注释分别标注"原 r"/"原 l"），但写成 `isJavdbSite as l`，导致 `r` 与 `l`
指向同一常量 `isJavdbSite`，`isJavbusSite` 从未被导入。

### 3.2 影响
javbus 站点上 `l`（实为 `isJavdbSite`）= `false`，使以下 javbus 分支失效：
- `if (l) injectCss(javbusMasonryCss)` —— javbus masonry CSS 的 hideNav 替换块未注入
- `window.isDetailPage` 的 `!!l && $('#magnet-table').length > 0` —— 永远 false
- `window.isListPage` 的 `!!l && $('.masonry > div .item').length > 0` —— 永远 false

### 3.3 修正
重命名时同步修正为：
```ts
import { isJavdbSite, isJavbusSite } from './constants/site';
```
恢复"原 r = isJavdbSite、原 l = isJavbusSite"的原始语义。此修正是重命名的必要
组成部分（不修正则 `l` 无法语义化为 `isJavbusSite`），且符合"零偏差"精神——
导入笔误本身就是对原脚本意图的偏差，纠偏即还原。

> ⚠️ 行为变化：javbus 站点上 `isDetailPage`/`isListPage` 现按 URL 实际判定（原先
> 恒 false）。若 javbus 相关插件依赖这两个标志，需在 Tampermonkey 运行时回归验证。

## 4. 验证记录

### 4.1 类型检查
```
./node_modules/.bin/tsc -b
```
exit code 0，无错误无警告。

### 4.2 构建
```
./node_modules/.bin/vite build
```
- ✓ 191 modules transformed
- 产物 `dist/monkey-jhs-disassemble.user.js` 1223.66 kB（gzip 314.42 kB）
- 较 doc/25 基线 1221.87 kB（gzip 314.19 kB）+1.79 kB（gzip +0.23 kB），增量来自
  新标识符更长（纯重命名，无逻辑新增）
- lightningcss 的 `Unexpected token Semicolon` 警告为已知的 layer.css IE hack
  （doc/24 记录，`errorRecovery` 已剥离），无害

### 4.3 残留扫描
```
grep -rn -E "(\(window as any\)\.(Me|Ne|De|gt|lt)\b|window\.(Me|Ne|De|gt|lt)\b|...)" src/
```
无匹配，旧名访问点已全部清理。

## 5. 待办（运行时验证）

tsc + build 仅保证编译期正确，以下需 Tampermonkey 实际加载验证：
- javbus 站点 `isDetailPage`/`isListPage` 判定是否符合预期（受 §3 修正影响）
- javbus 站点 `hideNav=1` 时 masonry CSS 隐藏导航块是否生效
- WebDav 备份/恢复（setting-plugin 的加密/解密/客户端调用）
- 新作品 IndexedDB 缓存清理（new-video-plugin 的 filetreeDb.set）
- 快捷键监听（Hotkey.handleKeydown/handleKeyup 静态调用）
- 图片查看器（showImageViewer 的 resetOverflow/容器/临时标记逻辑）
