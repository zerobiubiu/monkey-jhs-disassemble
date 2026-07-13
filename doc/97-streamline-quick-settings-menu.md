# 97 - 整理优化快捷设置菜单（删 4 项 + 调整 2 默认值）

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行

## 背景

快捷设置面板（`SimpleSettingPanel`）设置项过多，部分开关用户不常调整且功能默认值
已合理；页面列数默认 5、页面宽度默认 100% 偏宽。需精简菜单 + 优化默认值。

要求：逐项执行，保证每项正确性、独立性、可控制性、可恢复、可查询，清理干净。

## 方案

### 处理原则

- **删除设置项** = 删除 UI（`SimpleSettingPanel` 中的 `<div className="setting-item">`）
  + 删除绑定逻辑（`initSimpleSettingForm` 中的 `prop('checked')` + `on('change')`）
- **保留功能读取** = 各插件中的 `storageManager.getSetting(...)` 调用不动，
  功能按默认值（或老用户已保存值）运行
- **可恢复**：底层 setting 键保留，`getSetting` 仍可读；UI 代码 git 可恢复
- **可查询**：控制台 `storageManager.getSetting('xxx', default)` 仍可查
- **清理干净**：删除后不留孤儿代码（unused import / 空行堆积等一并处理）

### 逐项明细

| # | 设置项 | UI | 绑定 | 功能读取（保留） | 默认值 |
|---|--------|----|------|------------------|--------|
| 1 | hoverBigImg（启用悬浮大图） | 删 | 删（含 ImagePreview 创建/销毁） | list-page-plugin:709 `getSetting('hoverBigImg', NO)` | NO（关闭） |
| 2 | enableLoadScreenShot（加载长缩略图） | 删 | 删（含 .screen-container 移除） | screenshot-plugin:19 `getSetting('enableLoadScreenShot', 'yes')` | yes（加载） |
| 3 | enableLoadPreviewVideo（更高画质预览视频） | 删 | 删 | preview-video-plugin:459,547 `getSetting('enableLoadPreviewVideo', YES)` | YES（开启） |
| 4 | enableVerticalModel（竖图模式） | 删 | 删（含 applyImageMode 调用） | setting-plugin applyImageMode:550 `getSetting('enableVerticalModel', NO)` | NO（横图） |
| 5 | containerColumns（页面列数） | 保留 | 保留 | initCss:170 + form:374-375 | **5 → 4** |
| 6 | containerWidth（页面宽度） | 保留 | 保留 | initCss:166 + form:376-377 | **100% → 70%** |

### 各项说明

**项 1 hoverBigImg**：删除 UI + 绑定（含 `new ImagePreview(...)` 创建/`destroy()` 销毁）。
`ImagePreview` 的 import 在 setting-plugin.tsx 已无其他引用，一并删除。
功能初始化保留在 list-page-plugin.tsx:709（页面加载时按 setting 值创建）。

**项 2 enableLoadScreenShot**：删除 UI + 绑定（含关闭时 `.screen-container` 移除）。
功能读取保留在 screenshot-plugin.ts:19（默认 yes 加载长缩略图）。

**项 3 enableLoadPreviewVideo**：删除 UI + 绑定。
功能读取保留在 preview-video-plugin.tsx 两处（默认 YES 解析更高画质）。

**项 4 enableVerticalModel**：删除 UI + 绑定（含 `this.applyImageMode()` 调用）。
`applyImageMode` 方法保留（initCss 和 containerColumns input 仍调用），内部
`getSetting('enableVerticalModel', NO)` 保留（默认 NO 横图模式）。

**项 5 containerColumns 默认 5→4**：修改 3 处默认值
（initCss `?? 5`→`?? 4` + form `|| 5`→`|| 4` × 2）。UI（range 2-10）保留。

**项 6 containerWidth 默认 100→70**：修改 3 处默认值
（initCss `?? '100'`→`?? '70'` + form `|| 100`→`|| 70` × 2）。
containerWidth 存储值为实际百分比（70-100），range 值 = 宽度 - 70（0-30）。
默认 70% 对应 range=0（最小值）。UI（range 0-30）保留。

