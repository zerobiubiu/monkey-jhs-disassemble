---
name: gitnexus-area-list-page
description: "Skill for the List-page area of monkey-jhs-disassemble. 15 symbols across 6 files."
---

# List-page

15 symbols | 6 files | Cohesion: 82%

## When to Use

- Working with code in `src/`
- Understanding how PageCountTable, StatusTagHtml, buildStatusTagHtml work
- Modifying list-page-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/plugins/list-page-plugin.tsx` | filterMovieList, findCarNumAndHref, renderItemStatusTag, showCarNumBox |
| `src/core/util/util-status-tag.tsx` | buildStatusTagHtml, getStatusTagPositionStyle, injectStatusTag |
| `src/plugins/list-page/lp-dom.ts` | findCarNumAndHref, isDate, showCarNumBox |
| `src/components/misc/status-tag-html.tsx` | StatusTagHtml, parsePositionStyle |
| `src/plugins/list-page/lp-filter.tsx` | filterMovieList, renderItemStatusTag |
| `src/components/misc/page-count-table.tsx` | PageCountTable |

## Entry Points

Start here when exploring this area:

- **`PageCountTable`** (Function) — `src/components/misc/page-count-table.tsx:57`
- **`StatusTagHtml`** (Function) — `src/components/misc/status-tag-html.tsx:79`
- **`buildStatusTagHtml`** (Function) — `src/core/util/util-status-tag.tsx:103`
- **`getStatusTagPositionStyle`** (Function) — `src/core/util/util-status-tag.tsx:90`
- **`injectStatusTag`** (Function) — `src/core/util/util-status-tag.tsx:128`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `PageCountTable` | Function | `src/components/misc/page-count-table.tsx` | 57 |
| `StatusTagHtml` | Function | `src/components/misc/status-tag-html.tsx` | 79 |
| `buildStatusTagHtml` | Function | `src/core/util/util-status-tag.tsx` | 103 |
| `getStatusTagPositionStyle` | Function | `src/core/util/util-status-tag.tsx` | 90 |
| `injectStatusTag` | Function | `src/core/util/util-status-tag.tsx` | 128 |
| `findCarNumAndHref` | Function | `src/plugins/list-page/lp-dom.ts` | 45 |
| `isDate` | Function | `src/plugins/list-page/lp-dom.ts` | 75 |
| `filterMovieList` | Function | `src/plugins/list-page/lp-filter.tsx` | 80 |
| `renderItemStatusTag` | Function | `src/plugins/list-page/lp-filter.tsx` | 39 |
| `showCarNumBox` | Function | `src/plugins/list-page/lp-dom.ts` | 119 |
| `filterMovieList` | Method | `src/plugins/list-page-plugin.tsx` | 210 |
| `findCarNumAndHref` | Method | `src/plugins/list-page-plugin.tsx` | 225 |
| `renderItemStatusTag` | Method | `src/plugins/list-page-plugin.tsx` | 207 |
| `showCarNumBox` | Method | `src/plugins/list-page-plugin.tsx` | 237 |
| `parsePositionStyle` | Function | `src/components/misc/status-tag-html.tsx` | 63 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Observer → ShowToast` | cross_community | 10 |
| `Handle → AssertInitialized` | cross_community | 10 |
| `Handle → PutRecords` | cross_community | 10 |
| `Handle → PutRecords` | cross_community | 10 |
| `Handle → EnqueueWrite` | cross_community | 10 |
| `Handle → ShowToast` | cross_community | 10 |
| `Handle → IsRecord` | cross_community | 9 |
| `Handle → ReportPersistenceError` | cross_community | 8 |
| `Observer → TranslateText` | cross_community | 7 |
| `Observer → IsDate` | cross_community | 7 |

## How to Explore

1. `context({name: "PageCountTable"})` — see callers and callees
2. `query({search_query: "list-page"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
