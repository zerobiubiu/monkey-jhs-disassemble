# 52 - 移除清单解析器插件 + 预加载优化

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 1. 背景

### 1.1 移除清单解析器

用户要求完全移除"唤醒解析器"功能（ListParserPlugin），不再需要。

ListParserPlugin（doc/43 集成）在清单详情页 `/lists/*` 的演员名称 span 后
插入"唤醒解析器"按钮，点击通过 `lists://?url=<URL>` 自定义协议唤醒外部
解析器应用。现已不需要。

### 1.2 预加载优化

OtherSitePlugin 列表页预加载（doc/51 新增）存在以下问题：

1. **触发条件不准**：依赖 `window.isListPage` 判断，但 `/lists/xxx` 清单
   详情页有 `.movie-list` 却可能不匹配 isListPage；`/users/*` 清单列表页
   无 `.movie-list` 但可能匹配 isListPage
2. **日志不足**：无法了解预加载执行情况与进度
3. **SupJav 全站 Cloudflare 拦截**：预加载逐个失败刷屏（doc/51 已加容错，
   但根本上 SupJav 解析不可靠）

## 2. 方案

### 2.1 移除 ListParserPlugin

| 操作 | 详情 |
|------|------|
| 删除文件 | `src/plugins/list-parser-plugin.ts` |
| 移除 import + register | `src/main.tsx` |
| 插件计数 | 36 → 35（javdb 33 + missav 2） |
| 同步更新 | AGENTS.md 插件清单表 + README.md 清单管理表 + vite.config.ts description |

### 2.2 预加载触发改为按 .movie-list 存在判断

不再依赖 `window.isListPage`，改为 `document.querySelector('.movie-list')`：

| 页面 | .movie-list | 预加载 |
|------|-------------|--------|
| /series/xxx 分类列表 | ✅ | ✅ |
| /search?q= 搜索页 | ✅ | ✅ |
| /lists/xxx 清单详情页 | ✅ | ✅ |
| /users/lists 清单列表页 | ❌（容器是 #lists > ul） | ❌ |
| /v/xxx 详情页 | ❌ | ❌（isDetailPage 优先） |

### 2.3 预加载日志增强

**启动日志**：
```
[OtherSite 预加载] 40 个 item（屏蔽 3）| 已缓存 12 | 入队 25 个任务
```

**逐条日志**：
```
[OtherSite 预加载] ✓ BEAF-053 missAv 命中
[OtherSite 预加载] ✗ BEAF-052 missAv 未命中
[OtherSite 预加载] ⚠ missAv 被 Cloudflare 拦截，跳过本轮剩余任务
```

### 2.4 SupJav 始终显示黄色

给 supjav 配置加 `initUrl`，利用 `handleSite` 已有的 `initUrl` 机制：
- L202-205：检测到 initUrl → 按钮设黄色 + href=搜索页链接
- L224-225：检测到已有 href → 直接 return，不发请求

预加载中也跳过有 `initUrl` 的站点（`if (siteConfig.initUrl) continue`）。

### 2.5 预加载 Cloudflare 容错

检测到 403 / "Just a moment..." 后，将该站点加入 `blockedSiteIds` 集合，
本轮剩余任务全部跳过。下次页面加载时 `handle()` 入口 `clear()` 重试。

### 2.6 瀑布流联动

`startPreloadObserver` 监听 `.movie-list` childList：
- **AutoPagePlugin**（.movie-list 瀑布流）：append 新页 → 触发 observer →
  500ms 防抖 → preloadListPage（跳过已缓存）✅
- **ListWaterfallPlugin**（#lists > ul 瀑布流）：操作的不是 .movie-list，
  不触发 observer。且 /users/* 清单列表页无 .movie-list ✅

## 3. 实施

### 3.1 删除文件

| 文件 | 原因 |
|------|------|
| `src/plugins/list-parser-plugin.ts` | ListParserPlugin 完全移除 |

### 3.2 修改文件

| 文件 | 改动 |
|------|------|
| `src/main.tsx` | 移除 ListParserPlugin import + register；注释 36→35 |
| `src/plugins/other-site-plugin.tsx` | handle() 改为 .movie-list 检测；preloadListPage 日志增强；preloadSite 逐条日志；supjav 加 initUrl；预加载跳过 initUrl 站点；blockedSiteIds 容错 |
| `AGENTS.md` | 插件计数 36→35；移除 ListParserPlugin 条目 |
| `README.md` | 插件计数 36→35；移除清单解析条目 |
| `vite.config.ts` | description 36→35；version 1.3.3→1.4.0 |
| `changelog/CHANGELOG.md` | 新增 v1.3.2/v1.3.3/v1.4.0 条目 |

## 4. 执行验证记录

### 4.1 类型检查

```bash
$ npx tsc -b
（无输出，退出码 0）
```

### 4.2 构建

```bash
$ npx vite build
dist/monkey-jhs-disassemble.user.js  1,818.14 kB │ gzip: 415.53 kB
✓ built in 1.11s
```

构建成功。产物 1818.14 kB（gzip 415.53 kB），较 v1.3.3 基线 1820.44 kB
（gzip 416.29 kB）-2.30 kB，为删除 ListParserPlugin 文件的减量。

### 4.3 userscript metadata 验证

```
// @name         JavDB Power Tools
// @version      1.4.0
// @description  ...35 个功能插件
```

## 5. 后续

### 运行时验证建议

1. **清单详情页无唤醒按钮**：打开 /lists/xxx → 演员名后不再有"唤醒解析器"按钮
2. **预加载日志**：打开有 .movie-list 的页面 → 控制台显示预加载统计 + 逐条进度
3. **SupJav 黄色**：详情页 supjav 按钮始终黄色（warn 状态），不发请求
4. **Cloudflare 容错**：missav 被 Cloudflare 拦截后只输出一条警告，不再逐个失败
5. **瀑布流联动**：开启 autoPage 瀑布流 → 新页加载后自动预加载新 item
6. **/lists/xxx 预加载**：清单详情页（有 .movie-list）现在也会预加载
7. **/users/* 不预加载**：清单列表页（无 .movie-list）不预加载
