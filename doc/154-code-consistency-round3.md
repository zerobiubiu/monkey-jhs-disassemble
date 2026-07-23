# doc/154 — 代码一致性第三轮（错误处理 / 导入顺序 / CSS 类名）

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

用户要求「深入研究保证代码结构、代码风格、代码形式上的一致性，架构统一性，
方案完整性，结构正确性」。本轮通过四维并行审计（console 一致性 / 错误处理 /
导入风格 / CSS 命名）定位 10 高 / 14 中 / 8 低共 32 项不一致，优先修复全部
高优先级项。

## 方案

### 1. 错误处理统一化

项目约定：结构化日志走全局 `clog`，用户可见错误走全局 `show`。审计发现多个
catch 块仅用 `console.error` 带 `[JHS-*]` 前缀，绕过结构化日志且对用户不可见。

| 文件 | 修复 |
|------|------|
| detail-page-button-plugin.tsx | 13 处 `console.error` → `clog.error`；`show.error(err)` → `show.error('字幕搜索失败: ' + (err instanceof Error ? err.message : String(err)))` |
| history-plugin.tsx | 批量操作 catch 补 `clog.error` + `show.error` 用户反馈 |
| blacklist-plugin.tsx | 爬取保存循环 catch `console.error` → `clog.error`，移除 2 处重复 console 调用 |

### 2. 导入顺序统一化

六组约定：(1) 外部类型 → (2) 常量 → (3) 核心 → (4) 本地插件 → (5) 组件 →
(6) CSS?raw 最后，组间空行。

| 文件 | 问题 |
|------|------|
| main.tsx | CSS?raw 在中段、核心导入分散三处 → 全部归位，CSS 移至末尾 |
| history-plugin.tsx | 完全乱序（本地插件先于组件先于核心先于常量，外部类型埋中间） |
| top250-plugin.tsx | 完全倒序（组件先于核心先于常量，base-plugin 最后） |
| setting-plugin.tsx | CSS 在中段，核心导入跨多处分散 |
| detail-page-button-plugin.tsx | 组件先于常量，核心夹在组件之间 |
| blacklist-plugin.tsx | 顺序错乱 |

> 关于 main.tsx：`import './core/libs'` 副作用导入必须保持第 1 行（建立
> $/layer/Tabulator 全局）。CSS?raw 为惰性字符串绑定，无求值期副作用，移至末尾
> 安全（仅由启动序列显式 `injectCss()` 消费）。tsc `noUnusedLocals` + 未定义名
> 检查验证无导入丢失/重复。

### 3. CSS 类名去冲突

| 问题 | 修复 |
|------|------|
| `.menu-btn` 在 common-toolbar.css 与 setting-plugin.css 重名且声明冲突（min-width/border-radius/font-size/hover 各异，同注入 head 互相竞争） | 拆为 `.jhs-toolbar-menu-btn`（页面工具栏上下文）/ `.jhs-setting-menu-btn`（设置弹窗上下文），13 文件 68 处调用点按上下文同步 |
| video-lists-tag.css 前半段（L10-294）23 个无缀通用类名（`.custom-tags-display`/`.tag-filter-chip`/`.filter-mode-panel` 等）易与站点/其他插件冲突 | 统一加 `jhs-vlt-` 前缀 + 1 个 `@keyframes`，跨 4 文件（vlt-tags.ts / other-site-plugin.tsx / status-tag-filter-plugin.ts / preload-status-badge.tsx）调用点同步；后半段已带前缀者不动 |

## 实施

| 文件 | 操作 |
|------|------|
| `src/plugins/detail-page-button-plugin.tsx` | 修改：13 处 clog + show.error 修复 + 导入重排 |
| `src/plugins/history-plugin.tsx` | 修改：catch 补反馈 + 导入重排 |
| `src/plugins/blacklist-plugin.tsx` | 修改：clog 替换 + 导入重排 |
| `src/plugins/top250-plugin.tsx` | 修改：导入重排 |
| `src/plugins/setting-plugin.tsx` | 修改：导入重排 |
| `src/main.tsx` | 修改：导入六组重排 |
| `src/styles/common-toolbar.css` | 修改：.menu-btn → .jhs-toolbar-menu-btn |
| `src/styles/setting-plugin.css` | 修改：.menu-btn → .jhs-setting-menu-btn |
| `src/styles/video-lists-tag.css` | 修改：23 类 + 1 keyframes 加 jhs-vlt- 前缀 |
| 13 个组件/插件调用点文件 | 修改：menu-btn 类名按上下文替换 |
| 4 个 VLT 调用点文件 | 修改：类名加 jhs-vlt- 前缀 |

## 执行验证记录

```
$ bun run build
tsc -b && vite build
✓ 229 modules transformed.
dist/monkey-jhs-disassemble.user.js  2,024.89 kB │ gzip: 467.29 kB
✓ built in 1.18s
```

tsc 零错误（验证导入重排无丢失/重复、类名重命名无未定义引用）。Phase 1 / Phase 2
两次构建均绿。

## 后续验证建议

- 浏览器冒烟：设置弹窗菜单按钮、列表页工具栏按钮、清单标签筛选条样式无回归。
- 跨插件挂载点：other-site / status-tag-filter 对 `.jhs-vlt-filter-bar` 的
  querySelector/matches 选择器已同步更新，需确认筛选条仍正常挂载。
