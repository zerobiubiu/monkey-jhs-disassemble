# 30 - 更新 archetype 原型为含 Fc2Plugin 的完整版

> 文档类型：📄参考说明
> 文档状态：✅已执行

## 1. 背景

`archetype/jhs.user.js` 原为**删减版**——`03-simplify-to-javab-only.md`（archetype/doc）
精简为 javdb 专用时，将 `Fc2Plugin` 作为"非 javdb 站点插件"删除，但 FC2 实为
javdb 站内视频类型（`/advanced_search?type=3`，番号前缀 `FC2-`），删除有误。

用户提供了恢复 Fc2Plugin 后的**完整版**（根目录 `jhs.user.js` +
`12-restore-fc2-plugin.md`），要求替换 archetype 原型。

## 2. 操作

用根目录 `jhs.user.js` 覆盖 `archetype/jhs.user.js`（`cp -f`）。

完整版相对删减版的变更（详见 `12-restore-fc2-plugin.md`）：
- 恢复 `Fc2Plugin` 类（L3926-4150）+ 注册（L11853）
- 恢复 `@connect adult.contents.fc2.com` / `@connect fc2ppvdb.com`（L25-26）
- 适配已删插件为可选链/守卫（Fc2By123Av/Translate/ScreenShot/WangPan115Task/MagnetHub）
- 移除 `#hasDownBtn`（依赖已删 hasDown 常量 `g/y/x`）与 `#magnetSearchBtn`（依赖已删 MagnetHubPlugin）

## 3. 验证

- `node --check archetype/jhs.user.js`：**SYNTAX OK**
- `class Fc2Plugin extends BasePlugin`（L3926）✓
- `e.register(Fc2Plugin)`（L11853）✓
- `@connect adult.contents.fc2.com`（L25）/ `@connect fc2ppvdb.com`（L26）✓

## 4. 影响

- `archetype/jhs.user.js` 现为含 Fc2Plugin 的完整版，作为项目对照的参照原型
- **src 代码不受影响**——Fc2Plugin 已在 doc/29 迁移为 TS 模块（`src/plugins/fc2-plugin.ts`）并注册
- 后续对照 archetype 时，Fc2Plugin 行号以新版为准（L3926-4150，旧删减版无此类）
- 根目录 `jhs.user.js` 与 `12-restore-fc2-plugin.md` 为本次替换的来源文件，替换完成后可按需清理
