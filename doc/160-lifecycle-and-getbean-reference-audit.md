# doc/160 — 生命周期与 getBean 引用审计

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

验证矩阵要求「关闭功能后零永久轮询；未激活插件零 Observer、定时器和 CSS」。
第三至八轮（doc/153–159）闭合了十二维结构正确性审计。本轮补充审计两个
**运行时正确性**维度：事件监听器/定时器/观察器的生命周期清理，以及跨插件
`getBean()` 引用的有效性。

## 审计结果

### 1. 生命周期清理

| 资源类型 | 全树结果 | 说明 |
|----------|----------|------|
| `addEventListener` 无清理 | **0 泄漏** | DOM 元素上的监听器随元素 GC 回收；`document`/`window` 上的监听器为页面生命周期级（userscript 无卸载场景，有意保留） |
| `setInterval` 无清理 | **0 泄漏** | 全部由 `TaskSupervisor` 管理或已注释 |
| `setTimeout` 无清理 | **0 泄漏** | 全部为一次性 UI 延迟（动画弹跳 300ms / DOM 就绪等待 200-400ms / 防抖），无需清理 |
| `MutationObserver` 无 disconnect | **0 泄漏** | 全部由 `TaskSupervisor.observe()` 管理，插件销毁时自动 disconnect |

**结论**：验证矩阵「关闭功能后零永久轮询」条件满足。所有持续性资源
（Observer / 周期定时器）均受 supervisor 管理；一次性资源（setTimeout /
DOM 元素监听器）无需显式清理。

### 2. getBean 引用有效性

| 指标 | 结果 |
|------|------|
| 注册插件数 | **40** |
| getBean 调用目标 | 全部解析到已注册插件名 |
| 唯一例外 | `Beyond60Plugin`——**从未注册**，代码注释明确标注「忠实死路径」，使用可选链 `?.` 保护，`getBean` 返回 `undefined` 时安全跳过 |

**Beyond60Plugin 死路径说明**：原始 `jhs.user.js` 中存在超过 60 页时走
Beyond60Plugin 合并请求的逻辑分支，但该插件从未被实例化注册。本项目忠实
保留此死路径（零偏差原则），通过可选链确保运行时不抛异常。

### getBean 引用映射

| 调用方 | 目标 | 已注册 |
|--------|------|--------|
| auto-page-plugin | ListPagePlugin, Beyond60Plugin | ✅ / ⚠️ 死路径 |
| blacklist-plugin | ListPagePlugin, Beyond60Plugin | ✅ / ⚠️ 死路径 |
| detail-page-button-plugin | HighlightMagnetPlugin, MagnetHubPlugin, ListPagePlugin | ✅ |
| fc2-by-123av-plugin | MagnetHubPlugin, TranslatePlugin, ScreenShotPlugin | ✅ |
| fc2-plugin | Fc2By123AvPlugin, DetailPageButtonPlugin, MagnetHubPlugin, OtherSitePlugin, ReviewPlugin, RelatedPlugin, TranslatePlugin, ScreenShotPlugin | ✅ |
| history-plugin | ListPagePlugin, Fc2Plugin | ✅ |
| list-page-button-plugin | NewVideoPlugin, BlacklistPlugin, ListPagePlugin, Fc2Plugin | ✅ |
| other-site-plugin | ListPagePlugin | ✅ |
| vlt-sync | DetailPageButtonPlugin | ✅ |

## 全树审计闭合状态（十四维）

| 维度 | 轮次 | 状态 |
|------|------|------|
| console→clog 错误统一 | R3+R4 | ✅ |
| show.error instanceof 守卫 | R3+R4 | ✅ |
| 导入六组顺序 | R3+R4+R5+R6 | ✅ |
| CSS 类名前缀 | R3 | ✅ |
| z-index 令牌 | R3 | ✅ |
| devtools 跟踪保留 | R4 | ✅ |
| 空 catch 块分类 | R7→R8 | ✅ (17 有意) |
| @ts-ignore / @ts-expect-error | R7 | ✅ (0) |
| eslint-disable 抑制 | R7 | ✅ (0 block) |
| TODO / FIXME / HACK | R8 | ✅ (0) |
| 死代码 / 注释代码块 | R8 | ✅ (0) |
| 命名约定 | R8 | ✅ (9 有意) |
| 生命周期清理 | **R9** | ✅ (0 泄漏) |
| getBean 引用有效性 | **R9** | ✅ (1 死路径有意) |

## 版本号决策

本轮**无 src/ 变更**。按 §6.1.1，**不递增版本号**，**不写 CHANGELOG 条目**。

## 实施

| 文件 | 操作 |
|------|------|
| `doc/README.md` | 修改：阅读顺序追加 doc/160 |

## 执行验证记录

```
$ bun run build
tsc -b && vite build
✓ 229 modules transformed.
dist/monkey-jhs-disassemble.user.js  2,024.66 kB │ gzip: 467.32 kB
✓ built in 1.21s
```

tsc 零错误。产物大小不变。`@version` 仍为 1.28.3（未递增）。
