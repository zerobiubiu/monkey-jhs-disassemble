---
name: gitnexus-area-blacklist
description: "Skill for the Blacklist area of monkey-jhs-disassemble. 52 symbols across 32 files."
---

# Blacklist

52 symbols | 32 files | Cohesion: 54%

## When to Use

- Working with code in `src/`
- Understanding how BlacklistDialog, BlacklistNameCell, BlacklistPaginationCounter work
- Modifying blacklist-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/plugins/blacklist/blacklist-tabulator.tsx` | formatter, formatter, formatter, paginationCounter, buildBlacklistTableOptions (+1) |
| `src/plugins/blacklist-plugin.tsx` | openBlacklistDialog, success, getTableData, loadTableData, reloadTable (+1) |
| `src/core/jsx-to-string.ts` | escapeText, isReactElement, jsxToString, renderChildren |
| `src/plugins/history/history-tabulator.tsx` | formatter, formatter, formatter, formatter |
| `src/plugins/setting/setting-tag-ops.ts` | addKeyword, addLabelTag |
| `src/plugins/top250-plugin.tsx` | hookPage, renderPagination |
| `src/plugins/want-and-watched-videos-plugin.tsx` | handle, importWantWatchVideos |
| `src/plugins/blacklist/blacklist-scraper.tsx` | filterActorVideo, parseAndSaveFilterInfo |
| `src/components/blacklist/blacklist-dialog.tsx` | BlacklistDialog |
| `src/components/blacklist/blacklist-name-cell.tsx` | BlacklistNameCell |

## Entry Points

Start here when exploring this area:

- **`BlacklistDialog`** (Function) — `src/components/blacklist/blacklist-dialog.tsx:42`
- **`BlacklistNameCell`** (Function) — `src/components/blacklist/blacklist-name-cell.tsx:35`
- **`BlacklistPaginationCounter`** (Function) — `src/components/blacklist/blacklist-pagination-counter.tsx:37`
- **`BlacklistStatusCell`** (Function) — `src/components/blacklist/blacklist-status-cell.tsx:36`
- **`BlacklistUrlTypeCell`** (Function) — `src/components/blacklist/blacklist-url-type-cell.tsx:32`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `BlacklistDialog` | Function | `src/components/blacklist/blacklist-dialog.tsx` | 42 |
| `BlacklistNameCell` | Function | `src/components/blacklist/blacklist-name-cell.tsx` | 35 |
| `BlacklistPaginationCounter` | Function | `src/components/blacklist/blacklist-pagination-counter.tsx` | 37 |
| `BlacklistStatusCell` | Function | `src/components/blacklist/blacklist-status-cell.tsx` | 36 |
| `BlacklistUrlTypeCell` | Function | `src/components/blacklist/blacklist-url-type-cell.tsx` | 32 |
| `NewVideoDialog` | Function | `src/components/dialogs/new-video-dialog.tsx` | 43 |
| `ImageRecognitionDialog` | Function | `src/components/image-recognition/image-recognition-dialog.tsx` | 32 |
| `ConfirmWarn` | Function | `src/components/misc/confirm-warn.tsx` | 40 |
| `NewVideoDialogTitle` | Function | `src/components/misc/new-video-dialog-title.tsx` | 21 |
| `TableLinkParam` | Function | `src/components/misc/table-link-param.tsx` | 35 |
| `RankingContainers` | Function | `src/components/movie/ranking-containers.tsx` | 23 |
| `ReviewLinkContent` | Function | `src/components/review/review-link-content.tsx` | 34 |
| `ColoredTextCell` | Function | `src/components/shared/colored-text-cell.tsx` | 22 |
| `Top250Pagination` | Function | `src/components/top250/top250-pagination.tsx` | 33 |
| `WantWatchedHintSpan` | Function | `src/components/want-watched/want-watched-hint-span.tsx` | 30 |
| `WantWatchedImportButton` | Function | `src/components/want-watched/want-watched-import-button.tsx` | 30 |
| `escapeText` | Function | `src/core/jsx-to-string.ts` | 94 |
| `jsxToString` | Function | `src/core/jsx-to-string.ts` | 274 |
| `formatter` | Function | `src/plugins/blacklist/blacklist-tabulator.tsx` | 127 |
| `formatter` | Function | `src/plugins/blacklist/blacklist-tabulator.tsx` | 45 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Handle → EscapeText` | cross_community | 10 |
| `Handle → IsReactElement` | cross_community | 10 |
| `Init → EscapeText` | cross_community | 8 |
| `Init → IsReactElement` | cross_community | 8 |
| `Success → EscapeText` | cross_community | 7 |
| `Success → IsReactElement` | cross_community | 7 |
| `InitDmm → EscapeText` | cross_community | 7 |
| `Handle → IsReactElement` | cross_community | 7 |
| `Handle → EscapeText` | cross_community | 7 |
| `LoadScreenShot → IsReactElement` | cross_community | 7 |

## How to Explore

1. `context({name: "BlacklistDialog"})` — see callers and callees
2. `query({search_query: "blacklist"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
