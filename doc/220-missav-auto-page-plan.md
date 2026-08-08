# MissAV 列表页瀑布流加载实施计划

> **文档类型**：🔧 开发指导
> **文档状态**：✅ 已执行
> **版本**：1.40.2 → 1.41.0（新增功能插件，minor）
> **前置调研**：Camoufox 真实浏览器实测（本会话，探针脚本 `.superpowers/camoufox-missav/`）
> **执行方式**：subagent-driven development（2 任务 + 1 修复回环，逐任务审查 Approved）

## 1. 背景与需求

用户希望 missav 列表页支持瀑布流式加载（滚动触底自动加载下一页），替代手工点击分页。

### 1.1 Camoufox 实测证据（已验证事实）

用 Camoufox（反检测 Firefox，经 `uv run --with camoufox` 驱动）绕过 Cloudflare 访问
missav 实测：

| 探测项 | 实测结果 | 结论 |
|--------|----------|------|
| 页面可达 | `https://missav.ws/cn/new` → 200，JS challenge 自动通过 | Cloudflare 可绕 |
| 原生无限滚动 | 滚动到底 6 次，`.thumbnail.group` 恒为 12 | **无原生瀑布流**，需求有真实价值 |
| 分页机制 | 「下一页」链接 `?page=2`，数字链接连到 page=10+，每页 12 项 | 服务端渲染分页 `?page=N` |
| 英文站 | 分页按钮文本 `Next`（中文站 `下一页`） | 选择器需双语兼容 |
| 搜索页 | `/search/<番号>` 无分页链接（结果少） | 无分页链接时瀑布流自然停止 |
| 同源 fetch 抓 `?page=2` | **200**，117~146KB HTML，`DOMParser` 解析出完整 12 个 `.thumbnail.group`，首项番号与翻页一致，内含 `?page=3` 链接 | **GM_xmlhttpRequest 抓 HTML 方案成立**（带 cookie 不被 Cloudflare 拦） |
| 域名重定向 | `missav.ws` → `missav.ws/dm539/cn/new`（随机前缀负载均衡） | 抓页 URL 必须用**当前 origin**（含随机前缀），直接复用页面里的 next 链接 |
| 列表容器 | `.thumbnail.group` 的网格父容器 `div.grid.grid-cols-2.md:grid-cols-3.xl:grid-cols-4.gap-5` | 追加目标明确 |
| 番号提取 | `a[alt]` + 现有 `normalizeCarNum()`（`missav-renderer.ts` 已 export） | 零新增 |

### 1.2 与现有插件的协同

- **MissavStatusTagPlugin**：`observeAndProcess()` 的 MutationObserver 已监听
  `.thumbnail.group` 动态出现并自动挂状态标签——瀑布流 append 的新缩略图**自动被覆盖**，
  渲染层零改动；
- **MissavQuickCopyPlugin**：只操作播放页工具栏，列表页无交集。

## 2. 方案

### 2.1 架构

复用 AutoPagePlugin / ListWaterfallPlugin 已验证的模式：
**滚动触底 → 抓下一页 HTML → DOMParser 解析 → 提取缩略图 → 去重追加 → 更新下一页链接**。

```mermaid
flowchart LR
    S["滚动接近底部<br/>（复用 PaginationStateMachine）"] --> F["GM_xmlhttpRequest<br/>抓 nextUrl（当前 origin 含随机前缀）"]
    F --> P["DOMParser 解析<br/>提取 .thumbnail.group"]
    P --> D["按 a[alt] 番号去重<br/>（normalizeCarNum）"]
    D --> A["append 到网格容器"]
    A --> N["更新 nextUrl（页内 ?page=N 链接）"]
    N --> T["MissavStatusTagPlugin<br/>Observer 自动挂标签（零改动）"]
```

### 2.2 模块拆分

`src/plugins/missav-auto-page/` 子目录（参考 auto-page/ 先例）：

| 文件 | 职责 |
|------|------|
| `map-selectors.ts` | 选择器常量 + 纯函数（findNextUrl / extractThumbs / isThumbnailGrow） |
| `map-fetch.ts` | fetchNextPage：GM_xmlhttpRequest 抓取 + DOMParser 解析 + 去重 + 追加 |
| `missav-auto-page-plugin.ts` | 插件主类：容器定位、滚动监听、状态机、TaskSupervisor 生命周期、loader 状态条 |

