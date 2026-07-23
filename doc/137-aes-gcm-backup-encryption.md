# doc/137 — AES-GCM 加密备份升级

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

原备份加密使用 Caesar 位移混淆（`webdav-crypto.ts`）：每个码点 +5/-5，
固定 salt 前后包裹。这不是真正的加密——任何人只需反向位移即可还原明文。

WebDAV 凭据（URL/用户名/密码）存储在 settings 对象中（IndexedDB 明文），
页面脚本可通过 `storageManager.getSetting()` 读取。

## 方案

### 1. AES-GCM 加密模块（backup-crypto.ts）

新建 `src/core/backup-crypto.ts`：

- **算法**：AES-GCM 256 位（认证加密，防篡改）
- **密钥派生**：PBKDF2-SHA-256，100,000 次迭代
- **随机性**：每次加密使用独立随机 salt（16 字节）和 IV（12 字节）
- **信封格式**（BackupEnvelopeV2）：

```json
{
    "v": 2,
    "alg": "AES-GCM",
    "kdf": "PBKDF2-SHA-256",
    "iter": 100000,
    "salt": "<base64>",
    "iv": "<base64>",
    "ct": "<base64 ciphertext>",
    "ts": "<ISO 8601>"
}
```

导出 API：
- `encryptBackupV2(plaintext, password)` → 信封 JSON
- `decryptBackupV2(envelopeJson, password)` → 明文（口令错误抛 DOMException）
- `isBackupV2(content)` → 格式检测

### 2. WebDAV 凭据迁移到 GM 私有存储

| 旧存储 | 新存储 |
|--------|--------|
| `settings.webDavUrl` | `GM_setValue('jhs_webdav_url', ...)` |
| `settings.webDavUsername` | `GM_setValue('jhs_webdav_username', ...)` |
| `settings.webDavPassword` | `GM_setValue('jhs_webdav_password', ...)` |

保存时自动 `delete settings.webDavUrl/Username/Password`（一次性迁移）。

### 3. 备份口令

- 设置面板新增「备份口令」输入框（`type="password"` + 👁 切换）
- 存储在 `GM_setValue('jhs_backup_password', ...)`
- **永不写入备份文件**（凭据与数据分离）
- 新设备恢复时需重新输入口令

### 4. 加密/解密流程

**导出（V2）**：
```
JSON.stringify(payload) → encryptBackupV2(json, password) → 上传/下载
```

**导入（V2 优先，V1 兼容）**：
```
读取文件 → isBackupV2?
  → 是：decryptBackupV2(content, password) → JSON.parse
  → 否：decryptCredential(content)（V1 Caesar）→ JSON.parse
```

**本地导出**：有口令时 V2 加密，无口令时明文 JSON（用户可能想直接查看）。

## 实施（修改文件清单）

| 文件 | 操作 |
|------|------|
| `src/core/backup-crypto.ts` | 新建：AES-GCM + PBKDF2 模块 |
| `src/components/setting-dialog.tsx` | 修改：备份口令输入框 + 切换按钮 |
| `src/plugins/setting-plugin.tsx` | 修改：GM 凭据 + V2 加密/解密 + 口令绑定 |

## 执行验证记录

```
$ bun run build
tsc -b && vite build
✓ 222 modules transformed.
dist/monkey-jhs-disassemble.user.js  2,007.89 kB │ gzip: 463.08 kB
✓ built in 1.19s
```

tsc 零错误。产物 +5.71 kB（AES-GCM 模块 + 口令 UI）。

## 安全属性

| 属性 | V1 (Caesar) | V2 (AES-GCM) |
|------|-------------|--------------|
| 算法强度 | 无（位移混淆） | AES-256-GCM |
| 密钥派生 | 无（固定 salt） | PBKDF2-SHA-256 100k 迭代 |
| 随机性 | 无 | 随机 salt + IV |
| 完整性校验 | 无 | GCM 认证标签 |
| 口令错误检测 | 无（静默输出乱码） | DOMException |
| 凭据存储 | IndexedDB 明文 | GM 私有存储 |
