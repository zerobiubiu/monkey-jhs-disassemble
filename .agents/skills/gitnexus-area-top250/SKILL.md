---
name: gitnexus-area-top250
description: "Skill for the Top250 area of monkey-jhs-disassemble. 11 symbols across 6 files."
---

# Top250

11 symbols | 6 files | Cohesion: 71%

## When to Use

- Working with code in `src/`
- Understanding how LoginDialog, Top250ErrorMessage, Top250LoadError work
- Modifying top250-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/plugins/top250-plugin.tsx` | checkLogin, handle, handleTop, openLoginDialog, toolBar |
| `src/components/top250/top250-error-message.tsx` | Top250ErrorMessage, Top250LoadError |
| `src/components/dialogs/login-dialog.tsx` | LoginDialog |
| `src/components/top250/top250-nav-link.tsx` | Top250NavLink |
| `src/components/top250/top250-tool-bar.tsx` | Top250ToolBar |
| `src/components/top250/top250-year-button.tsx` | Top250YearButton |

## Entry Points

Start here when exploring this area:

- **`LoginDialog`** (Function) — `src/components/dialogs/login-dialog.tsx:32`
- **`Top250ErrorMessage`** (Function) — `src/components/top250/top250-error-message.tsx:31`
- **`Top250LoadError`** (Function) — `src/components/top250/top250-error-message.tsx:39`
- **`Top250NavLink`** (Function) — `src/components/top250/top250-nav-link.tsx:21`
- **`Top250ToolBar`** (Function) — `src/components/top250/top250-tool-bar.tsx:43`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `LoginDialog` | Function | `src/components/dialogs/login-dialog.tsx` | 32 |
| `Top250ErrorMessage` | Function | `src/components/top250/top250-error-message.tsx` | 31 |
| `Top250LoadError` | Function | `src/components/top250/top250-error-message.tsx` | 39 |
| `Top250NavLink` | Function | `src/components/top250/top250-nav-link.tsx` | 21 |
| `Top250ToolBar` | Function | `src/components/top250/top250-tool-bar.tsx` | 43 |
| `Top250YearButton` | Function | `src/components/top250/top250-year-button.tsx` | 36 |
| `checkLogin` | Method | `src/plugins/top250-plugin.tsx` | 260 |
| `handle` | Method | `src/plugins/top250-plugin.tsx` | 73 |
| `handleTop` | Method | `src/plugins/top250-plugin.tsx` | 134 |
| `openLoginDialog` | Method | `src/plugins/top250-plugin.tsx` | 293 |
| `toolBar` | Method | `src/plugins/top250-plugin.tsx` | 203 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Handle → IsReactElement` | cross_community | 6 |
| `Handle → EscapeText` | cross_community | 6 |
| `HandleTop → IsReactElement` | cross_community | 6 |
| `HandleTop → EscapeText` | cross_community | 6 |
| `Handle → GetBean` | cross_community | 5 |
| `Handle → LoginDialog` | intra_community | 4 |
| `Handle → Top250ToolBar` | intra_community | 4 |
| `Handle → Top250YearButton` | intra_community | 4 |
| `HandleTop → Top250Pagination` | cross_community | 4 |

## How to Explore

1. `context({name: "LoginDialog"})` — see callers and callees
2. `query({search_query: "top250"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
