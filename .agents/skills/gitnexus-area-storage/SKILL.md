---
name: gitnexus-area-storage
description: "Skill for the Storage area of monkey-jhs-disassemble. 112 symbols across 18 files."
---

# Storage

112 symbols | 18 files | Cohesion: 77%

## When to Use

- Working with code in `src/`
- Understanding how batchSaveBlacklistCarList, getBlacklistCarList, removeBlacklistCarList work
- Modifying storage-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/storage/persistent-data-store.ts` | recordId, assertInitialized, delete, enqueueWrite, get (+15) |
| `src/core/storage/persistent-data-backend.ts` | deleteRecord, loadMeta, open, putRecord, putRecords (+11) |
| `src/core/storage/persistent-data-migration.ts` | buildState, migratePersistentData, sourceKeysFor, removeItem, collectEntries (+9) |
| `src/core/storage/storage-migrations.ts` | async_merge_other, fn, clean_no_url_blacklist, fn, merge_blacklist (+9) |
| `src/core/storage/car-list-ops.ts` | saveCar, saveCarList, saveSingleCar, updateCarInfo, batchRemoveCars (+3) |
| `tests/persistent-data-migration.test.ts` | deleteRecord, putRecord, putRecords, loadMeta, FakeBackend (+2) |
| `src/core/storage-manager.ts` | importData, removeNewVideoList, runMigrations, _saveSingleCar, getSetting (+2) |
| `src/core/storage/favorite-actress-ops.ts` | addFavoriteActressList, getFavoriteActressList, removeFavoriteActress, removeNewVideoList, updateFavoriteActress |
| `src/core/storage/blacklist-ops.ts` | addBlacklistItem, deleteBlacklistItem, getBlacklist, updateBlacklistItem |
| `src/core/storage/blacklist-car-list-ops.ts` | batchSaveBlacklistCarList, getBlacklistCarList, removeBlacklistCarList |

## Entry Points

Start here when exploring this area:

- **`batchSaveBlacklistCarList`** (Function) — `src/core/storage/blacklist-car-list-ops.ts:39`
- **`getBlacklistCarList`** (Function) — `src/core/storage/blacklist-car-list-ops.ts:18`
- **`removeBlacklistCarList`** (Function) — `src/core/storage/blacklist-car-list-ops.ts:63`
- **`addBlacklistItem`** (Function) — `src/core/storage/blacklist-ops.ts:41`
- **`deleteBlacklistItem`** (Function) — `src/core/storage/blacklist-ops.ts:101`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `IndexedDbBackend` | Class | `src/core/storage/persistent-data-backend.ts` | 31 |
| `batchSaveBlacklistCarList` | Function | `src/core/storage/blacklist-car-list-ops.ts` | 39 |
| `getBlacklistCarList` | Function | `src/core/storage/blacklist-car-list-ops.ts` | 18 |
| `removeBlacklistCarList` | Function | `src/core/storage/blacklist-car-list-ops.ts` | 63 |
| `addBlacklistItem` | Function | `src/core/storage/blacklist-ops.ts` | 41 |
| `deleteBlacklistItem` | Function | `src/core/storage/blacklist-ops.ts` | 101 |
| `getBlacklist` | Function | `src/core/storage/blacklist-ops.ts` | 32 |
| `updateBlacklistItem` | Function | `src/core/storage/blacklist-ops.ts` | 81 |
| `saveCar` | Function | `src/core/storage/car-list-ops.ts` | 173 |
| `encryptBackupV2` | Function | `src/core/backup-crypto.ts` | 84 |
| `collectGmStorageBackup` | Function | `src/core/backup-extra-storage.ts` | 83 |
| `collectLocalStorageBackup` | Function | `src/core/backup-extra-storage.ts` | 63 |
| `flushPersistentData` | Function | `src/core/storage/persistent-data-store.ts` | 230 |
| `buildBackupPayload` | Function | `src/plugins/setting/data-import-export.ts` | 56 |
| `exportData` | Function | `src/plugins/setting/data-import-export.ts` | 151 |
| `addFavoriteActressList` | Function | `src/core/storage/favorite-actress-ops.ts` | 56 |
| `getFavoriteActressList` | Function | `src/core/storage/favorite-actress-ops.ts` | 39 |
| `removeFavoriteActress` | Function | `src/core/storage/favorite-actress-ops.ts` | 133 |
| `removeNewVideoList` | Function | `src/core/storage/favorite-actress-ops.ts` | 205 |
| `updateFavoriteActress` | Function | `src/core/storage/favorite-actress-ops.ts` | 154 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Observer → ShowToast` | cross_community | 10 |
| `Handle → AssertInitialized` | cross_community | 10 |
| `Handle → PutRecords` | cross_community | 10 |
| `Handle → PutRecords` | cross_community | 10 |
| `Handle → EnqueueWrite` | cross_community | 10 |
| `Handle → ShowToast` | cross_community | 10 |
| `RunExecution → Open` | cross_community | 8 |
| `Handle → ReportPersistenceError` | cross_community | 8 |
| `BindFavSyncPanel → Open` | cross_community | 8 |
| `Success → ShowToast` | cross_community | 8 |

## How to Explore

1. `context({name: "batchSaveBlacklistCarList"})` — see callers and callees
2. `query({search_query: "storage"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
