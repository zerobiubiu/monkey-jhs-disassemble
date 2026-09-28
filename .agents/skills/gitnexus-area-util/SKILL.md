---
name: gitnexus-area-util
description: "Skill for the Util area of monkey-jhs-disassemble. 39 symbols across 13 files."
---

# Util

39 symbols | 13 files | Cohesion: 88%

## When to Use

- Working with code in `src/`
- Understanding how _createLogElement, bindEvents, reRenderAllLogs work
- Modifying util-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/core/util/logger-panel.tsx` | _createLogElement, bindEvents, reRenderAllLogs, renderLog, setFilter (+6) |
| `src/core/common-util.ts` | success, setupEscClose, _handleGlobalEscKey, getTopLayerEl, _handleGlobalEscKeyUp (+1) |
| `src/core/util/esc-layer.ts` | setupEscClose, bindIframe, _handleGlobalEscKey, getTopLayerEl, _handleGlobalEscKeyUp (+1) |
| `src/core/logger.tsx` | clear, init, setFilter |
| `src/core/util/util-date.ts` | getHourDifference, isUnnecessaryCheck |
| `src/core/util/util-dom.ts` | loopDetector, finish |
| `src/core/util/util-popup.ts` | getDefaultArea, getResponsiveArea |
| `src/core/util/util-sort.ts` | genericSort, coerceDate |
| `src/core/util/util-simple-lists.ts` | fetchSimpleListsPage |
| `src/plugins/detail-page-button/dpb-list-panel-fetch.ts` | fetchAllListPageEntries |

## Entry Points

Start here when exploring this area:

- **`_createLogElement`** (Function) — `src/core/util/logger-panel.tsx:225`
- **`bindEvents`** (Function) — `src/core/util/logger-panel.tsx:95`
- **`reRenderAllLogs`** (Function) — `src/core/util/logger-panel.tsx:197`
- **`renderLog`** (Function) — `src/core/util/logger-panel.tsx:179`
- **`setFilter`** (Function) — `src/core/util/logger-panel.tsx:253`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `_createLogElement` | Function | `src/core/util/logger-panel.tsx` | 225 |
| `bindEvents` | Function | `src/core/util/logger-panel.tsx` | 95 |
| `reRenderAllLogs` | Function | `src/core/util/logger-panel.tsx` | 197 |
| `renderLog` | Function | `src/core/util/logger-panel.tsx` | 179 |
| `setFilter` | Function | `src/core/util/logger-panel.tsx` | 253 |
| `toggleExpandCollapsed` | Function | `src/core/util/logger-panel.tsx` | 126 |
| `toggleMaximize` | Function | `src/core/util/logger-panel.tsx` | 161 |
| `checkInitialCollapseState` | Function | `src/core/util/logger-panel.tsx` | 138 |
| `checkInitialMaximizeState` | Function | `src/core/util/logger-panel.tsx` | 153 |
| `clear` | Function | `src/core/util/logger-panel.tsx` | 272 |
| `createContainer` | Function | `src/core/util/logger-panel.tsx` | 39 |
| `fetchSimpleListsPage` | Function | `src/core/util/util-simple-lists.ts` | 23 |
| `fetchAllListPageEntries` | Function | `src/plugins/detail-page-button/dpb-list-panel-fetch.ts` | 76 |
| `fetchAuthoritativeCheckboxState` | Function | `src/plugins/video-lists-tag/server/vlt-server-api.ts` | 135 |
| `getCheckboxCount` | Function | `src/plugins/video-lists-tag/vlt-helpers.ts` | 183 |
| `success` | Function | `src/core/common-util.ts` | 152 |
| `setupEscClose` | Function | `src/core/util/esc-layer.ts` | 249 |
| `bindIframe` | Function | `src/core/util/esc-layer.ts` | 268 |
| `_handleGlobalEscKey` | Function | `src/core/util/esc-layer.ts` | 108 |
| `getTopLayerEl` | Function | `src/core/util/esc-layer.ts` | 67 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Init → EscapeText` | cross_community | 8 |
| `Init → IsReactElement` | cross_community | 8 |
| `RunExecution → FetchSimpleListsPage` | cross_community | 5 |
| `RunExecution → GetCheckboxCount` | cross_community | 5 |
| `RunExecution → GetCsrfToken` | cross_community | 5 |
| `RunExecution → ExtractListNameFromInput` | cross_community | 5 |
| `RunExecution → PostJavdbListMutation` | cross_community | 4 |
| `Init → Clear` | intra_community | 4 |
| `ExecuteCompactionPlan → FetchSimpleListsPage` | cross_community | 4 |
| `Init → ToggleMaximize` | cross_community | 3 |

## How to Explore

1. `context({name: "_createLogElement"})` — see callers and callees
2. `query({search_query: "util"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
