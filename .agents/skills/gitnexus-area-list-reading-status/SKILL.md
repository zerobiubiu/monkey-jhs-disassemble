---
name: gitnexus-area-list-reading-status
description: "Skill for the List-reading-status area of monkey-jhs-disassemble. 38 symbols across 5 files."
---

# List-reading-status

38 symbols | 5 files | Cohesion: 63%

## When to Use

- Working with code in `src/`
- Understanding how applySortAndFilter, createFilterChip, saveFilterRatingState work
- Modifying list-reading-status-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/plugins/list-reading-status/lrs-storage.ts` | getLastUri, getLastUriMap, getRatingMap, openJhsDB, restoreFromIndexedDB (+10) |
| `src/plugins/list-reading-status/lrs-filter.ts` | applySortAndFilter, createFilterChip, saveFilterRatingState, saveFilterReadState, applyFilter (+2) |
| `src/plugins/list-reading-status/lrs-render.ts` | createStarWidget, ensureHeaderWidgets, renderStars, createDropdown, ensureWidgets (+2) |
| `src/plugins/list-reading-status/lrs-toolbar.ts` | buildToolbar, refreshChips, restoreToolbarUI, saveSortState, tryBuildToolbar |
| `src/plugins/list-reading-status/lrs-sort.ts` | applySort, compareLi, ensureLiOrder, getListMeta |

## Entry Points

Start here when exploring this area:

- **`applySortAndFilter`** (Function) — `src/plugins/list-reading-status/lrs-filter.ts:85`
- **`createFilterChip`** (Function) — `src/plugins/list-reading-status/lrs-filter.ts:124`
- **`saveFilterRatingState`** (Function) — `src/plugins/list-reading-status/lrs-filter.ts:18`
- **`saveFilterReadState`** (Function) — `src/plugins/list-reading-status/lrs-filter.ts:12`
- **`buildToolbar`** (Function) — `src/plugins/list-reading-status/lrs-toolbar.ts:59`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `applySortAndFilter` | Function | `src/plugins/list-reading-status/lrs-filter.ts` | 85 |
| `createFilterChip` | Function | `src/plugins/list-reading-status/lrs-filter.ts` | 124 |
| `saveFilterRatingState` | Function | `src/plugins/list-reading-status/lrs-filter.ts` | 18 |
| `saveFilterReadState` | Function | `src/plugins/list-reading-status/lrs-filter.ts` | 12 |
| `buildToolbar` | Function | `src/plugins/list-reading-status/lrs-toolbar.ts` | 59 |
| `refreshChips` | Function | `src/plugins/list-reading-status/lrs-toolbar.ts` | 164 |
| `restoreToolbarUI` | Function | `src/plugins/list-reading-status/lrs-toolbar.ts` | 206 |
| `saveSortState` | Function | `src/plugins/list-reading-status/lrs-toolbar.ts` | 46 |
| `tryBuildToolbar` | Function | `src/plugins/list-reading-status/lrs-toolbar.ts` | 196 |
| `getLastUri` | Function | `src/plugins/list-reading-status/lrs-storage.ts` | 90 |
| `getLastUriMap` | Function | `src/plugins/list-reading-status/lrs-storage.ts` | 68 |
| `getRatingMap` | Function | `src/plugins/list-reading-status/lrs-storage.ts` | 34 |
| `restoreFromIndexedDB` | Function | `src/plugins/list-reading-status/lrs-storage.ts` | 182 |
| `saveLastUri` | Function | `src/plugins/list-reading-status/lrs-storage.ts` | 79 |
| `saveRatingMap` | Function | `src/plugins/list-reading-status/lrs-storage.ts` | 45 |
| `setRating` | Function | `src/plugins/list-reading-status/lrs-storage.ts` | 51 |
| `syncToIndexedDB` | Function | `src/plugins/list-reading-status/lrs-storage.ts` | 151 |
| `applyFilter` | Function | `src/plugins/list-reading-status/lrs-filter.ts` | 51 |
| `matchesFilter` | Function | `src/plugins/list-reading-status/lrs-filter.ts` | 24 |
| `createStarWidget` | Function | `src/plugins/list-reading-status/lrs-render.ts` | 29 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `TryBuildToolbar → GetLastUriMap` | cross_community | 8 |
| `TryBuildToolbar → GetRatingMap` | cross_community | 8 |
| `ProcessAllItems → GetReadSet` | cross_community | 7 |
| `ProcessAllItems → OpenJhsDB` | cross_community | 7 |
| `CreateFilterChip → GetLastUriMap` | cross_community | 7 |
| `CreateFilterChip → GetRatingMap` | cross_community | 7 |
| `TryBuildToolbar → GetReadSet` | cross_community | 7 |
| `ProcessAllItems → GetLastUriMap` | cross_community | 7 |
| `ProcessAllItems → GetRatingMap` | cross_community | 7 |
| `CreateFilterChip → GetReadSet` | cross_community | 6 |

## How to Explore

1. `context({name: "applySortAndFilter"})` — see callers and callees
2. `query({search_query: "list-reading-status"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
