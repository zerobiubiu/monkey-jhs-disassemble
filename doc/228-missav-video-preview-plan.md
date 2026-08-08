# MissAV 视频流 iframe 详情弹窗实施计划

> **文档类型**：🔧 开发指导
> **文档状态**：🔧 待执行
> **版本**：1.43.5 → 1.44.0（新增功能插件，minor）
> **前置调研**：Camoufox 真实浏览器实测（本会话，探针脚本 `.superpowers/camoufox-missav/`）
> **执行方式**：subagent-driven development（计划 3 任务，逐任务审查）

## 1. 背景与需求

用户希望 missav 列表页（视频流）支持 **javdb 同款交互**：点击视频卡片弹出
**iframe 界面**加载视频详情页，突出显示左侧主内容区（播放器 + 标题 + 工具
栏），而无需跳转新页面。用户实测确认：**missav 在 1024px 宽度以下（不含
1024）会自动隐藏右侧推荐栏**，因此 iframe 宽度设 <1024 即可自然突出左侧，
无需额外隐藏逻辑。

### 1.1 Camoufox 实测证据（已验证事实）

用 Camoufox（反检测 Firefox，经 `uv run --with camoufox` 驱动）绕过 Cloudflare
访问 missav 实测（探针 `probe-preview.py` / `probe-click.py` / `probe-top.py` /
`probe-hide-header.py`）：

| 探测项 | 实测结果 | 结论 |
|--------|----------|------|
| 响应式右侧栏 | 视口 900/1023px 右侧栏 `display:none`（左侧 736px 占满）；1024/1200px 右侧 `display:flex`（300px，左侧 668px） | **<1024 自动隐藏右侧，用户说法完全正确** |
| iframe 加载详情页 | 列表页内嵌 900px 宽 iframe 加载 `/cn/mkmp-745` → 右侧自动隐藏、左侧 736px 占满、`#sprite-plyr` 播放器正常加载、标题正确 | **iframe 方案成立，无需特殊隐藏逻辑** |
| 卡片点击结构 | `.thumbnail.group` 带 Alpine `@click="clickPreview('<uuid>')"` + 内部 `a[href]`（详情页链接，2 个封面链接 + 1 个标题链接） | 拦截点明确 |
| 站点原生点击 | 点击卡片触发 `clickPreview`（Alpine），页面出现一个空 iframe（站点预览容器），**不跳转** | 拦截后需阻止 Alpine 冒泡，避免站点预览弹层 |
| 拦截可行性 | 捕获阶段 `document.addEventListener('click', ..., true)` + `preventDefault()` + `stopPropagation()` → 点击 `a[href]` 后 `location.href` 不变 | **capture 拦截 + 阻止传播方案可行**（Alpine 委托监听在 document，捕获阶段 stopPropagation 可阻断） |
| 详情页顶部 | 900px 视口：`div.fixed.z-max.w-full.bg-gradient-to-b.from-darkest` 56px 顶部条显示；`content-without-search` 有 `padding-top: 80px`（内容区自身 padding，与 header 无关） | iframe 内需隐藏顶部条 + 收窄 padding，对齐 javdb `hideNav=1` 语义 |
| 隐藏 header 效果 | 隐藏顶部条后 leftTop 仍 80px（padding 属内容区自身），需同时改 padding-top | 注入 CSS 处理 |

### 1.2 与现有插件的协同

- **MissavAutoPagePlugin / MissavStatusFilterPlugin**：`isVideoDetailPath` 守卫
  （doc/227）在 iframe 视频页内自动跳过瀑布流/筛选器——**零改动**；
- **MissavQuickCopyPlugin**：iframe 视频页内正常插入「复制番号/转JavDB」按钮
  （弹窗内可用）——**零改动，预期行为**；
- **MissavStatusTagPlugin**：视频页无缩略图网格，observer 无目标——**零改动**；
- **MissavVideoPreviewPlugin（新）**：iframe 内视频页底部有推荐区（同款
  `.thumbnail.group` grid，doc/220 实测），点击推荐缩略图同样弹新窗（嵌套
  layer，与 javdb iframe 内行为一致）。

### 1.3 与 javdb openPage 机制对齐

javdb 的 `utils.openPage`（`src/core/common-util.ts` L132-157）：
`layer.open({ type: 2, content: url + (含 ? ? '&' : '?') + 'hideNav=1', area: getResponsiveArea(['85%','90%']) })`，
`main.tsx` L122-131 依 `hideNav=1` 注入隐藏导航 CSS。本次 missav 弹窗采用
**同构机制**：URL 加 `?jhsPreview=1` 参数 → iframe 内注入
`jhsPreviewCss`（隐藏顶部条 + 收窄 padding-top）→ 突出左侧播放器区。

## 2. 方案

### 2.1 架构

```mermaid
flowchart LR
    C["列表页卡片点击<br/>（.thumbnail.group）"] --> I["捕获阶段 click 拦截<br/>preventDefault + stopPropagation"]
    I --> U["提取 a[href] 详情 URL"]
    U --> L["layer.open type:2<br/>area 900px × 90%"]
    L --> F["iframe 加载详情页<br/>URL 带 ?jhsPreview=1"]
    F --> H["iframe 内注入 CSS<br/>隐藏顶部条 + 收窄 padding"]
    F --> G["既有守卫自动生效<br/>瀑布流/筛选器跳过"]
```

