# 无引用模块清理（v1.47.4）

> **文档类型**：🧾 变更记录
> **文档状态**：✅ 已执行
> **影响范围**：`src/core/`、`src/components/`、`src/styles/`、`docs/plugin-catalog.md`、`AGENTS.md`、`scripts/site-selector-baseline.json`、`vite.config.ts`、`package.json`、`changelog/CHANGELOG.md`
> **前置文档**：无
> **替代文档**：无
> **生效版本**：1.47.4

## 1. 背景

仓库经多轮重构（阶段文档 01–11）后遗留若干**仅由历史文档与自身注释引用、在 import 图中零命中**的模块。它们不参与运行，但持续占用认知与维护面：被 `plugin-catalog.md`/`AGENTS.md` 的目录计数计入、在 `check:structure` 文件数中占位、在 `site-selector-baseline.json` 棘轮基线中留下条目，并让 AOCI 索引携带「已无导入方」的死条目。

AOCI 索引在本次全量认知交付中已明确标注其中四项「无导入方 / 未接线」，本次将其与 import 图复核结果对齐后落地清理。

## 2. 方案

判定口径（可复现、只认可机械证据）：对 `src/**` 每个 `.ts`/`.tsx`/`.css`，以**规格化导入说明符**搜索全 `src/` 与 `tests/`——`from '<path>'`、`import('<path>')`、`from '<path>.css'`；`index.ts` 以父目录名（barrel 目录导入）计；`main.tsx`/`*.d.ts` 由构建配置与 tsconfig 引用，不参与判定。命中数为 0 即为候选，再逐个人工确认「非 side-effect 导入、非动态字符串引用」。

关键确认项：

- `core/image-preview.tsx` 的唯一构造点来自设置项 `hoverBigImg`，该设置与初始化已由 doc/04 移除；此后无任何 `new ImagePreview(...)`。其三个专属资产（两个组件 + 一个样式表）只被它引用 → 随根一并删除。
- `core/list-dom-bus.ts`：doc/142 引入的 Runtime V2 候选基础设施，**从未接线**（各插件仍各自建 Observer）。
- `components/misc/url-auto-link.tsx`：日志链接化已由 `components/log/logger-log-entry.tsx` 内联实现，本组件为遗留。
- `components/setting-panels/hr-style.ts`：`HR_STYLE` 已被 `.jhs-setting-section`（`setting-section.tsx`）取代。

**不在本次范围**（有意保留，勿删）：

- `core/_jquery-global.ts`、`core/libs.ts`：side-effect 导入（`import './_jquery-global'` / `import './core/libs'`），无 `from` 绑定故不产生说明符命中。
- 文档标注为**有意死代码/零偏差保留**的项（如 `other-site-plugin` 的 `renderSettingsArea/setupEventListeners` 空守卫、`_waitForDomChange/_waitForEl`、`new-video` 的 `resetBtnTip` 空实现、`HAS_DOWN_TEXT` 残留常量、`Beyond60Plugin` 未注册分支、`dpb-helpers` 超时语义不对称等）——它们承载既有契约或兼容路径，删除会改变被文档冻结的行为。
- `plugins/setting/jhs-sync/index.ts`：barrel 出口，实测无消费方（消费者均直连子模块），但属 doc/214 声明的模块公共面，保留待决策。

## 3. 实施（改动文件清单）

**删除 7 个文件**

| 文件 | 类型 | 说明 |
|------|------|------|
| `src/core/image-preview.tsx` | core | `ImagePreview` 悬浮大图预览（根） |
| `src/components/image-preview/image-preview-error.tsx` | 组件 | 只被根引用 |
| `src/components/image-preview/image-preview-img.tsx` | 组件 | 只被根引用 |
| `src/styles/image-preview.css` | 样式 | 只被根以 `?raw` 引用（含 `/* __Z_INDEX__ */` 占位符） |
| `src/core/list-dom-bus.ts` | core | `ListDomBus`（未接线） |
| `src/components/misc/url-auto-link.tsx` | 组件 | `UrlAutoLink`（遗留） |
| `src/components/setting-panels/hr-style.ts` | 组件 | `HR_STYLE`（已被 `.jhs-setting-section` 取代） |

**同步修改 6 个文件**

| 文件 | 改动 |
|------|------|
| `docs/plugin-catalog.md` | §2 核心模块 `64 → 62`（顶层 `28 → 26`）；删除 `list-dom-bus.ts` 行；`image-preview.tsx / viewer.ts` 行改为 `viewer.ts` |
| `AGENTS.md` | §3.4 核心模块 `63 → 62`（顶层 26 + 子目录 36）；§3.5 组件 `141 → 140`；§9.4 移除对已删 `image-preview.css` 占位符的引用 |
| `scripts/site-selector-baseline.json` | 移除 `"src/core/list-dom-bus.ts": 1` 条目 |
| `vite.config.ts` | `userscript.version` `1.47.3 → 1.47.4` |
| `package.json` | `version` `1.47.3 → 1.47.4` |
| `changelog/CHANGELOG.md` | 新增 `## v1.47.4` 条目 |

