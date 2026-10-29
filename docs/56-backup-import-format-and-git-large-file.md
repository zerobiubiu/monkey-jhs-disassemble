# Git 大备份恢复与格式识别修复

> **文档类型**：🧾 变更记录  
> **文档状态**：✅ 已执行  
> **影响范围**：Git 大文件读取、本地备份导入、WebDAV/Git 云端导入与下载  
> **前置文档**：`07-architecture-and-tooling.md`（原 doc/137 加密备份）、`10-list-management.md`（原 doc/217 Git 备份）  
> **替代文档**：无  
> **生效版本**：v1.48.7

## 1. 背景与现场证据

用户在云端和本地导入同一自动备份时，均遇到 `JSON.parse` 的 `Unexpected token`；错误片段包含控制字符和 `5\\pojZ^_`。

只读检查指定下载文件得到：

- 实际大小 **1,295 字节**，不是预期的完整备份。
- 按旧 Caesar 变换反向检查，内容是 Git Contents API 文件元数据，包含 `type: file`、`path`、`sha`、`size`、`content`、`encoding` 等字段。
- 元数据记录原文件大小 **28,445,950 字节**，但 `encoding: none`、`content: ""`，没有任何可恢复的备份正文。
- 原文件 SHA-256：`8028f84c97812ecae96bc796ae522bd6b84cbf5764a2ca5a740e0981d13cd082`；修复前后摘要一致。个人备份内容、仓库地址和凭据均未纳入项目。

本轮合并修复三个同链路问题：

1. **读取层**：大文件首次 Contents 响应不含正文，代码回退 raw 请求后不检查返回值；若服务仍返回元数据，就误把元数据交给上层。未访问用户远端，未进一步断言其服务为何未按 raw 媒体类型返回正文。
2. **云端格式层**：非 V2 内容一律调用 `decryptCredential`，但当前云端上传的是明文 JSON。错误解密会减去每个字符的码点并丢掉前后各六字符，造成乱码；现场下载文件符合这条路径的结果。
3. **本地格式层**：仅支持明文/V2，不支持旧 Caesar 文件，且所有失败都被描述为 JSON 语法错误。

**不能通过给该 1,295 字节文件补括号、加密口令或反向位移恢复记录：正文从未下载到这个文件。必须重新获取远端原始备份。**

## 2. 方案与行为契约

### 2.1 Git 大文件读取

保留正常小文件 base64 解码和 raw 正文路径。raw 仍是文件元数据时，使用首次 Contents 响应的 SHA，请求已配置 API 下的 `/repos/{repo}/git/blobs/{sha}` 并解码 base64。

- SHA 绑定首次读到的文件版本；路径段编码，不从响应拼接任意 URL。
- 不访问返回的 `download_url` 或 `git_url`，不向新主机转发 Token。
- 缺 SHA、blob 无正文、错误编码或权限错误均明确失败，不把元数据交给导入/下载冒充成功。
- 只有接口明确声明 `size: 0` 才按空文件处理；缺少大小不能默认为空文件。

### 2.2 三个入口共用解码器

在现有 `backup-crypto.ts` 中增加 `decodeBackup`，同时返回校验后的原文和键值对象。

| 输入 | 行为 |
| --- | --- |
| 明文 JSON | 保持内容，不执行旧格式解密；允许文件头 UTF-8 BOM |
| 旧 Caesar 格式 | 前后标记都匹配才解密；标记由现有加密实现生成，不复制 salt/位移规则 |
| V2 AES-GCM | 使用已设置口令；缺口令、错口令或密文损坏明确报错，不回退明文 |
| 未知 AES 版本 | 拒绝，不把信封当业务数据写入 |
| 非对象、坏文件、Git 文件元数据 | 导入前拒绝；不给错误提示附带原始 JSON 片段；提示重新下载 |

本地导入在解码通过后才显示覆盖确认。云端保留原确认步骤，取回并解码通过后才写存储。三个入口不再各自实现格式分支。

既有顺序不变：`stripBackupExtras` → `storageManager.importData` → `applyBackupExtras` → 成功刷新；主存储导入失败时，不写附加存储、不刷新。错误路径使用 `clog.error` 与字符串 toast。

## 3. 实施文件清单

| 文件 | 改动 |
| --- | --- |
| `src/core/backup-crypto.ts` | 统一解码与对象/元数据校验，复用既有 V1/V2 实现 |
| `src/plugins/setting/git-backup-client.ts` | 检查 raw 响应、同 API 的 SHA blob 回退、缺失正文失败 |
| `src/plugins/setting/data-import-export.ts` | 本地导入改用统一解码器，保留确认与恢复顺序 |
| `src/plugins/setting/webdav-operations.ts` | 云端导入/下载共用解码器，删除盲目 Caesar 解密 |
| `tests/backup-crypto.test.ts` | 新增 19 例：三格式、BOM、口令、坏文件、元数据、未知版本 |
| `tests/git-backup-client.test.ts` | 新增 7 例：blob 回退、失败边界、同 API 安全性和同尺寸大文件 |
| `tests/setting/backup-restore.test.ts` | 新增 15 例：三个入口真实事件回调、确认、附加存储、失败零写入 |
| `package.json`、`vite.config.ts` | 源码构建通过后，版本同步递增为 1.48.7 |
| `AGENTS.md` | 固化用户确认的 Git 操作规则，更新测试清单 |
| `docs/plugin-catalog.md`、`docs/README.md`、`changelog/CHANGELOG.md` | 更新模块职责、文档索引与版本说明 |
| 本文 | 记录根因、实现、验证和恢复建议 |