### 2.2 模块拆分

`src/plugins/missav-video-preview/` 子目录（参考 missav-auto-page/ 先例）：

| 文件 | 职责 |
|------|------|
| `mv-selectors.ts` | 选择器常量 + 纯函数（findDetailUrl / isPreviewUrl / CARD_SEL） |
| `mv-iframe-css.ts` | `jhsPreviewCss` CSS 字符串常量（隐藏顶部条 + padding-top 收窄）+ 注入判定 |
| `missav-video-preview-plugin.ts` | 插件主类：文档级捕获 click 拦截 + layer.open 弹窗 + iframe 内 CSS 注入 |

### 2.3 关键设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 拦截方式 | `document` 捕获阶段 click 监听（`{ capture: true }`）+ `target.closest('.thumbnail.group')` 命中 → `preventDefault` + `stopPropagation` | 实测可行；捕获阶段 stopPropagation 阻断 Alpine document 委托（clickPreview 不触发） |
| 触发按键 | 左键（`e.button === 0`）且非 Ctrl/Cmd 修饰键 → 弹窗；中键/右键/Ctrl+点击 → 保留原生行为（新标签） | 对齐 javdb openPage 语义（ctrl/meta 新标签） |
| 弹窗 | `layer.open({ type: 2, content: url + '?jhsPreview=1', area: [`min(900, vw-40)px`, '90%'], shadeClose: true, scrollbar: false })` | 900px < 1024 右侧自动隐藏；layer-wrapper 已提供 ESC/closeBtn 基建 |
| iframe 内 CSS | URL 含 `jhsPreview=1` → 注入 `.fixed.z-max` 顶部条 `display:none` + `.content-without-search { padding-top: 20px }` | 对齐 javdb hideNav；实测 padding 属内容区自身需显式收窄 |
| 推荐区嵌套 | iframe 视频页内点击底部推荐缩略图 → iframe 内 layer 弹窗 | 与 javdb iframe 行为一致；layer 在 iframe 文档内层叠 |
| 生命周期 | `TaskSupervisor` 管理捕获监听器 | 项目统一约定（doc/139） |
| 守卫 | 列表页全站注册（无 pageTypes 覆写）；`isVideoDetailPath` 不拦截（iframe 视频页推荐区仍需弹窗） | 与 missav-auto-page 同模式 |
| 设置项 | 本期不做（默认开启） | YAGNI，用户未要求开关 |
| 样式 | 无独立 CSS 文件；`jhsPreviewCss` 常量走 `initCss` 脉冲注入（iframe 内也执行 initCss） | 最小化；iframe 是独立文档，main.tsx 顶层 CSS 不覆盖 |

**注意**：iframe 内是新文档，userscript 会照常运行（无 `@noframes`，doc/186），
`initCss` 会在 iframe 内注入 `jhsPreviewCss`——因此**无需在 main.tsx 改任何
iframe 检测逻辑**，全部由新插件在 iframe 实例内自行处理（`isPreviewUrl(location.href)`
判定当前上下文是否为预览 iframe）。

### 2.4 交互细节（待用户确认，默认值如下）

1. **点击范围**：默认所有列表页卡片**左键点击 → 弹窗**；中键/右键/Ctrl+点击
   保留原生行为（新标签打开详情页）；
2. **弹窗内容**：加载**完整详情页**（播放器/收藏/片单/下载/分享/复制番号/转
   JavDB 全部可用），仅隐藏顶部条；
3. **弹窗尺寸**：默认 `min(900px, 视口宽-40px)` × 90% 高。

## 3. 任务分解

### Task 1：纯函数模块 + 测试（mv-selectors.ts）

**文件**：
- Create：`src/plugins/missav-video-preview/mv-selectors.ts`
- Test：`tests/missav-video-preview.test.ts`

**Interfaces**：
- `CARD_SEL = '.thumbnail.group'` — 卡片选择器（与 MAP_SEL.thumb 一致）
- `findDetailUrl(card: Element): string | null` — 从卡片内 `a[href]` 取详情绝对 URL
  （优先 href 属性，`a[alt]` 优先或首个 a[href]）
- `isPreviewUrl(url: string): boolean` — 判定 URL 是否含 `jhsPreview=1` 参数
- `isPlainLeftClick(e: MouseEvent): boolean` — `e.button === 0 && !e.ctrlKey &&
  !e.metaKey && !e.shiftKey && !e.altKey`

```ts
// mv-selectors.ts 关键实现（Task 1 交付）
export const CARD_SEL = '.thumbnail.group';
export const PREVIEW_PARAM = 'jhsPreview=1';

export function isPreviewUrl(url: string): boolean {
    return url.includes(PREVIEW_PARAM);
}

export function findDetailUrl(card: Element): string | null {
    const a = card.querySelector<HTMLAnchorElement>('a[href]');
    return a ? a.href : null;
}

export function isPlainLeftClick(e: MouseEvent): boolean {
    return e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey;
}
```

