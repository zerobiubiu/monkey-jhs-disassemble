# 集成完成检查清单

转换完成后逐项核对，全部 ✅ 才算完成。

## 代码层面

- [ ] 插件类继承 `BasePlugin`，实现 `getName()`/`initCss()`/`handle()` 三方法
- [ ] `getName()` 返回 `'XxxPlugin'`（与 main.tsx 注册名一致）
- [ ] `initCss()` 返回 CSS 字符串（`?raw` import），不引入 `GM_addStyle`
- [ ] `handle()` 主逻辑与原脚本零偏差（除非明确标注为行为改进）
- [ ] 文件头注释：来源（`archetype/X.user.js` 行号）+ 功能 + 集成方式
- [ ] 每个方法有 doc-comment：用途、参数、返回值、对应原脚本行号
- [ ] 所有注释用简体中文
- [ ] 无 `@ts-nocheck`（项目已全量去除）
- [ ] TS 类型完整，无 `any` 泛滥（GM_* API 的 `any` 除外，那是 globals.d.ts 既定）

## GM_* grant

- [ ] 原脚本用到的每个 GM_* API 都在 `vite.config.ts` 的 `grant` 数组中
- [ ] 每个 GM_* API 都在 `src/types/globals.d.ts` 有 `declare const GM_xxx: any;`
- [ ] 未引入 `GM_addStyle`（改走 initCss）

## main.tsx 注册

- [ ] `import { XxxPlugin } from './plugins/xxx-plugin'` 顶部导入
- [ ] `if (isJavdbSite)` 块内 `manager.register(XxxPlugin)`
- [ ] 顶部注释 "注册 N 插件" → "注册 N+1 插件"
- [ ] 注册顺序：放在现有插件末尾（不破坏已有顺序）

## CSS

- [ ] `src/styles/<plugin-name>.css` 已创建
- [ ] 插件内 `import xxxCssRaw from '../../styles/<plugin-name>.css?raw'`
- [ ] CSS 与原版运行时注入值字符级对齐（LF、首尾空白、中文注释）
- [ ] lightningcss 警告无害（layer.css IE hack 已知，doc/24 记录）

## 文档

- [ ] `doc/NN-<plugin-name>-integration.md` 已创建（NN 为下一个编号）
- [ ] 文档头部元数据块：文档类型 + 文档状态
- [ ] §1.3 可行性分析表（5 维度决策）
- [ ] §2.3 模块拆分映射表（原脚本段 → 本项目模块）
- [ ] §3.3 控制流保留要点（编号列出）
- [ ] §4 执行验证记录（tsc + vite build 实际输出）
- [ ] 文档状态从 🔧待执行 改为 ✅已执行
- [ ] `doc/README.md` 更新：文档清单 + 阅读顺序 + 进度概览（plugins 计数 +1）

## 验证

- [ ] `bunx tsc -b` 无输出，退出码 0
- [ ] `bunx vite build` 成功，产物体积合理（与基线 delta 为新增模块的合理增量）
- [ ] 构建产物 userscript 头部 grant 含新增的 GM_* API（如有）
- [ ] 无未清理的测试数据

## 自我辩论（AGENTS.md 强制）

- [ ] 已预测执行效果与修改后果，确认可行后才执行
- [ ] 修改完已自行测试，验证程序稳定性与可靠性、功能完整性
- [ ] 偏离原脚本的行为已在文档 §2.2 明确标注为"用户要求的行为改进"
