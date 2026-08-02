# Git 备份通道（GitHub 兼容族）

> **文档类型**：🔧 开发指导
> **文档状态**：✅ 已执行
> **版本**：1.39.0 → 1.40.0

## 1. 背景

备份系统的存储目的地此前只有 WebDav 一条通道（手动备份 + 自动备份）。用户提出
希望通过 **Git 仓库** 备份数据，诉求核心是：利用 Git 托管平台的**版本历史**能力
（每次备份一个 commit，网页端可 diff / 回滚），这是 WebDav 单文件覆盖做不到的。

### 1.1 可行性调研结论（多轮讨论定稿）

1. **油猴脚本无法直连 git 协议**：git wire 协议走原生 TCP + 二进制打包，浏览器
   沙箱只有 HTTP(S)（`GM_xmlhttpRequest`），无法实现 push 协商。
2. **浏览器内完整 git 客户端（isomorphic-git / wasm-git）成本不成比例**：
   - isomorphic-git（229 KB min / 68 KB gzip）技术上可行（可插拔 `http` 适配器
     挂 `GM_xmlhttpRequest` + lightning-fs 持久化 .git），但需要本地养一个真仓库
     （IDB 对象库膨胀 / 浅克隆边界）、多标签并发互斥、non-fast-forward 冲突恢复
     循环，工程量约为 Contents API 方案的 3–4 倍；
   - wasm-git（libgit2→WASM，约 1 MB）的 HTTP 层烧死在 WASM 内部，GitHub 不发
     CORS 头，需额外自建代理服务器，且单文件 userscript 分发 1 MB wasm 不便，出局。
   - 二者换来的增量能力（离线提交 / 真分支 / 本地历史镜像）对「备份一个 JSON」
     场景几乎无价值——**服务端历史版本由 Contents API 每次 PUT 一个 commit 即白送**。
3. **最终方案：Git 托管平台的 Contents REST API**。普通 HTTPS + JSON + Bearer
   token，正是 `GM_xmlhttpRequest` 擅长的形态；项目 `@connect` 已含 `'*'` 通配，
   零配置改动。

### 1.2 平台范围

「Contents API」是 GitHub 的接口名称，**并非跨平台通用**：

| 平台 | 兼容性 | 本期处理 |
|------|--------|----------|
| GitHub / GitHub Enterprise | 基准实现 | ✅ 支持 |
| Gitea / Forgejo（自建） | API 刻意镜像 GitHub，仅基址为 `https://host/api/v1` | ✅ 支持（改 API 地址即可） |
| Gitee | 形状相似但认证/字段有出入、单文件限 1MB | ❌ 后续按需 |
| GitLab / Bitbucket / Azure | 完全不同的 API 形状 | ❌ 后续按需 |

首期按用户决定**只做 GitHub 兼容族**，但架构上以 `BackupProvider` 接口抽象，
后续加 Gitee/GitLab 适配器不影响上层。

## 2. 方案

### 2.1 架构

```
buildBackupPayload()（数据源不变）
        │
        ├─ 手动：#webdavBackupBtn / #gitBackupBtn（各通道独立按钮）
        ├─ 自动：autoBackup() 按 settings.backupChannels 开关分发到已启用通道
        │
        ▼
BackupProvider 接口（backup / getBackupList / getFileContent / deleteFile）
        ├─ WebDavClient（core/webdav.ts，结构满足，零修改）
        └─ GitBackupClient（本期新增，显式实现）
                │
                ▼
        openFileListDialog（Tabulator 弹层，面向接口，双通道共享）
```

### 2.2 GitHub Contents API 操作映射

