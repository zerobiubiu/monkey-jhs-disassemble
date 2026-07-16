# 120 · 触底加载改为分段按钮

| 项 | 内容 |
|----|------|
| 文档类型 | 🔧开发指导 |
| 文档状态 | ✅已执行 |
| 版本 | 1.19.1 → 1.19.2 |

## 背景

快捷设置里「触底加载」使用原生 `<select>`，在悬浮窄面板中下拉难用、样式
与周围开关不统一，观感差。

## 方案

改为二选一 **分段按钮**（segmented control）：

- 同一行：`触底加载` + `[ 自动 | 点按钮 ]`
- 容器 `#autoPageLoadMode` 用 `data-value` 存当前值
- 点击切换 `is-active`，即时写 `autoPageLoadMode` 并调 `AutoPagePlugin.setLoadMode`

存储键与语义不变：`auto` / `click`。

## 实施

| 文件 | 变更 |
|------|------|
| `src/components/simple-setting-panel.tsx` | select → `jhs-qs-seg` 双按钮 |
| `src/styles/setting-plugin.css` | 分段按钮样式；删 `.jhs-qs-select` |
| `src/plugins/setting-plugin.tsx` | 回填 active + click 绑定 |
| `vite.config.ts` | version 1.19.1→1.19.2 |

## 执行验证记录

```
$ npx tsc -b && npx vite build
# 通过；@version 1.19.2
```

## 后续验证建议

1. 悬停快捷设置：触底加载为两段按钮，当前项高亮蓝底。
2. 点「点按钮」：滑到底出现「点击加载下一页」；点「自动」恢复触底自动加载。
3. 重复点同一段：不重复写 storage / 不闪烁。
