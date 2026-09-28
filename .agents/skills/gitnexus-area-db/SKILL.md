---
name: gitnexus-area-db
description: "Skill for the Db area of monkey-jhs-disassemble. 22 symbols across 3 files."
---

# Db

22 symbols | 3 files | Cohesion: 83%

## When to Use

- Working with code in `src/`
- Understanding how check, getAllInventory, queryMoviesLists work
- Modifying db-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/plugins/video-lists-tag/db/vlt-db-core.ts` | check, getAllInventory, normalizeMeta, openDb, queryMoviesLists (+11) |
| `src/plugins/video-lists-tag/db/vlt-db-migrate.ts` | exportData, importData, isImported |
| `src/plugins/video-lists-tag/db/vlt-db-reconcile.ts` | getListAssociationCounts, getListReconcileState, reconcileListSnapshot |

## Entry Points

Start here when exploring this area:

- **`check`** (Function) — `src/plugins/video-lists-tag/db/vlt-db-core.ts:377`
- **`getAllInventory`** (Function) — `src/plugins/video-lists-tag/db/vlt-db-core.ts:389`
- **`queryMoviesLists`** (Function) — `src/plugins/video-lists-tag/db/vlt-db-core.ts:340`
- **`withState`** (Function) — `src/plugins/video-lists-tag/db/vlt-db-core.ts:190`
- **`exportData`** (Function) — `src/plugins/video-lists-tag/db/vlt-db-migrate.ts:42`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `check` | Function | `src/plugins/video-lists-tag/db/vlt-db-core.ts` | 377 |
| `getAllInventory` | Function | `src/plugins/video-lists-tag/db/vlt-db-core.ts` | 389 |
| `queryMoviesLists` | Function | `src/plugins/video-lists-tag/db/vlt-db-core.ts` | 340 |
| `withState` | Function | `src/plugins/video-lists-tag/db/vlt-db-core.ts` | 190 |
| `exportData` | Function | `src/plugins/video-lists-tag/db/vlt-db-migrate.ts` | 42 |
| `importData` | Function | `src/plugins/video-lists-tag/db/vlt-db-migrate.ts` | 12 |
| `isImported` | Function | `src/plugins/video-lists-tag/db/vlt-db-migrate.ts` | 37 |
| `getListAssociationCounts` | Function | `src/plugins/video-lists-tag/db/vlt-db-reconcile.ts` | 47 |
| `associationDesignations` | Function | `src/plugins/video-lists-tag/db/vlt-db-core.ts` | 168 |
| `bumpListRevision` | Function | `src/plugins/video-lists-tag/db/vlt-db-core.ts` | 182 |
| `deleteList` | Function | `src/plugins/video-lists-tag/db/vlt-db-core.ts` | 394 |
| `listFingerprint` | Function | `src/plugins/video-lists-tag/db/vlt-db-core.ts` | 178 |
| `randomBootstrapStyle` | Function | `src/plugins/video-lists-tag/db/vlt-db-core.ts` | 127 |
| `renameList` | Function | `src/plugins/video-lists-tag/db/vlt-db-core.ts` | 411 |
| `sync` | Function | `src/plugins/video-lists-tag/db/vlt-db-core.ts` | 263 |
| `validateSnapshot` | Function | `src/plugins/video-lists-tag/db/vlt-db-core.ts` | 236 |
| `getListReconcileState` | Function | `src/plugins/video-lists-tag/db/vlt-db-reconcile.ts` | 27 |
| `reconcileListSnapshot` | Function | `src/plugins/video-lists-tag/db/vlt-db-reconcile.ts` | 66 |
| `normalizeMeta` | Function | `src/plugins/video-lists-tag/db/vlt-db-core.ts` | 160 |
| `openDb` | Function | `src/plugins/video-lists-tag/db/vlt-db-core.ts` | 131 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Sync → NormalizeMeta` | cross_community | 3 |
| `Sync → OpenDb` | cross_community | 3 |
| `Sync → RequestResult` | cross_community | 3 |
| `Sync → TransactionDone` | cross_community | 3 |
| `ReconcileListSnapshot → AssociationDesignations` | intra_community | 3 |
| `ReconcileListSnapshot → NormalizeMeta` | cross_community | 3 |
| `ReconcileListSnapshot → OpenDb` | cross_community | 3 |
| `ReconcileListSnapshot → RequestResult` | cross_community | 3 |
| `ReconcileListSnapshot → TransactionDone` | cross_community | 3 |

## How to Explore

1. `context({name: "check"})` — see callers and callees
2. `query({search_query: "db"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