### 2.3 关键设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 容器选择器 | `div.grid.grid-cols-2.md\:grid-cols-3.xl\:grid-cols-4.gap-5` | 实测精确；降级用 `.thumbnail.group` 的父链 |
| 下一页链接 | 页内 `a[href*='page=']` 中文本 `下一页`/`Next` 的链接 | 双语兼容；实测存在；href 为绝对 URL（含随机前缀） |
| 抓取方式 | `GM_xmlhttpRequest`（带 cookie） | 与同源 fetch 等价，实测 200 不被拦 |
| 去重 | 维护已加载番号 Set（normalizeCarNum 后），新页首项已存在即停止 | 参考 lw-fetch loadedIds |
| 状态管理 | 复用 `PaginationStateMachine`（core/pagination-state.ts） | AutoPagePlugin 同款，canLoad/loadSuccess/loadError 语义现成 |
| 生命周期 | `TaskSupervisor` | 项目统一约定（doc/139） |
| 每页 12 项 | 滚动预加载距离 800px（比 javdb 500px 大，12 项页高较短） | 减少频繁抓取 |
| 搜索页 | 无分页链接 → nextUrl=null → hasMore=false，自然停止 | 实测无需特判 |
| 设置项 | 本期不做（默认开启） | YAGNI，用户未要求开关 |
| 状态条 | `.jhs-map-loader` 元素（加载中/到底了/错误重试），CSS 内联于 initCss | 参考 auto-page loader |

## 3. 任务分解

### Task 1：纯函数模块 + 测试（map-selectors.ts）

**文件**：
- Create：`src/plugins/missav-auto-page/map-selectors.ts`
- Test：`tests/missav-auto-page.test.ts`

**Interfaces**：
- `findNextUrl(doc: Document | Element): string | null` — 找文本为 `下一页`/`Next` 的 `a[href*='page=']` 链接，返回绝对 href；无则 null
- `extractThumbs(container: ParentNode): HTMLElement[]` — 提取 `.thumbnail.group` 元素数组
- `collectCarNums(thumbs: HTMLElement[]): string[]` — 从 `a[alt]` 提取番号并 `normalizeCarNum` 归一化

```ts
// map-selectors.ts 关键实现（Task 1 交付）
import { normalizeCarNum } from '../car-status-sync/missav-renderer';

export const MAP_SEL = {
    thumb: '.thumbnail.group',
    grid: 'div.grid.grid-cols-2.md\\:grid-cols-3.xl\\:grid-cols-4.gap-5',
    nextLink: "a[href*='page=']"
} as const;

export function findNextUrl(doc: Document | Element): string | null {
    const links = Array.from(doc.querySelectorAll<HTMLAnchorElement>(MAP_SEL.nextLink));
    const next = links.find((a) => {
        const text = a.textContent?.trim() || '';
        return text === '下一页' || text === 'Next';
    });
    return next ? next.href : null;
}

export function extractThumbs(container: ParentNode): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>(MAP_SEL.thumb));
}

export function collectCarNums(thumbs: HTMLElement[]): string[] {
    return thumbs.map((t) => {
        const a = t.querySelector<HTMLAnchorElement>('a[alt]');
        return a ? normalizeCarNum(a.getAttribute('alt') || '') : '';
    }).filter(Boolean);
}
```

- [ ] **Step 1：写失败测试**（tests/missav-auto-page.test.ts，node 环境，用 HTML 片段 + DOMParser）
```ts
import { describe, expect, it } from 'vitest';
import { findNextUrl, extractThumbs, collectCarNums } from '../src/plugins/missav-auto-page/map-selectors';

// 以下为完整测试用例（含中文/英文/无分页/缩略图提取/番号归一化）
```
- [ ] **Step 2：运行测试确认失败**：`bun run test tests/missav-auto-page.test.ts`
- [ ] **Step 3：实现 map-selectors.ts**
- [ ] **Step 4：测试通过**
- [ ] **Step 5：提交**：`git commit -m "新增 MissAV 瀑布流纯函数模块"`

### Task 2：插件主类 + 抓取模块 + 注册

**文件**：
- Create：`src/plugins/missav-auto-page/map-fetch.ts`
- Create：`src/plugins/missav-auto-page/missav-auto-page-plugin.ts`
- Modify：`src/main.tsx`（isMissavSite 块注册）
- Modify：`src/plugins/plugin-registry.ts`（PluginMap 类型映射）

