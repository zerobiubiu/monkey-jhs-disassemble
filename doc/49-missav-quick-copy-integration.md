# 49 - MissavQuickCopy 插件集成

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 1. 背景

### 1.1 来源

`archetype/MissAV Quick Copy & Javdb Search.user.js`（v1.0.2，~190 行），
独立油猴脚本 `MissAV Quick Copy & Javdb Search`，功能：
为 MissAV 视频播放页面提供番号快速复制和一键跳转 JavDB 搜索。
点击"复制番号"按钮将当前番号复制到剪贴板，点击"转到JavDB搜索"按钮
在新标签页中搜索对应番号。与本项目同作者 zerobiubiu。

### 1.2 集成目标

将独立脚本集成到本项目，转为 TS 模块化，作为 `BasePlugin` 子类注册到
`PluginManager`，与现有 missav 站点插件（MissavStatusTagPlugin）并列。
要求转换后执行逻辑与原脚本零偏差。

### 1.3 可行性分析

| 维度 | 结论 | 依据 |
|------|------|------|
| 站点限定 | ✅ missav only，仅播放页 | 原脚本 `@match https://missav.ws/*/*-*`；本项目 `match` 已含 `missav.ws/live`，插件在 `if (isMissavSite)` 块注册，handle() 内目标选择器只在播放页命中 |
| GM_API 依赖 | ✅ grant 已齐 | 原脚本 `@grant GM_openInTab`，但实际代码注释掉了改用 `<a>.click()`；项目 grant 已含 `GM_openInTab`（doc/46 补），保留原 `<a>.click()` 实现无需额外补 grant |
| 数据源 | 无 | 不读 IndexedDB/localStorage |
| 事件源 | 无 | 仅 click 事件 + MutationObserver |
| 网络请求 | 无 | 无 GM_xmlhttpRequest/fetch |
| 主项目冲突 | ✅ 天然兼容 | 见 §1.4 |

### 1.4 主项目冲突排查

**无冲突，独立运行。**

本插件操作 missav 播放页工具栏选择器
`body > div:nth-child(3) > div.sm:container... > div > div.flex-1.order-first > div.mt-4 > div`，
仅在此容器内 prepend/appendChild 两个按钮。grep `src/` 确认：

| 冲突类型 | 表现 | 协调策略 |
|----------|------|----------|
| 选择器重叠 | 无 | MissavStatusTagPlugin 操作的是缩略图 `.thumbnail` 容器渲染状态标签，与本插件操作的工具栏无交集 |
| MutationObserver 互相触发 | 无 | 本插件 observer 监听 document.body subtree 等待目标元素出现即 disconnect，插入按钮后不再监听；不与其他插件 observer 互相触发 |
| DOM 容器共享 | 无 | 本插件只在目标工具栏 prepend/appendChild，不操作其他容器 |

## 2. 方案

### 2.1 目录结构

~190 行单一职责（复制番号 + 跳转 JavDB），不拆子目录。无 CSS（按钮样式
复用 missav 页面 tailwind class），无 initCss（返回空字符串）。

```
src/plugins/missav-quick-copy-plugin.ts   # MissavQuickCopyPlugin（extends BasePlugin）
```

### 2.2 关键设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 拆分粒度 | 单文件 | ~190 行单一职责，无需子目录拆分 |
| CSS 注入 | 无（initCss 返回空） | 原脚本无 GM_addStyle，按钮样式复用 missav 页面 tailwind class |
| DOM 创建方式 | 保留原生 createElement/createElementNS | 原脚本用原生 API 逐个创建元素（非 innerHTML 模板字符串），无需 TSX 化 |
| openInNewTab 实现 | 保留 `<a>.click()` | 原脚本注释掉了 GM_openInTab/window.open，实际用 `<a>.click()`，与原脚本零偏差 |
| 站点守卫 | `if (isMissavSite)` 块注册 | 原脚本 `@match missav.ws`；本项目 match 已覆盖，插件注册在 missav 块 |
| MutationObserver | 保留原逻辑 | 监听 document.body subtree，找到目标元素即 disconnect + insertButtons |
| 闭包状态 → 类字段 | observer 转类私有字段 | 原 IIFE 闭包变量；类化后需跨方法共享（虽然本插件只在 handle 内用） |

### 2.3 模块拆分映射

