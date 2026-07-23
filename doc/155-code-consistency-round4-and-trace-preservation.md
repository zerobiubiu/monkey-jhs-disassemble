# doc/155 — 第四轮代码一致性 + devtools 跟踪日志零偏差保留

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

用户要求「深入研究保证代码结构、代码风格、代码形式上的一致性，架构统一性，
方案完整性，结构正确性」。第三轮（doc/154）覆盖了 5 个核心插件；本轮把同一套
约定推广到**剩余 39 个插件文件**，并修正了一个由审计-执行链路引入的零偏差回归。

## 审计方法（无截断 + 对抗校验）

- 四维并行审计（console / show.error-raw / imports）。**首轮每维 20 条上限静默
  截断**了 console 与 imports 维度（命中 20/20 即停），违反「无静默截断」原则；
  改为**无上限**重审，得到真实表面 **159 处**（console 125 / show.error 4 /
  imports 30，跨 39 文件）。
- 完整发现持久化到 `local://r4-dispatch.md`，按发现数贪心装箱为 4 个**互不相交**
  的编辑组（负载 40/40/40/39），每组只读自己 GROUP 头下的文件与条目。
- 对抗 advisory 在编辑在途时指出零偏差回归（见下），据此做窄范围回退而非全量重做。

## 一致性修复（保留项）

| 维度 | 修复 | 范围 |
|------|------|------|
| 错误处理 | catch 块 `console.error`→`clog.error`（clog.error 同步转发 console.error，devtools 仍可见） | 39 文件全部 error 路径 |
| toast 安全 | `show.error(err)` / `show.error('…' + e)` / `e.message \|\| e` → `… + (e instanceof Error ? e.message : String(e))` | image-recognition / fc2-by-123av / new-video / preview-video / want-and-watched |
| 导入顺序 | 六组约定（外部类型→常量→核心→本地插件→组件→CSS?raw 最后，组间空行） | 30 个违规文件 |
| 死日志 | 移除一次性 `console.log('触发')` 等无诊断价值调试输出 | list-page / missav-quick-copy 等 |
| 重复日志 | 删除与相邻 `clog.error` 重复的 `console.error` | related / review |

`clog` / `show` 均为全局（globals.d.ts），**不新增任何 import**；导入重排只改行序，
不改绑定/路径（tsc `noUnusedLocals` + 未定义名检查为硬安全网）。

## 零偏差修正：devtools 跟踪日志保留（关键架构决策）

### 问题

`logger.tsx` 的 `addLog`（L263-322）**从不写 console**，仅推入页内面板；只有
`error()`（L353）额外 `console.error(...args)`。即 `clog.log`/`clog.warn`/`clog.debug`
**仅面板可见**。这是有意设计，且与原始 `jhs.user.js` 日志器（文件头注 L2365-2762）
的 error-only 转发一致。

集成自独立脚本的模块（doc/45/126 等）使用**有意的 devtools 跟踪体系**：
`${LOG_PREFIX}` / `${LOG}` / `[视频清单标签]` 模板字面量 `console.log/warn`，以及
`%c` 着色日志工厂（car-status-logger、rating-utils）。第四轮把它们机械地改成
`clog.log/warn` 后，这些跟踪**静默地从 devtools 消失**——功能行为变更，违反
AGENTS.md「与原始脚本零偏差」，且 `tsc`/`vite build` **无法捕获**。

### 决策（窄范围回退，非全量重做）

- **回退**：上述跟踪体系的 `clog.log/warn` → `console.log/warn`（机械还原，diff 逐行
  给出）。涉及 vlt-sync / vlt-tags / vlt-reconcile / list-reading-status / page-sort /
  status-tag-filter / list-waterfall / modal-list-disabler / other-site 预加载 /
  missav-quick-copy。
- **保留**：所有 `console.error`→`clog.error`（clog.error 转发 console.error，devtools
  仍可见，零偏差成立）；导入重排；`show.error` 守卫。
