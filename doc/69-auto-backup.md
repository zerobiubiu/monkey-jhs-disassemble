# 69 - 自动备份功能（凭证 ID + 增量滚动 + 策略随文件保存）

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行

## 背景

原脚本只有手动 WebDav 备份（设置面板「备份数据」按钮），用户需主动点击。
缺少自动备份能力，数据丢失风险高。需增加自动备份功能：

- 默认每天第一次打开时自动备份
- 配置项在设置菜单「数据备份」面板控制
- 备份文件保存本机凭证 ID（唯一标识每台电脑的每个浏览器）
- 凭证 ID 第一次打开脚本时创建，存浏览器本地（GM 存储），不进入备份系统
- 增量滚动更新：一个浏览器只保留一份备份文件，每次覆盖
- 自动备份策略随备份文件保存

## 方案

### 核心设计

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 凭证 ID 存储 | GM_setValue（Tampermonkey 持久化） | 不在 IndexedDB 内，不被 exportData 导出，天然不进入备份系统 |
| 凭证 ID 生成 | UUID v4（crypto.randomUUID + 兜底手动拼装） | 无第三方依赖，全局唯一 |
| 备份文件名 | `auto_<credentialId>.json`（固定名） | 一个浏览器一份，增量覆盖不堆叠历史 |
| 备份格式 | `{ ...exportData, __meta: { credentialId, autoBackupConfig, backupTime } }` | 凭证 ID + 策略随文件保存，注入顶层 `__meta` 不污染 exportData 的业务键 |
| 触发时机 | main.tsx 启动序列末尾（processPlugins 之后） | 所有插件就绪后再备份，数据最完整 |
| 触发频率 | daily（默认）/ everyOpen / disabled | daily 按本机日期判断「每天第一次」 |
| 失败处理 | 静默 console.warn | 自动备份不打扰用户 |
| 未配置 WebDav | 静默跳过 | 未配置凭据无法备份，不报错 |

### 数据流

```
首次打开脚本
  └─ getCredentialId() → GM_getValue 无值 → 生成 UUID v4 → GM_setValue 持久化

每次打开脚本（main.tsx 启动序列末尾）
  └─ SettingPlugin.autoBackup()
       ├─ 读 settings.autoBackupConfig（默认 {enabled:true, frequency:'daily'}）
       ├─ shouldAutoBackup(config) → 判断是否满足触发条件
       │    ├─ disabled / enabled=false → 不触发
       │    ├─ everyOpen → 触发
       │    └─ daily → 本机日期 !== 上次备份日期 → 触发
       ├─ 未配置 WebDav 凭据 → 静默跳过
       └─ buildBackupPayload() → exportData + __meta 注入
            └─ encryptCredential → webdavClient.backup(folder, auto_<id>.json, content)
                 └─ markAutoBackupDone() → GM_setValue 记录今日日期
```

### 备份文件格式

```json
{
  "car_list": [...],
  "setting": {...},
  "其他 IndexedDB 键": ...,
  "__meta": {
    "credentialId": "550e8400-e29b-41d4-a716-446655440000",
    "autoBackupConfig": {
      "enabled": true,
      "frequency": "daily"
    },
    "backupTime": "2026_07_08_12_34_56"
  }
}
```

`__meta` 注入在 exportData 顶层，导入时会被 importData 写入 IndexedDB（无副作用，
因为凭证 ID 仍以 GM 存储的本地值为准，`__meta` 键不参与业务逻辑）。

### 设置面板配置项

数据备份面板（密码输入框之后）新增：

| 控件 | id | 类型 | 说明 |
|------|----|------|------|
| 启用自动备份 | `enableAutoBackup` | checkbox | 开关 |
| 备份频率 | `autoBackupFrequency` | select | daily / everyOpen / disabled |
| 本机凭证 | `credentialIdDisplay` | readonly input | 只读显示凭证 ID |

配置保存在 `settings.autoBackupConfig`（`{enabled, frequency}`），随备份文件保存。

