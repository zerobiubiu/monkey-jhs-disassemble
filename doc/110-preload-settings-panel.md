# 110 - 预加载配置面板（设置菜单新增「⚡ 预加载配置」）

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 1. 背景

doc/107-109 上线了视频流（列表页）外部网站预加载的状态徽标 + 筛选栏 + 深度跟踪，
但相关行为（是否预加载、是否显示状态、防抖延迟、启用站点、清缓存）均为硬编码，
用户无法在设置菜单调整。用户要求「为视频流中的预加载功能做全项的配置拆解，
在设置菜单中添加一个配置页面，方便通过配置调整各项」。

## 2. 方案

在 SettingDialog 新增「⚡ 预加载配置」侧栏项 + `preload-panel` 面板，按
AGENTS.md §4.4「添加新面板的正确方式」实现（组件加侧栏+面板、bindClick
处理、loadForm/saveForm 回填与持久化），镜像 domain-panel（文本输入）、
base-panel（checkbox/select + data-tip）、vlt/missav-panel（动作按钮+状态 div）
既有模式。配置项对应预加载功能的真实可调行为：

| 配置项 | id | 类型 | 默认 | 控制行为 |
|--------|----|------|------|----------|
| 列表页预加载 | `enablePreload` | checkbox(yes/no) | yes | handle() 列表页分支总闸；关则不预加载、无徽标/筛选栏（详情页按钮仍受 enableLoadOtherSite 控制） |
| 显示状态徽标与筛选栏 | `enablePreloadStatus` | checkbox(yes/no) | yes | 徽标 + 筛选栏显隐；关则后台仍预加载缓存，但不渲染 UI（updatePreloadStatus/syncAllBadges/initFilterBar/ensureFilterBar/refreshFilterBar 早 return） |
| 预加载防抖延迟 | `preloadDebounce` | number(ms) | 300 | startPreloadObserver 防抖时长（流式加载新 item 后多久入队请求） |
| 预加载站点 - MissAv | `preload-enable-missAvBtn` | checkbox | ✓ | 写入 localStorage `jhs_enabled_sites`（getEnabledSites 读取） |
| 预加载站点 - SupJav | `preload-enable-supJavBtn` | checkbox | ✓ | 同上（SupJav 有 initUrl 跳过列表页预加载，仅详情页有效） |
| 清理预加载缓存 | `#clear-preload-cache-btn` | 动作按钮 | — | `localStorage.removeItem('jhs_other_site')` + 计数状态回显 |

> 总开关「外部网站功能」(`enableLoadOtherSite`) 仍位于快捷设置面板
> (SimpleSettingPanel)，未移入本面板以避免与 SimpleSettingPanel 同 id
> 冲突（两处 DOM 同时存在时 `$('#enableLoadOtherSite')` 会匹配多元素）。
> 本面板以 help 文案指引用户去快捷设置开关总开关。

## 3. 实施

### 3.1 修改文件

| 文件 | 改动 |
|------|------|
| `src/components/setting-dialog.tsx` | 侧栏新增 `⚡ 预加载配置`（data-panel=preload-panel）；内容区新增 `preload-panel`：enablePreload/enablePreloadStatus 开关 + preloadDebounce 数字输入 + 站点 checkbox + clear-preload-cache-btn 动作按钮 + preload-cache-status 状态 div + help 文案（镜像 domain/base/vlt/missav 模式，HR_STYLE 分隔） |
| `src/plugins/setting-plugin.tsx` | `loadForm` 回填 enablePreload/enablePreloadStatus（默认开启 idiom）/preloadDebounce/站点 checkbox（getEnabledSites）；`bindClick` 绑定 `#clear-preload-cache-btn`（removeItem jhs_other_site + 计数）；`saveForm` 收集 enablePreload/enablePreloadStatus/preloadDebounce 写 settings、站点 checkbox 写 jhs_enabled_sites（saveEnabledSites） |
| `src/plugins/other-site-plugin.tsx` | 新增 `preloadStatusEnabled`/`preloadDebounceMs` 字段；handle() 列表页分支增 enablePreload 闸 + 读两字段；updatePreloadStatus/syncAllBadges/initFilterBar/ensureFilterBar/refreshFilterBar 加 `if(!preloadStatusEnabled) return`；startPreloadObserver 用 preloadDebounceMs 替代硬编码 300 |
| `vite.config.ts` | version 1.15.1→1.16.0 |
| `AGENTS.md` | §4.1 侧栏列表补 preload-panel |
| `doc/README.md` | 文档清单新增 doc/110 |
| `changelog/CHANGELOG.md` | 新增 v1.16.0 条目 |

### 3.2 配置层级关系

```
enableLoadOtherSite (总开关，SimpleSettingPanel)
 └ NO → 整个 OtherSitePlugin 不启动（详情页按钮 + 列表页预加载全无）
 └ YES
     ├ 详情页 → loadOtherSite（渲染按钮）
     └ 列表页 → enablePreload (列表页预加载)
         └ NO → 不预加载、无 UI
         └ YES → 后台预加载缓存
             └ enablePreloadStatus (显示状态徽标与筛选栏)
                 └ NO → 静默缓存，无 UI
                 └ YES → 徽标 + 筛选栏
```

## 4. 执行验证记录

### 4.1 类型检查 + 构建

```bash
$ npx tsc -b            # 通过
$ npx vite build        # 1,901.31 kB / gzip 437.37 kB；@version 1.16.0
```

### 4.2 产物含新元素

`dist` 中检索 `preload-panel`/`enablePreload`/`enablePreloadStatus`/
`preloadDebounce`/`clear-preload-cache-btn`/`preload-enable-missAvBtn`
共 28 处命中，面板与字段已打入产物。

## 5. 后续验证建议

1. **打开设置菜单**：侧栏出现「⚡ 预加载配置」，点击切到该面板，底部「保存设置」可见、清理全部缓存隐藏
2. **回填**：enablePreload/enablePreloadStatus 默认勾选；preloadDebounce=300；MissAv/SupJav 站点按 jhs_enabled_sites 勾选
3. **关闭列表页预加载**：取消 enablePreload → 保存（页面刷新）→ 列表页无徽标/筛选栏，详情页按钮仍正常
4. **关闭状态 UI**：取消 enablePreloadStatus、保留 enablePreload → 保存 → 列表页无徽标/筛选栏，但缓存仍在后台写入（打开详情页按钮仍变绿）
5. **调防抖**：preloadDebounce 改 1000 → 保存 → 滚出瀑布流新页后约 1s 才开始预加载
6. **站点选择**：取消 SupJav → 保存 → 详情页 supJav 按钮隐藏、列表页无 supJav 徽标（SupJav 本就跳过列表预加载，主要影响详情页显隐）
7. **清缓存**：点「清理预加载缓存」→ 状态回显「已清理 N 条」，刷新列表页后全部 item 重新预加载