## 实施

| 文件 | 改动 |
|------|------|
| `src/components/simple-setting-panel.tsx` | 删除 4 个设置项 UI（hoverBigImg / enableLoadScreenShot / enableLoadPreviewVideo / enableVerticalModel）；清理删除后冗余空行；头部注释去掉对应项描述 |
| `src/plugins/setting-plugin.tsx` | 删除 4 个设置项绑定（prop + on change，含 ImagePreview 创建/销毁、.screen-container 移除、applyImageMode 调用）；删除 unused `import { ImagePreview }`；containerColumns 默认 5→4（3 处）；containerWidth 默认 100→70（3 处） |

### 未改动文件（功能读取保留）

| 文件 | 保留逻辑 |
|------|----------|
| `src/plugins/list-page-plugin.tsx:709` | `getSetting('hoverBigImg', NO)` → ImagePreview 初始化 |
| `src/plugins/screenshot-plugin.ts:19` | `getSetting('enableLoadScreenShot', 'yes')` → 长缩略图加载 |
| `src/plugins/preview-video-plugin.tsx:459,547` | `getSetting('enableLoadPreviewVideo', YES)` → 更高画质解析 |
| `src/plugins/setting-plugin.tsx` applyImageMode | `getSetting('enableVerticalModel', NO)` → 竖图/横图 CSS |

## 执行验证

```
$ bun run build
$ tsc -b && vite build
✓ 219 modules transformed.
dist/monkey-jhs-disassemble.user.js  1,883.79 kB │ gzip: 434.13 kB
✓ built in 1.11s
```

- `tsc -b` 零错误
- 2 个修改文件诊断无 error/warning（删除 ImagePreview unused import 后 warning 消除）
- 产物 1883.79 kB（gzip 434.13 kB），较清理前 1887.86 kB **-4.07 kB**
- 产物验证：
  - `#hoverBigImg` / `#enableLoadScreenShot` / `#enableLoadPreviewVideo` /
    `#enableVerticalModel` jQuery 选择器/HTML id 均为 **0 匹配**（UI + 绑定已清除）
  - `containerColumns ?? 4` × 1 + `containerColumns || 4` × 2（默认值已改）
  - `containerWidth ?? '70'` × 1 + `containerWidth || 70` × 2（默认值已改）
  - `getSetting('hoverBigImg'...)` × 1 / `getSetting('enableLoadScreenShot'...)` × 1 /
    `getSetting('enableLoadPreviewVideo'...)` × 2 / `getSetting('enableVerticalModel'...)` × 1
    （功能读取保留）
- version `1.12.7` → `1.12.8`（菜单整理 + 默认值调整，patch 递增）

## 后续验证建议

1. 打开 javdb 列表页 → 点击 JHS 菜单打开快捷设置面板
2. 确认设置项不含：启用悬浮大图 / 加载长缩略图 / 更高画质预览视频 / 竖图模式
3. 确认保留：瀑布流模式 / 启用标题翻译 / 加载女优信息 / 加载第三方视频资源 /
   页面列数(range) / 页面宽度(range)
4. 页面列数默认显示 4，页面宽度默认显示 70%
5. 功能验证（按默认值运行）：
   - 悬浮大图默认关闭（hoverBigImg=NO）—— 鼠标悬停封面无大图弹出
   - 长缩略图默认加载（enableLoadScreenShot=yes）—— 详情页图片区首列有长缩略图
   - 更高画质预览默认开启（enableLoadPreviewVideo=YES）—— 详情页预览视频解析更高画质
   - 竖图模式默认关闭（enableVerticalModel=NO）—— 列表页封面为横图裁剪
6. 可恢复性：控制台
   `storageManager.saveSettingItem('hoverBigImg', 'yes')` 后刷新，
   悬浮大图功能恢复（list-page-plugin 读取 setting 值创建 ImagePreview）
