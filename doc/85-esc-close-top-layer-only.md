# 85 - ESC 逐级关闭弹层（防一次关全部）

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行

## 背景

doc/84 修复关闭钮后，用户反馈 **ESC 仍一次关掉所有弹层**，无法逐级关闭
（先关二级、再关一级）。

## 根因分析

可能叠加因素：

1. **keydown 自动重复**（`event.repeat`）：按住 ESC 或系统连发，同一物理按键
   连续触发多次 `_handleGlobalEscKey`，每层关一次，体感为「一次全关」
2. **仅依赖 `layerIndexStack` 顺序**：栈与真实 DOM/z-index 不一致时可能关错层
3. **监听重复**：历史上 jQuery bubble + 多处 `setupEscClose` 叠加时，同一次
   keydown 可能进入 handler 多次（doc/84 的 close 出栈不足以挡住同 tick 内连关）

## 方案

重写 `CommonUtil` ESC 关闭逻辑：

| 措施 | 说明 |
|------|------|
| DOM z-index 顶层 | `getTopLayerIndex()` 扫描 `.layui-layer[times]`，跳过 loading/tips，按 z-index 取最顶层 |
| `event.repeat` 忽略 | 系统键盘连发不关第二层 |
| `_escClosing` 锁 | 同一次按键周期只关一层；keyup 解锁 + 400ms 兜底防死锁 |
| 仅捕获阶段 | `document.addEventListener(..., true)`，去掉 jQuery document bubble 双绑定 |
| iframe | 同源 iframe document 同样捕获绑定，共用 handler / 锁 |
| 栈同步 | `syncLayerIndexStack` 剔除已销毁索引；`layer.close` 包装仍出栈 |

## 实施

| 文件 | 变更 |
|------|------|
| `src/core/common-util.ts` | getTopLayerIndex / syncLayerIndexStack / 重写 ESC keydown+keyup |
| `vite.config.ts` | version 1.10.2 → 1.10.3 |

## 执行验证记录

```
bun run build  # tsc -b && vite build
✓ built in 1.17s
dist/monkey-jhs-disassemble.user.js  1,910.93 kB │ gzip: 438.97 kB
```

## 后续验证建议

1. 打开设置 → 再开帮助/WebDav 备份列表 → 按一次 ESC：只关最上层
2. 再按一次 ESC：关闭设置
3. 快速连按 ESC：每次一层，不应一键清空
4. 列表 iframe 视频层：ESC 只关视频层，不连带关其它
