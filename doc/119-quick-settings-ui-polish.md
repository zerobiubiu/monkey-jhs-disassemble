# 119 · 快捷设置面板 UI 优化

| 项 | 内容 |
|----|------|
| 文档类型 | 🔧开发指导 |
| 文档状态 | ✅已执行 |
| 版本 | 1.19.0 → 1.19.1 |

## 背景

悬浮快捷设置（`SimpleSettingPanel`）长期沿用旧式 `setting-item` 纵向堆叠布局，
面板定位依赖 CSS 占位 `__SIMPLE_SETTING_RIGHT__: -300%`，在导航栏右侧容易溢出或
贴边难看。鼠标从「设置」移入面板时，按钮与面板之间的间隙会立刻触发 `mouseleave`
导致面板闪关。每次 `mouseenter` 都会 `initSimpleSettingForm` 重复 `.on()`，事件
可能叠加。

## 方案

1. **结构重写**：`SimpleSettingPanel` 改为分组卡片布局（列表显示 / 浏览行为 /
   功能 / 页面布局），行式 `标签 + 控件`，底部固定「常见问题 / 更多设置」。
2. **定位与样式**：去掉 `__SIMPLE_SETTING_*__` 占位；面板 `top: calc(100% + 6px)`、
   `right: 0`、固定宽 340px；`::before` 热区桥接移入间隙；圆角/阴影/分区色与
   mini-switch 尺寸约束。
3. **交互**：`mouseleave` 延迟 220ms 再关闭，`mouseenter` 取消定时器；表单绑定
   使用 `.jhsQs` 命名空间 + `off().on()` 防重复绑定；「显示所有已鉴定」开启时
   分项卡片 `is-disabled` 视觉弱化。

表单控件 **id 全部保留**，业务逻辑与 storage 键不变。

## 实施

| 文件 | 变更 |
|------|------|
| `src/components/simple-setting-panel.tsx` | 分组 `jhs-qs-*` 布局重写 |
| `src/styles/setting-plugin.css` | 快捷面板定位 + 内部样式；删占位依赖 |
| `src/plugins/setting-plugin.tsx` | 延迟关闭 / open helper；initCss 只 replace `__CSS_TEXT__`；form 命名空间绑定 |
| `vite.config.ts` | version 1.19.0→1.19.1 |

## 执行验证记录

```
$ npx tsc -b && npx vite build
# 通过；产物 1,920.15 kB / gzip 442.33 kB
# @version 1.19.1
```

## 后续验证建议

1. 悬停导航「设置」：面板在按钮下方右对齐展开，分组清晰可读。
2. 从按钮缓慢移入面板：不闪关；移出后约 0.2s 关闭。
3. 反复进出后切换开关：各设置仍只生效一次（无叠加 handler）。
4. 开启「显示所有已鉴定」：下方 5 个分项灰显且不可点。
5. 「更多设置」打开完整设置弹窗；「触底加载」切换仍即时驱动 AutoPagePlugin。
