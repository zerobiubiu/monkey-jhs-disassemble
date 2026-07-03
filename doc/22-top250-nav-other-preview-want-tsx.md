# 22 - top250/nav/other-site/preview/want-watched 组件 .ts→.tsx 转换（jsxToString 模式）

**文档类型**：🔧开发指导
**文档状态**：✅已执行

## 1. 背景

`doc/16` 落地轻量 `jsxToString`（`src/core/jsx-to-string.ts`），仅依赖 react
的**类型**（`import type`），运行时零依赖。`doc/17`/`18`/`19`/`20`/`21` 先后
将列表页 / 鉴定记录 / 黑名单 / 详情页按钮 / 设置弹层共 42 个 HTML 字符串组件
转为 TSX 原生 React 组件，调用点改 `jsxToString(<Comp {...props} />)`。

本次将 `doc/13` 扫描的剩余 17 个组件（top250 工具栏/年份按钮/分页/错误提示/
导航入口/登录弹窗、nav-bar 检索框/其它下拉、other-site 容器/按钮/复选框/
多结果角标、preview-video 画质按钮/操作按钮/封面入口、want-watched 导入按钮/
提示 span）统一转为 TSX，调用点 4 个插件 `.ts`→`.tsx` + `top250-plugin.tsx`
（已 .tsx），调用改 `jsxToString(<Comp {...props} />)`。

## 2. 转换清单

### 2.1 组件（.ts → .tsx，删原 .ts）

| 旧文件 | 新文件 | 说明 |
|--------|--------|------|
| `login-dialog.ts` | `login-dialog.tsx` | 无 props；用户名/密码输入框 + 登录按钮；jsxToString 忽略 onfocus/onblur/onmouseover/onmouseout 内联 JS（视觉装饰丢失，DOM 结构/id/style 零偏差） |
| `top250-tool-bar.ts` | `top250-tool-bar.tsx` | 4 props（handleType/typeValue/hasCnsub/yearButtonsHtml）；两组 conditionBox（分类按钮 + 年份按钮）；yearButtonsHtml 以 `dangerouslySetInnerHTML` 注入；href 含 & 用表达式保留 |
| `top250-year-button.ts` | `top250-year-button.tsx` | 3 props（year/typeValue/hasCnsub）；单个年份按钮；href 含 & 用表达式保留 |
| `top250-pagination.ts` | `top250-pagination.tsx` | 1 prop（page）；nav.pagination + 5 页码列表（Array.from 循环替代 listHtml for 拼接） |
| `top250-error-message.ts` | `top250-error-message.tsx` | Top250ErrorMessage（1 prop message）+ Top250LoadError（无 props）；各返回 `<h3>` |
| `top250-nav-link.ts` | `top250-nav-link.tsx` | 无 props；`<a href="/rankings/top"><span>Top250</span></a>` |
| `nav-search-box.ts` | `nav-search-box.tsx` | 无 props；检索框（select + input + 2 个 a） |
| `nav-other-dropdown.ts` | `nav-other-dropdown.tsx` | 无 props；navbar-item has-dropdown（反饍/ThePornDude） |
| `other-site-box.ts` | `other-site-box.tsx` | 2 props（siteButtonsHtml/isJavdbSite）；siteButtonsHtml 以 `dangerouslySetInnerHTML` 注入 |
| `other-site-btn.ts` | `other-site-btn.tsx` | 2 props（id/enabled）；enabled=false 时 style={display:none}，true 时无 style（原 style="" DOM 等价） |
| `other-site-checkbox.ts` | `other-site-checkbox.tsx` | 3 props（id/isEnabled/isJavdbSite）；`<label for>` 用 `{...{for:...} as Record<string,string>}` 展开注入（jsxToString 不转换 htmlFor，故用 for 原样输出） |
| `site-result-tag.ts` | `site-result-tag.tsx` | 无 props；`<span class="site-tag" style="top:-15px">多结果</span>` |
| `preview-video-quality-btn.ts` | `preview-video-quality-btn.tsx` | 3 props（opt:any/src/isActive）；画质按钮；opt.id/opt.quality/opt.text |
| `preview-video-action-btn.ts` | `preview-video-action-btn.tsx` | 4 props（id/color/label/hotKey?）；操作按钮；hotKey 缺省时不显示括号 |
| `preview-video-container.ts` | `preview-video-container.tsx` | 1 prop（coverSrc）；`<a>` + `<span>` + `<img>`（自闭合） |
| `want-watched-import-button.ts` | `want-watched-import-button.tsx` | 1 prop（variant: want/watched）；a-primary/a-success 类 |
| `want-watched-hint-span.ts` | `want-watched-hint-span.tsx` | 1 prop（variant: want/watched）；提示 span；文案含直引号 `"`（JSX 文本节点合法，escapeText 不转义 "） |

