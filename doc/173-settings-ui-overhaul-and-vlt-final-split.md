# doc/173 — 设置面板 UI 统一化 + vlt-sync 最终拆分

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

用户反馈设置面板 CSS 严重不统一：输入框对齐混乱、密码切换按钮用 emoji 不一致、
颜色选择器原生样式突兀、各面板布局五花八门。同时 vlt-sync.tsx 2259 行需进一步拆分。

## 1. 设置面板 CSS 设计系统

### CSS 重写（setting-plugin.css 652→786 行）
- `.setting-item`：flex → CSS Grid（`grid-template-columns: 180px 1fr`），统一标签右对齐 + 输入框撑满
- 统一控件样式：所有 input/select/textarea 高度 36px、圆角 6px、focus 蓝色光环
- 密码输入：移除自定义 emoji 切换按钮，依赖浏览器原生 `::-ms-reveal` / Chrome 密码显示按钮
- iOS 风格 toggle 开关（`.jhs-toggle`）：40×22px 滑块，灰→绿
- 分区标题 + 分隔线（`.jhs-setting-section` / `.jhs-setting-section-title`）
- 统一按钮（`.jhs-setting-btn--primary/success/danger/pink/mint`）
- 颜色选择器样式化（36×36 圆角）
- 只读输入框灰底
- tooltip 图标（`.jhs-tooltip-icon`）

### 8 个原子表单组件（src/components/setting/）
| 组件 | 职责 |
|------|------|
| SettingRow | 标签 + 内容网格行 |
| SettingInput | 统一 input |
| SettingSelect | 统一 select |
| SettingToggle | iOS 开关行 |
| SettingCheckbox | 复选框 + 标签 |
| SettingSection | 分区标题 + 分隔线 |
| SettingButton | 统一按钮 |
| SettingColorRow | 数字 + 颜色 + 预览 |

### 9 个面板全部重构
每个面板使用原子组件重写，所有 id/class/data-attr 保留（120 个 jQuery 选择器审计全通过）。

### 独立预览页
`preview/settings-preview.html`（1387 行自包含 HTML）——无需 Tampermonkey 即可在浏览器中
视觉审查全部 9 个面板的 UI 效果。

## 2. vlt-sync.tsx 最终拆分（2259→27 行）

| 新模块 | 行数 | 职责 |
|--------|------|------|
| vlt-helpers.ts | 338 | 纯辅助函数 + 常量/类型 |
| vlt-checkbox.ts | 288 | 复选框变更处理 + 待更新追踪 |
| vlt-server.ts | 484 | 服务端变更管道 + CSRF + 重试 |
| vlt-create-list.tsx | 687 | 新建清单 UI + 事件绑定 |
| vlt-list-mgmt.ts | 340 | 清单管理监听 + 删除/重命名 |

vlt-sync.tsx 降为 27 行 barrel re-exports，保留所有现有导入路径。

## 3. 选择器审计

120 个 jQuery 选择器逐一验证：118 OK + 2 预期移除（密码切换按钮）+ 0 缺失 + 0 死处理器。

## 验证记录

- bun run build：✅
- bun run test：✅ 28/28
- bun run lint：✅ 0 errors
- bun run check:structure：✅
- 选择器审计：✅ 0 missing
