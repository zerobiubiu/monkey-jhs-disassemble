# 115 - 访问记录随 WebDav / JSON 备份

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 1. 背景

doc/113/114 说明访问记录仅存 localStorage、不进备份。用户要求访问时间记录
可随脚本 WebDav 备份（及本地 JSON 导入导出）。

## 2. 方案

备份链路统一走 `SettingPlugin.buildBackupPayload`（手动 WebDav 备份 + 自动备份）：

```
{
  ...storageManager.exportData(),   // IndexedDB
  __meta: { credentialId, autoBackupConfig, backupTime },
  __localStorage: {
    jhs_visit_history: localStorage.getItem('jhs_visit_history')  // string | null
  }
}
```

导入（本地 JSON 覆盖导入 + WebDav 备份列表「导入」）：

1. `applyBackupLocalStorage(parsedData)`：若有 `__localStorage.jhs_visit_history`
   则写回 localStorage（覆盖）；缺失/null 则不动本地（兼容旧备份）
2. `delete data.__localStorage`，避免 `storageManager.importData` 误写入 IndexedDB
3. `storageManager.importData(parsedData)` 照常清空并写入 forage

本地「导出数据」改为 `buildBackupPayload`，与 WebDav 内容一致。

常量 `VISIT_HISTORY_STORAGE_KEY` 从 `visit-history-plugin.ts` 导出，备份侧复用。

## 3. 实施

| 文件 | 改动 |
|------|------|
| `src/plugins/visit-history-plugin.ts` | 导出 `VISIT_HISTORY_STORAGE_KEY`；注释改为「随备份」 |
| `src/plugins/setting-plugin.tsx` | `buildBackupPayload` 注入 `__localStorage`；新增 `applyBackupLocalStorage`；本地/WebDav 导入前调用；`exportData` 改用 buildBackupPayload |
| `vite.config.ts` | version 1.17.2→1.17.3 |
| `doc/README.md` / `changelog/CHANGELOG.md` | 同步 |

## 4. 验证

```bash
$ npx tsc -b && npx vite build   # @version 1.17.3
```

建议：本机访问若干页面 → WebDav 备份 → 清 localStorage `jhs_visit_history` →
从备份导入 → 详情页元数据链接悬浮应恢复「最近打开时间」。
