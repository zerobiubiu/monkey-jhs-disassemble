# 69. 增强 Top250 使用网站现行高级检索承载页

> **文档类型**：变更记录  
> **文档状态**：已执行  
> **生效版本**：v1.49.6  
> **前置与更正**：[68. 原站 Top250 翻页与增强入口分离](68-top250-native-pagination.md)。该文的原生分页结论不变；增强入口指向的旧承载地址由本次替代。  
> **影响范围**：增强榜单入口、页面激活、分类/年份链接与字幕切换后的分页。未改变原生 `/rankings/top`、热播榜、榜单 API 或站点鉴权。

## 1. 问题与证据

v1.49.5 将原生榜单与增强模式分开，但保留了旧宿主 `/advanced_search`。当时的入口测试用 `history.replaceState` 切换 jsdom 的 URL，并没有向这个地址发文档请求；测试通过只能证明客户端识别了参数，不能证明服务器上有可挂载的页面。

| 受管 Chrome 直接 GET | 本次观察 | 能得出的结论 |
| --- | --- | --- |
| `/advanced_search?handleTop=1&handleType=all&type_value=` | HTTP 404，标题「頁面未找到 (404)」，`.section .container` 为 0 | 旧地址不能承载增强榜单。 |
| `/search_advanced?handleTop=1&handleType=all&type_value=` | HTTP 302 → `/login` 200；原站页面链接也指向 `/search_advanced` | 是原站的登录受限路由，但本次未取得登录后的正文。登录页自己的一个 `.section .container` 不算证据。 |

[站点结构 §9](javdb-site-structure.md#9-高级检索-search_advanced) 有既往 `/search_advanced` 现场样本：`.section .container > .box` 命中 1、`h2.section-title` 命中 1，检索表单以 GET 提交到该路径。选用原站现行承载页，不把首页或登录页改成榜单。不以历史样本冒充本次登录态验收。

## 2. 修正方案与实施

1. 在 `src/constants/top250.ts` 定义承载路径 `TOP250_HOST_PATH` 和地址生成函数 `top250Href`。主导航、旧推荐标签、分类和年份共用该生成函数，激活守卫使用同一路径并精确检查 `handleTop=1`。切换筛选回第一页；翻页只替换当前查询的 `page`。
2. 在 `src/plugins/top250-plugin.tsx` 先确认实际挂载容器存在，再检查移动端登录或加载数据。容器不存在时说明原因并退出。原站 `/rankings/top` 仍直接放行。
3. `src/components/top250/top250-tool-bar.tsx` 与 `top250-year-button.tsx` 不再拼旧路径。`top250-pagination.tsx` 标记增强页自己的分页。切换字幕只更新这些控件的 `has_cnsub`，不误改 `.toolbar a.button` 等宿主链接，页码也不再漏掉刚选择的字幕选项。
4. `tests/top250-navigation.test.ts` 增加独立环回 HTTP 服务：它只在 `/search_advanced` 提供载体，未知路径真实返回 404。测试用组件生成的入口发 GET、读取响应正文，再验证五个分类、年份和下一页确实可取到同一载体，并覆盖缺失容器及未激活页面。路由白名单刻意不复用生产常量，避免二者一起拼错仍为绿。
5. `AGENTS.md` 标注地址规则位置；`GREASYFORK.md` 区分网站登录和移动端登录；`package.json`、`vite.config.ts`、`CHANGELOG.md`、`docs/README.md` 同步版本、发布说明与索引。

修改网站承载路由时只需调整共享常量，并在独立 HTTP 路由契约及原站证据中核实，不必逐个修改筛选组件。其他榜单不共用此开关。

## 3. 后续验证建议

使用已有网站登录态和移动端授权的浏览器时，可直接打开增强入口，确认不是 404、选年份后第 2 页仍为同年，切换字幕后翻页仍保留字幕选项。另从 `/rankings/top` 点下一页确认留在原生路径。不要为测试提供账户凭据或导出会话。

## 4. 执行验证记录

**环境**：Windows x64、Bun 1.4.4、Node v26.13.0、Vitest 4.1.10、Vite 8.2.1、受管 Chrome。未安装依赖。

| 验证 | 实际结果 |
| --- | --- |
| `bun run test tests/top250-navigation.test.ts tests/page-context-home.test.ts tests/jsx-to-string.test.ts` | 3 个文件 / 38 项通过，含 14 项榜单测试及真实环回 HTTP 回归。未跑全量套件。 |
| `bun run eslint` 指定本次涉及的五个源码文件，及 `bun run check:selectors`、`check:structure`、`check:docs` | ESLint 无诊断；选择器 81 文件 / 241 处；结构 421 文件 / 69 目录；43 个插件 / 69 个核心文件，均通过。 |
| `bun run build`，再同步版本、`bun run check:version`、`bun run vite build` 和产物头检查 | TypeScript 检查及打包通过；463 个模块，1,424.62 kB / gzip 365.49 kB；安装脚本头、包和构建配置均为 1.49.6。 |

**独立浏览器导航**：在仅监听环回地址的夹具上加载实际插件、jQuery 和 layer，不提供令牌，禁止外部网络连接。实点主菜单后，服务器收到 `GET /search_advanced?handleTop=1&handleType=all&type_value=`，页面显示高级检索容器和插件登录提示；没有填写或提交表单。在独立的原生榜单页实点下一页，收到 `GET /rankings/top?t=y2024&page=2`，没有进入增强模式。夹具和标签已关闭。

**结论与限制**：不再生成经证实返回 404 的旧榜单入口，客户端路由和筛选导航已经过实际 HTTP 验证。用户选择不登录，因此没有验证当前线上登录后的榜单内容或移动端数据请求，不声称增强榜单已在线端到端通过。Node 的 localStorage 实验提示及第三方 CSS 的既有 lightningcss 告警未影响测试和构建。未提交、推送或发布。