未新增/移动源模块，插件数仍 43、核心文件仍 67；未修改 DOM 模板、样式、备份上传格式或存储迁移。四个改动源文件均低于 500 行，无需拆分。

## 4. 验证范围

- 修改前既有两组测试：**29/29 通过**。
- 先添加失败回归，复现 raw 元数据被当作正文、缺大小被默认为空文件等问题，再完成实现。
- 新增 **41 例**；全套从 **43 文件 / 428 例**到 **44 文件 / 469 例**。
- 大文件测试在内存生成 **28,445,950 字节**合成 JSON，经过元数据 → raw 元数据 → blob 解码后，逐字相同且可解析；不使用个人数据或落盘大文件。
- 入口测试不 mock 解码器，使用实际 HTML formatter 和事件绑定；网络、存储、FileReader 输入及刷新为替身。明文/V1/V2 均能通过三个入口；无效文件不调用存储或下载，主存储失败不调用附加存储。
- 指定个人文件通过真实文件只读探针确认被新解码器拒绝并提示重新下载，未改动原文件。

## 5. 后续验证与用户恢复建议

1. **先在远端保留原自动备份副本或确认历史提交可用**。自动备份会滚动覆盖同名文件，不要用当前不完整的本地数据覆盖待恢复的远端备份。
2. 用 `dist/monkey-jhs-disassemble.user.js` 更新到 **1.48.7**，在备份面板重新获取原备份。
3. 下载结果应是完整业务 JSON，而不是只有 `name/path/sha/encoding` 的接口元数据；现场原备份元数据标注约 28.4 MB。
4. 覆盖导入前另行保存当前数据；恢复后抽查收藏、观看状态、评分、访问记录和附加存储。
5. 若 Git Blobs 接口不被服务支持或权限不足，应保留错误提示并从原始可信仓库取回正文，不绕到陌生下载域转发 Token。

## 6. 执行验证记录

### 执行环境

- 本地 Windows，仓库 `D:/monkey-jhs-disassemble`，分支 `master`；验证日期 2026-10-29。
- Nushell 0.116.1、Bun 1.4.3、Node v24.22.0、Vitest 4.1.10、Vite 8.2.1。
- 初始没有依赖目录，经用户明确允许执行 `bun install --frozen-lockfile`；安装 330 个包，未修改锁文件。

### 验证命令与实际输出

| 命令/检查 | 实际输出或结果 |
| --- | --- |
| `bun run test` | `Test Files 44 passed (44)`；`Tests 469 passed (469)` |
| `bun run lint` | `eslint src/`，退出码 0，无错误/告警 |
| `bun run lint:css` | `stylelint "src/styles/**/*.css"`，退出码 0 |
| `bun run check:structure` | `OK (390 files, 68 dirs within limits; 0 file-ceilings, 3 dir-ceilings in ratchet)` |
| `bun run check:docs` | `OK (43 plugins [5 flagged], 67 core files)` |
| `bun run check:selectors` | `OK (85 files, 258 literals; 0 file(s) below baseline)` |
| `bun run check:version` | `OK (userscript 1.48.7 = package.json 1.48.7)` |
| `bun run build` | `tsc -b && vite build` 成功，434 modules transformed；产物 1,287.16 kB，gzip 332.17 kB |
| 产物头部读取 | `// @version      1.48.7` |
| `git diff --check` | 无输出，退出码 0 |
| `git diff --exit-code -- bun.lock` | 无输出，退出码 0，锁文件未改变 |
| 四个源文件 `read` diagnostics | 语法错误 0；最终全量 TypeScript 构建再次通过 |
| 指定文件只读探针 | `bytes:1295`、`fileUnchanged:true`、`expectedBackupBytes:28445950`、`embeddedContentLength:0`、`encoding:none`；返回“请重新下载原始备份文件” |

### 前端或调用方验证

`tests/setting/backup-restore.test.ts` 的 15 例通过：覆盖本地 FileReader 回调、云端表格导入/下载点击回调、覆盖确认、主/附加数据恢复顺序和失败路径。没有在真实网站执行覆盖恢复，没有访问用户私人远端仓库。

### 验证结论

源码、定向与全套测试、静态门禁和最终版本产物均通过。现场错误文件被安全拒绝；正确的明文/V1/V2 格式可以通过本地与云端入口。交付的是可安装修复产物，不表示用户真实记录已经恢复。

### 已知限制

- 未执行用户远端 Git 服务和 Tampermonkey 真实网页端到端恢复；接口权限、Git Blobs 支持和实际业务数据仍需用户按上述步骤验证。
- 构建保留上游 layer.css 的 10 条 IE hack `Unexpected token Semicolon` 警告，已由既有 `lightningcss.errorRecovery` 处理；本轮未改样式，构建正常完成。
- 当前会话没有可用 AOCI 服务/CLI，用户已明确允许本次跳过索引维护；源码/文档变化未同步 AOCI 托管索引，待工具恢复后维护。
- 不提交、不推送、不切分支；未改个人备份和网站数据。
