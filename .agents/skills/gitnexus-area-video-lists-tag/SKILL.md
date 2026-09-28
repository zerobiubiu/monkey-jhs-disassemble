---
name: gitnexus-area-video-lists-tag
description: "Skill for the Video-lists-tag area of monkey-jhs-disassemble. 152 symbols across 31 files."
---

# Video-lists-tag

152 symbols | 31 files | Cohesion: 65%

## When to Use

- Working with code in `src/`
- Understanding how onload, broadcastSubscribe, handleCheckboxChange work
- Modifying video-lists-tag-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/plugins/video-lists-tag/vlt-reconcile.ts` | pushLocalOnlyAssociation, reconcileAfterConfirmedMutation, reconcileListBeforeMutation, reconcileListWithJavdb, setupAutomaticListReconciliation (+19) |
| `src/plugins/video-lists-tag/vlt-helpers.ts` | getListInfo, matchingListCheckboxes, setListCheckboxBusy, setListCheckboxState, setListDisplayedCount (+12) |
| `src/plugins/video-lists-tag/vlt-tags.ts` | buildFilterBar, initExistingItems, loadAutoRefreshState, VltTags, setupAutoRefreshListener (+9) |
| `src/plugins/video-lists-tag/vlt-checkbox.ts` | autoFavoriteIfPendingUpdate, handleCheckboxChange, syncMoviesLists, setAutoFavCleanupEnabled, setProtectedKeywords (+6) |
| `src/plugins/video-lists-tag/vlt-create-list-api.ts` | createList, fetchListIdByName, findCurrentListCheckbox, manuallyBuildCheckbox, pollForNewCheckboxes (+5) |
| `src/plugins/video-lists-tag/vlt-list-mgmt.ts` | removeDetailPageCheckbox, updateDetailPageCheckboxLabel, closeEditModal, handleListDeletion, handleListRename (+3) |
| `src/plugins/video-lists-tag/vlt-filter-bar.ts` | buildFilterBar, boundRefreshChips, refreshChips, buildFilterModeDropdown, updateModeUI (+2) |
| `src/plugins/video-lists-tag/vlt-create-list-ui.tsx` | bindCreateListAvailability, sync, bindCreateListEvents, isCreateListPanelReady, setCreateListBusy (+1) |
| `src/plugins/page-sort-plugin.ts` | newOption, applySort, createSortSelector, handle, waitForContainer |
| `src/plugins/video-lists-tag/vlt-tag-renderer.ts` | tagsEqual, addTagDisplay, createTagBadge, getRandomBootstrapColor, renderTags |

## Entry Points

Start here when exploring this area:

- **`onload`** (Function) — `src/core/gm-http.ts:227`
- **`broadcastSubscribe`** (Function) — `src/core/util/broadcast.ts:123`
- **`handleCheckboxChange`** (Function) — `src/plugins/video-lists-tag/vlt-checkbox.ts:153`
- **`setupListMgmtBroadcastListener`** (Function) — `src/plugins/video-lists-tag/vlt-remote-sync.ts:31`
- **`handlePayload`** (Function) — `src/plugins/video-lists-tag/vlt-remote-sync.ts:36`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `VltTags` | Class | `src/plugins/video-lists-tag/vlt-tags.ts` | 72 |
| `onload` | Function | `src/core/gm-http.ts` | 227 |
| `broadcastSubscribe` | Function | `src/core/util/broadcast.ts` | 123 |
| `handleCheckboxChange` | Function | `src/plugins/video-lists-tag/vlt-checkbox.ts` | 153 |
| `setupListMgmtBroadcastListener` | Function | `src/plugins/video-lists-tag/vlt-remote-sync.ts` | 31 |
| `handlePayload` | Function | `src/plugins/video-lists-tag/vlt-remote-sync.ts` | 36 |
| `handleSyncNotify` | Function | `src/plugins/video-lists-tag/vlt-sync-listener.ts` | 42 |
| `setupAutoRefreshListener` | Function | `src/plugins/video-lists-tag/vlt-sync-listener.ts` | 88 |
| `onDelivery` | Function | `src/plugins/video-lists-tag/vlt-sync-listener.ts` | 101 |
| `postJavdbListMutation` | Function | `src/plugins/video-lists-tag/server/vlt-server-api.ts` | 97 |
| `readPendingJournals` | Function | `src/plugins/video-lists-tag/server/vlt-server-api.ts` | 72 |
| `removePendingJournal` | Function | `src/plugins/video-lists-tag/server/vlt-server-api.ts` | 64 |
| `commitAuthoritativeState` | Function | `src/plugins/video-lists-tag/server/vlt-server-recover.ts` | 27 |
| `recoverPendingServerSyncs` | Function | `src/plugins/video-lists-tag/server/vlt-server-recover.ts` | 124 |
| `getListInfo` | Function | `src/plugins/video-lists-tag/vlt-helpers.ts` | 147 |
| `matchingListCheckboxes` | Function | `src/plugins/video-lists-tag/vlt-helpers.ts` | 194 |
| `setListCheckboxBusy` | Function | `src/plugins/video-lists-tag/vlt-helpers.ts` | 207 |
| `setListCheckboxState` | Function | `src/plugins/video-lists-tag/vlt-helpers.ts` | 203 |
| `setListDisplayedCount` | Function | `src/plugins/video-lists-tag/vlt-helpers.ts` | 257 |
| `enqueueAssociationTask` | Function | `src/plugins/video-lists-tag/vlt-lock-queue.ts` | 16 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `PerformServerCheckboxMutation → Open` | cross_community | 7 |
| `BuildRatingBar → BroadcastSend` | cross_community | 6 |
| `OnWatchedAdded → GetScore` | cross_community | 6 |
| `OnWatchedAdded → ExtractListNameFromInput` | cross_community | 6 |
| `SetupListManagementListener → GetToastContainer` | cross_community | 6 |
| `PerformReconciliation → NormalizeText` | cross_community | 6 |
| `PerformReconciliation → GetCode` | cross_community | 6 |
| `PerformReconciliation → GetSeries` | cross_community | 6 |
| `Handle → GetRandomBootstrapColor` | cross_community | 6 |
| `Ensure → BroadcastSend` | cross_community | 6 |

## How to Explore

1. `context({name: "onload"})` — see callers and callees
2. `query({search_query: "video-lists-tag"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