**Interfaces**：
- `fetchNextPage(plugin: MissavAutoPagePlugin): Promise<void>` — 抓取/解析/去重/追加/更新 nextUrl
- 主类字段：`container / nextUrl / pagination（PaginationStateMachine）/ supervisor / loader / loadedCarNums: Set<string>`

关键实现（Task 2 交付）：

```ts
// map-fetch.ts fetchNextPage 核心
export async function fetchNextPage(plugin: MissavAutoPagePlugin): Promise<void> {
    if (!plugin.pagination.canLoad || !plugin.nextUrl) return;
    plugin.pagination.startLoading();
    plugin.setLoader('loading', '加载中...');
    try {
        const html = await gmGet(plugin.nextUrl);           // GM_xmlhttpRequest 封装
        const doc = new DOMParser().parseFromString(String(html), 'text/html');
        const thumbs = extractThumbs(doc);
        if (thumbs.length === 0) throw new Error('下一页无缩略图');
        const carNums = collectCarNums(thumbs);
        if (carNums.length > 0 && plugin.loadedCarNums.has(carNums[0])) {
            plugin.nextUrl = null;
            plugin.pagination.loadSuccess(false);
            plugin.setLoader('no-more', '已经到底了');
            return;
        }
        carNums.forEach((c) => c && plugin.loadedCarNums.add(c));
        const fragment = document.createDocumentFragment();
        thumbs.forEach((t) => fragment.appendChild(t));
        plugin.container!.appendChild(fragment);
        const next = findNextUrl(doc);
        plugin.nextUrl = next;
        plugin.pagination.loadSuccess(!!next);
        plugin.setLoader('', '');
        if (!plugin.nextUrl) plugin.setLoader('no-more', '已经到底了');
    } catch (err) {
        clog.error('[MissAV 瀑布流] 加载失败:', err);
        plugin.pagination.loadError();
        plugin.setLoader('error', '加载失败，点击重试');
    }
}
```

主类 `handle()`：
1. `container = document.querySelector(MAP_SEL.grid)`（降级父链）
2. 无容器 → 返回
3. 注入 loader 到容器后
4. `nextUrl = findNextUrl(document)` + `pagination.init(!!nextUrl)` + 预填 `loadedCarNums`（当前页）
5. `TaskSupervisor.addEventListener(window, 'scroll', ...)` 触底检测（800px）
6. loader click → 错误重试

- [ ] **Step 1：实现 map-fetch.ts + missav-auto-page-plugin.ts**
- [ ] **Step 2：main.tsx 注册**（`if (isMissavSite)` 块 + plugin-registry.ts 映射）
- [ ] **Step 3：验证**：`bun run build && bun run lint && bun run test && bun run check:structure`
- [ ] **Step 4：提交**：`git commit -m "新增 MissAV 瀑布流插件"`

### Task 3：收尾（版本号 + 文档 + changelog）

- [ ] **Step 1**：`vite.config.ts` version `1.40.2 → 1.41.0`（新增插件，minor）
- [ ] **Step 2**：本文档状态 → ✅ + 填写执行验证记录
- [ ] **Step 3**：`doc/README.md` 文档清单 + 阅读顺序 + 进度概览更新
- [ ] **Step 4**：`changelog/CHANGELOG.md` 新增 v1.41.0
- [ ] **Step 5**：`bun run build` 确认产物 `@version 1.41.0`；提交

## 4. 验证方案

- 纯函数：`tests/missav-auto-page.test.ts`（node 环境，~10 用例）
- 静态：`tsc -b` / `lint`(0/0) / `check:structure`
- **浏览器实测（用户环境或 Camoufox 回归）**：
  1. missav 列表页滚动到底 → 自动加载第 2 页，缩略图追加且状态标签自动出现
  2. 连续加载至最后一页 → 「已经到底了」
  3. 英文站 `/en` 同样正常
  4. 搜索页无分页 → 不触发加载、不报错

## 5. 评估与风险

- **Cloudflare**：同源 fetch 实测 200；GM_xmlhttpRequest 带同浏览器 cookie，预期同结果；
  若被拦，兜底用 `buildBrowserNavHeaders`（src/plugins/other-site/osp-helpers.ts 已 export）
  补导航头；
