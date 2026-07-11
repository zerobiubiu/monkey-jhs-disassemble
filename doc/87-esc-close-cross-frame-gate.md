# 87 - ESC 逐级关闭 iframe 内层优先修复（最终）

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行
> **执行日期**：2026-07-12

## 1. 背景

doc/84、doc/85、doc/86、doc/87 初版（1.10.5）、doc/87 二版（1.10.6）、doc/87 三版（1.10.7 诊断版）共六次尝试修复"ESC 一次关掉所有弹层"，均未成功。本次为最终修复。

## 2. 诊断过程与根因演进

### doc/85（1.10.3）

怀疑 `event.repeat` 连发 + getTopLayerIndex 取错层。加 `event.repeat` 忽略 + DOM z-index 顶层 + `_escClosing` 实例锁。**未命中**。

### doc/86（1.10.4）

怀疑实例锁不可靠 + layer 关闭动画 DOM 仍在。改模块级 `escLayerGate` + 立即 `display:none` + 800ms 兜底。**未命中**。

### doc/87 初版（1.10.5）

怀疑 gate 每 frame 一份不互斥，挂 `unsafeWindow.__jhsEscGate`。实测 `gateIsTopGate=false`（Tampermonkey 中每 frame 的 `unsafeWindow` 指向自己 window）。**未命中**。

### doc/87 二版（1.10.6）

改 `window.top.__jhsEscGate`——实测 `topGateShared=true`，gate 确实共享了。**仍未命中**：ESC 仍一次关两层。

### doc/87 三版（1.10.7 诊断版）

在 `_handleGlobalEscKey` 内嵌 `console.log` 诊断，让用户重装脚本后实测。诊断输出：

```
[JHS-ESC-DIAG] { frame: TOP, gateLockedBefore: false, layersInThisDoc: 1, stackInThisFrame: [1], eventTarget: BODY }
[JHS-ESC-DIAG] CLOSING layer 1 in frame TOP
[JHS-ESC-DIAG] KEYUP — releasing gate
```

**真根因终于暴露**：

1. ESC 只触发了一次，只有 **TOP frame 的 handler 被调用**，iframe frame handler **根本没跑**
2. `eventTarget: BODY`——ESC 的 target 是外层 body，**焦点不在 iframe 内**
3. 外层 handler 找到最顶层 `.layui-layer`——是 `type=iframe` 弹层（详情页 iframe），直接关掉它
4. **iframe 弹层被关 → iframe DOM 销毁 → iframe 里的磁力搜索二级弹层跟随消失**

本质：**只关了一层（layer 1 = 外层 iframe 弹层），但关的是外层 iframe 弹层而非 iframe 内更内层的二级弹层**。因为 iframe 内弹层在 iframe document 里，外层 document 的 `getTopLayerEl` 查不到它。关掉 iframe 弹层后 iframe 销毁，内层弹层跟着没了，体感"一次关全部"。

**关键约束**：iframe document 是独立事件目标，父 document 的 keydown 事件**不会自动传递到 iframe contentDocument**。所以 iframe 内 handler 不会自然被触发——即使 `setupEscClose` 给 iframe contentDocument 绑了 handler。

## 3. 最终方案（1.10.8）

外层 handler 检测到顶层是 `type=iframe` 弹层时：

1. 检查 iframe `contentDocument` 内是否有可见的 `.layui-layer`（内层弹层，跳过 loading/tips/关闭中/隐藏）
2. 若**有内层弹层**：
   - 释放 gate（`escLayerGate.release()`）
   - 主动向 iframe `contentDocument` `dispatchEvent` 一个 ESC `KeyboardEvent`（`composed: true`）
   - iframe 内 handler 收到 ESC → `tryEnter` 成功（gate 已释放）→ `getTopLayerEl` 在 iframe document 找到内层弹层 → 关掉它
   - iframe handler 的 800ms `setTimeout` 兜底释放 gate
   - 外层 handler `return`（不关外层 iframe 弹层）
3. 若**无内层弹层**：正常关外层 iframe 弹层

这样，ESC 优先关 iframe 内最内层弹层（磁力搜索二级），再按一次才关外层 iframe 弹层（详情页），逐级关闭成立。

### 互斥保证

- 外层 handler 先 `tryEnter` 锁住 gate → 释放 → dispatch 到 iframe
- iframe handler `tryEnter` 成功（gate 已释放）→ 关内层 → 800ms 后释放
- 同一次按键不会重复 `tryEnter`（外层已 return，iframe 只 dispatch 一次）
- gate 共享 `window.top.__jhsEscGate`，跨 frame 互斥可靠

## 4. 实施

| 文件 | 变更 |
|---|---|
| `src/core/common-util.ts` | `_handleGlobalEscKey` 新增 iframe 内层弹层检测 + 向 iframe contentDocument dispatch ESC keydown + 诊断日志移除 |
| `vite.config.ts` | version 1.10.7 → 1.10.8 |

### 代码片段

```ts
// iframe 内有弹层 → 释放 gate + dispatch ESC 到 iframe contentDocument
if (hasInnerLayer) {
    const iframeEl = topEl.querySelector(`#layui-layer-iframe${layerIdx}`);
    if (iframeEl?.contentDocument) {
        try {
            escLayerGate.release();
            const innerEvt = new KeyboardEvent('keydown', {
                key: 'Escape', keyCode: 27, which: 27,
                bubbles: true, cancelable: true, composed: true
            });
            iframeEl.contentDocument.dispatchEvent(innerEvt);
            window.setTimeout(() => escLayerGate.release(), 100);
            return;
        } catch {
            escLayerGate.release();
            return;
        }
    }
    escLayerGate.release();
    return;
}
```

## 5. 执行验证记录

```
$ bun run build   # tsc -b && vite build
✓ built in 1.18s
dist/monkey-jhs-disassemble.user.js  @version 1.10.8
```

## 6. 后续验证建议（请务必重装脚本到 1.10.8）

1. 列表页点击封面打开详情 iframe 弹层
2. 在 iframe 内点击 `#magnetSearchBtn` 打开磁力搜索二级弹层
3. **按一次 ESC**：应该只关磁力搜索二级弹层，详情 iframe 弹层保留
4. **再按一次 ESC**：关详情 iframe 弹层
5. 长按 ESC 不松：只关一层

## 7. 与前几次修复的关系

| 版本 | 修复 | 保留 / 撤销 |
|---|---|---|
| doc/85 (1.10.3) | `event.repeat` 忽略 + getTopLayerEl | **保留**（防连发基础） |
| doc/86 (1.10.4) | 模块级 `escLayerGate` + 立即 `display:none` | **保留**（防动画期重入） |
| doc/87 初版 (1.10.5) | `unsafeWindow.__jhsEscGate` | **撤销**（每 frame 独立无效） |
| doc/87 二版 (1.10.6) | `window.top.__jhsEscGate` | **保留**（gate 跨 frame 共享） |
| doc/87 三版 (1.10.7) | 诊断日志 | **已撤销**（移除） |
| doc/87 最终 (1.10.8) | iframe 内层弹层检测 + dispatch ESC | **本次新增** |

本次真正命中根因：**ESC 只触发外层 handler、只关了外层 iframe 弹层（连带 iframe 内弹层销毁）**，而非"handler 重复触发关了两层"。修复方式：外层 handler 检测 iframe 内有弹层时，不关外层，dispatch ESC 到 iframe 让内层 handler 关内层弹层。