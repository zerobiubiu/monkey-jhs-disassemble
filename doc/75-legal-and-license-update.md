# 法律条款与项目说明更新

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行
> **关联版本**：1.8.5（不递增——纯元数据/文档变更，无 src/ 源码逻辑修改）

## 1. 背景

本项目（JavDB Power Tools）基于 GreasyFork 脚本 JAV-JHS（脚本 ID: 558525，
https://greasyfork.org/zh-CN/scripts/558525-jav-jhs）的 3.3.6 版本进行二次开发。

原始脚本以 MIT 协议发布。3.3.6 之后的后续版本转为私密付费，GreasyFork 页面
已对游客关闭（"此脚本不再在本网站上对游客开放"）。本项目基于 MIT 协议下
发布的 3.3.6 版本，行使 MIT 授予的修改与再发布权利。

此前项目的协议声明存在以下缺口：
- 无 LICENSE 文件（MIT 强制要求附带许可证全文）
- README.md License 节仅写 "MIT" 两字，无版权声明/归属/衍生关系说明
- vite.config.ts 无 @copyright 字段
- package.json 无 license 字段

## 2. 方案

补全 MIT 协议合规要求，明确衍生关系与原始项目归属：

1. 创建 LICENSE 文件（MIT 全文 + 版权声明 + 原始项目信息 + 集成脚本清单）
2. 重写 README.md License 节（衍生关系声明 + 集成脚本致谢表）
3. vite.config.ts 增加 @copyright 元数据
4. package.json 增加 license 字段

## 3. 实施

| 文件 | 变更 |
|------|------|
| `LICENSE` | 新建：MIT 全文 + 版权声明 `2024-2026 zerobiubiu` + 衍生关系说明 + 13 个集成脚本清单 |
| `README.md` | 重写 License 节为 "License & Attribution"：衍生关系声明（基于 JAV-JHS 3.3.6 / MIT / 后续版本转私密付费 / MIT 永久授权）+ 集成脚本致谢表 |
| `vite.config.ts` | userscript 头部增加 `@copyright: '2024-2026 zerobiubiu (https://github.com/zerobiubiu) — 基于 JAV-JHS 3.3.6 (MIT) 二次开发'` |
| `package.json` | 增加 `"license": "MIT"` 字段 |

## 4. 法律依据

- **MIT 协议为永久授权**：一旦以 MIT 发布，接收方享有的权利不可撤销。后续版本改协议
  不影响已发布版本的 MIT 授权。
- **MIT 对衍生作品的义务**：(1) 保留版权声明；(2) 附带许可证文本。本项目通过 LICENSE
  文件和 README Attribution 节履行上述义务。
- **二次开发合法性**：3.3.6 版本以 MIT 发布，允许修改、合并、发布、再授权。本项目
  拆分重构 + 功能扩展属于 MIT 明确允许的衍生作品范畴。

## 5. 版本号说明

本次为纯元数据/文档变更（LICENSE/README/package.json/vite.config.ts userscript 头部），
不涉及 `src/` 下任何源码逻辑修改。按版本号规则（§6.1.1），不递增版本号，保持 1.8.5。

## 6. 执行验证记录

### 6.1 构建验证

```bash
bun run build
```

验证 vite-plugin-monkey 正确输出 `@copyright` 元数据到产物头部。