## 4. 执行验证记录

### 执行环境

- 工作机：Windows（win32 10.0.26300，x64），工作目录 `E:/monkey-jhs-disassemble`
- 运行时：Bun（`bun run …`）；构建链 Vite 8 + vite-plugin-monkey + tsc（TypeScript 6，`tsc -b`）
- 基线：清理前 HEAD `0bd357b`（工作区干净），`userscript 1.47.3`

### 验证命令

```bash
# 判定证据（清理前）
grep -rnE "from ['\"][^'\"]*<key>['\"]|import\(['\"][^'\"]*<key>['\"]\)|from ['\"][^'\"]*<key>\.css" src tests
# 门禁与静态检查（清理后）
bun run check:docs; bun run check:structure; bun run check:selectors; bun run check:version
bun run lint; bun run lint:css
bun run build        # tsc -b && vite build
bun run test         # vitest run
# 产物证据
grep -m3 -E "^// @version" dist/monkey-jhs-disassemble.user.js
grep -c "ImagePreview\|ListDomBus\|UrlAutoLink\|HR_STYLE\|image-hover-preview" dist/monkey-jhs-disassemble.user.js
```

### 实际输出

| 命令 | 输出 |
|------|------|
| 说明符搜索（7 个候选） | 命中数 0（唯一非零为自身文件的 `.css` 自引用与 side-effect 导入的假阳性） |
| `check:docs` | `OK (44 plugins [5 flagged], 62 core files)` |
| `check:structure` | `OK (384 files, 67 dirs within limits; 4 file-ceilings, 3 dir-ceilings in ratchet)`（清理前 390 files） |
| `check:selectors` | `OK (88 files, 274 literals; 0 file(s) below baseline — 可下调基线)`（清理前 89 files / 275 literals） |
| `check:version` | `OK (userscript 1.47.4 = package.json 1.47.4)` |
| `lint` / `lint:css` | 均 `exit 0`，无 error/warning |
| `bun run build` | `tsc -b` 通过；`✓ 428 modules transformed` → `dist/monkey-jhs-disassemble.user.js 1,284.97 kB │ gzip: 330.03 kB`，`✓ built in 815ms`（既有 lightningcss 对 layer.css IE hack 的容错警告，与本次改动无关） |
| `bun run test` | `Test Files 35 passed (35)` / `Tests 362 passed (362)` |
| 产物 `@version` | `1.47.4` |
| 产物残留符号 | `ImagePreview`=0、`ListDomBus`=0、`UrlAutoLink`=0、`HR_STYLE`=0、`image-hover-preview`=0 |
| `src/tests/scripts` 残留引用 | 0 |

### 前端或调用方验证

本次为**删除无引用模块**，生效面为「不再存在的导入路径」：改后全仓 `from '<已删路径>'` 命中 0、构建产物不含被删符号，等价于「无调用方受影响」。用户可见行为零变化（受影响功能自 doc/04 起已无入口）。

**视觉/运行时限制**：userscript 需在 JavDB/MissAV 页面由 Tampermonkey 注入运行，本机无法完成端到端浏览器冒烟；上表「产物不含被删符号 + 全门禁通过 + 全量测试通过」为本轮可执行的最高强度证据。建议用户在真实站点打开详情页/列表页确认无回归。

### 验证结论

✅ 已执行。7 个零引用文件及其唯一消费者链被完整清除；计数、基线、门禁、版本、文档索引全部同步；构建与 362 用例全通过；产物层面确认被删符号零残留。

### 已知限制

- 判定口径基于**静态说明符匹配**：若存在通过运行时拼接字符串 `import(...)` 的引用方式将被漏判——本仓库无此类模式（已人工确认删除项均为 0 命中且无动态引用）。
- `plugins/setting/jhs-sync/index.ts`（无消费方的 barrel）与文档标注为有意保留的死代码**未清理**，需产品决策（见 §2「不在本次范围」）。
- 未做真机浏览器冒烟（见上「视觉/运行时限制」）。

## 5. 后续验证建议

1. 真实站点冒烟：JavDB 列表页（批量操作/状态标签/瀑布流/预加载）与详情页（评分条/清单面板/字幕/评论/相关清单）确认无控制台错误。
2. 若确认 `jhs-sync/index.ts` 亦无未来消费计划，另建变更文档一并清理（本次未动）。
3. 后续 AOCI 维护：本变更已改变受管理对象集合（含删除），治理收尾按 `aoci_maintain` 批次处理（`aoci_remove_entry` 处理孤儿条目）。