### 2.2 调用点（.ts → .tsx，调用改 jsxToString）

| 旧文件 | 新文件 | 调用数 | 说明 |
|--------|--------|--------|------|
| `top250-plugin.tsx`（已 .tsx） | `top250-plugin.tsx` | 7 | Top250NavLink/Top250Pagination/Top250ErrorMessage/Top250LoadError/Top250YearButton/Top250ToolBar/LoginDialog |
| `nav-bar-plugin.ts` | `nav-bar-plugin.tsx` | 2 | NavSearchBox/NavOtherDropdown |
| `other-site-plugin.ts` | `other-site-plugin.tsx` | 6 | OtherSiteBtn/OtherSiteBox/OtherSiteCheckbox + SiteResultTag×3 |
| `preview-video-plugin.ts` | `preview-video-plugin.tsx` | 7 | PreviewVideoContainer/PreviewVideoQualityBtn/PreviewVideoActionBtn×3/SiteResultTag |
| `want-and-watched-videos-plugin.ts` | `want-and-watched-videos-plugin.tsx` | 4 | WantWatchedImportButton×2/WantWatchedHintSpan×2 |

## 3. 执行验证记录

### 3.1 build

```
$ pnpm run build
$ tsc -b && vite build
✓ 166 modules transformed.
dist/monkey-jhs-disassemble.user.js  517.33 kB │ gzip: 122.79 kB
✓ built in 336ms
```

tsc strict 通过（noUnusedLocals/noUnusedParameters/noFallthroughCasesInSwitch）。

### 3.2 产物体积

| 阶段 | 原始 | gzip |
|------|------|------|
| doc/21 后 | 505.36 kB | 122.35 kB |
| **doc/22（本档）** | **517.33 kB** | **122.79 kB** |

较 doc/21 +11.97 kB（17 个组件 JSX runtime + 函数体增量），< 600 kB 阈值。✓

### 3.3 行为一致性

- 17 个组件的 HTML 结构/类名/style 值与原 .ts 零偏差（class→className、
  style string→CSSProperties 对象、href 含 & 用表达式保留避免 JSX 实体解码、
  data-*/aria-* 原样、自闭合 void element 保留）。
- `LoginDialog` 的 onfocus/onblur/onmouseover/onmouseout 内联 JS 丢失
  （jsxToString 忽略 on* 事件）；#loginBtn/#username/#password id 保留，
  success 回调的事件绑定不受影响；视觉装饰（边框/背景色变化）丢失，DOM 等价。
- `OtherSiteBtn` enabled=true 时无 style 属性（原 style=""，DOM 等价）。
- `OtherSiteCheckbox` 的 `<label for>` 用 `{...{for:...} as Record<string,string>}`
  展开（TypeScript strict 跳过 index signature 检查，jsxToString 原样输出 for）。
- `Top250YearButton` 循环拼接的 yearButtonsHtml 紧凑无空白（原 \n 折叠为空格，
  buttons has-addons CSS 下按钮紧贴，视觉等价）。
- `want-watched-hint-span` 文案直引号 `"` 在 JSX 文本节点合法。

### 3.4 提交

- 主题：`17 个 HTML 字符串组件转 TSX 原生 JSX 组件`
- commit：`60833b1`
- 39 files changed, 1100 insertions(+), 599 deletions(-)
