---
name: gitnexus-area-car-status-sync
description: "Skill for the Car-status-sync area of monkey-jhs-disassemble. 68 symbols across 11 files."
---

# Car-status-sync

68 symbols | 11 files | Cohesion: 74%

## When to Use

- Working with code in `src/`
- Understanding how withExclusiveLock, countColumnar, gzipToBase64 work
- Modifying car-status-sync-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/plugins/car-status-sync/car-status-db.ts` | canApplyRevision, clearAppliedRevision, importLocalDB, normalizeJavdbUrlPath, normalizeLocalRecord (+13) |
| `src/plugins/car-status-sync/missav-status-tag-plugin.ts` | applyFull, tryProcess, observeAndProcess, processAll, processListPage (+10) |
| `src/plugins/car-status-sync/car-status-columnar.ts` | countColumnar, gzipToBase64, isSafeUrlPath, normalizeUrl, toColumnar (+7) |
| `src/plugins/car-status-sync/car-list-reader-plugin.ts` | appendDeltaJournal, nextRevision, publishSnapshot, handle, pushDelta (+2) |
| `src/plugins/car-status-sync/car-status-journal.ts` | compactDeltaJournal, countDeltaItems, getPayloadRevision, readDeltaJournal, sortDeltaJournal (+1) |
| `src/plugins/car-status-sync/missav-renderer.ts` | createBadge, normalizeCarNum, renderBadges |
| `src/plugins/setting/data-import-export.ts` | handleMissavSync, handleMissavFileChange |
| `src/core/sync/sync-intent-journal.ts` | cleanStaleIntents, readPendingIntents |
| `src/core/sync/sync-lock.ts` | withExclusiveLock |
| `src/core/storage/persistent-data-store.ts` | readPersistentPrefix |

## Entry Points

Start here when exploring this area:

- **`withExclusiveLock`** (Function) — `src/core/sync/sync-lock.ts:25`
- **`countColumnar`** (Function) — `src/plugins/car-status-sync/car-status-columnar.ts:171`
- **`gzipToBase64`** (Function) — `src/plugins/car-status-sync/car-status-columnar.ts:189`
- **`normalizeUrl`** (Function) — `src/plugins/car-status-sync/car-status-columnar.ts:31`
- **`toColumnar`** (Function) — `src/plugins/car-status-sync/car-status-columnar.ts:81`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `withExclusiveLock` | Function | `src/core/sync/sync-lock.ts` | 25 |
| `countColumnar` | Function | `src/plugins/car-status-sync/car-status-columnar.ts` | 171 |
| `gzipToBase64` | Function | `src/plugins/car-status-sync/car-status-columnar.ts` | 189 |
| `normalizeUrl` | Function | `src/plugins/car-status-sync/car-status-columnar.ts` | 31 |
| `toColumnar` | Function | `src/plugins/car-status-sync/car-status-columnar.ts` | 81 |
| `compactDeltaJournal` | Function | `src/plugins/car-status-sync/car-status-journal.ts` | 77 |
| `countDeltaItems` | Function | `src/plugins/car-status-sync/car-status-journal.ts` | 72 |
| `getPayloadRevision` | Function | `src/plugins/car-status-sync/car-status-journal.ts` | 19 |
| `readDeltaJournal` | Function | `src/plugins/car-status-sync/car-status-journal.ts` | 55 |
| `sortDeltaJournal` | Function | `src/plugins/car-status-sync/car-status-journal.ts` | 61 |
| `handleMissavSync` | Function | `src/plugins/setting/data-import-export.ts` | 233 |
| `buildJavdbUrl` | Function | `src/plugins/car-status-sync/car-status-columnar.ts` | 59 |
| `columnarToFlat` | Function | `src/plugins/car-status-sync/car-status-columnar.ts` | 145 |
| `gunzipFromBase64` | Function | `src/plugins/car-status-sync/car-status-columnar.ts` | 218 |
| `importLocalDB` | Function | `src/plugins/car-status-sync/car-status-db.ts` | 594 |
| `normalizeJavdbUrlPath` | Function | `src/plugins/car-status-sync/car-status-db.ts` | 183 |
| `normalizeLocalRecord` | Function | `src/plugins/car-status-sync/car-status-db.ts` | 217 |
| `openLocalDB` | Function | `src/plugins/car-status-sync/car-status-db.ts` | 31 |
| `readLocalCarsSnapshot` | Function | `src/plugins/car-status-sync/car-status-db.ts` | 402 |
| `replaceLocalCars` | Function | `src/plugins/car-status-sync/car-status-db.ts` | 523 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ApplyFull → SanitizeUrl` | cross_community | 8 |
| `Handle → SanitizeUrl` | cross_community | 8 |
| `ApplyFull → OpenLocalDB` | cross_community | 7 |
| `ApplyFull → NormalizeCarNum` | cross_community | 7 |
| `Handle → OpenLocalDB` | cross_community | 7 |
| `Handle → NormalizeCarNum` | cross_community | 7 |
| `Handle → WithExclusiveLock` | intra_community | 6 |
| `Handle → NormalizeUrl` | intra_community | 6 |
| `Handle → CountColumnar` | intra_community | 5 |
| `HandleMissavFileChange → GetToastContainer` | cross_community | 5 |

## How to Explore

1. `context({name: "withExclusiveLock"})` — see callers and callees
2. `query({search_query: "car-status-sync"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
