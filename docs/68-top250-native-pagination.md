# 68. 原站 Top250 翻页与增强入口分离

> **文档类型**：变更记录  
> **文档状态**：已执行  
> **生效版本**：v1.49.5  
> **影响范围**：JavDB 原生 Top250 导航、脚本增强榜单及项目现状说明。未改热播榜、瀑布流请求、数据存储或站点登录协议。  
> **相关资料**：[站点结构 §8](javdb-site-structure.md#8-榜单页-rankingstoprankingsplayback)、[原选择器核验](21-javdb-selector-audit.md)、[插件目录](plugin-catalog.md)。

## 1. 背景与问题

用户从 `/rankings/top` 翻页时进入 `/advanced_search?handleTop=1&handleType=all&type_value=`，没有到达目标页。此次合并修正导航边界和审查时发现的现状文档漂移，不做与问题无关的结构改造。

| 优先顺序 | 证据 | 用户影响 |
| --- | --- | --- |
| 1. 原站分页被作为增强入口 | 旧 `Top250Plugin.handle()` 在整页匹配 `a[href*="rankings/top"]`，先取消点击，再由 `checkLogin` 仅读分类参数 `t` 拼接高级搜索地址。方向键也是点击同一原生链接。 | 点击页码、上一页、下一页不能进入目标页，还可能误弹脚本登录框。手动跳页已有 `URL.searchParams.set('page', …)`，并非根因。 |
| 2. 增强页自身也接管过多 | 旧实现以整串 URL 包含 `handleTop=1` 判定；在内容容器上委托所有分页类名，靠 `data-page`、`pushState` 和刷新导航。 | 搜索值或 `handleTop=10` 也能误入增强渲染；增强分页没有可复制或在新标签打开的真实地址。 |
| 3. 项目现状说明漂移 | 改前 `check:docs` 从注册表得到 43 个插件，README 却写 44，且把历史 13 个文件 / 183 个用例写成当前套件；脚本页版本还停在 v1.49.3。 | 用户会误判安装版本与功能范围。该门禁检查插件目录，不检查所有介绍文档。 |

### 真实站点边界

仅使用 GET 打开 `https://javdb.com/rankings/top`。静态读取和受管 Chrome 均被站点重定向到 `/login`，未取得登录后的榜单正文。登录页可见同站主导航 `.main-nav` 中的 `<a class="navbar-item" href="/rankings/top">TOP250</a>`。历史实测在原生榜单找到一处 `.pagination`；首页未必有旧「猜你喜歡」标签，因此不能只保留那个旧入口。

## 2. 修正方案与实施

- **原生页**：在 `/rankings/top`（含末尾斜杠）不安装 Top250 增强，也不改主导航、原生分页或筛选。原站的 `href` 就是跳转目标，不自己读取页码文字、猜末页或重拼网址。列表跳页、方向键和自动加载仍使用各自已有的导航入口。
- **其他页面**：只让主导航里精确指向 `/rankings/top` 的总入口和旧「猜你喜歡」标签指向增强榜单。正文、筛选深链或分页不会因 URL 含有 `rankings/top` 而被接管。未新增菜单项。
- **增强页**：仅在 `/advanced_search` 且查询字段 `handleTop` 恰好为 `1` 时激活。进入后才检查移动端登录；登录成功刷新同一 URL。原有分类、年份、字幕和五页范围不变；分页使用普通链接，替换 `page`，保留其余查询参数，首末页无越界链接。没有新增请求接口或认证依赖。
- **项目说明**：当前插件数以 `docs/plugin-catalog.md` 与 `check:docs` 为准；使用说明改为链接正式版本记录，测试数量看实际运行输出，不回改历史记录。

| 文件 | 职责 |
| --- | --- |
| `src/plugins/top250-plugin.tsx` | 区分原生页与增强页；去除整页点击拦截和内容容器的分页委托；合并页码读取。 |
| `src/core/util/site/selectors.ts` | `navRankTop` 仅匹配实际主导航中的总入口。 |
| `src/components/top250/{top250-nav-link,top250-pagination}.tsx` | 明确入口地址；为可达页输出 `href`，为当前页输出 `aria-current="page"`。 |
| `tests/top250-navigation.test.ts` | 真实 jQuery、组件与插件交互；覆盖原站点击/修饰键、增强入口、路由误判、筛选与分页边界。 |
| `README.md`、`AGENTS.md`、`src/main.tsx`、`GREASYFORK.md`、`docs/plugin-catalog.md` | 清除过时统计与说明，说明原生/增强榜单的边界。`src/main.tsx` 仅改注释。 |
| `vite.config.ts`、`package.json`、`CHANGELOG.md`、`docs/README.md` | 同步版本、发布说明与文档索引。 |

以后若站点更换主菜单结构，只需复核 `navRankTop`；原站分页不依赖这个选择器。若只改增强榜单分页展示，只改该组件即可，不需要修改原站或通用键盘翻页插件。

## 3. 后续验证建议

在已登录的 Tampermonkey 会话启用 v1.49.5，直接打开 `/rankings/top`，点击第 2 页后核对地址与高亮页码，再返回上一页。若使用分类，核对原链接中的 `t` 等参数仍在。未关闭站点登录限制，也不需要提供账户、Cookie 或移动端令牌。

## 4. 执行验证记录

**环境**：Windows x64，Bun 1.4.4、Node v26.13.0、Vitest 4.1.10、Vite 8.2.1；受管 Chrome 的独立本地验收标签。无外部依赖安装。

| 验证命令或场景 | 实际结果 |
| --- | --- |
| `bun run test tests/top250-navigation.test.ts tests/page-context-home.test.ts tests/jsx-to-string.test.ts` | 3 个文件、34 项通过，其中榜单回归 10 项。未运行全量套件。 |
| `bun run eslint` 加本次涉及的 5 个源码路径 | 退出 0，无诊断。 |
| `bun run check:selectors` / `check:structure` / `check:docs` | 81 文件 / 241 个受跟踪裸选择器；420 文件 / 69 目录符合结构门禁；43 个插件（5 个开关）/ 69 个核心文件。 |
| `bun run build`；递增版本后 `bun run check:version`、`bun run vite build` 并读取产物头 | TypeScript 编译通过；462 个模块，最终安装脚本 1,424.48 kB / gzip 365.32 kB；`dist/monkey-jhs-disassemble.user.js` 头部 `@version 1.49.5`，与两处版本一致。 |

**浏览器实测**：本机 HTTP 夹具模拟站点分页，加载实际 `Top250Plugin`、`KeyPageTurningPlugin` 和跳页控件，使用真实 jQuery。浏览器操作顺序：首页 → 点击下一页（2）→ 数字页码（5）→ 上一页（4）→ 键盘左键（3）→ 跳页框按钮（4）。服务端收到以下文档请求，浏览器每次均显示对应页码：

```text
GET /rankings/top?t=y2024&locale=zh-CN
GET /rankings/top?t=y2024&locale=zh-CN&page=2
GET /rankings/top?t=y2024&locale=zh-CN&page=5
GET /rankings/top?t=y2024&locale=zh-CN&page=4
GET /rankings/top?t=y2024&locale=zh-CN&page=3
GET /rankings/top?t=y2024&locale=zh-CN&page=4
```

**结论与限制**：脚本不再将原生页码导航改为高级搜索，增强页查询契约另有回归覆盖。线上受登录限制，未宣称已看到真实第 2 页内容，也未安装到用户浏览器、操作账户或发布。测试运行提示 Node 的 `localStorage` 实验警告；构建仍有原 `layui-layer` IE CSS hack 的 lightningcss 告警，两者均未导致验证失败。
