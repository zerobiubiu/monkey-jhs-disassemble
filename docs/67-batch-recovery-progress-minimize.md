# 批量恢复进度最小化

> **文档类型**：🧾 变更记录
> **文档状态**：✅ 已执行
> **影响范围**：批量评价与清单的恢复进度界面
> **前置文档**：[66-batch-video-concurrency-and-multi-lists.md](66-batch-video-concurrency-and-multi-lists.md)
> **生效版本**：v1.49.4

## 1. 背景

自动恢复未完成的批量任务会打开原生模态进度窗口，执行期间阻挡主页面浏览。需要允许恢复进度收起为悬浮按钮，同时保持任务执行、实时计数和结束提醒。主动打开「批量设置评价与清单」的窗口不提供此功能。

## 2. 方案与行为

- 权限固定于窗口入口：`runBatchListProgress` 创建的独立恢复窗口允许最小化；`openBatchListDialog` 的选择、开始、继续和重试均不改变其不可最小化属性。
- 最小化调用原生 `dialog.close()`，退出模态层，释放遮罩与页面焦点限制；保留同一窗口、执行回调、进度及关闭等待 Promise，不发出停止信号。
- 最小化期间跳过窗口级 Escape 拦截，不因进度刷新或任务结束抢走页面焦点。运行期间仍保留离页提示；关闭页面后不能持续执行。
- 悬浮按钮固定于页面右下方、底部选择栏上方，显示处理数与当前状态。点击按钮展开同一窗口，不重新执行任务。
- 最小化期间再次点击主页面的批量设置入口，会展开已有恢复窗口，不新建任务或重新加载清单，避免入口被点击后没有可见反馈。
- 本轮执行结束时，若处于最小化状态，按钮以 1.6 秒周期闪烁提醒；展开后清除提醒。系统开启减少动态效果时禁用循环动画，保留静态强调及结果文字。
- 展开与最小化共用状态判定，区分同步完成、仍有项目待完成、已停止，失败、评价待确认或异常不会显示为全部成功。
- 通过计数消费最小化产生的异步 `close` 事件，覆盖快速收起后立即展开的时序；真正关闭结果窗口才移除按钮、监听器并完成窗口生命周期。
- 执行器、任务日志、跨页执行锁、停止与恢复规则保持原实现，执行锁仍在任务结算时释放。

## 3. 实施文件

| 文件 | 改动 |
|---|---|
| `src/plugins/list-page/batch-lists/dialog.tsx` | 最小化权限、收起/展开生命周期、关闭事件区分、悬浮进度更新与焦点保护 |
| `src/components/list-page/batch-lists-dialog.tsx` | 最小化入口、悬浮按钮 JSX、共享结果状态判定 |
| `src/styles/list-page/batch-lists.css` | 标题布局、悬浮按钮、结束提醒、减动样式 |
| `tests/batch-lists-ui.test.ts` | 主动窗口禁用、后台执行及交互、延迟关闭事件、结果提醒与异常回归 |
| `AGENTS.md`、`README.md`、`GREASYFORK.md`、`docs/plugin-catalog.md` | 同步架构与当前用户行为说明 |
| `package.json`、`vite.config.ts`、`CHANGELOG.md`、`docs/README.md` | 两处版本、更新日志与文档索引 |

触及源码文件均低于 500 行，无新增源文件、目录、插件、依赖或结构棘轮调整，无需拆分。

## 4. 后续验证建议

安装新构建产物后，在少量真实任务的中断恢复过程中核对最小化、页面筛选与其他弹窗交互、结束提醒及展开结果。实际账户的网络和 Tampermonkey 沙箱仍需用户现场确认。

## 5. 执行验证记录

### 执行环境

Windows / PowerShell，使用项目已有 Bun、TypeScript、Vite、Vitest、ESLint、Stylelint 与本机浏览器工具。未安装依赖，未向真实网站发送写请求，未提交或推送 Git。

### 命令、实际输出与结论

