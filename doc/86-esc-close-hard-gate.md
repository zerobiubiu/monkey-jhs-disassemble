# 86 - ESC 逐级关闭硬门修复

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行

## 背景

doc/84 / doc/85 之后用户反馈 **ESC 仍一次关掉全部弹层**。

## 根因（重新定位）

1. **layer 关闭动画**：`layer.close` 在 `anim` 开启时 **200ms 后才从 DOM 移除**，
   此前节点仍在；若 handler 同 tick / 连发再取「顶层」，可能连关或状态错乱。
2. **实例锁不可靠**：`_escClosing` 在实例上；keyup 过早 `false` 后，keydown
   连发可再进 handler。
3. **门闩与「可见顶层」未同步**：关了但未立刻从候选集排除。

## 方案

| 机制 | 说明 |
|------|------|
| 模块级 `escLayerGate` | keydown 成功关一层后 `locked=true`，**keyup Escape 才解锁**（800ms 兜底） |
| 立即摘除顶层 | 调 `layer.close` 前：`data-jhs-esc-closing=1` + `display:none`（层+对应 shade） |
| `getTopLayerEl` | 跳过 loading/tips / 关闭中 / display:none，按 z-index 取顶 |
| `event.repeat` | 忽略系统键盘连发 |
| 捕获阶段单路径 | document keydown/keyup 各绑一次 |

效果：**一次物理按键只关最顶一层**；松手后再按才关下一层。

## 实施

| 文件 | 变更 |
|------|------|
| `src/core/common-util.ts` | escLayerGate + getTopLayerEl + 重写 ESC handler |
| `vite.config.ts` | 1.10.3 → 1.10.4 |

## 执行验证记录

```
bun run build
✓ built in 1.25s
dist/monkey-jhs-disassemble.user.js  1,911.50 kB │ gzip: 439.12 kB
```

## 后续验证（请务必重装脚本）

1. 油猴中确认脚本版本为 **1.10.4**（旧版缓存会导致「怎么改都没用」）
2. 设置 → 打开 WebDav 备份列表（或帮助）→ **按一下 ESC**：只关二级
3. **再按一下 ESC**：关设置
4. 按住 ESC 不松：只应关一层
