# 32 - 修复 CSS 布局问题（toast 超宽 + 设置面板按钮贴连）

- **文档类型**: 🔧开发指导
- **文档状态**: ✅已执行
- **关联文件**: `src/styles/common-toolbar.css`、`src/components/setting-dialog.tsx`

## 1. 问题描述

用户反馈两个 CSS 布局问题：

### 问题 A：toast 通知超宽
点击收藏/已观看等操作后弹出的 toast 通知宽度异常（937px），
正常应为自适应内容宽度（约 200px）。

### 问题 B：设置面板按钮贴连
设置 → 数据备份面板中，"查看备份"与"备份数据"两个按钮间距 0px，
"导入数据"与"导出数据"按钮同样贴连，正常应有约 4px 间距。

## 2. 根因分析

### 问题 A 根因：lightningcss 删除 fit-content

toastify-js 源 CSS `src/toastify.css` 中 `.toastify-center` 有两行：
```css
max-width: fit-content;
max-width: -moz-fit-content;
```

Vite 的 lightningcss CSS 压缩器在处理时**删除了标准的 `fit-content`**，
只保留了 `-moz-fit-content`（Firefox 前缀）。Chrome 不认 `-moz-` 前缀，
`max-width` 失效，toast 退回 `.toastify` 的 `max-width: calc(50% - 20px)`
（视口 50% ≈ 937px），导致 toast 超宽。

dist 产物中实际输出：
```css
.toastify-center{max-width:-moz-fit-content;...}
```

### 问题 B 根因：jsxToString 丢失 inline-block 空白

`jsxToString` 的 `renderChildren` 处理数组时用 `join('')` 拼接：
```js
if (Array.isArray(children)) return children.map(c => renderChildren(c)).join('');
```

两个 `<a class="menu-btn">` 元素在数组中相邻，`join('')` 输出
`<a>...</a><a>...</a>`，中间**无空白字符**。

而 archetype 原版 HTML 模板中两按钮间有 `\n` + 缩进空白：
```html
<a>查看备份</a>\n                                    <a>备份数据</a>
```

`inline-block` 元素之间的空白会被浏览器渲染为约 4px 间距。
`jsxToString` 丢失了这个空白 → 间距变 0px。

**注**：`DetailMenuButtons`（详情页顶部按钮组）不受影响，因为其
父容器是 `display: flex; gap: 10px`，flex + gap 提供间距，不依赖
空白字符。`SubtitleActionCell` 也不受影响，因为显式写了 `{" "}`。

## 3. 修改方案

### 修复 A：toast 超宽

在 `src/styles/common-toolbar.css` 末尾（`/*__SCROLLBAR__*/` 占位前）
添加覆盖规则：
```css
.toastify-center {
    max-width: fit-content !important;
}
```

`!important` 确保 `common-toolbar.css`（后注入，通过 `?raw` 不经
lightningcss 处理）覆盖 toastify CSS（先注入，经 lightningcss 处理）。
`common-toolbar.css` 通过 `?raw` 加载为原始字符串，不经 lightningcss，
`fit-content` 保留原样。

### 修复 B：设置面板按钮贴连

在 `src/components/setting-dialog.tsx` 的 `SettingDialog` 组件中，
在两处相邻 `menu-btn` 按钮间显式添加 `{' '}`（JSX 空格文本节点）：

1. 导入数据 / 导出数据按钮间
2. 查看备份 / 备份数据按钮间

```tsx
<a id="importBtn" ...>导入数据</a>{' '}
<a id="exportBtn" ...>导出数据</a>
```

`{' '}` 经 SWC 编译为 children 数组中的 `" "` 字符串，`jsxToString`
的 `renderChildren` 正确输出空格，恢复 `inline-block` 间距。

## 4. 验证

### 构建验证
```
tsc -b        # exit 0
vite build   # built in 1.01s, 产物 1705.48 kB (gzip 406.40 kB)
```

### dist 产物验证
- `.toastify-center { max-width: fit-content !important; }` 存在 ✓
- 导入/导出按钮间有 `" "` 文本节点 ✓

### 运行时验证（页面注入测试）
**toast 修复**：在页面注入 `.toastify-center { max-width: fit-content !important; }`
后触发 toast：
- `maxWidth: fit-content` ✓（之前 `calc(50% - 20px)`）
- `width: 222.2px` ✓（之前 937px）

**按钮间距**：dist 产物中导入/导出按钮间有 `" "` 空格，
`inline-block` 布局下浏览器渲染约 4px 间距（与 archetype 一致）。

## 5. 注意事项

### lightningcss 的 fit-content 问题
lightningcss 将 `fit-content` + `-moz-fit-content` 两行合并为只保留
`-moz-fit-content`，这在 Chrome 中无效。这是 lightningcss 的行为
（可能误认为 `-moz-` 前缀版本更兼容）。本项目通过 `!important` 覆盖
绕过，不修改 lightningcss 配置。

### jsxToString 空白丢失的系统性影响
`jsxToString` 的 `renderChildren` 用 `join('')` 拼接数组，丢失
`inline-block` 元素间的空白。所有通过 `jsxToString` 渲染的组件，
如果 `inline-block` 元素在数组中相邻且无显式 `{" "}`，间距都会丢失。

本次仅修复了用户反馈的 `SettingDialog` 两处。其他组件（如
`HistoryActionButtons`、`CacheItemHtml` 等）的按钮使用了 `flex` 布局
或 `margin` 提供间距，不受影响。如后续发现其他 `inline-block` 按钮
贴连问题，同法添加 `{' '}` 即可。