| 原脚本段 | 行号 | 本项目模块 |
|----------|------|------------|
| UserScript 头 | L1-10 | vite.config.ts（match/grant 已覆盖，无需改） |
| selector 常量 | L13-15 | 模块级常量 `MENU_BAR_SELECTOR` |
| extractCode | L18-23 | 模块级函数 `extractCode` |
| copyToClipboard | L26-32 | 模块级函数 `copyToClipboard` |
| showToast | L35-56 | 模块级函数 `showToast` |
| openInNewTab | L59-113 | 模块级函数 `openInNewTab`（保留 `<a>.click()`，去除注释代码） |
| createButton | L116-131 | 模块级函数 `createButton` |
| createSVGClipboard | L134-163 | 模块级函数 `createSVGClipboard` |
| createSVGJavDB | L165-170 | 模块级函数 `createSVGJavDB` |
| insertButtons | L173-201 | 模块级函数 `insertButtons` |
| MutationObserver | L204-210 | `MissavQuickCopyPlugin.handle()` |
| IIFE 启动 | L213 | `main.tsx` 的 `if (isMissavSite)` 块注册 |

## 3. 实施

### 3.1 新增文件

| 文件 | 行数 | 职责 |
|------|------|------|
| `src/plugins/missav-quick-copy-plugin.ts` | ~300 | MissavQuickCopyPlugin 类（extends BasePlugin，handle 内 MutationObserver + insertButtons）+ 6 个模块级辅助函数 |

### 3.2 修改文件

| 文件 | 改动 |
|------|------|
| `src/main.tsx` | import MissavQuickCopyPlugin；`if (isMissavSite)` 块 `manager.register(MissavQuickCopyPlugin)` |
| `vite.config.ts` | version `1.0.1` → `1.1.0`（minor 递增：新增插件） |
| `doc/README.md` | 文档清单追加 doc/49 |

### 3.3 控制流保留要点

1. **extractCode 番号提取**：FC2-PPV-\d+ 整体保留；其他取 pathname 末段的前两段
2. **copyToClipboard**：navigator.clipboard.writeText（Promise），成功 true/失败 false
3. **showToast**：原生 DOM 浮动提示（fixed 定位 + opacity 过渡 + 2s 后淡出移除）
4. **openInNewTab**：创建隐形 `<a target=_blank>` + click（原脚本注释掉了
   GM_openInTab/window.open，实际用 `<a>.click()`，保留此实现）
5. **createButton**：原生 createElement + tailwind class + SVG 图标 + 文本节点
6. **createSVGClipboard**：原生 createElementNS 创建剪贴板图标（3 个 path）
7. **createSVGJavDB**：template.innerHTML 解析 SVG 字符串
8. **insertButtons**：prepend 复制按钮 + appendChild JavDB 按钮
9. **MutationObserver**：监听 document.body subtree，找到目标元素后 disconnect + insertButtons

## 4. 执行验证记录

### 4.1 类型检查

```bash
$ npx tsc -b
（无输出，退出码 0）
```

全量类型检查通过，无错误无警告。

### 4.2 构建

```bash
$ npx vite build
dist/monkey-jhs-disassemble.user.js  1,815.46 kB │ gzip: 415.22 kB
✓ built in 1.56s
```

构建成功。产物 1815.46 kB（gzip 415.22 kB），较 doc/48 基线 1809.85 kB
（gzip 413.45 kB）+5.61 kB（gzip +1.77 kB），为新插件的合理增量。

### 4.3 userscript metadata 验证

本插件未新增 GM_* API（保留原 `<a>.click()` 实现不依赖 GM_openInTab），
userscript 头部 grant/match 无变化。`@version` 为 `1.1.0`。

## 5. 后续

### 运行时验证建议

1. **播放页按钮注入**：打开 missav.ws 播放页（URL 含 `-`）→ 工具栏应出现
   "复制番号"（最前）+ "转到JavDB搜索"（最后）两个按钮
2. **复制番号**：点击"复制番号" → 剪贴板应含当前番号 → 浮动提示
   "番号 {番号} 已复制"
3. **FC2 番号**：FC2-PPV-\d+ 格式的播放页 → 番号应整体保留
4. **跳转 JavDB**：点击"转到JavDB搜索" → 新标签页打开
   `https://javdb.com/search?q={番号}&f=all` → 浮动提示"正在跳转"
5. **非播放页**：missav 非播放页（如首页/列表页）→ 不注入按钮
   （目标选择器不匹配，observer 持续等待但不会命中）

### dead code 说明

- 原脚本 openInNewTab 中注释掉的 window.open / GM_openInTab / 方法3 / 方法4
  代码已去除（保留实际生效的 `<a>.click()` 实现，去除注释代码不影响行为）
