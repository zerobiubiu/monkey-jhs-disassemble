> **文档类型**：🔧 开发指导
> **文档状态**：✅ 已执行
> **影响范围**：`changelog/CHANGELOG.md` 结构、`release.yml` 发布说明提取、`package.json` 版本镜像与 `check:version` 门禁、docs 索引（33 补档 / 40–42 行）
> **前置文档**：`README.md`（docs 索引规范）
> **替代文档**：无
> **生效版本**：v1.47.3

# 发布链路与版本双源治理：提取修复、标题清理、check:version

## 1. 背景（2026-10-05 实测发现）

1. **发布说明提取破损**：`release.yml` 用 awk 提取「首个 `## v` 至下一个 `^---$`」。现行 changelog（v1.46.2 起的新条目）不再写 `---` 分隔线 → 按现行逻辑本地模拟，提取产物为 **243 行 / 34 个版本标题**（从空标题 `## v1.46.9` 一路吞到 v1.46.2），而非「最新版本条目」；下一次推送发布 v1.47.x 时会被原样挂上 Release 说明。
2. **空 `## v1.46.9` 标题**：该标题（2026-09-26 某次编辑引入）悬在文件顶部且无正文；v1.46.9 的真实正文位于 v1.46.10 与 v1.46.8 之间（当时已失去标题）。
3. **v1.13.3 双标题**：同一版本的两条修复各自带一个 `## v1.13.3` 标题（同日期），版本标题重复。
4. **版本双源漂移**：`package.json` version=1.46.32 与 `vite.config.ts` `userscript.version`=1.47.2 不一致（发布与产物 @version 只认后者；镜像长期未同步，静默漂移约 4 个版本）。
5. **docs 欠档**：`docs/33-batch-ui-layering.md` 从未落盘（commit `15835d2` 提交说明声明“补 doc/33”，但其名状态显示未新增该文件），而 `docs/34`、`docs/35`、README 均已引用；README 索引同时缺 `40` 行。

## 2. 方案与实施

| 项 | 修法 | 文件 |
|---|---|---|
| 提取逻辑 | awk 改为「首个 `## v` → 下一个 `## v` 前」：`/^## v/{n++; if(n>1) exit} n>=1{print}`；条目之间不再要求 `---`，历史分隔线行不参与判定 | `.github/workflows/release.yml` |
| v1.46.9 标题 | 删除顶部空标题；在其正文所在位置（v1.46.10 与 v1.46.8 之间）补回 `## v1.46.9` | `changelog/CHANGELOG.md` |
| v1.13.3 双标题 | 合并为一个标题（两条修复 bullet 并入同一 `### 修复` 小节，内容零删改） | `changelog/CHANGELOG.md` |
| 版本双源 | `package.json` version 对齐 `userscript.version`（1.47.3）；新增 `bun run check:version` 门禁（`scripts/check-version-sync.ts`，独立命令、不接入 build/lint/test） | `package.json`、`vite.config.ts`、`scripts/check-version-sync.ts` |
| docs 欠档 | 补写 `docs/33-batch-ui-layering.md`（补档声明见其元数据）；README 索引补 40/41/42 行、13 行标注替代关系 | `docs/33-…`、`docs/README.md` |

## 3. 执行验证记录

### 执行环境

- Windows x64；2026-10-05；Bun；release.yml 同款 awk 本地复现。

### 验证命令与实际输出

- 提取模拟（修复前，现行 awk）：`awk '/^## v/{f=1} f&&/^---$/{exit} f{print}' changelog/CHANGELOG.md` → **243 行**，含 v1.46.9…v1.46.2 共 34 个版本标题（首个为空标题）；
- 提取模拟（修复后）：同一命令改新逻辑 → **9 行**，唯一标题 `## v1.47.3`；
- 结构扫描（修复后）：连续 `## v` 标题 = 0 处、重复版本标题 = 0 处（修复前各 1 处）；
- `check:version`（正例）：`check-version-sync: OK (userscript 1.47.3 = package.json 1.47.3)`，rc=0；
- `check:version`（隔离 fixture 负例）：vite=9.9.9 / pkg=1.0.0 → `FAIL（vite.config.ts userscript.version=9.9.9 != package.json version=1.0.0；同步属元数据修正，见 AGENTS.md §6.3）`，rc=1；提取失败分支（vite 侧无 version 行）同样 rc=1；
- 全门禁：`check:docs` / `check:structure` / `check:selectors` / `lint` / `lint:css` 全 rc=0；`bun run build` ✓ built in 767ms（产物 1,284.97 kB / gzip 330.03 kB）；`bun run test` 35 文件 / 362 用例全过。

### 前端或调用方验证

发布链路无前端面；发布前检查项：本地跑一遍提取模拟与 `bun run check:version`（本次已按此执行）。

### 验证结论

下次推送 master：Release `v1.47.3` 的说明只含 `## v1.47.3` 一个条目；版本双源一致且有门禁兜底；docs 引用链（33 / 34 / 35 / 40 / 41 / 42）完整。

### 已知限制

- 更早（v1.46.2 以下）条目仍保留旧 `---` 风格，与现行风格混排；新 awk 对两种风格均兼容，不做批量改写；
- `check:version` 与其它 `check:*` 一致为独立命令，未接入 CI。
