# NN - <PluginName> 插件集成

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 1. 背景

### 1.1 来源
`archetype/<name>.user.js`（XXX 行）是独立油猴脚本 `<脚本名>` vX.Y，
功能：<一句话描述>。与本项目 `jhs.user.js`（鉴黄师）是同一作者的独立脚本，
<说明与本项目的关系：是否寄生读 IDB / 是否监听本项目广播的事件 / 完全独立>。

### 1.2 集成目标
将独立脚本集成到本项目（鉴黄师拆分重构工程），转为 TS 模块化 + TSX 组件，作为
`BasePlugin` 子类注册到 `PluginManager`，与现有 N 插件并列。要求：
- 转换为 TS 为主的语言，组件生成用 TSX（jsxToString）
- 保证执行逻辑不冲突（与原脚本零偏差）
- 先保证原项目可扩展性，再扩展功能实现
- 目录结构清晰

### 1.3 可行性分析（集成前调研）
### 1.3 可行性分析

| 维度 | 结论 | 依据 |
|------|------|------|
| 站点限定 | <结论> | <依据> |
| GM_* 依赖 | <结论> | <依据> |
| 数据源 | <结论> | <依据> |
| 事件源 | <结论> | <依据> |
| 网络请求 | <结论> | <依据> |
| 主项目冲突 | <结论> | <依据：grep 关键操作符到 src/ 的结果> |

### 1.4 主项目冲突排查

| 冲突类型 | 表现 | 协调策略 |
|----------|------|----------|
| <冲突类型或“无冲突”> | <表现> | <策略或“独立运行”> |

## 2. 方案

### 2.1 目录结构
<单文件则写 `src/plugins/<plugin-name>-plugin.ts`；子目录则画文件树 + 依赖方向图>

### 2.2 关键设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| <决策点 1> | <选择> | <理由> |
| CSS 注入 | `initCss()` 返回 CSS 字符串 | 项目既定模式，替代原脚本 GM_addStyle |
| innerHTML 生成 | `jsxToString(<TSX />)` | 满足 TSX 化要求，DOM 等价 |

### 2.3 模块拆分映射

| 原脚本段 | 行号 | 本项目模块 |
|----------|------|------------|
| `CONFIG` | L24-45 | `<plugin-name>-config.ts` |
| `Utils` | L50-131 | `<plugin-name>-utils.ts` |
| ... | ... | ... |
| `GM_addStyle` CSS | L483-566 | `src/styles/<plugin-name>.css`（?raw import via initCss） |

## 3. 实施

### 3.1 新增文件

| 文件 | 行数 | 职责 |
|------|------|------|
| `src/plugins/<plugin-name>-plugin.tsx` | ~XXX | <职责> |
| `src/styles/<plugin-name>.css` | ~XX | <样式类> |

### 3.2 修改文件

| 文件 | 改动 |
|------|------|
| `src/types/globals.d.ts` | <加 `declare const GM_xxx: any;` 或无改动> |
| `vite.config.ts` | <grant 数组加 `GM_xxx` 或无改动> |
| `src/main.tsx` | import <PluginName>Plugin；`if (isJavdbSite)` 块注册；注释 N→N+1 |
| `doc/README.md` | 文档清单 + 阅读顺序 + 进度概览更新 |

### 3.3 控制流保留要点

1. **<要点 1>**：<说明>
2. **<要点 2>**：<说明>
3. **<要点 3>**：<说明>

### 3.4 与主项目协调（冲突时必填，无冲突则省略）

<列出落实 §1.4 协调策略的编码实现：autoPage 守卫 / 复用 data 属性 / 排序互斥 / sortGuard disconnect-reconnect 等>

## 4. 执行验证记录

### 4.1 类型检查
```bash
$ bunx tsc -b
（无输出，退出码 0）
```
全量类型检查通过，无错误无警告。

### 4.2 构建
```bash
$ bunx vite build
dist/monkey-jhs-disassemble.user.js  X,XXX.XX kB │ gzip: XXX.XX kB
✓ built in XXXms
```
构建成功。产物 XXXX.XX kB（gzip XXX.XX kB），较 doc/NN-1 基线 XXXX.XX kB
（gzip XXX.XX kB）+X.XX kB（gzip +X.XX kB），为 <插件名> 模块 + CSS 的合理增量。

### 4.3 userscript metadata 验证
<构建产物 userscript 头部 grant 含 `GM_xxx`；菜单命令数 / match 规则等>

## 5. 后续

- **运行时验证**：建议在 Tampermonkey 加载构建产物，测试：<列出关键功能点>
- **dead code**：<原脚本历史文档是否有已修复机制在本集成中体现>