### 增量滚动更新

- 文件名固定为 `auto_<credentialId>.json`
- WebDavClient.backup 先 MKCOL 创建目录再 PUT 写入，PUT 覆盖同名文件
- 一个浏览器只保留一份自动备份文件，不堆叠历史
- 手动备份仍用时间戳文件名（`utils.getNowStr('_', '_') + '.json'`），不受影响

## 实施

### 修改文件清单

| 文件 | 改动 |
|------|------|
| `src/core/auto-backup.ts` | **新增**：凭证 ID 管理（getCredentialId）+ 触发判断（shouldAutoBackup）+ 文件名（getAutoBackupFileName）+ 日期记录（markAutoBackupDone）+ 默认配置 + 类型定义 |
| `src/components/setting-dialog.tsx` | 数据备份面板密码输入框后新增：启用自动备份 checkbox + 备份频率 select + 本机凭证 readonly input |
| `src/plugins/setting-plugin.tsx` | import auto-backup 模块；loadForm 加载自动备份配置 + 凭证 ID 显示；saveForm 保存 autoBackupConfig；backupDataByWebDav 改用 buildBackupPayload（注入 __meta）；新增 buildBackupPayload + autoBackup 方法 |
| `src/main.tsx` | 启动序列 processPlugins 之后触发 SettingPlugin.autoBackup()（javdb only） |
| `vite.config.ts` | version 1.7.7 → 1.8.0 |

### 备份方法对比

| 方法 | 触发 | 文件名 | 内容 | 失败处理 |
|------|------|--------|------|----------|
| `backupDataByWebDav`（手动） | 用户点击「备份数据」 | 时间戳 `.json` | exportData + __meta | show.error |
| `autoBackup`（自动） | 启动序列 | `auto_<credentialId>.json` | exportData + __meta | console.warn 静默 |

两者共用 `buildBackupPayload` 构造备份内容（含 __meta），保证格式一致。

## 执行验证记录

### 构建验证

```
$ tsc -b && vite build
✓ 214 modules transformed.
dist/monkey-jhs-disassemble.user.js  1,849.12 kB │ gzip: 423.04 kB
✓ built in 1.25s
```

- `tsc -b` 通过（无类型错误）
- `vite build` 通过（无 INEFFECTIVE_DYNAMIC_IMPORT 警告）
- 产物 1849.12 kB（gzip 423.04 kB），较 doc/68 基线 1843.47 kB +5.65 kB
- diagnostics：auto-backup.ts / setting-plugin.tsx / setting-dialog.tsx / main.tsx 均无 errors/warnings

### 版本号

`vite.config.ts` version `1.7.7` → `1.8.0`（新增功能模块，minor 递增）

## 后续验证建议

1. **凭证 ID 创建**：首次安装脚本 → 打开设置「数据备份」面板 → 「本机凭证」应显示
   36 字符 UUID；关闭重开应显示同一个 ID（GM 持久化）
2. **凭证 ID 不进备份**：导出数据（localStorage 检查）确认凭证 ID 不在 IndexedDB 内
3. **自动备份触发**：配置 WebDav 凭据 → 当天首次打开 → 控制台应显示
   `[JHS 自动备份] 完成` → WebDav 目录下应有 `auto_<credentialId>.json`
4. **增量覆盖**：再次触发自动备份 → 同名文件被覆盖（不新增）
5. **daily 频率**：同一天多次打开 → 仅第一次触发（GM 记录日期）
6. **everyOpen 频率**：设置频率为「每次打开」→ 每次打开都触发
7. **disabled 频率**：设置频率为「不自动备份」→ 不触发
8. **未配置 WebDav**：清空 WebDav 凭据 → 自动备份静默跳过（无报错）
9. **备份内容**：下载 `auto_<id>.json` 解密后确认含 `__meta.credentialId` +
   `__meta.autoBackupConfig`
10. **手动备份不变**：点击「备份数据」→ 仍用时间戳文件名 + 含 __meta
