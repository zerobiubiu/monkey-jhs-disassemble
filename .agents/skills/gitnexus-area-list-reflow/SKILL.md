---
name: gitnexus-area-list-reflow
description: "Skill for the List-reflow area of monkey-jhs-disassemble. 46 symbols across 13 files."
---

# List-reflow

46 symbols | 13 files | Cohesion: 68%

## When to Use

- Working with code in `src/`
- Understanding how readPersistentValue, writePersistentValue, writePersistentValueAndWait work
- Modifying list-reflow-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/plugins/list-reflow/lr-panel.tsx` | initReflowPanel, renderMemberRows, toElement, finishExecution, onProgress (+5) |
| `src/plugins/list-reflow/lr-journal.ts` | appendRollback, createSessionId, loadRollback, saveJournal, hasResumableJournal (+3) |
| `src/plugins/list-reflow/lr-data.ts` | getCurrentListId, absoluteNextUrl, enumerateListVideos, extractListId, fetchAllUserLists (+1) |
| `src/core/storage/persistent-data-store.ts` | readPersistentValue, writePersistentValue, writePersistentValueAndWait, set, removePersistentValue |
| `src/plugins/list-reflow/lr-plan.ts` | div, previewIds, renderPlan, runPlanPreview |
| `src/plugins/list-reflow/lr-execute.ts` | executeCompactionPlan, sleep, undoSession |
| `src/plugins/list-reflow/lr-planner.ts` | dedupePreserveOrder, planCompaction, sortListsAsc |
| `src/core/sync/sync-intent-journal.ts` | writeIntent, clearIntent |
| `src/plugins/video-lists-tag/server/vlt-server-api.ts` | createPendingJournal |
| `tests/lr-execute.test.ts` | run |

## Entry Points

Start here when exploring this area:

- **`readPersistentValue`** (Function) — `src/core/storage/persistent-data-store.ts:285`
- **`writePersistentValue`** (Function) — `src/core/storage/persistent-data-store.ts:300`
- **`writePersistentValueAndWait`** (Function) — `src/core/storage/persistent-data-store.ts:318`
- **`writeIntent`** (Function) — `src/core/sync/sync-intent-journal.ts:34`
- **`executeCompactionPlan`** (Function) — `src/plugins/list-reflow/lr-execute.ts:150`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `readPersistentValue` | Function | `src/core/storage/persistent-data-store.ts` | 285 |
| `writePersistentValue` | Function | `src/core/storage/persistent-data-store.ts` | 300 |
| `writePersistentValueAndWait` | Function | `src/core/storage/persistent-data-store.ts` | 318 |
| `writeIntent` | Function | `src/core/sync/sync-intent-journal.ts` | 34 |
| `executeCompactionPlan` | Function | `src/plugins/list-reflow/lr-execute.ts` | 150 |
| `undoSession` | Function | `src/plugins/list-reflow/lr-execute.ts` | 277 |
| `appendRollback` | Function | `src/plugins/list-reflow/lr-journal.ts` | 77 |
| `createSessionId` | Function | `src/plugins/list-reflow/lr-journal.ts` | 97 |
| `loadRollback` | Function | `src/plugins/list-reflow/lr-journal.ts` | 85 |
| `saveJournal` | Function | `src/plugins/list-reflow/lr-journal.ts` | 53 |
| `createPendingJournal` | Function | `src/plugins/video-lists-tag/server/vlt-server-api.ts` | 44 |
| `ReflowPanel` | Function | `src/components/list-reflow/reflow-panel.tsx` | 15 |
| `getCurrentListId` | Function | `src/plugins/list-reflow/lr-data.ts` | 56 |
| `hasResumableJournal` | Function | `src/plugins/list-reflow/lr-journal.ts` | 69 |
| `loadJournal` | Function | `src/plugins/list-reflow/lr-journal.ts` | 59 |
| `initReflowPanel` | Function | `src/plugins/list-reflow/lr-panel.tsx` | 118 |
| `finishExecution` | Function | `src/plugins/list-reflow/lr-panel.tsx` | 234 |
| `onProgress` | Function | `src/plugins/list-reflow/lr-panel.tsx` | 405 |
| `onProgress` | Function | `src/plugins/list-reflow/lr-panel.tsx` | 266 |
| `runExecution` | Function | `src/plugins/list-reflow/lr-panel.tsx` | 248 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Handle → PutRecords` | cross_community | 10 |
| `Handle → PutRecords` | cross_community | 10 |
| `Handle → EnqueueWrite` | cross_community | 10 |
| `RunExecution → Open` | cross_community | 8 |
| `BindFavSyncPanel → Open` | cross_community | 8 |
| `BindFavSyncPanel → RecordId` | cross_community | 7 |
| `RunExecution → AssertInitialized` | cross_community | 7 |
| `RunExecution → PutRecords` | cross_community | 7 |
| `RunExecution → EnqueueWrite` | cross_community | 7 |
| `BindFavSyncPanel → PutRecords` | cross_community | 7 |

## How to Explore

1. `context({name: "readPersistentValue"})` — see callers and callees
2. `query({search_query: "list-reflow"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
