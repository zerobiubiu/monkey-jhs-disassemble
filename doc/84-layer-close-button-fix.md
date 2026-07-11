# 84 - 弹窗右上角关闭按钮 + ESC 只关最上层

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行

## 背景

用户反馈：
1. 设置等 layer 弹窗只能按 ESC 关闭，右上角没有关闭按钮
2. 仅列表内嵌视频页（iframe + shadeClose）可点空白遮罩关闭
3. 打开二级弹窗后再按 ESC，会把所有弹窗一起关掉，不符合预期

## 根因

### 关闭按钮不可见

`layui-layer/layer.css` 含 IE 前缀 hack（`*right`、`_display` 等）。
Vite 使用 lightningcss 压缩时（`errorRecovery: true`）解析失败，**连带丢掉
相邻标准属性**。构建警告可复现：

```
.layui-layer-setwin {
    position: absolute;
    right: 15px;
    *right: 0;   ← Unexpected token，整段定位被吃掉
    top: 15px;
}
```

产物中变成：

```css
.layui-layer-setwin{font-size:0;line-height:initial;top:15px}
/* 丢失 position:absolute; right:15px → 关闭钮不在标题栏右上角 */
```

layer 默认 `closeBtn: 1` 仍会生成 DOM，但位置错乱，用户看不到。

### ESC 关多层

`utils.layerIndexStack` 只在 `setupEscClose` 入栈，经关闭钮 / shade / 代码
`layer.close` 关闭时**未出栈**，栈内残留已销毁索引。再次 ESC 时行为异常；
配合 `layer.closeAll` 路径更易一次清光。

## 方案

| 项 | 做法 |
|----|------|
| CSS 修复 | 新增 `layer-fix.css`，无 IE hack 的标准规则 `!important` 还原 setwin/close1/close2 |
| 默认关闭钮 | `layer.open` 包装：未指定时 `closeBtn: 1` |
| 点遮罩 | type 1/2 未指定时默认 `shadeClose: true`（显式 `false` 如 Top250 登录仍保留） |
| ESC 栈 | `layer.close` / `closeAll` 同步清理栈；ESC 前过滤 DOM 已不存在的索引；只关最上层 |
| 注入时机 | `setupLayerWrapper()` 内 `injectCss(layerFixCss)` |

## 实施

| 文件 | 变更 |
|------|------|
| `src/styles/layer-fix.css` | **新增** setwin/关闭钮定位覆盖 |
| `src/core/layer-wrapper.ts` | 注入 CSS + closeBtn/shadeClose 默认 + close 出栈 |
| `src/core/common-util.ts` | `_handleGlobalEscKey` 剪枝死索引，只 `layer.close` 最上层 |
| `vite.config.ts` | version 1.10.1 → 1.10.2 |

## 执行验证记录

```
bun run build  # tsc -b && vite build
✓ built in 1.23s
dist/monkey-jhs-disassemble.user.js  1,908.91 kB │ gzip: 438.52 kB
```

（layer.css IE hack 的 lightningcss 警告仍存在，由 layer-fix.css 覆盖修复）

## 后续验证建议

1. 打开「设置」→ 标题栏右上角可见 ×，点击仅关闭设置
2. 设置内再开「帮助/备份列表」等二级层 → × 与 ESC 只关最上层，底层仍在
3. 点遮罩半透明区域可关闭 type1/2 弹窗（Top250 登录除外）
4. 列表点封面 iframe 视频页行为不变