- **恢复**：`%c` 着色工厂按 archetype 原样还原——car-status-logger 的
  info/ok/warn/err 用 `console.*` + `%c` 样式串（取自 `archetype/missavStatusTag.user.js`
  L101-130 的配色）；rating-utils 的 `log()` 恢复 `%c[JHS-Rating][action]` +
  `background:#ffc107` 样式串（取自 HEAD）。
- **恢复删除项**：missav-quick-copy 被误删的 4 条 `${LOG}` 跟踪（openInNewTab 触发 /
  模拟单击 / 尝试打开 JavDB 链接 / 按钮已插入）逐字还原；其 catch 的 `clog.error`
  回退为原 `console.log`（原脚本该处即 console.log）。
- **未触碰**：`logger.tsx`。曾考虑给 `log()`/`warn()` 加 console 转发以「一次性」修复，
  被否决：(1) 违背 error-only 的有意设计与原始日志器；(2) 60+ 处既有 `clog.log/warn`
  （gm-http / storage-manager / webdav 等）会开始刷屏 devtools，制造原始从未产生的噪声；
  (3) 为回退 ~70 处机械替换而改最负载的日志模块，本末倒置。
- **other-site 选择性回退**：`PRELOAD_LOG` 跟踪 → `console`；保留 3 处既有的
  `clog.warn('检测第三方资源失败…')`（HEAD 即 clog，非跟踪体系，属项目自有诊断）。

### 分层结论（有意，非不一致）

集成自独立脚本的模块**保留原生 devtools 跟踪**（`console.*` + `%c`）；项目自有代码
**使用面板日志**（`clog`）。这是有意的分层，沿用第三轮先例（彼时也只把
`console.error`→`clog.error`）。未来 agent 不得为「表面一致」把跟踪体系改回 `clog.log/warn`。

## 实施

| 文件 | 操作 |
|------|------|
| 39 个 `src/plugins/**` | 修改：clog.error 统一 / 导入六组 / show.error 守卫 / 死日志移除 |
| 8 个跟踪文件 + other-site | 修改：clog.log/warn → console.log/warn（回退） |
| `src/plugins/car-status-sync/car-status-logger.ts` | 修改：恢复 %c 着色 console.* 工厂 |
| `src/plugins/rating-display/rating-utils.ts` | 修改：恢复 %c 着色 console.log |
| `src/plugins/missav-quick-copy-plugin.ts` | 修改：恢复 4 条 ${LOG} 跟踪 + catch 回退 console.log |
| `src/core/common-util.ts` | 修改：rightClick/copyToClipboard 的 console→clog（post-init 方法体，安全）+ 移除死 cookie dump |
| `src/core/logger.tsx` | **未改动**（error-only 转发为有意设计） |

## 执行验证记录

```
$ bun run build
tsc -b && vite build
✓ 229 modules transformed.
dist/monkey-jhs-disassemble.user.js  2,024.66 kB │ gzip: 467.32 kB
✓ built in 1.21s
```

- tsc 零错误（验证 30 个导入重排无丢失/重复绑定）。
- 逐文件读取确认回退：vlt-sync L220/244、vlt-tags L294、page-sort L222、
  list-waterfall L238 均为 `console.log(`；`clog.error` 保留（vlt-tags L298）。
- 8 个跟踪文件残留 `clog.log/warn` = 0；other-site 残留 `clog.warn` = 3（既有检测项，
  正确保留）。
- `%c` 工厂与 missav `${LOG}` 跟踪经 read 确认逐字还原。

## 后续验证建议

- 浏览器 devtools：清单同步 / 标签刷新 / 排序 / 瀑布流 / 预加载 / MissAV 快速复制的
  `console` 跟踪应重新可见（含 `%c` 着色）。
- 页内 clog 面板：项目自有插件的 `clog.log/warn` 仍入面板；error 同时入面板与 devtools。
