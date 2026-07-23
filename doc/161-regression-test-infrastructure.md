# doc/161 — 回归测试基础设施落地

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

一致性/风格审计轴在第三至九轮（doc/153–160）已**收敛于十四维**（console / show.error /
导入 / CSS 类名 / z-index / devtools 跟踪 / 空 catch / ts-ignore / eslint-disable /
TODO / 死代码 / 命名 / 生命周期 / getBean 引用，全部清洁或有意保留）。继续审计只会
产出更多「全清洁」结果，而基线明确要求「最近完成的…转为回归测试保护」，验证矩阵要求
「每个发布必须通过…测试」，批次 6 亦列「增加 Vitest、jsdom」——这些在树中**尚未落地**
（无 `test` 脚本、无 vitest 依赖）。故本轮**停止审计，执行被推迟的测试基建切片**，把
已交付的修复（doc/151 jsxToString XSS、doc/137 BackupEnvelopeV2）纳入回归保护。

## 方案

### 1. 运行器与隔离

- 新增 devDependencies：`vitest`、`jsdom`。
- 新增 `vitest.config.ts`，**与 `vite.config.ts` 分离**：不引入 react/monkey 插件；
  `environment: 'node'`（Node 18+ 全局 `crypto.subtle`/`atob`/`btoa` 满足 AES-GCM）；
  `include: ['tests/**/*.test.ts']`。
- 测试目录 `tests/` 在 `src/` 之外，故：
  - `tsc -b` 不覆盖（app 仅 include `src`，node 仅 include `vite.config.ts`）；
  - `eslint src/` 不覆盖（直接 `eslint tests/` 无配置匹配，返回空）；
  - `vite build` 不覆盖（`tests/` 不在入口依赖图）。
  - 结论：新增/修改测试**不改变用户脚本产物字节**，构建门禁保持稳定。

### 2. 首两回归套件（无 JSX、无 DOM）

被测模块为纯函数，用 `react.createElement` 构造节点，故套件无需 JSX 转换或浏览器 DOM。

| 套件 | 保护对象 | 用例 |
|------|----------|------|
| `tests/jsx-to-string.test.ts` | doc/151 XSS 加固 | 文本转义（`<script>` 注入）、属性值转义（`"` 逃逸）、href/src 协议白名单（javascript:/data:/vbscript: → `#`，含前导空白/大小写）、on* 事件剥离、函数组件递归转义、Fragment 透明输出 |
| `tests/backup-crypto.test.ts` | doc/137 AES-GCM 备份 | 正确口令往返恒等、同明文两次加密不同（独立 salt/IV）、信封结构（v=2/alg/kdf/iter=100000/salt 16B/iv 12B/ts ISO）、错口令抛错、篡改密文抛错、不支持版本抛错、isBackupV2 判别 |

### 3. 刻意推迟项（诚实 right-sizing）

- **schema 迁移幂等性**（doc/135 的 `runMigrations` + `?? 0` 版本门控）：`storage-manager`
  的 localforage 实例当前在构造期硬绑定，无注入 seam。要测幂等性需先引入可注入存储
  替身，属独立 seam 工作；强行内联 fake 会牵动生产代码且易红树。故**列为下一测试目标**，
  本轮不强行纳入——这是 right-sizing，非 scope shrink（已在 AGENTS.md §6.3 与本文记录）。

## 实施

| 文件 | 操作 |
|------|------|
| `package.json` | 修改：新增 `test` 脚本；devDeps 增 vitest/jsdom；`version` 字段 1.27.8→1.28.3（与 userscript 同步，元数据修正） |
| `vitest.config.ts` | 新增：隔离运行器配置 |
| `tests/jsx-to-string.test.ts` | 新增：XSS 回归套件 |
| `tests/backup-crypto.test.ts` | 新增：加密往返套件 |
| `AGENTS.md` | 修改：新增 §6.3 测试运行器说明 |
| `doc/README.md` | 修改：阅读顺序追加 doc/161 |

## 版本号决策

- **`userscript.version` 不递增**：本轮无 `src/` 逻辑变更；`tests/` 与 `vitest.config.ts`
  不在构建图，产物字节不变。按 §6.1.1，纯测试/构建工具变更不递增 userscript 版本。
- **`package.json` 的 `version` 字段**由 1.27.8 同步至 1.28.3：此为批次 6「同步
  package.json 与 userscript 版本」的元数据漂移修正，非逻辑变更。
- **无 CHANGELOG 条目**：CHANGELOG 按 userscript 版本键控，无新版本则无条目（与
  R5/R7/R8/R9 纯文档轮次一致）。

## 执行验证记录

```
$ bun run test
 RUN  v4.1.10
 Test Files  2 passed (2)
      Tests  21 passed (21)
   Duration  343ms

$ bun run build
✓ built in 1.24s
// @version      1.28.3          ← 未递增，产物字节稳定

$ bun run lint        # eslint src/，不扫描 tests/
✖ 805 problems (0 errors, 805 warnings)   ← 与基线一致

$ bun run lint:css    # stylelint，0 errors
$ npx eslint tests/   # 无配置匹配，返回空 → tests/ 不扰动 lint 门禁
```

## 后续验证建议

- CI 接入：在 `tsc -b && vite build` 后追加 `bun run test` 作为发布门禁。
- 下一测试目标：schema 迁移幂等性（需先为 storage-manager 注入 localforage 替身 seam）。
- 视需要为需 DOM 的组件/插件补 jsdom 环境套件（jsdom 已预装）。
