---
name: gitnexus-area-rating-display
description: "Skill for the Rating-display area of monkey-jhs-disassemble. 31 symbols across 6 files."
---

# Rating-display

31 symbols | 6 files | Cohesion: 79%

## When to Use

- Working with code in `src/`
- Understanding how flushPending, fetchRating, readRatingCacheMap work
- Modifying rating-display-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/plugins/rating-display/rating-display-plugin.ts` | flushPending, _invalidateCards, clearPageCache, handle, init (+4) |
| `src/plugins/rating-display/rating-cache.ts` | buildWatchedMap, get, save, set, size (+3) |
| `src/plugins/rating-display/rating-utils.ts` | debounce, getCode, normalizeCode, getAnchor, getSafeUrl (+2) |
| `src/plugins/rating-display/rating-renderer.tsx` | removeFrom, showPlaceholder, showRating |
| `src/plugins/rating-display/rating-net.ts` | fetchRating, parseRating, request |
| `src/plugins/setting/jhs-sync/sync-common.ts` | readRatingCacheMap |

## Entry Points

Start here when exploring this area:

- **`flushPending`** (Function) — `src/plugins/rating-display/rating-display-plugin.ts:282`
- **`fetchRating`** (Function) — `src/plugins/rating-display/rating-net.ts:88`
- **`readRatingCacheMap`** (Function) — `src/plugins/setting/jhs-sync/sync-common.ts:71`
- **`get`** (Method) — `src/plugins/rating-display/rating-cache.ts:157`
- **`save`** (Method) — `src/plugins/rating-display/rating-cache.ts:130`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `flushPending` | Function | `src/plugins/rating-display/rating-display-plugin.ts` | 282 |
| `fetchRating` | Function | `src/plugins/rating-display/rating-net.ts` | 88 |
| `readRatingCacheMap` | Function | `src/plugins/setting/jhs-sync/sync-common.ts` | 71 |
| `get` | Method | `src/plugins/rating-display/rating-cache.ts` | 157 |
| `save` | Method | `src/plugins/rating-display/rating-cache.ts` | 130 |
| `set` | Method | `src/plugins/rating-display/rating-cache.ts` | 165 |
| `size` | Method | `src/plugins/rating-display/rating-cache.ts` | 195 |
| `_invalidateCards` | Method | `src/plugins/rating-display/rating-display-plugin.ts` | 195 |
| `clearPageCache` | Method | `src/plugins/rating-display/rating-display-plugin.ts` | 125 |
| `handle` | Method | `src/plugins/rating-display/rating-display-plugin.ts` | 436 |
| `init` | Method | `src/plugins/rating-display/rating-display-plugin.ts` | 250 |
| `loadAll` | Method | `src/plugins/rating-display/rating-display-plugin.ts` | 159 |
| `processItem` | Method | `src/plugins/rating-display/rating-display-plugin.ts` | 83 |
| `refreshAll` | Method | `src/plugins/rating-display/rating-display-plugin.ts` | 109 |
| `toast` | Method | `src/plugins/rating-display/rating-display-plugin.ts` | 67 |
| `removeFrom` | Method | `src/plugins/rating-display/rating-renderer.tsx` | 106 |
| `showPlaceholder` | Method | `src/plugins/rating-display/rating-renderer.tsx` | 36 |
| `showRating` | Method | `src/plugins/rating-display/rating-renderer.tsx` | 58 |
| `_syncToIdb` | Method | `src/plugins/rating-display/rating-cache.ts` | 135 |
| `load` | Method | `src/plugins/rating-display/rating-cache.ts` | 78 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ClearPageCache → EscapeText` | cross_community | 6 |
| `ClearPageCache → IsReactElement` | cross_community | 6 |
| `Init → EscapeText` | cross_community | 6 |
| `Init → IsReactElement` | cross_community | 6 |
| `HandleCleanAllCache → OpenIdb` | cross_community | 3 |
| `ClearPageCache → Get` | intra_community | 3 |
| `ClearPageCache → RemoveFrom` | intra_community | 3 |
| `ClearPageCache → GetCode` | intra_community | 3 |
| `Init → Log` | cross_community | 3 |
| `HandleCleanCache → OpenIdb` | cross_community | 3 |

## How to Explore

1. `context({name: "flushPending"})` — see callers and callees
2. `query({search_query: "rating-display"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
