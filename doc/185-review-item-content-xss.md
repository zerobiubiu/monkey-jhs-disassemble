# doc/185 — review-item 评论正文 XSS 加固

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

codex-dev 交叉审计 P1-E2 项：review-item.tsx 的评论正文 `content` 来自 JavDB API（不可信 HTML），原以 `dangerouslySetInnerHTML` 原始注入，存在 XSS 面。同文件 `stars` 为调用方生成的可信 `<i class="icon-star">` 标记，安全，维持原 raw 注入。

## 方案

新增纯函数 `safeReviewNodes(html)`：`DOMParser` 解析后递归遍历 `body.childNodes`：
- 文本节点 → 字符串子节点（jsxToString 转义 `&`/`<`/`>`）
- `<a>` → href 经 `sanitizeUrl`，强制 `target="_blank" rel="noopener noreferrer"`，保留 class/style
- `<br>` → `<br />`
- 白名单内联标签（b/i/em/strong/p/span）→ 保留标签，仅复制 class/style（`parseInlineStyle` 解析内联 style 为 React style 对象），剥离其余属性（含 on 事件属性）
- 其余标签（script/iframe/img/svg 等）→ 剥离标签、保留子节点

`parseInlineStyle` 仅做字符串切分 + kebab→camel，无 eval/正则回溯，try/catch 兜底。

安全论证：仅复制 class/style 两类属性；on 事件属性、非 a 元素的 href、src、action 等永不复制，故事件向量无法注入；style 在目标浏览器（evergreen）中不可执行 `javascript:`，与加固前行为等价。

## 首版回归修正

首版 safeReviewNodes 剥离全部属性且未白名单 SPAN，导致 ReviewLinkContent 生成的可信样式丢失（ed2k 高亮 `<span>` 被解包、magnet/http 的 `<a class="a-primary">` 失去 a-primary 外观）。本版白名单加入 SPAN 并在保留标签上复制 class/style，恢复保真度。

## 实施清单

| 文件 | 操作 |
|------|------|
| src/components/review/review-item.tsx | 新增 safeReviewNodes + parseInlineStyle；content `<p>` 改用它；stars 维持原样；修正文件头注释 |

## 验证

tsc 0 错 / vitest 28/28 / eslint 0 错 / stylelint 干净 / check:structure OK。`dangerouslySetInnerHTML` 仅余 stars 一处。
