# doc/156 — 风格约定固化 + 组件目录审计

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

用户要求「再深入研究保证代码结构、代码风格、代码形式上的一致性，架构统一性，
方案完整性，结构正确性」。第三至五轮（doc/153–155）通过审计→执行→对抗修正
确立了六类风格约定，但仅存在于各轮 doc 中，未写入 AGENTS.md 的强制条款——
后续 agent 无法自动遵守。本轮将这些约定**固化为 AGENTS.md §9**，并对前几轮
审计刻意排除的 `src/components/` 目录做三维补审。

## 组件目录审计结果

| 维度 | 结果 |
|------|------|
| `console.*` 调用 | **0**（组件为纯渲染函数，不含日志逻辑） |
| `show.error/ok/success` 直传 Error | **0**（组件不含 toast 调用） |
| 导入顺序违规 | **0**（scout 审计 34 个 .tsx 文件，全部符合六组约定或导入数不足以违规） |

结论：`src/components/` 在三个维度上**全清洁**，无需任何 src/ 编辑。

## AGENTS.md §9 新增条款

将 doc/153–155 的约定提炼为 6 条强制规则：

| 条款 | 内容 | 来源 |
|------|------|------|
| §9.1 导入顺序 | 六组约定（外部类型→常量→核心→本地插件→组件→CSS?raw） | doc/154/155 |
| §9.2 日志分层 | clog 仅面板（error 例外转发 console）；集成脚本跟踪保留 console.*；禁止 clog.info | doc/155 |
| §9.3 toast 安全 | show.error 必须传字符串，instanceof 守卫 | doc/154/155 |
| §9.4 z-index 令牌 | --jhs-z-page:9999 / --jhs-z-top:999999999；禁止散落字面量 | doc/153 |
| §9.5 CSS 前缀 | 插件专属类必须加 jhs- 或插件前缀；禁止同名冲突 | doc/154 |
| §9.6 审计方法论 | 禁止静默截断；完整发现持久化后装箱并行；跟踪例外复核 | doc/155 |

## 版本号决策

本轮**无 src/ 变更**（组件审计全清洁 + AGENTS.md 为文档文件）。
按 §6.1.1「纯文档修改（doc/ 下的 .md）、纯 AGENTS.md 修改不递增版本号」，
**不递增版本号**，**不写 CHANGELOG 条目**（CHANGELOG 按版本键控，无新版本则无条目）。

## 实施

| 文件 | 操作 |
|------|------|
| `AGENTS.md` | 修改：新增 §9（6 条强制风格约定） |
| `doc/README.md` | 修改：阅读顺序追加 doc/156 |

## 执行验证记录

```
$ bun run build
tsc -b && vite build
✓ 229 modules transformed.
dist/monkey-jhs-disassemble.user.js  2,024.66 kB │ gzip: 467.32 kB
✓ built in 1.19s
```

tsc 零错误。产物大小不变（AGENTS.md 不在 tsconfig include 内，不影响构建）。
`@version` 仍为 1.28.2（未递增）。

## 后续验证建议

- 新 agent 编辑 src/ 时应自动加载 AGENTS.md §9 并遵守；可通过 code review 或
  lint 规则（未来 ESLint 自定义规则）强制执行导入顺序与 clog/console 分层。
