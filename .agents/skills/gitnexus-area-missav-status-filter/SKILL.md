---
name: gitnexus-area-missav-status-filter
description: "Skill for the Missav-status-filter area of monkey-jhs-disassemble. 15 symbols across 4 files."
---

# Missav-status-filter

15 symbols | 4 files | Cohesion: 76%

## When to Use

- Working with code in `src/`
- Understanding how isVideoPage, applyFilter, shouldShow work
- Modifying missav-status-filter-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/plugins/missav-status-filter/missav-status-filter-plugin.ts` | applyActiveFilter, buildFilterBar, handle, observerNeedsRefresh, startObserving (+2) |
| `src/plugins/missav-status-filter/mstf-collect.ts` | isVideoDetailPath, collectStatusCounts, getItemStatus, statusToLabel |
| `src/plugins/missav-status-filter/mstf-apply.ts` | applyFilter, getCell, shouldShow |
| `src/plugins/car-status-sync/missav-renderer.ts` | isVideoPage |

## Entry Points

Start here when exploring this area:

- **`isVideoPage`** (Function) — `src/plugins/car-status-sync/missav-renderer.ts:150`
- **`applyFilter`** (Function) — `src/plugins/missav-status-filter/mstf-apply.ts:35`
- **`shouldShow`** (Function) — `src/plugins/missav-status-filter/mstf-apply.ts:5`
- **`isVideoDetailPath`** (Function) — `src/plugins/missav-status-filter/mstf-collect.ts:18`
- **`collectStatusCounts`** (Function) — `src/plugins/missav-status-filter/mstf-collect.ts:34`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `isVideoPage` | Function | `src/plugins/car-status-sync/missav-renderer.ts` | 150 |
| `applyFilter` | Function | `src/plugins/missav-status-filter/mstf-apply.ts` | 35 |
| `shouldShow` | Function | `src/plugins/missav-status-filter/mstf-apply.ts` | 5 |
| `isVideoDetailPath` | Function | `src/plugins/missav-status-filter/mstf-collect.ts` | 18 |
| `collectStatusCounts` | Function | `src/plugins/missav-status-filter/mstf-collect.ts` | 34 |
| `getItemStatus` | Function | `src/plugins/missav-status-filter/mstf-collect.ts` | 29 |
| `statusToLabel` | Function | `src/plugins/missav-status-filter/mstf-collect.ts` | 25 |
| `applyActiveFilter` | Method | `src/plugins/missav-status-filter/missav-status-filter-plugin.ts` | 148 |
| `buildFilterBar` | Method | `src/plugins/missav-status-filter/missav-status-filter-plugin.ts` | 92 |
| `handle` | Method | `src/plugins/missav-status-filter/missav-status-filter-plugin.ts` | 65 |
| `observerNeedsRefresh` | Method | `src/plugins/missav-status-filter/missav-status-filter-plugin.ts` | 198 |
| `startObserving` | Method | `src/plugins/missav-status-filter/missav-status-filter-plugin.ts` | 165 |
| `tryBuild` | Method | `src/plugins/missav-status-filter/missav-status-filter-plugin.ts` | 76 |
| `renderChips` | Method | `src/plugins/missav-status-filter/missav-status-filter-plugin.ts` | 120 |
| `getCell` | Function | `src/plugins/missav-status-filter/mstf-apply.ts` | 25 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `StartObserving → GetCell` | intra_community | 6 |
| `StartObserving → ShouldShow` | intra_community | 6 |
| `StartObserving → GetItemStatus` | cross_community | 6 |
| `StartObserving → StatusToLabel` | cross_community | 6 |

## How to Explore

1. `context({name: "isVideoPage"})` — see callers and callees
2. `query({search_query: "missav-status-filter"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
