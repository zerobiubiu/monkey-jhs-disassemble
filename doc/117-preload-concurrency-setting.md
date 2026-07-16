# 117 - 预加载并发数配置

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 1. 背景

预加载配置面板已有开关/防抖/TTL/站点，但请求调度固定串行（AsyncTaskQueue
concurrency=1），大列表预加载偏慢。用户要求设置中增加并发控制。

## 2. 方案

### 2.1 AsyncTaskQueue 支持 N 并发

重写 `src/core/async-task-queue.ts`：

- `constructor(concurrency=1)` / `setConcurrency(n)`
- 内部 `running` + `pending` 信号量调度
- `addTask` 行为：满并发则入队等待，完成后再 `pump`
- 单任务 catch 记 clog，不中断队列（与原版一致）
- `waitAllFinished`：空闲时 resolve

concurrency=1 时语义等价原串行。

### 2.2 设置项 `preloadConcurrency`

| 项 | 默认 | 范围 | 说明 |
|----|------|------|------|
| `preloadConcurrency` | 1 | 1–10 | 同时预加载请求数；1 最稳，增大加快但易 Cloudflare |

- 设置面板「预加载配置」新增数字输入 + data-tip
- loadForm / saveForm 读写
- OtherSitePlugin.handle 读取后 `preloadQueue.setConcurrency(...)`

## 3. 实施

| 文件 | 改动 |
|------|------|
| `src/core/async-task-queue.ts` | 串行 → 可配置并发 |
| `src/plugins/other-site-plugin.tsx` | 读 preloadConcurrency 并 setConcurrency |
| `src/components/setting-dialog.tsx` | 预加载面板加并发数输入 |
| `src/plugins/setting-plugin.tsx` | loadForm/saveForm |
| `vite.config.ts` | 1.18.0→1.18.1 |
| `doc/README.md` / `changelog/CHANGELOG.md` | 同步 |

## 4. 验证

```bash
$ npx tsc -b && npx vite build   # @version 1.18.1
```

建议：并发设 3 → 列表页预加载时筛选栏「请求中」可同时出现多条；若 Cloudflare
频繁拦截则降回 1–2。
