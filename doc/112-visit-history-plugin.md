# 112 - 访问记录插件（详情页链接悬浮显示最近打开时间）

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 1. 背景

用户新功能需求：记录所有打开过的 javdb 页面，在影片详情页元数据面板
（番號/導演/片商/系列/類別/演員 等可跳转链接）上悬浮显示「最近打开时间」。
相对时间格式：1 分钟内「X秒前打开过」、1 小时内「X分钟前打开过」、
1 天内「X小时前打开过」、1 周内「X天前打开过」、更久显示日期。

## 2. 方案

新增插件 `VisitHistoryPlugin`（本项目自创，非 archetype 拆分/集成/升级），
单文件，注册到 PluginManager（javdb only）。

### 2.1 记录（全页）

每次 `handle()`（每页加载一次）记录当前页 `pathname + search` → `Date.now()`
到 localStorage `jhs_visit_history`（`Map<path, ts>`）。超过 `MAX_ENTRIES`
（5000）按 ts 升序淘汰最旧；配额超限兜底清空避免抛错阻断。

### 2.2 显示（详情页）

`isDetailPage` 时 `injectMetaLinkTooltips()`：
- 容器：优先用户指定选择器
  `body > section > div > div.video-detail > div.video-meta-panel > div > div:nth-child(2)`，
  缺失回退 `.movie-panel-info`。
- 链接：`.panel-block .value a[href]`（番號 video_codes / 導演 / 片商 / 系列 /
  類別 tags / 演員，排除下载/訂正/外部站点等非元数据链接）。
- 命中历史 → 设 `data-tip-top` 属性，复用项目全局 tooltip 系统
  （core/tooltip.ts 的 `setupTooltip`，document mouseover/mouseout + `.js-tooltip`）。
- **捕获阶段刷新**：每个链接绑 `mouseover`（capture=true）重设 `data-tip-top`，
  使页面停留较久时悬浮仍显示实时相对时间（全局 tooltip 在 bubble 阶段读属性，
  capture 先于 bubble，故读到刷新值）。
- 未访问过的链接不设属性（不显示 tooltip）。

### 2.3 路径归一化

`normalizePath(href)`：`new URL(href, location.origin)` → 仅同源 javdb 链接
返回 `pathname + search`（相对/绝对均归一为 `/directors/nPVV`），外部
（missav/supjav）与 `javascript:` 跳过——记录与查询均用此归一 key，保证链接与
访问记录匹配。

### 2.4 相对时间格式

| 经过时间 | 文案 |
|----------|------|
| < 1 分钟 | `X秒前打开过` |
| < 1 小时 | `X分钟前打开过` |
| < 1 天 | `X小时前打开过` |
| < 1 周 | `X天前打开过` |
| ≥ 1 周 | `YYYY-MM-DD 打开过`（本地时区） |

### 2.5 缓存管理联动

`jhs_visit_history` 加入 SettingPlugin `cacheItems`（「🕐 访问记录」），
用户可在「缓存管理」面板清理/查看（与既有缓存一致）。

## 3. 实施

### 3.1 新增文件

| 文件 | 说明 |
|------|------|
| `src/plugins/visit-history-plugin.ts` | VisitHistoryPlugin：recordVisit/readHistory/evictIfNeeded/injectMetaLinkTooltips/normalizePath/formatVisitTime/formatDate |

### 3.2 修改文件

| 文件 | 改动 |
|------|------|
| `src/main.tsx` | import + `manager.register(VisitHistoryPlugin)`（isJavdbSite 块） |
| `src/plugins/setting-plugin.tsx` | cacheItems 新增 `jhs_visit_history`（🕐 访问记录） |
| `vite.config.ts` | version 1.16.1→1.17.0 |
| `AGENTS.md` | §1 插件计数 39→40（JavDB 37→38）；§3.3 新增「新增功能插件」段 + VisitHistoryPlugin 行 |
| `doc/README.md` | 文档清单新增 doc/112 |
| `changelog/CHANGELOG.md` | 新增 v1.17.0 条目 |

## 4. 执行验证记录

### 4.1 类型检查 + 构建

```bash
$ npx tsc -b            # 通过
$ npx vite build        # 1,905.65 kB / gzip 438.59 kB；@version 1.17.0
```

### 4.2 live 真机验证（/v/YwzrNz 详情页）

在真实详情页运行选择器 + 归一化 + 格式化 + 注入逻辑：

- 选择器 `.movie-panel-info .panel-block .value a[href]` 命中 **14 条**元数据链接
  （番號 video_codes、導演、片商、系列、類別 tags×8、演員×2）✓
- href 归一化正确：`/video_codes/START`、`/directors/nPVV`、`/makers/q6?f=download`、
  `/series/vRbG`、`/tags?c4=65` 等 ✓
- 相对时间格式：`5秒前打开过` / `2分钟前打开过` / `2小时前打开过` /
  `2天前打开过` / `2026-04-15 打开过` —— 全部符合规格 ✓
- 命中历史的链接成功设 `data-tip-top` 属性（全局 tooltip 复用既有机制）✓

## 5. 后续验证建议

1. **首次无记录**：全新环境打开详情页，元数据链接无悬浮（未访问过）
2. **访问后显示**：先打开某导演页 → 返回任意详情页（含该导演链接）→ 悬浮链接
   显示「X秒/分钟前打开过」
3. **实时刷新**：详情页停留数分钟后悬浮，时间文案随实时更新（捕获阶段刷新）
4. **跨档位**：访问 1 小时后再悬浮显示「X分钟前」→ 1 天后「X小时前」→
   1 周后「X天前」→ 更久显示日期
5. **缓存清理**：「缓存管理」面板出现「🕐 访问记录」，清理后详情页链接不再显示
   最近打开时间
