# doc/177 — Wave 4 原子化拆分（Round 4）

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

Round-4 原子化审计发现 `list-page-plugin.tsx`（734 行）从未原子化（先前 wave 的声明为假），
以及多个已拆分 barrel 仍含残留逻辑（history/blacklist/new-video 的数据层方法未移出）。
同时发现 `vlt-create-list`（687）、`dpb-list-panel`（658）、`vlt-db`（571）、`common-util`（522）、
`setting-form-binder`（517）、`logger`（507）、`dpb-rating`（507）、`auto-page`（490）、
`vlt-server`（484）、`list-waterfall`（469）、`vlt-filter-bar`（458）、`fc2-by-123av`（437）、
`lrs-toolbar`（428）、`other-site`（510）、`status-tag-filter`（507）等 15 个文件超过 400 行且混合多职责。

## 方案

8 个并行 worker 按目录隔离拆分 18 个文件，新建 7 个子目录
（`list-page/`、`fc2-123av/`、`status-tag-filter/`、`auto-page/`、`list-waterfall/`、
`video-lists-tag/db/`、`video-lists-tag/server/`）+ 在已有子目录新增模块
（`setting/` +3、`history/` +1、`blacklist/` +2、`new-video/` +1、`list-reading-status/` +2、
`detail-page-button/` +3、`core/util/` +2）。

## 拆分清单

| 文件 | 前→后行数 | 新模块 | 职责分离 |
|------|-----------|--------|----------|
| list-page-plugin.tsx | 734→258 | lp-filter.tsx / lp-dom.ts / lp-translate.ts / lp-jump-page.tsx | IDB+DOM / DOM解析+事件 / 网络+缓存 / 跳页UI |
| vlt-create-list.tsx | 687→11 | vlt-create-list-api.ts / vlt-create-list-ui.tsx | 网络+同步 / UI注入+事件 |
| dpb-list-panel.tsx | 658→428 | dpb-list-panel-fetch.ts / dpb-list-panel-render.tsx | 服务端分页 / DOM渲染 |
| vlt-db.ts | 571→83 | db/vlt-db-core.ts / db/vlt-db-reconcile.ts / db/vlt-db-migrate.ts | 连接+CRUD / 对账 / 迁移 |
| common-util.ts | 522→283 | core/util/esc-layer.ts | ESC 层管理（gate+栈+全局键监听） |
| setting-form-binder.ts | 517→248 | setting/setting-form-load.ts / setting/setting-form-bind.ts | 表单加载保存 / 事件绑定 |
| history-plugin.tsx | 511→431 | history/history-data.ts | 数据过滤+排序+分页 |
| other-site-plugin.tsx | 510→377 | other-site/osp-probe.tsx | 站点探测（网络+缓存+DOM） |
| status-tag-filter-plugin.ts | 507→235 | status-tag-filter/stf-collect.ts / stf-apply.ts / stf-ui.ts | 标签收集 / 过滤应用 / UI构建 |
| logger.tsx | 507→259 | core/util/logger-panel.tsx | DOM面板渲染+事件+过滤 |
| dpb-rating.tsx | 507→230 | dpb-rating-api.tsx | javdb review/want API + 快捷操作 |
| auto-page-plugin.ts | 490→304 | auto-page/ap-fetch.ts / auto-page/ap-scroll.ts | 页面获取 / 滚动检测+加载全部 |
| vlt-server.ts | 484→215 | server/vlt-server-api.ts / server/vlt-server-recover.ts | API调用 / 恢复逻辑 |
| list-waterfall-plugin.ts | 469→279 | list-waterfall/lw-fetch.ts / list-waterfall/lw-scroll.ts | 获取+解析+追加 / 滚动+回顶 |
| vlt-filter-bar.ts | 458→311 | vlt-filter-apply.ts | 过滤逻辑+标签统计 |
| blacklist-plugin.tsx | 441→277 | blacklist/blacklist-data.tsx / blacklist/blacklist-add.tsx | 数据聚合 / 添加黑名单 |
| fc2-by-123av-plugin.tsx | 437→170 | fc2-123av/fc2-browse.tsx / fc2-123av/fc2-detail.tsx | 浏览+分页 / 详情弹窗 |
| lrs-toolbar.ts | 428→213 | lrs-sort.ts / lrs-filter.ts | 排序函数 / 过滤+芯片 |
| setting-plugin.tsx | 498→452 | setting/setting-tag-ops.ts | 关键词标签管理 |
| new-video-plugin.tsx | 288→154 | new-video/edit-actress.tsx | 编辑演员弹窗 |

## D1 去重

`list-page-plugin.tsx` 内 3× 重复的 textContent 替换块提取为 `replaceTitleTextNodes` 辅助函数
（`lp-dom.ts`），3 处调用点统一。

## Ratchet 合规

- `src/core` 根 28（上限内）
- `src/core/util` 18（≤20）
- `video-lists-tag` 20（≤20，`db/` + `server/` 嵌套避免超限）

## 门禁

- tsc 0 错
- vitest 28/28
- eslint 0 错（59 warn，较前 60 降 1）
- stylelint 干净
- check:structure OK（331 文件 53 目录）

## 副作用

产物 2397.65 kB（gzip 612.19 kB），较原子化前 +20 kB（新模块代码量；gzip +6 kB）。
