---
name: gitnexus-area-setting
description: "Skill for the Setting area of monkey-jhs-disassemble. 88 symbols across 25 files."
---

# Setting

88 symbols | 25 files | Cohesion: 74%

## When to Use

- Working with code in `src/`
- Understanding how CacheItemHtml, VideoQualityOption, q work
- Modifying setting-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/plugins/setting/git-backup-client.ts` | base64ToUtf8, buildContentsPath, utf8ToBase64, backup, buildHeaders (+12) |
| `src/plugins/setting/cache-management.ts` | formatSize, getCacheStats, handleCleanAllCache, handleCleanCache, handleExportCache (+5) |
| `src/plugins/setting/webdav-operations.ts` | formatter, formatter, formatter, getData, getElement (+5) |
| `src/plugins/setting-plugin.tsx` | openSettingDialog, autoBackup, buildBackupPayload, addKeyword, addLabelTag (+2) |
| `src/plugins/setting/data-import-export.ts` | downloadJson, handleMissavExportClick, handleMissavImportClick, handleVltExportClick, handleVltImportClick (+1) |
| `src/core/auto-backup.ts` | getTodayStr, markAutoBackupDone, shouldAutoBackup, generateUuid, getAutoBackupFileName (+1) |
| `src/plugins/setting/git-operations.ts` | getGitCredentialsFromGm, backupDataByGit, backupListBtnByGit, buildGitClient, getGitCredentials |
| `src/core/backup-crypto.ts` | base64ToBytes, decryptBackupV2, deriveKey, isBackupV2 |
| `src/plugins/setting/backup-provider.ts` | deleteFile, getBackupList, getFileContent, BackupProvider |
| `src/core/backup-extra-storage.ts` | applyBackupExtras, stripBackupExtras |

## Entry Points

Start here when exploring this area:

- **`CacheItemHtml`** (Function) — `src/components/setting/cache-item-html.tsx:38`
- **`VideoQualityOption`** (Function) — `src/components/setting/video-quality-option.tsx:33`
- **`q`** (Function) — `src/core/util/util-popup.ts:14`
- **`exportLocalDB`** (Function) — `src/plugins/car-status-sync/car-status-db.ts:124`
- **`formatSize`** (Function) — `src/plugins/setting/cache-management.ts:63`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `WebDavClient` | Class | `src/core/webdav.ts` | 41 |
| `GitBackupClient` | Class | `src/plugins/setting/git-backup-client.ts` | 140 |
| `GitHttpError` | Class | `src/plugins/setting/git-backup-client.ts` | 66 |
| `CacheItemHtml` | Function | `src/components/setting/cache-item-html.tsx` | 38 |
| `VideoQualityOption` | Function | `src/components/setting/video-quality-option.tsx` | 33 |
| `q` | Function | `src/core/util/util-popup.ts` | 14 |
| `exportLocalDB` | Function | `src/plugins/car-status-sync/car-status-db.ts` | 124 |
| `formatSize` | Function | `src/plugins/setting/cache-management.ts` | 63 |
| `getCacheStats` | Function | `src/plugins/setting/cache-management.ts` | 51 |
| `handleCleanAllCache` | Function | `src/plugins/setting/cache-management.ts` | 149 |
| `handleCleanCache` | Function | `src/plugins/setting/cache-management.ts` | 124 |
| `handleExportCache` | Function | `src/plugins/setting/cache-management.ts` | 190 |
| `handleViewCache` | Function | `src/plugins/setting/cache-management.ts` | 180 |
| `refreshAllCacheStats` | Function | `src/plugins/setting/cache-management.ts` | 85 |
| `refreshCacheStats` | Function | `src/plugins/setting/cache-management.ts` | 75 |
| `refreshPreloadCacheStats` | Function | `src/plugins/setting/cache-management.ts` | 103 |
| `downloadJson` | Function | `src/plugins/setting/data-import-export.ts` | 39 |
| `handleMissavExportClick` | Function | `src/plugins/setting/data-import-export.ts` | 308 |
| `handleMissavImportClick` | Function | `src/plugins/setting/data-import-export.ts` | 266 |
| `handleVltExportClick` | Function | `src/plugins/setting/data-import-export.ts` | 210 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `HandleCleanCache → AssertInitialized` | cross_community | 7 |
| `HandleCleanCache → Open` | cross_community | 7 |
| `BindClick → AssertInitialized` | cross_community | 7 |
| `Handle → AssertInitialized` | cross_community | 7 |
| `AutoBackup → _getAuthHeaders` | cross_community | 6 |
| `HandleCleanCache → IsRecord` | cross_community | 6 |
| `BindClick → IsRecord` | cross_community | 6 |
| `Handle → IsRecord` | cross_community | 6 |
| `HandleCleanAllCache → AssertInitialized` | cross_community | 6 |
| `BackupDataByGit → AssertInitialized` | cross_community | 6 |

## How to Explore

1. `context({name: "CacheItemHtml"})` — see callers and callees
2. `query({search_query: "setting"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
