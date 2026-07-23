# doc/170 — 收尾：4 处内联 UI 模板修复 + 死 SVG 常量清理 + 零硬编码 HTML 边界
> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

最终 src/-only 残留审计在 15 文件 LOW 波次之外又发现 4 处内联 UI 模板字符串违规
（common-util / new-video / list-waterfall / review），并对 icons.ts 的 8 个 SVG 常量
提出白名单复核。本轮修复 4 处违规、清理 5 个死常量，并将「零硬编码 HTML」规则的边界
写死，避免后续把 jQuery 元素构造 idiom 误判为违规而空转。

## 1. 4 处内联 UI 模板修复

| 文件 | 原内联字面量 | 改为 | 新增组件/辅助 |
|------|-------------|------|--------------|
| src/core/common-util.ts | insertStyle 内 `'<style>' + css + '</style>'` 拼接 | `styleBlockHtml(css)` | 新增 `styleBlockHtml(css,id?)` 辅助于 style-block.tsx（类比 log-colored.tsx 的 logColoredHtml；`.indexOf('<style>')` 为搜索 needle 保留不动） |
| src/plugins/new-video-plugin.tsx | 头像弹窗 `'<style>' + avatarSelectDialogCssRaw + '</style>'` | `jsxToString(<StyleBlock css={...} />)` | 复用 StyleBlock |
| src/plugins/list-waterfall-plugin.ts | 回到顶部 `btn.innerHTML = '<svg ...><path d="..."/></svg>'` | `scrollTopIconHtml()` | 新增 scroll-top-icon.tsx（ScrollTopIcon + scrollTopIconHtml；SVG 仅 viewBox/d，JSX 安全，无需 dangerouslySetInnerHTML） |
| src/plugins/review-plugin.tsx | 星标 `Array(score).fill('<i class="icon-star"></i>')` | `fill(jsxToString(<ReviewStarIcon />))` | 新增 review-star-icon.tsx（ReviewStarIcon 渲染 `<i className="icon-star">`） |

## 2. 死 SVG 常量清理（icons-trace + icon-trace 双重核实）

icons.ts 8 个 SVG 常量：3 个经 React props → dangerouslySetInnerHTML 在函数组件内消费
（EDIT_SVG→actress-card.tsx:170、DELETE_SVG→actress-card.tsx:177、
REFRESH_SVG→new-video-dialog.tsx:87-89）= SANCTIONED，保留；5 个赋给 BasePlugin 字段
但全 src/ 零读取（含无 `this['x']` 动态访问、唯一 importer 为 base-plugin.ts）= DEAD，
删除：常量定义（icons.ts）+ rename-import 说明符（base-plugin.ts）+ 字段赋值（base-plugin.ts）。
删除项：SETTING_SVG/settingSvg、CHECK_SVG/checkSvg、ACTRESS_SVG/actressSvg、
NEW_SVG/newSvg、BLACKLIST_SVG/blacklistSvg。

## 3. 零硬编码 HTML 规则边界（写死，§9.7 同步落地）

- 违规 = 字符串字面量被解析进 DOM（innerHTML / jQuery .html/.append/.prepend/.after/.before /
  jQuery HTML 片段选择器 `$( '<...>' )` / 拼接进上述），且非 sanctioned 常量。
- 豁免（搜索/比较 needle，不生成元素）：`.indexOf/.includes/.startsWith/.match/.test` 对
  DOM 派生文本的字面量，如 insertStyle 的 `css.indexOf('<style>')`、style-injector 的
  `.includes('<style>')`、main.tsx 的 `.includes('<span>1005</span>')`。
- 不在零硬编码规则范围：jQuery `$( '<tag>' )` / `$( '<tag class=...>' )` 元素构造——这是
  jQuery 的 createElement 等价 API（空容器/带属性元素句柄），非「拼字符串编写 UI 模板」；
  本审计将其归为 OTHER_FP，不作违规，亦不强制改写（改写为 document.createElement 属风格
  偏好，无行为差异，且对正在工作的插件文件引入无谓回归面）。
- sanctioned 数据常量：经 dangerouslySetInnerHTML 在组件内注入的 SVG/CSS 命名常量
  （JAVDB_ICON_SVG、TOAST_SVG_ICONS、icons.ts 的 EDIT/DELETE/REFRESH_SVG、各 *-icon.tsx
  的路径/标记常量）。元素本身仍由组件生成。

## 4. 实施清单

| 文件 | 操作 |
|------|------|
| src/components/style-block.tsx | 改（+styleBlockHtml） |
| src/components/scroll-top-icon.tsx | 新增 |
| src/components/review-star-icon.tsx | 新增 |
| src/core/common-util.ts | 改 |
| src/plugins/new-video-plugin.tsx | 改 |
| src/plugins/list-waterfall-plugin.ts | 改 |
| src/plugins/review-plugin.tsx | 改 |
| src/resources/icons.ts | 改（删 5 死常量） |
| src/plugins/base-plugin.ts | 改（删 5 import 说明符 + 5 字段） |
| AGENTS.md | 改（新增 §9.7） |

## 5. 验证记录

（由最终门禁 v1.28.11 复核）bun run build 通过；bun run test 28/28；bun run lint 0 errors；
bun run check:structure OK；死符号 grep（settingSvg|checkSvg|actressSvg|newSvg|blacklistSvg|
SETTING_SVG|CHECK_SVG|ACTRESS_SVG|NEW_SVG|BLACKLIST_SVG）= 0。