| 操作 | HTTP 请求 |
|------|-----------|
| 备份（创建） | `PUT /repos/{o}/{r}/contents/{folder}/{file}?ref={branch}`，body `{message, content(base64), branch}` |
| 备份（覆盖） | 先 `GET` 取文件 `sha`，PUT body 追加 `sha`（乐观锁，与 git non-fast-forward 语义一致） |
| 列目录 | `GET /repos/{o}/{r}/contents/{folder}?ref={branch}`；404 按空目录（Git 目录隐式，无需 MKCOL） |
| 下载 | `GET` 单文件取 `content`(base64) 解码；>1MB 时 GitHub 省略 content，回退 `Accept: application/vnd.github.raw+json` |
| 删除 | `GET` 取 sha → `DELETE` body `{message, sha, branch}` |
| 列表日期 | 每文件 `GET /repos/{o}/{r}/commits?path={file}&sha={branch}` 取最近 commit 时间（best-effort，失败回退空串，表格列回退显示当前时间） |

认证头 `Authorization: Bearer <PAT>`；附带 `Accept: application/vnd.github+json`、
`X-GitHub-Api-Version: 2022-11-28`（Gitea 忽略未知头）、`User-Agent`（防代理剥离 UA
导致 GitHub 403）。

### 2.3 双通道开关与自动备份分发

- 新增设置 `settings.backupChannels = { webdav: boolean; git: boolean }`
  （随 settings 进备份，跨设备迁移偏好）；
- **缺省值**：`webdav: true, git: false`（向后兼容：未设置时 WebDav 行为不变，
  Git 必须显式启用）；
- `autoBackup()` 分发逻辑：
  - WebDav 通道：`channels.webdav !== false` 且 GM 凭据已配置 → 执行；
  - Git 通道：`channels.git === true` 且 GM 凭据已配置 → 执行；
  - 两通道均不可用 → 静默跳过（不构建 payload，省一次 IDB 读）；
  - **任一通道成功即 `markAutoBackupDone()`**；全部失败则不标记，下次打开重试。

### 2.4 凭据存储（与 WebDav 同等待遇）

新增 4 个 GM 私有存储键（`setting-keys.ts`），**不进备份**（与
`backup-extra-storage.ts` 的白名单机制天然隔离）：

| 键 | 内容 | 缺省回退 |
|----|------|----------|
| `jhs_git_api_url` | API 基址 | `https://api.github.com` |
| `jhs_git_repo` | 仓库 `owner/repo` | 无（必填） |
| `jhs_git_branch` | 分支 | `main` |
| `jhs_git_token` | PAT | 无（必填） |

### 2.5 加密策略

与 WebDav 备份保持一致：**明文上传**（doc/171 已确立 WebDav 明文策略）。
面板 UI 文案引导「请先建好私有仓库」。备份口令（V2 加密）仅作用于本地导出，
云通道共用弹层的下载/导入流程已含 V2 检测解密，无需改动。

## 3. 实施（修改文件清单）

**新增**：

| 文件 | 职责 |
|------|------|
| `src/plugins/setting/backup-provider.ts` | `BackupProvider` 接口 + `BackupFileItem` 类型（复用 `WebDavFileItem` 形状） |
| `src/plugins/setting/git-backup-client.ts` | `GitBackupClient`（GitHub 兼容族）+ `GitHttpError` + base64/UTF-8 编解码 + 路径编码纯函数 |
| `src/plugins/setting/git-operations.ts` | 凭据校验（输入框优先 / GM 回退）、客户端构造、手动备份 / 列表查看入口（镜像 webdav-operations） |
| `tests/git-backup-client.test.ts` | 21 用例：编解码往返 / 路径编码 / 各操作请求构造与响应解析（stub `GM_xmlhttpRequest`）/ 缺省值 / 错误传播 |
| `doc/217-git-backup-channel.md` | 本文档 |

**修改**：

