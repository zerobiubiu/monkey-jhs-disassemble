# 02 - 精简 jhs.user.js：删除"封面快捷按钮"功能（CoverButtonPlugin）

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行
> **执行日期**：2026-07-01

## 1. 背景

`jhs.user.js` 中 `CoverButtonPlugin` 在列表页封面卡片上注入一组悬浮快捷按钮（长缩略图 / 预览视频 / 鉴定处理 / 第三方跳转 / 复制按钮），并附带 5 个开关配置项。用户要求删除该功能，"只要不干扰其他内容的都删除"。

## 2. 删除清单

### 2.1 类定义

- `class CoverButtonPlugin extends BasePlugin`（原 L11972-12260）— 整个类删除，含 `getName` / `initCss` / `handle` / `addSvgBtn` / `enableSvgBtn` / `bindClick` / `showImg` / `showVideo`。

### 2.2 注册代码

- `e.register(CoverButtonPlugin);`（原 L15354、L15384 两处，分别属于 javdb 与 javbus 分支）— 两处全部删除。

### 2.3 BasePlugin 构造函数中的 SVG 定义

以下 9 个 SVG 字符串属性**仅被 `CoverButtonPlugin` 引用**（grep 确认），全部删除：

- `copySvg` / `titleSvg` / `carNumSvg` / `downSvg`（复制按钮子弹钮）
- `handleSvg` / `siteSvg`（鉴定处理、第三方跳转）
- `videoSvg` / `screenSvg` / `recoveryVideoSvg`（预览视频、长缩略图、切回封面）

> 保留 `refreshSvg`、`blacklistSvg` 等其他插件仍在使用的 SVG。

### 2.4 SettingPlugin.openSettingDialog

- 删除 `const i = this.getBean("CoverButtonPlugin");`
- 删除模板字符串中"封面快捷按钮"区块：从 `<div class="setting-item" style="margin-top:10px">封面快捷按钮</div>` 起，到 5 个 `enableXxxSvg` checkbox 的 setting-item 及其后跟随的 `<hr>` 分隔线（含）。
- 删除 `layer.open` 的 `end` 回调中 `this.getBean("CoverButtonPlugin").enableSvgBtn();`（整个 `end` 回调块删除）。

### 2.5 SettingPlugin.loadForm

- 删除 5 个 `$("#enableXxxSvg").prop("checked", ...)` 调用。

### 2.6 SettingPlugin.saveForm

- 删除 5 个 `e.enableXxxSvg = $("#enableXxxSvg").is(":checked") ? _ : C;` 赋值。

### 2.7 ListPagePlugin.checkDom

- 删除 `this.getBean("CoverButtonPlugin").addSvgBtn();`。

## 3. 实施方式

由于 `openSettingDialog` 的 `let s = ...` 是单行超长模板字符串、BasePlugin 中 SVG 字符串亦为超长单行，`edit_file` 的 fuzzy 匹配会失败。故编写一次性 node 脚本 `_remove_coverbutton.cjs`，基于唯一字符串锚点（`"copySvg",`、`封面快捷按钮`、`enableCopySvg`、`class CoverButtonPlugin` 等）做 `indexOf` + `slice` 精确切割。脚本执行后已删除。

## 4. 验证

- `node --check jhs.user.js` → 语法检查通过。
- `diagnostics` → File doesn't have errors or warnings。
- grep `CoverButtonPlugin|enableScreenSvg|enableVideoSvg|enableHandleSvg|enableSiteSvg|enableCopySvg|screenSvg|videoSvg|handleSvg|siteSvg|copySvg|recoveryVideoSvg|carNumSvg|titleSvg|downSvg|封面快捷按钮` → No matches found。
- 确认 `openSettingDialog` 内不再有 `${i.xxx}` 引用（`const i` 已删，残留的 3 处 `${i.` 属于其他无关方法的局部变量）。

## 5. 影响与后续

- 列表页封面卡片不再显示快捷按钮工具栏；鉴定/收藏/过滤等操作仍可通过 jhs 详情页按钮、菜单命令、`ListPageButtonPlugin` 排序守卫等既有路径完成，不受影响。
- 设置面板"基础配置"中"封面快捷按钮"分组消失，其余配置项（窗口数、标签位置、画质、评论条数、高亮演员、请求超时、日志等）保持不变。
- 共删除约 41114 字符，文件行数相应减少。
