---
name: gitnexus-area-jhs-sync
description: "Skill for the Jhs-sync area of monkey-jhs-disassemble. 26 symbols across 4 files."
---

# Jhs-sync

26 symbols | 4 files | Cohesion: 87%

## When to Use

- Working with code in `src/`
- Understanding how bindFavSyncPanel, extractVideoId, fetchPageHtml work
- Modifying jhs-sync-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/plugins/setting/jhs-sync/sync-engine.ts` | buildQueue, emit, fetchOnePage, hasResumableSession, onSyncChange (+10) |
| `src/plugins/setting/jhs-sync/sync-common.ts` | extractVideoId, fetchPageHtml, getCsrfToken, postWantToWatch, postWatched |
| `src/plugins/setting/jhs-sync/sync-session.ts` | createSession, isResumable, loadSession, saveSession |
| `src/plugins/setting/jhs-sync/fav-sync-bind.ts` | bindFavSyncPanel, refreshUi |

## Entry Points

Start here when exploring this area:

- **`bindFavSyncPanel`** (Function) — `src/plugins/setting/jhs-sync/fav-sync-bind.ts:81`
- **`extractVideoId`** (Function) — `src/plugins/setting/jhs-sync/sync-common.ts:19`
- **`fetchPageHtml`** (Function) — `src/plugins/setting/jhs-sync/sync-common.ts:26`
- **`hasResumableSession`** (Function) — `src/plugins/setting/jhs-sync/sync-engine.ts:69`
- **`onSyncChange`** (Function) — `src/plugins/setting/jhs-sync/sync-engine.ts:46`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `bindFavSyncPanel` | Function | `src/plugins/setting/jhs-sync/fav-sync-bind.ts` | 81 |
| `extractVideoId` | Function | `src/plugins/setting/jhs-sync/sync-common.ts` | 19 |
| `fetchPageHtml` | Function | `src/plugins/setting/jhs-sync/sync-common.ts` | 26 |
| `hasResumableSession` | Function | `src/plugins/setting/jhs-sync/sync-engine.ts` | 69 |
| `onSyncChange` | Function | `src/plugins/setting/jhs-sync/sync-engine.ts` | 46 |
| `pauseSync` | Function | `src/plugins/setting/jhs-sync/sync-engine.ts` | 322 |
| `resetSync` | Function | `src/plugins/setting/jhs-sync/sync-engine.ts` | 329 |
| `resumeSync` | Function | `src/plugins/setting/jhs-sync/sync-engine.ts` | 311 |
| `startSync` | Function | `src/plugins/setting/jhs-sync/sync-engine.ts` | 301 |
| `createSession` | Function | `src/plugins/setting/jhs-sync/sync-session.ts` | 77 |
| `isResumable` | Function | `src/plugins/setting/jhs-sync/sync-session.ts` | 113 |
| `loadSession` | Function | `src/plugins/setting/jhs-sync/sync-session.ts` | 97 |
| `saveSession` | Function | `src/plugins/setting/jhs-sync/sync-session.ts` | 102 |
| `getPhaseLabel` | Function | `src/plugins/setting/jhs-sync/sync-engine.ts` | 362 |
| `getProgress` | Function | `src/plugins/setting/jhs-sync/sync-engine.ts` | 345 |
| `isRunning` | Function | `src/plugins/setting/jhs-sync/sync-engine.ts` | 64 |
| `getCsrfToken` | Function | `src/plugins/setting/jhs-sync/sync-common.ts` | 13 |
| `postWantToWatch` | Function | `src/plugins/setting/jhs-sync/sync-common.ts` | 33 |
| `postWatched` | Function | `src/plugins/setting/jhs-sync/sync-common.ts` | 53 |
| `buildQueue` | Function | `src/plugins/setting/jhs-sync/sync-engine.ts` | 100 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `BindFavSyncPanel → Open` | cross_community | 8 |
| `BindFavSyncPanel → RecordId` | cross_community | 7 |
| `BindFavSyncPanel → PutRecords` | cross_community | 7 |
| `BindFavSyncPanel → EnqueueWrite` | cross_community | 7 |
| `BindFavSyncPanel → AssertInitialized` | cross_community | 7 |
| `ResumeSync → RecordId` | cross_community | 5 |
| `ResumeSync → AssertInitialized` | cross_community | 5 |
| `BindFavSyncPanel → IsResumable` | cross_community | 4 |
| `StartSync → ReportPersistenceError` | cross_community | 4 |
| `BindFavSyncPanel → GetPhaseLabel` | cross_community | 3 |

## How to Explore

1. `context({name: "bindFavSyncPanel"})` — see callers and callees
2. `query({search_query: "jhs-sync"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
