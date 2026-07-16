# 114 - 访问记录悬浮真正实时（hover 重读 + 定时跳动）

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 1. 背景

doc/113 已改自定义 tooltip + 1s 定时器，用户仍反馈「必须刷新页面才能更新
打开时间」。根因不是定时器本身，而是 **注入时闭包固化**：

```ts
const history = this.readHistory(); // 仅页面加载时读一次
const ts = history[path];
if (!ts) return; // 当时未访问 → 永不绑监听
el.addEventListener('mouseenter', () => this.showVisitTooltip(el, ts)); // ts 固化
```

典型失败路径：

1. 详情页加载时某导演尚未访问 → 不绑事件 → 新标签打开导演页再回来，仍无提示
2. 详情页加载时已有旧 ts（如 5 分钟前）→ 新标签再开一次导演页 → 悬浮仍显示
   「5分钟前」，直到刷新详情页

## 2. 方案

| 改动 | 说明 |
|------|------|
| 所有元数据链接都绑 mouseenter | 不在注入时按 history 过滤 |
| **每次 hover 重读 localStorage** | `onEnter` 内 `readHistory()[path]` 取最新 ts |
| 定时器内也重读 path 的 ts | 跨标签刚写过记录时，悬浮中即可更新到「几秒前」 |
| 刷新间隔 500ms | 秒级文案更跟手 |
| pageshow(bfcache) | 前进/后退恢复时补 `recordVisit` + 强制重绑 |

## 3. 实施

| 文件 | 改动 |
|------|------|
| `src/plugins/visit-history-plugin.ts` | inject 改为全链接绑定；hover/tick 重读 history；pageshow；`__jhsVisitEnter` 防重复绑；TICK_MS=500 |
| `vite.config.ts` | version 1.17.1→1.17.2 |
| `doc/README.md` / `changelog/CHANGELOG.md` | 同步 |

## 4. 验证

```bash
$ npx tsc -b && npx vite build   # @version 1.17.2
```

建议：详情页打开 → 新标签打开导演 → 切回详情页（不刷新）→ 悬浮导演链接应
立即显示「X秒前打开过」且每秒跳动；无需 F5。
