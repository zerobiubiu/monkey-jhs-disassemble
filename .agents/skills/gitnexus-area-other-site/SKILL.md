---
name: gitnexus-area-other-site
description: "Skill for the Other-site area of monkey-jhs-disassemble. 18 symbols across 9 files."
---

# Other-site

18 symbols | 9 files | Cohesion: 66%

## When to Use

- Working with code in `src/`
- Understanding how PreloadStatusBadge, PreloadStatusBar, SiteResultTag work
- Modifying other-site-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/plugins/other-site/osp-preload.tsx` | doPreloadSite, getPreloadableSites, preloadListPage, preloadSite, syncAllBadges (+1) |
| `src/plugins/other-site/osp-filter-bar.ts` | applyPreloadFilter, refreshChips, collectPreloadCounts |
| `src/components/misc/preload-status-badge.tsx` | PreloadStatusBadge, PreloadStatusBar |
| `src/plugins/other-site/osp-helpers.ts` | isCacheEntryValid, getItemPreloadStatus |
| `src/components/other-site/site-result-tag.tsx` | SiteResultTag |
| `src/core/storage/persistent-data-store.ts` | replacePersistentMap |
| `src/plugins/other-site/osp-enabled-sites.ts` | getEnabledSites |
| `src/plugins/other-site/osp-probe.tsx` | probeSite |
| `src/core/async-task-queue.ts` | addTask |

## Entry Points

Start here when exploring this area:

- **`PreloadStatusBadge`** (Function) — `src/components/misc/preload-status-badge.tsx:51`
- **`PreloadStatusBar`** (Function) — `src/components/misc/preload-status-badge.tsx:33`
- **`SiteResultTag`** (Function) — `src/components/other-site/site-result-tag.tsx:22`
- **`replacePersistentMap`** (Function) — `src/core/storage/persistent-data-store.ts:268`
- **`getEnabledSites`** (Function) — `src/plugins/other-site/osp-enabled-sites.ts:10`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `PreloadStatusBadge` | Function | `src/components/misc/preload-status-badge.tsx` | 51 |
| `PreloadStatusBar` | Function | `src/components/misc/preload-status-badge.tsx` | 33 |
| `SiteResultTag` | Function | `src/components/other-site/site-result-tag.tsx` | 22 |
| `replacePersistentMap` | Function | `src/core/storage/persistent-data-store.ts` | 268 |
| `getEnabledSites` | Function | `src/plugins/other-site/osp-enabled-sites.ts` | 10 |
| `isCacheEntryValid` | Function | `src/plugins/other-site/osp-helpers.ts` | 7 |
| `preloadListPage` | Function | `src/plugins/other-site/osp-preload.tsx` | 43 |
| `syncAllBadges` | Function | `src/plugins/other-site/osp-preload.tsx` | 329 |
| `probeSite` | Function | `src/plugins/other-site/osp-probe.tsx` | 26 |
| `getItemPreloadStatus` | Function | `src/plugins/other-site/osp-helpers.ts` | 50 |
| `addTask` | Method | `src/core/async-task-queue.ts` | 49 |
| `doPreloadSite` | Function | `src/plugins/other-site/osp-preload.tsx` | 166 |
| `getPreloadableSites` | Function | `src/plugins/other-site/osp-preload.tsx` | 313 |
| `preloadSite` | Function | `src/plugins/other-site/osp-preload.tsx` | 133 |
| `updatePreloadStatus` | Function | `src/plugins/other-site/osp-preload.tsx` | 276 |
| `applyPreloadFilter` | Function | `src/plugins/other-site/osp-filter-bar.ts` | 190 |
| `refreshChips` | Function | `src/plugins/other-site/osp-filter-bar.ts` | 125 |
| `collectPreloadCounts` | Function | `src/plugins/other-site/osp-filter-bar.ts` | 170 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `StartPreloadObserver → GetItemPreloadStatus` | cross_community | 7 |
| `Handle → Open` | cross_community | 7 |
| `Handle → EnqueueWrite` | cross_community | 6 |
| `Handle → FindCarNumOrTitle` | cross_community | 5 |
| `Handle → GetBaseUrl` | cross_community | 5 |
| `Handle → InitUrl` | cross_community | 5 |
| `Handle → SearchPath` | cross_community | 5 |
| `Handle → PutRecord` | cross_community | 5 |
| `StartPreloadObserver → AssertInitialized` | cross_community | 5 |
| `PreloadListPage → NotifyIdle` | cross_community | 4 |

## How to Explore

1. `context({name: "PreloadStatusBadge"})` — see callers and callees
2. `query({search_query: "other-site"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
