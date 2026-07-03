# 05 - legacy 残留辅助代码提取到 core

**文档类型**：🔧开发指导
**文档状态**：✅已执行

## 1. 背景

legacy（`src/legacy/jhs.ts`，原 573 行）在插件/CSS/常量陆续外置后，仍残留三组
与启动序列无关的可复用辅助代码。本次将它们提取为正式 core 模块，legacy 仅保留
启动序列与 CSS replace 胶水。

## 2. 提取清单

| 残留代码 | 原 legacy 位置 | 目标模块 | 导出 |
|----------|----------------|----------|------|
| `layer.open`/`layer.close` 包装（`ut`/`ft`，关闭后恢复 overflow、open 后挂 ESC） | 原 L474-495 | `src/core/layer-wrapper.ts` | `setupLayerWrapper()` |
| Tooltip 定位核心 `function e` + 注入样式 + hover 事件 IIFE | 原 L312-441 | `src/core/tooltip.ts` | `positionTooltip()` / `setupTooltip()` |
| WebDav 加密辅助 `Me`/`Ne` + salt `Le` | 原 L450-470 | `src/core/webdav-crypto.ts` | `Me` / `Ne` / `Le` |

### 2.1 未提取说明

- `const me = "jhs_appAuthorization"`：legacy 内定义后未被引用（死代码），
  `constants/api.ts` 与 `plugins/top250-plugin.ts` 各自保留同名常量，故直接删除。
- `const G = new BroadcastChannel("channel-refresh")` + `window.refresh`/
  `cleanCache_*`：属启动序列的全局函数挂载（与 `utils`/`storageManager` 等同性质），
  与启动耦合，提取收益小，保留在 legacy。

## 3. 修改方案

### 3.1 新建 `src/core/layer-wrapper.ts`

- `resetOverflowByShadeCount(delay=10)`：延迟依据 `.layui-layer-shade` 计数恢复
  `documentElement.style.overflow`（原 layer.close 内联 IIFE 的等价独立实现）。
- `setupLayerWrapper()`：保存原 `layer.close`/`layer.open`，替换为包装版。
  控制流与原脚本一致：close 先调原实现再重置 overflow；open 先保存原 success，
  新 success 先执行原 success 再 `utils.setupEscClose(index)`。

### 3.2 新建 `src/core/tooltip.ts`

- `TooltipableElement`（extends HTMLElement，挂 `tooltipElement`/`hoverTimeout`）、
  `TooltipDirection` 类型。
- `createTooltipElement(content)`：原 IIFE 内匿名工厂，建 `.js-tooltip` 并 append body。
- `positionTooltip(element, content, direction)`：原 `function e`。量取尺寸 → 依方向
  计算坐标 → 空间不足且对侧容纳时翻转 → 视口夹紧 → 写 left/top + is-active。
  `left`/`top` 保留 `number | undefined`（与原 `let l; let c;` 等价，模板字符串
  `${left}px` 在未赋值时得 `"undefinedpx"`，行为与原一致）。
- `setupTooltip()`：注入 `TOOLTIP_CSS`，绑定 document mouseover/mouseout。
  mouseover 命中 `[data-tip-*]` 延迟 50ms 显示；mouseout 清 timeout、离目标移除。

### 3.3 新建 `src/core/webdav-crypto.ts`

- 导出 `Le`（salt 常量）、`Me`（码点 +5 加密）、`Ne`（码点 -5 解密 + 去 salt）。
  `codePointAt(0)!` 非空断言（保留原 NaN 时 `String.fromCodePoint` 抛 RangeError 行为）。

### 3.4 legacy 调整

- 顶部 import：`setupLayerWrapper` / `setupTooltip` / `Me, Ne`。
- tooltip IIFE → `setupTooltip();`
- webdav 定义块 → 仅保留 `unsafeWindow.Me = window.Me = Me;` / `unsafeWindow.Ne = ...`
  挂载（Me/Ne 由 import 提供，setting-plugin 仍以 `(window as any).Me/.Ne` 访问）。
- layer 包装块 → `setupLayerWrapper();`

## 4. 执行验证记录

### 4.1 构建

```
$ pnpm run build
$ tsc -b && vite build
✓ 51 modules transformed.
dist/monkey-jhs-disassemble.user.js  462.66 kB │ gzip: 113.30 kB
✓ built in 268ms
```

`tsc -b` 通过 strict + noUnusedLocals + noUnusedParameters + noFallthroughCasesInSwitch；
`vite build` 成功出包。

### 4.2 提交

```
68f7ff1 (HEAD -> master) 提取 legacy 残留辅助代码到 core
 4 files changed, 308 insertions(+), 173 deletions(-)
 create mode 100644 src/core/layer-wrapper.ts
 create mode 100644 src/core/tooltip.ts
 create mode 100644 src/core/webdav-crypto.ts
```

### 4.3 行数变化

- legacy：573 → 405 行（-168）
- 新增 core：layer-wrapper 56 行 / tooltip 178 行 / webdav-crypto 38 行
