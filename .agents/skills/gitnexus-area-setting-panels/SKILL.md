---
name: gitnexus-area-setting-panels
description: "Skill for the Setting-panels area of monkey-jhs-disassemble. 20 symbols across 19 files."
---

# Setting-panels

20 symbols | 19 files | Cohesion: 99%

## When to Use

- Working with code in `src/`
- Understanding how BackupPanel, BasePanel, CachePanel work
- Modifying setting-panels-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/components/setting/setting-dialog.tsx` | SettingDialog, ariaSelected |
| `src/components/setting-panels/backup-panel.tsx` | BackupPanel |
| `src/components/setting-panels/base-panel.tsx` | BasePanel |
| `src/components/setting-panels/cache-panel.tsx` | CachePanel |
| `src/components/setting-panels/diagnostics-panel.tsx` | DiagnosticsPanel |
| `src/components/setting-panels/domain-panel.tsx` | DomainPanel |
| `src/components/setting-panels/fav-sync-panel.tsx` | FavSyncPanel |
| `src/components/setting-panels/filter-panel.tsx` | FilterPanel |
| `src/components/setting-panels/list-manager-panel.tsx` | ListManagerPanel |
| `src/components/setting-panels/preload-panel.tsx` | PreloadPanel |

## Entry Points

Start here when exploring this area:

- **`BackupPanel`** (Function) — `src/components/setting-panels/backup-panel.tsx:25`
- **`BasePanel`** (Function) — `src/components/setting-panels/base-panel.tsx:28`
- **`CachePanel`** (Function) — `src/components/setting-panels/cache-panel.tsx:21`
- **`DiagnosticsPanel`** (Function) — `src/components/setting-panels/diagnostics-panel.tsx:19`
- **`DomainPanel`** (Function) — `src/components/setting-panels/domain-panel.tsx:20`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `BackupPanel` | Function | `src/components/setting-panels/backup-panel.tsx` | 25 |
| `BasePanel` | Function | `src/components/setting-panels/base-panel.tsx` | 28 |
| `CachePanel` | Function | `src/components/setting-panels/cache-panel.tsx` | 21 |
| `DiagnosticsPanel` | Function | `src/components/setting-panels/diagnostics-panel.tsx` | 19 |
| `DomainPanel` | Function | `src/components/setting-panels/domain-panel.tsx` | 20 |
| `FavSyncPanel` | Function | `src/components/setting-panels/fav-sync-panel.tsx` | 23 |
| `FilterPanel` | Function | `src/components/setting-panels/filter-panel.tsx` | 19 |
| `ListManagerPanel` | Function | `src/components/setting-panels/list-manager-panel.tsx` | 31 |
| `PreloadPanel` | Function | `src/components/setting-panels/preload-panel.tsx` | 23 |
| `SyncPanel` | Function | `src/components/setting-panels/sync-panel.tsx` | 46 |
| `SettingButton` | Function | `src/components/setting/setting-button.tsx` | 25 |
| `SettingCheckbox` | Function | `src/components/setting/setting-checkbox.tsx` | 19 |
| `SettingColorRow` | Function | `src/components/setting/setting-color-row.tsx` | 27 |
| `SettingDialog` | Function | `src/components/setting/setting-dialog.tsx` | 47 |
| `ariaSelected` | Function | `src/components/setting/setting-dialog.tsx` | 61 |
| `SettingInput` | Function | `src/components/setting/setting-input.tsx` | 31 |
| `SettingRow` | Function | `src/components/setting/setting-row.tsx` | 26 |
| `SettingSection` | Function | `src/components/setting/setting-section.tsx` | 23 |
| `SettingSelect` | Function | `src/components/setting/setting-select.tsx` | 24 |
| `SettingToggle` | Function | `src/components/setting/setting-toggle.tsx` | 25 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ListManagerPanel → SettingRow` | intra_community | 3 |
| `SettingDialog → SettingButton` | intra_community | 3 |
| `SettingDialog → SettingInput` | intra_community | 3 |
| `SettingDialog → SettingSection` | intra_community | 3 |
| `SettingDialog → SettingSelect` | intra_community | 3 |
| `PreloadPanel → SettingRow` | intra_community | 3 |
| `SettingDialog → SettingRow` | intra_community | 3 |

## How to Explore

1. `context({name: "BackupPanel"})` — see callers and callees
2. `query({search_query: "setting-panels"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
