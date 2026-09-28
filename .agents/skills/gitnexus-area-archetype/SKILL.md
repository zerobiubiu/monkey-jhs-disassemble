---
name: gitnexus-area-archetype
description: "Skill for the Archetype area of monkey-jhs-disassemble. 191 symbols across 12 files."
---

# Archetype

191 symbols | 12 files | Cohesion: 89%

## When to Use

- Working with code in `archetype/`
- Understanding how checkHealth, enqueueFailedDelta, extractApiError work
- Modifying archetype-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `archetype/listReadingStatus.user.js` | compareLi, countFilterStats, createDropdown, createStarWidget, ensureHeaderWidgets (+34) |
| `archetype/jhsCarListReader.user.js` | checkHealth, enqueueFailedDelta, extractApiError, fetchHwm, flushPendingQueue (+23) |
| `archetype/missavStatusTag.user.js` | columnarToFlat, fetchCarsSince, fetchHwm, gmXHR, main (+21) |
| `archetype/videoListsTag.user.js` | applyFilter, buildFilterBar, createFilterChip, refreshChips, buildFilterModeDropdown (+16) |
| `archetype/listsOptionSync.user.js` | dismissToast, onTransitionEnd, getToastContainer, gmPost, handleCheckboxChange (+13) |
| `archetype/listWaterfall.user.js` | findNextUrl, gmGet, rewriteItemLinks, toAbsolute, checkLoad (+10) |
| `archetype/statusTagFilter.user.js` | applyFilter, collectStatusTagCounts, countNoStatusItems, createFilterChip, refreshChips (+7) |
| `archetype/pageSort.user.js` | compareItems, getStrongText, sortFn, sortFn, createSortSelector (+6) |
| `archetype/MissAV Quick Copy & Javdb Search.user.js` | copyToClipboard, copyBtn, javdbBtn, openInNewTab, showToast (+5) |
| `archetype/jhsRatingDisplay.user.js` | fetchRating, flushPending, parseRating, init, loadAll (+2) |

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `checkHealth` | Function | `archetype/jhsCarListReader.user.js` | 573 |
| `enqueueFailedDelta` | Function | `archetype/jhsCarListReader.user.js` | 740 |
| `extractApiError` | Function | `archetype/jhsCarListReader.user.js` | 553 |
| `fetchHwm` | Function | `archetype/jhsCarListReader.user.js` | 612 |
| `flushPendingQueue` | Function | `archetype/jhsCarListReader.user.js` | 817 |
| `gmXHR` | Function | `archetype/jhsCarListReader.user.js` | 523 |
| `gzipToBuffer` | Function | `archetype/jhsCarListReader.user.js` | 398 |
| `isoToLocalStr` | Function | `archetype/jhsCarListReader.user.js` | 163 |
| `loadPendingQueue` | Function | `archetype/jhsCarListReader.user.js` | 714 |
| `menuHealthCheck` | Function | `archetype/jhsCarListReader.user.js` | 1140 |
| `menuPendingQueue` | Function | `archetype/jhsCarListReader.user.js` | 1170 |
| `mergeGroups` | Function | `archetype/jhsCarListReader.user.js` | 778 |
| `pushCars` | Function | `archetype/jhsCarListReader.user.js` | 643 |
| `savePendingQueue` | Function | `archetype/jhsCarListReader.user.js` | 727 |
| `showSyncResult` | Function | `archetype/jhsCarListReader.user.js` | 1081 |
| `syncDeltaCars` | Function | `archetype/jhsCarListReader.user.js` | 898 |
| `compareLi` | Function | `archetype/listReadingStatus.user.js` | 864 |
| `countFilterStats` | Function | `archetype/listReadingStatus.user.js` | 1014 |
| `createDropdown` | Function | `archetype/listReadingStatus.user.js` | 588 |
| `createStarWidget` | Function | `archetype/listReadingStatus.user.js` | 537 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `EnsureWidgets → GetLastUriMap` | cross_community | 6 |
| `EnsureWidgets → GetRatingMap` | cross_community | 6 |
| `EnsureWidgets → GetReadSet` | cross_community | 6 |
| `EnsureWidgets → OpenJhsDB` | cross_community | 6 |
| `Main → OpenDBWithVersion` | intra_community | 4 |
| `Init → SetState` | intra_community | 4 |
| `Main → MeasureSize` | intra_community | 3 |
| `Main → NormalizeUrl` | intra_community | 3 |
| `EnsureWidgets → UpdateSelectAppearance` | intra_community | 3 |

## How to Explore

1. `context({name: "checkHealth"})` — see callers and callees
2. `query({search_query: "archetype"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
