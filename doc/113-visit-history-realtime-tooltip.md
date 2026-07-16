# 113 - 访问记录悬浮时间实时跳动 + 备份说明

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 1. 背景

doc/112 上线 VisitHistoryPlugin 后用户反馈：

1. **计时显示不实时**：悬浮后显示的「X秒前打开过」是静态的，必须刷新页面才更新。
2. **备份归属疑问**：访问记录是随 WebDav 备份走，还是只保留在本地？

## 2. 根因与方案

### 2.1 实时跳动

doc/112 复用全局 tooltip（`data-tip-top` + `setupTooltip`）：内容在 hover 时
一次性捕获，悬浮期间不刷新。全局 tooltip 的 `content` 在 mouseover 闭包中固化，
无法秒级跳动。

**改为自定义实时 tooltip**（`.jhs-visit-tooltip`）：

- `mouseenter` → 显示 tooltip + 启动 `setInterval(1s)` 重算 `formatVisitTime(ts)`
- `mouseleave` / scroll / resize → 清除定时器 + 隐藏
- 样式对齐全局 `.js-tooltip`（浅绿底 `#f0fdf4` / 字色 `#166534` / 阴影）
- 不设 `data-tip-top`，避免与全局静态 tooltip 双重显示

### 2.2 备份归属（结论：仅本地）

| 存储 | 位置 | 是否进备份 |
|------|------|------------|
| 设置/鉴定/黑名单等 | IndexedDB（localforage `JAV-JHS/appData`） | ✅ `exportData` 全量序列化 |
| 访问记录 `jhs_visit_history` | **localStorage** | ❌ 不进备份 |
| 预加载缓存 `jhs_other_site` 等 | localStorage | ❌ 不进备份 |

`storageManager.exportData()` 仅 `forage.iterate` IndexedDB，不含 localStorage。
访问记录为**本机本地**，换浏览器/清站点数据会丢失；「缓存管理」面板可手动清理。

> 若需随备份同步到其他设备，可后续将记录迁入 IndexedDB 或在备份 payload 中
> 显式附加 localStorage 键（需处理导入合并策略）。当前保持 localStorage 同步写入
> （避免 IDB 异步在快速跳页时丢记录）。

## 3. 实施

| 文件 | 改动 |
|------|------|
| `src/plugins/visit-history-plugin.ts` | 去掉 data-tip-top；改 mouseenter/mouseleave + 1s 定时刷新；新增 ensureTooltipEl/showVisitTooltip/hideVisitTooltip；initCss 注入 visit-history-tooltip.css |
| `src/styles/visit-history-tooltip.css` | 新增 `.jhs-visit-tooltip`（对齐全局 tooltip 视觉） |
| `vite.config.ts` | version 1.17.0→1.17.1 |
| `doc/README.md` | 文档清单新增 doc/113 |
| `changelog/CHANGELOG.md` | 新增 v1.17.1 条目 |

## 4. 执行验证记录

```bash
$ npx tsc -b            # 通过
$ npx vite build        # @version 1.17.1
```

## 5. 后续验证建议

1. 打开某导演页 → 回详情页 → 悬浮导演链接 → 文案从「N秒前」每秒 +1，无需刷新
2. 移开鼠标 → tooltip 消失
3. 备份/导出数据后换机导入 → 访问记录**不会**带过去（本机 localStorage）
4. 「缓存管理」→「🕐 访问记录」清理 → 详情页链接不再显示最近打开
