---
name: gitnexus-area-detail-page-button
description: "Skill for the Detail-page-button area of monkey-jhs-disassemble. 102 symbols across 18 files."
---

# Detail-page-button

102 symbols | 18 files | Cohesion: 80%

## When to Use

- Working with code in `src/`
- Understanding how DetailMenuButtons, QuickBlockConfirmMessage, ReviewConflictDialog work
- Modifying detail-page-button-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/plugins/detail-page-button-plugin.tsx` | _syncRatingBar, _triggerJavdbReview, _triggerJavdbWant, broadcastWantWatchedSync, createMenuBtn (+18) |
| `src/plugins/detail-page-button/dpb-list-merge-ui.ts` | addToGroup, cssEscape, findNativeInput, forwardListGroupChange, liveMembers (+14) |
| `src/plugins/detail-page-button/dpb-rating-api.tsx` | quickBlock, quickConvertToFav, quickSetHasWatch, execRailsJs, getCsrfToken (+5) |
| `src/plugins/detail-page-button/dpb-list-merge.ts` | computeGroupCheckState, nextListName, groupEntries, isMergeExcluded, parseListName (+5) |
| `src/plugins/detail-page-button/dpb-list-panel.tsx` | forwardListPanelChange, syncListPanelInputState, initListPanel, ensure, showListPanelNotice (+5) |
| `src/plugins/detail-page-button/dpb-review-sync.tsx` | autoSyncReviewState, confirmReviewConflict, enqueuePush, readServerReviewState, ensure (+3) |
| `src/plugins/detail-page-button/dpb-want-watched.ts` | onWantAdded, onWantRemoved, onWatchedAdded, onWatchedRemoved, removeCarIfStatus (+2) |
| `src/plugins/detail-page-button/dpb-list-panel-render.tsx` | createListPanelEntry, showListPanelError, showListPanelLoading |
| `src/components/dpb/detail-menu-buttons.tsx` | DetailMenuButtons, statusBtnStyle |
| `src/plugins/detail-page-button/dpb-helpers.ts` | waitForEl, check |

## Entry Points

Start here when exploring this area:

- **`DetailMenuButtons`** (Function) — `src/components/dpb/detail-menu-buttons.tsx:97`
- **`QuickBlockConfirmMessage`** (Function) — `src/components/dpb/quick-block-confirm-message.tsx:33`
- **`ReviewConflictDialog`** (Function) — `src/components/dpb/review-conflict-dialog.tsx:31`
- **`MagnetHubMountBox`** (Function) — `src/components/magnet-hub/magnet-hub-mount-box.tsx:27`
- **`quickBlock`** (Function) — `src/plugins/detail-page-button/dpb-rating-api.tsx:87`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `DetailPageButtonPlugin` | Class | `src/plugins/detail-page-button-plugin.tsx` | 101 |
| `DetailMenuButtons` | Function | `src/components/dpb/detail-menu-buttons.tsx` | 97 |
| `QuickBlockConfirmMessage` | Function | `src/components/dpb/quick-block-confirm-message.tsx` | 33 |
| `ReviewConflictDialog` | Function | `src/components/dpb/review-conflict-dialog.tsx` | 31 |
| `MagnetHubMountBox` | Function | `src/components/magnet-hub/magnet-hub-mount-box.tsx` | 27 |
| `quickBlock` | Function | `src/plugins/detail-page-button/dpb-rating-api.tsx` | 87 |
| `quickConvertToFav` | Function | `src/plugins/detail-page-button/dpb-rating-api.tsx` | 143 |
| `quickSetHasWatch` | Function | `src/plugins/detail-page-button/dpb-rating-api.tsx` | 19 |
| `autoSyncReviewState` | Function | `src/plugins/detail-page-button/dpb-review-sync.tsx` | 86 |
| `readServerReviewState` | Function | `src/plugins/detail-page-button/dpb-review-sync.tsx` | 40 |
| `ensure` | Function | `src/plugins/detail-page-button/dpb-review-sync.tsx` | 63 |
| `onWantAdded` | Function | `src/plugins/detail-page-button/dpb-want-watched.ts` | 93 |
| `onWantRemoved` | Function | `src/plugins/detail-page-button/dpb-want-watched.ts` | 125 |
| `onWatchedAdded` | Function | `src/plugins/detail-page-button/dpb-want-watched.ts` | 147 |
| `onWatchedRemoved` | Function | `src/plugins/detail-page-button/dpb-want-watched.ts` | 181 |
| `removeCarIfStatus` | Function | `src/plugins/detail-page-button/dpb-want-watched.ts` | 206 |
| `handleSync` | Function | `src/plugins/detail-page-button/dpb-want-watched.ts` | 240 |
| `sleep` | Function | `src/core/util/util-misc.ts` | 47 |
| `forwardListGroupChange` | Function | `src/plugins/detail-page-button/dpb-list-merge-ui.ts` | 414 |
| `reflowGroup` | Function | `src/plugins/detail-page-button/dpb-list-merge-ui.ts` | 436 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Handle → JoinElementText` | cross_community | 7 |
| `Handle → QueryActressLinks` | cross_community | 7 |
| `SyncListPanelInputState → CssEscape` | intra_community | 6 |
| `BuildRatingBar → BroadcastSend` | cross_community | 6 |
| `OnWatchedAdded → GetScore` | cross_community | 6 |
| `OnWatchedAdded → ExtractListNameFromInput` | cross_community | 6 |
| `BuildRatingBar → JoinElementText` | cross_community | 6 |
| `BuildRatingBar → QueryActressLinks` | cross_community | 6 |
| `Ensure → BroadcastSend` | cross_community | 6 |
| `Ensure → JoinElementText` | cross_community | 6 |

## How to Explore

1. `context({name: "DetailMenuButtons"})` — see callers and callees
2. `query({search_query: "detail-page-button"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