- **图片加载**：服务端渲染完整 src，append 后直接加载；若原页面用懒加载占位，
  需在实测中确认 img 属性（计划假设完整 src，实施时验证）；
- **随机前缀域**：直接复用页面内 next 链接（绝对 URL 含前缀），不自行拼 URL；
- **不变量**：不触碰状态标签渲染、修订号门控、跨站同步；新插件独立注册 isMissavSite 块。

## 6. 后续可扩展（不纳入本期）

- 设置项（瀑布流开关 / 预加载距离 / 每页项数提示）；
- 视频播放页底部推荐也可瀑布流（.thumbnail.group 同样存在，需验证分页链接）。

## 7. 执行验证记录

### 执行环境

Windows + Bun + Chrome（构建/静态验证）；Camoufox（反检测 Firefox，经 `uv run --with camoufox` 驱动）真实浏览器实测。

### 验证命令

```text
$ bun run build          # = tsc -b && vite build
$ bun run lint           # eslint src/
$ bun run test           # vitest run（9 文件 143 用例，含新增 missav-auto-page 11 用例）
$ bun run check:structure
```

### 实际输出

```text
$ bun run build
✓ 402 modules transformed.
[lightningcss minify] …（layer.css IE hack 警告，已知无害项）
dist/monkey-jhs-disassemble.user.js  2,183.83 kB │ gzip: 506.01 kB
✓ built in ~1.5s
产物头部 @version 1.41.0（已核对）

$ bun run lint
（无输出 = 0 errors / 0 warnings）

$ bun run test
 Test Files  9 passed (9)
      Tests  143 passed (143)

$ bun run check:structure
check-structure: OK
```

### 前端或调用方验证（Camoufox 实测，本会话探针脚本 .superpowers/camoufox-missav/）

实施前调研（probe1-4）确认：missav 无原生无限滚动、服务端分页 `?page=N`（每页 12 项）、
同源 fetch 抓页 200 不被 Cloudflare 拦、英文站「Next」中文站「下一页」、搜索页无分页。

实施后审查回环（probe5-6）确认：

| 审查项 | 实测结果 | 结论 |
|--------|----------|------|
| 去重 alt 可用性 | 当前页 DOM 12/12 缩略图均有 `a[alt]`；服务端 HTML 含大量 alt 属性 | I-1 解除 |
| 主选择器命中 | `div.grid.grid-cols-2.md:grid-cols-3.xl:grid-cols-4.gap-5` 在真实页面命中（12 项） | 容器选择器可用 |
| 降级父链 | `.thumbnail.group` → 无 class DIV → grid（1 层包装），`parentElement.parentElement` 恰好命中 grid | I-2 解除 |
| 视频页 | 视频页有同款 grid（底部推荐 16 项）但**无分页链接**；已加 `isVideoPage()` 守卫跳过 | I-3 修复（9df58c0） |
| 追加布局 | grid 直接子元素是 12 个无样式包装 DIV（display:block），追加缩略图本身为 grid 项，视觉需真实浏览器确认 | 已知限制 |
| Alpine 预览 | 服务端 HTML 缩略图含 `@mouseenter/@click` Alpine 指令，append 后不会自动初始化（预览功能可能失效） | 已知限制 |

### 验证结论

✅ 通过。两个任务 + 一个修复回环全部 Approved；构建/lint/143 测试/结构门禁全绿；
产物 `@version 1.41.0`。

### 已知限制（需用户浏览器实测）

1. **滚动加载实测**：需在真实 Tampermonkey 环境确认列表页滚动触底自动加载第 2 页、
   缩略图追加且状态标签自动出现（MissavStatusTagPlugin 的 Observer 自动覆盖）；
2. **Alpine 预览指令**：瀑布流追加的缩略图悬停预览（`@mouseenter` setPreview）可能不生效
   （追加节点不触发 Alpine init）；点击跳转（`@click`）如失效则追加项无法点入详情页——
   若实测确认，后续需在 append 后调用 `Alpine.initTree(container)` 或剥离指令；
3. **追加布局**：追加缩略图直接作为 grid 子项（现有项隔一层无样式包装 DIV），视觉应与
   原布局一致，但需真实页面确认无错位；
4. **Cloudflare 频率限制**：探针期间短时密集请求曾遇一次 403（临时限流），GM_xmlhttpRequest
   真实使用频率低，风险低；若遇拦截可用 `buildBrowserNavHeaders` 兜底。