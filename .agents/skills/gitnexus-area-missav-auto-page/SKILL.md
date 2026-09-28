---
name: gitnexus-area-missav-auto-page
description: "Skill for the Missav-auto-page area of monkey-jhs-disassemble. 12 symbols across 3 files."
---

# Missav-auto-page

12 symbols | 3 files | Cohesion: 73%

## When to Use

- Working with code in `src/`
- Understanding how fetchNextPage, collectCarNums, extractThumbs work
- Modifying missav-auto-page-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/plugins/missav-auto-page/missav-auto-page-plugin.ts` | checkLoad, handle, loadAllPages, setLoader, showLoadAllBtn (+1) |
| `src/plugins/missav-auto-page/map-selectors.ts` | collectCarNums, extractThumbs, findNextUrl, liftDataSrcToSrc |
| `src/plugins/missav-auto-page/map-fetch.ts` | fetchNextPage, gmGet |

## Entry Points

Start here when exploring this area:

- **`fetchNextPage`** (Function) — `src/plugins/missav-auto-page/map-fetch.ts:47`
- **`collectCarNums`** (Function) — `src/plugins/missav-auto-page/map-selectors.ts:27`
- **`extractThumbs`** (Function) — `src/plugins/missav-auto-page/map-selectors.ts:23`
- **`findNextUrl`** (Function) — `src/plugins/missav-auto-page/map-selectors.ts:14`
- **`liftDataSrcToSrc`** (Function) — `src/plugins/missav-auto-page/map-selectors.ts:44`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `fetchNextPage` | Function | `src/plugins/missav-auto-page/map-fetch.ts` | 47 |
| `collectCarNums` | Function | `src/plugins/missav-auto-page/map-selectors.ts` | 27 |
| `extractThumbs` | Function | `src/plugins/missav-auto-page/map-selectors.ts` | 23 |
| `findNextUrl` | Function | `src/plugins/missav-auto-page/map-selectors.ts` | 14 |
| `liftDataSrcToSrc` | Function | `src/plugins/missav-auto-page/map-selectors.ts` | 44 |
| `checkLoad` | Method | `src/plugins/missav-auto-page/missav-auto-page-plugin.ts` | 134 |
| `handle` | Method | `src/plugins/missav-auto-page/missav-auto-page-plugin.ts` | 74 |
| `loadAllPages` | Method | `src/plugins/missav-auto-page/missav-auto-page-plugin.ts` | 174 |
| `setLoader` | Method | `src/plugins/missav-auto-page/missav-auto-page-plugin.ts` | 224 |
| `showLoadAllBtn` | Method | `src/plugins/missav-auto-page/missav-auto-page-plugin.ts` | 154 |
| `updateLoadAllBtn` | Method | `src/plugins/missav-auto-page/missav-auto-page-plugin.ts` | 211 |
| `gmGet` | Function | `src/plugins/missav-auto-page/map-fetch.ts` | 19 |

## How to Explore

1. `context({name: "fetchNextPage"})` — see callers and callees
2. `query({search_query: "missav-auto-page"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