- [ ] **Step 1：写失败测试**（tests/missav-video-preview.test.ts，node 环境，
      HTML 片段 + DOMParser + 构造 MouseEvent）
- [ ] **Step 2：运行测试确认失败**：`bun run test tests/missav-video-preview.test.ts`
- [ ] **Step 3：实现 mv-selectors.ts**
- [ ] **Step 4：测试通过**
- [ ] **Step 5：提交**：`git commit -m "新增 MissAV 视频预览纯函数模块"`

### Task 2：插件主类 + iframe CSS + 注册

**文件**：
- Create：`src/plugins/missav-video-preview/mv-iframe-css.ts`（`jhsPreviewCss` 常量）
- Create：`src/plugins/missav-video-preview/missav-video-preview-plugin.ts`
- Modify：`src/main.tsx`（isMissavSite 块注册）
- Modify：`src/plugins/plugin-registry.ts`（PluginMap 类型映射）

**Interfaces**：
- `jhsPreviewCss: string` — 隐藏顶部条 + 收窄 padding 的 CSS 片段：

```css
.fixed.z-max.w-full.bg-gradient-to-b.from-darkest { display: none !important; }
.content-without-search { padding-top: 20px !important; }
```

- 主类 `handle()`：
  1. `if (!isPreviewUrl(location.href))` → 注册捕获阶段 click 监听
     （`e.target.closest(CARD_SEL)` 命中 + `isPlainLeftClick` → `findDetailUrl` →
     `preventDefault/stopPropagation` → `layer.open` 弹窗）
  2. `if (isPreviewUrl(location.href))` → 注入内容区微调（可选：将
     `.content-without-search` padding-top 收窄，若顶部条 CSS 已覆盖则无需）
      实际上 `jhsPreviewCss` 在 initCss 返回即可（iframe 内 initCss 也会执行）；
      handle 分支仅处理监听注册

- `initCss()`：返回 `jhsPreviewCss`（iframe 内自动注入，CSS 按类名匹配，
  列表页无 `.fixed.z-max` 顶部条/无 `content-without-search`，天然无副作用）

- [ ] **Step 1：实现 mv-iframe-css.ts + missav-video-preview-plugin.ts**
- [ ] **Step 2：main.tsx 注册**（isMissavSite 块 + plugin-registry.ts 映射）
- [ ] **Step 3：验证**：`bun run build && bun run lint && bun run test && bun run check:structure`
- [ ] **Step 4：提交**：`git commit -m "新增 MissAV 视频流 iframe 详情弹窗插件"`

### Task 3：收尾（版本号 + 文档 + changelog）

- [ ] **Step 1**：`vite.config.ts` version `1.43.5 → 1.44.0`（新增插件，minor）
- [ ] **Step 2**：本文档状态 → ✅ + 填写执行验证记录
- [ ] **Step 3**：`doc/README.md` 文档清单 + 阅读顺序 + 进度概览更新
- [ ] **Step 4**：`changelog/CHANGELOG.md` 新增 v1.44.0
- [ ] **Step 5**：`bun run build` 确认产物 `@version 1.44.0`；提交

## 4. 验证方案

- 纯函数：`tests/missav-video-preview.test.ts`（node 环境，~10 用例）
- 静态：`tsc -b` / `lint`(0/0) / `check:structure`
- **浏览器实测（Camoufox 回归）**：
  1. missav 列表页左键点击卡片 → 900px iframe 弹窗，右侧自动隐藏、左侧占满、
     Plyr 播放器加载、顶部条隐藏、复制番号按钮可用
  2. 中键/右键/Ctrl+点击 → 新标签打开（原生行为）
  3. 弹窗内点击底部推荐缩略图 → 嵌套弹窗
  4. 关闭弹窗后列表页滚动/瀑布流/筛选器正常

## 5. 评估与风险

- **Alpine 预览冲突**：捕获阶段 stopPropagation 阻断 clickPreview（实测验证）；
  若 Alpine 在捕获阶段另有 document 级监听（未实测到），兜底在卡片上直接挂
  click 监听；
- **iframe 内脚本执行**：userscript 在 iframe 文档内完整运行（无 @noframes），
  各插件守卫已验证（doc/227）；`devicePixelRatio`/视口差异不影响；
- **layer 嵌套**：iframe 内 layer.open 在 iframe 文档内层叠（javdb 同行为），
  关闭后 shade 计数恢复（layer-wrapper 已处理）；
- **随机前缀域**：详情 URL 从卡片 `a[href]` 提取（绝对 URL 含随机前缀），
  不自行拼接；
- **不变量**：不触碰状态标签渲染、跨站同步、瀑布流/筛选器逻辑；新插件独立
  注册 isMissavSite 块。

## 6. 后续可扩展（不纳入本期）

- 设置项（弹窗开关 / 宽高比）；
- javdb 列表页点击卡片也改弹窗（现有 dialogOpenDetail 设置已支持，无需改）。