| 命令 | 实际输出或关键摘录 | 退出码 / 结论 |
|---|---|---|
| `bun run test tests/batch-lists-ui.test.ts` | 最初 `26 passed (26)`，补齐已有窗口入口后 `1 passed (1)`；`28 passed (28)` | 0，通过 |
| `bun run test` | 最初 `924 passed (924)`，最终 `75 passed (75)`；`926 passed (926)` | 0，通过 |
| `bun run build`（源码完成后） | `462 modules transformed`；`1,425.26 kB / gzip 365.47 kB` | 0，通过 |
| `bun run build`（版本同步后） | `462 modules transformed`；`1,425.26 kB / gzip 365.48 kB` | 0，通过 |
| `bun run build`（入口展开修正后最终验证） | `462 modules transformed`；`1,425.44 kB / gzip 365.53 kB` | 0，通过 |
| `bun run lint` | 无告警 | 0，通过 |
| `bun run lint:css` | 无告警 | 0，通过 |
| `bun run check:structure` | `OK (420 files, 69 dirs within limits; 0 file-ceilings, 3 dir-ceilings in ratchet)` | 0，通过 |
| `bun run check:docs` | `OK (43 plugins [5 flagged], 69 core files)` | 0，通过 |
| `bun run check:version` | `OK (userscript 1.49.4 = package.json 1.49.4)` | 0，通过 |
| `rg -n '@version' dist/monkey-jhs-disassemble.user.js` | `4:// @version      1.49.4` | 0，产物版本一致 |
| `impeccable.cmd detect --json src/components/list-page/batch-lists-dialog.tsx src/plugins/list-page/batch-lists/dialog.tsx src/styles/list-page/batch-lists.css` | `[]` | 0，无检测项 |
| `git diff --check` | 无输出 | 0，通过 |

构建输出包含第三方 layer.css 既有 IE hack 的 `Unexpected token Semicolon` 容错警告，构建成功，不修改第三方样式。

### 前端调用与已知限制

jsdom 覆盖任务继续、停止信号不变、页面点击与焦点、Escape 放行、离页提示、窗口单例、最终清理，以及异步 close 事件迟到时的快速收起/展开。成功、部分失败、评价待确认、停止和异常均有回归。

浏览器使用 `bun run tests/browser/batch-lists-ui.ts` 提供的 `127.0.0.1:4178` 隔离预览；真实组件、控制器和 CSS 搭配内存执行器，不读取账户或 GM 数据。最终源码重启预览后通过 Ego Browser 复验：

| 场景 | 实际观测 |
|---|---|
| 主动入口 | 选择与执行窗口均无最小化按钮 |
| 最小化释放模态 | 原生 dialog `open=false` 且不再匹配 `:modal`；主页面真实点击计数 1，Escape 到达页面 |
| 后台执行与焦点 | 进度由 2/5 继续到 5/5，焦点留在页面验证按钮，完成不抢焦点 |
| 主入口与快速展开 | 主入口展开原标记为 `latest` 的同一窗口，仅一个 dialog；同一 tick 收起再展开仍执行中 |
| 结束提醒 | 悬浮按钮具有 `is-unread` 与 `jhs-batch-result-flash` 动画，关键帧为雾蓝 `rgb(232,238,246)` 与白色 |
| 窄屏与减动 | 390×844 下浮钮 108×80，完全在屏内；文档 scrollWidth=390，展开窗口宽358、左右16；减动模式 animation=`none` |
| 展开及清理 | 展开仍为同一窗口、进度值5，未读提醒清除；最终原生 close 事件后 dialog 与悬浮按钮数量均为0 |

TaskSpace 8 已通过 `finish({keep:[]})` 关闭，隔离预览服务已停止；验证脚本保存在被 Git 忽略的 `preview/batch-minimize-20261105/`。

截图接口及一次 CDP 回退均遇到 `Page.captureScreenshot` 超时，未获得截图；浏览器证据为真实交互、DOM、布局尺寸与动画关键帧，不声称完成像素视觉验收。未安装构建脚本，也未验证真实网站/Tampermonkey 端到端写入。

当前会话未暴露 AOCI 工具，无法取得 `aoci_rules` / `aoci_overview` 或执行 `aoci_maintain`；未修改或声称已同步 AOCI 索引。本次实现依据实际源码、现状文档与执行验证。
