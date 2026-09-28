---
name: gitnexus-area-plugins
description: "Skill for the Plugins area of monkey-jhs-disassemble. 442 symbols across 132 files."
---

# Plugins

442 symbols | 132 files | Cohesion: 76%

## When to Use

- Working with code in `src/`
- Understanding how ActressInfoDetailSegment, ActressInfoStarPageHtml, HitShowScore work
- Modifying plugins-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/plugins/detail-page-button-plugin.tsx` | refreshItemStatusTag, _clearListPanelLoadTimeout, _createListPanelEntry, _isListContainerLoaded, _loadAllListPages (+19) |
| `src/plugins/visit-history-plugin.ts` | VisitHistoryPlugin, destroy, bindPageshow, handle, injectMetaLinkTooltips (+14) |
| `src/plugins/other-site-plugin.tsx` | handle, OtherSitePlugin, destroy, getEnabledSites, handleSite (+10) |
| `src/plugins/history-plugin.tsx` | HistoryPlugin, applyAction, bindClick, handleClickDetail, handleDelete (+8) |
| `src/plugins/setting-plugin.tsx` | SettingPlugin, toggleSettingBox, addBackToTopBtn, cancelSimpleSettingHide, handle (+8) |
| `src/plugins/auto-page-plugin.ts` | checkLoad, checkScrollPosition, handle, loadNextPage, setState (+8) |
| `src/plugins/fc2-by-123av-plugin.tsx` | Fc2By123AvPlugin, handleLongImg, saveAction, get123AvVideoInfo, getActressInfo (+7) |
| `src/plugins/missav-quick-copy-plugin.tsx` | MissavQuickCopyPlugin, createButton, createSVGClipboard, createSVGJavDB, extractCode (+7) |
| `src/plugins/list-page-plugin.tsx` | translate, observer, addJumpPageControl, bindClick, checkDom (+7) |
| `src/plugins/list-reading-status-plugin.ts` | ListReadingStatusPlugin, destroy, refreshListToolbar, applySortAndFilter, ensureHeaderWidgets (+6) |

## Entry Points

Start here when exploring this area:

- **`ActressInfoDetailSegment`** (Function) — `src/components/actress/actress-info-detail-segment.tsx:61`
- **`ActressInfoStarPageHtml`** (Function) — `src/components/actress/actress-info-star-page-html.tsx:39`
- **`HitShowScore`** (Function) — `src/components/hit-show/hit-show-score.tsx:57`
- **`TranslatedTitle`** (Function) — `src/components/misc/translated-title.tsx:34`
- **`readPersistentMap`** (Function) — `src/core/storage/persistent-data-store.ts:235`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `KeyedQueue` | Class | `src/core/sync/sync-queue.ts` | 14 |
| `ActressInfoPlugin` | Class | `src/plugins/actress-info-plugin.tsx` | 41 |
| `BasePlugin` | Class | `src/plugins/base-plugin.ts` | 57 |
| `BlacklistPlugin` | Class | `src/plugins/blacklist-plugin.tsx` | 68 |
| `CarListReaderPlugin` | Class | `src/plugins/car-status-sync/car-list-reader-plugin.ts` | 53 |
| `MissavStatusTagPlugin` | Class | `src/plugins/car-status-sync/missav-status-tag-plugin.ts` | 58 |
| `DetailPagePlugin` | Class | `src/plugins/detail-page-plugin.ts` | 15 |
| `FavoriteActressesPlugin` | Class | `src/plugins/favorite-actresses-plugin.tsx` | 52 |
| `Fc2By123AvPlugin` | Class | `src/plugins/fc2-by-123av-plugin.tsx` | 30 |
| `Fc2Plugin` | Class | `src/plugins/fc2-plugin.tsx` | 48 |
| `FoldCategoryPlugin` | Class | `src/plugins/fold-category-plugin.tsx` | 38 |
| `HighlightMagnetPlugin` | Class | `src/plugins/highlight-magnet-plugin.ts` | 21 |
| `HistoryPlugin` | Class | `src/plugins/history-plugin.tsx` | 63 |
| `HitShowPlugin` | Class | `src/plugins/hit-show-plugin.tsx` | 34 |
| `ImageRecognitionPlugin` | Class | `src/plugins/image-recognition-plugin.tsx` | 28 |
| `KeyPageTurningPlugin` | Class | `src/plugins/key-page-turning-plugin.ts` | 32 |
| `ListPageButtonPlugin` | Class | `src/plugins/list-page-button-plugin.tsx` | 43 |
| `ListReflowPlugin` | Class | `src/plugins/list-reflow/list-reflow-plugin.ts` | 25 |
| `MagnetHubPlugin` | Class | `src/plugins/magnet-hub-plugin.tsx` | 46 |
| `MissavQuickCopyPlugin` | Class | `src/plugins/missav-quick-copy-plugin.tsx` | 279 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Observer → ShowToast` | cross_community | 10 |
| `Handle → EscapeText` | cross_community | 10 |
| `Handle → IsReactElement` | cross_community | 10 |
| `Handle → AssertInitialized` | cross_community | 10 |
| `Handle → PutRecords` | cross_community | 10 |
| `Handle → PutRecords` | cross_community | 10 |
| `Handle → EnqueueWrite` | cross_community | 10 |
| `Handle → ShowToast` | cross_community | 10 |
| `Handle → IsRecord` | cross_community | 9 |
| `Handle → Fc2123avDetailDialog` | cross_community | 8 |

## How to Explore

1. `context({name: "ActressInfoDetailSegment"})` — see callers and callees
2. `query({search_query: "plugins"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
