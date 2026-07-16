# 116 - 全量长期缓存随 WebDav / JSON 备份

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 1. 背景

用户确认缓存为**长期数据**，要求自动/手动备份均带上全部缓存，避免被清
站点数据或换机后丢失。此前仅 `jhs_visit_history` 进 `__localStorage`，
`jhs_other_site` 等预加载/翻译/演员等缓存不进备份。

## 2. 分析结论

| 层级 | 是否已在备份 | 说明 |
|------|--------------|------|
| IndexedDB `JAV-JHS/appData` | ✅ `exportData` 全量 | setting、car_list、黑名单、vlt_*、listReadingStatus_data、jhsRatingDisplay_data 等 |
| localStorage 长期缓存 | ❌→✅ 本版 | 见下表 |
| GM 清单阅读/瀑布流 | ❌→✅ 本版 | listReading 主源在 GM，需一并备份 |
| API 签名 / 跨标签广播 | 不备份 | 可再生/瞬时 |
| 本机 credentialId / 上次自动备份日 | 不备份 | 本机绑定 |

**纳入 `__localStorage` 的键**（`src/core/backup-extra-storage.ts`）：

- 缓存：`jhs_other_site`、`jhs_other_site_dmm`、`jhs_dmm_video`、`jhs_translate`、
  `jhs_actress_info`、`jhs_score_info`、`jhs_screenShot`、`jhs_visit_history`、
  `jdb:rating_cache_v2`
- 偏好：`jhs_enabled_sites`、`jhs_foldCategory`、`jhs_sortMethod`、
  `jhs_fancyboxThumbs`、`jhs_upgrade_flags`、`jhs_videoMuted`、
  `jhs_magnetHub_selectedEngine`、`jhs_appAuthorization`

**纳入 `__gmStorage` 的键**：

- `jdb:list-reading-status` / `jdb:list-rating` / `jdb:list-last-uri` /
  `jdb:list-sort` / `jdb:list-filter-read` / `jdb:list-filter-rating` /
  `jdb:list-waterfall-enabled`

## 3. 方案

- 新增 `backup-extra-storage.ts`：键清单 + `collectLocalStorageBackup` /
  `collectGmStorageBackup` / `applyBackupExtras`
- `buildBackupPayload`：写入完整 `__localStorage` + `__gmStorage`
- 导入（本地 JSON + WebDav 导入）：`applyBackupExtras` 后 `importData`
- 缓存管理面板补充 `jhs_other_site_dmm`、`jhs_screenShot`、`jdb:rating_cache_v2`

手动 WebDav / 自动备份 / 本地导出共用 `buildBackupPayload`，内容一致。

## 4. 实施

| 文件 | 改动 |
|------|------|
| `src/core/backup-extra-storage.ts` | **新增** 备份附加键清单与采集/恢复 |
| `src/plugins/setting-plugin.tsx` | buildBackupPayload / 导入改用 applyBackupExtras；cacheItems 扩充 |
| `vite.config.ts` | version 1.17.3→1.18.0 |
| `doc/README.md` / `changelog/CHANGELOG.md` | 同步 |

## 5. 验证

```bash
$ npx tsc -b && npx vite build   # @version 1.18.0
```

建议：预加载若干页 → 备份 → 清 localStorage 对应键 → 导入 → 详情页 missav
按钮应仍能绿（缓存命中）、访问记录/翻译缓存等恢复。