| 文件 | 变更 |
|------|------|
| `src/plugins/setting/setting-keys.ts` | +4 个 `GM_KEY_GIT_*` 常量 |
| `src/plugins/setting/webdav-operations.ts` | `openFileListDialog` 客户端参数 `WebDavClient` → `BackupProvider`（结构泛化，双通道共享弹层） |
| `src/components/setting-panels/backup-panel.tsx` | +「Git 备份（GitHub 兼容）」分区（查看备份/备份数据 + API 地址/仓库/分支/Token 输入）；自动备份分区 +「备份通道」双开关（`enableWebdavChannel` / `enableGitChannel`） |
| `src/plugins/setting/setting-form-load.ts` | loadForm 回填 Git 凭据 + 通道开关；saveForm 写 GM + `settings.backupChannels` |
| `src/plugins/setting/setting-form-bind.ts` | 绑定 `#gitBackupBtn` / `#gitBackupListBtn` |
| `src/plugins/setting-plugin.tsx` | `autoBackup()` 重写为双通道分发（见 §2.3）；+git-operations 导入 |
| `vite.config.ts` | version 1.39.0→1.40.0（新增功能模块，minor）；description 增「Git云备份」 |

**目录约束说明**：git 客户端未放 `src/core/`（与 `webdav.ts` 同级），因为
`src/core` 直接子文件数已达 check-structure 门禁上限（28）；且本模块仅
SettingPlugin 使用，放 `src/plugins/setting/` 与 `webdav-operations.ts`
同目录更内聚（setting/ 目录 11 文件 < 20 上限）。

## 4. 安全与限制

- **私有仓库强引导**：备份含观看记录等个人数据，UI 文案明确「请先建好私有仓库」；
- **Token 权限最小化**：GitHub fine-grained PAT 可精确授权单仓库 Contents 读写，
  面板 placeholder 提示「仅需仓库内容读写权限」；
- **勿用公共加速镜像**：API 基址可配置（兼作自建反代入口，如 Cloudflare Worker
  转发），但带 Token 的请求经第三方公共镜像等于泄露凭据，客户端注释已注明；
- **单文件 100MB 上限**（GitHub Contents API），备份 JSON 通常 MB 级；>1MB 读取
  已做 raw 回退；
- **限流**：GitHub 认证后 5000 次/小时，每日一次自动备份可忽略；
- **仓库需预建**：脚本不代建仓库（代建需额外 scope）。

## 5. 执行验证记录

```text
$ bunx tsc -b
（无输出 = 通过）

$ bun run lint
$ eslint src/
（0 errors / 0 warnings，基线保持）

$ bun run test
 Test Files  8 passed (8)
      Tests  132 passed (132)   ← 含新增 git-backup-client 21 用例

$ bun run build
dist/monkey-jhs-disassemble.user.js  2,179.53 kB │ gzip: 504.73 kB
（lightningcss IE hack 警告为 layer.css 已知无害项，vite.config.ts 有注释说明）

$ bun run check:structure
check-structure: OK (358 files, 58 dirs within limits; 4 file-ceilings, 3 dir-ceilings in ratchet)
```

## 6. 后续验证建议（需浏览器实测）

1. 建一个 **GitHub 私有空仓库**，生成 fine-grained PAT（Contents 读写），
   设置面板填 仓库 + Token → 「备份数据」→ 网页端确认 commit 出现；
2. 「查看备份」弹层：列表日期列显示最近 commit 时间；下载 / 导入 / 删除逐项验证；
3. 自动备份：勾选「Git」通道 + 频率「每次打开」→ 刷新页面 → devtools 控制台
   出现 `[JHS 自动备份] Git 通道完成`；
4. 双通道同开（WebDav + Git）：确认两通道各收到一份 `auto_<credentialId>.json`；
5. 自建 Gitea 验证（可选）：API 地址填 `https://<host>/api/v1`，重复 1–3；
6. 自建反代验证（可选，网络受限环境）：API 地址指向自己的 Worker 代理。

## 7. 后续可扩展项

- Gitee 适配器（认证方式 + 1MB blobs API 绕行）；
- GitLab 适配器（独立 API 形状）；
- 云通道加密（与本地导出 V2 对齐，需评估 WebDav 同步加密的兼容性，属独立需求）。
