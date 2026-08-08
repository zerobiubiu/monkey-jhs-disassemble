# MissAV 视频预览弹窗覆盖列表页顶部条

> **文档类型**：🔧 开发指导
> **文档状态**：✅ 已执行
> **版本**：1.44.2 → 1.44.3（patch，bug 修复）
> **前置文档**：doc/228（iframe 详情弹窗）、doc/229（宽度 1023px）、doc/230（高度 100%）

## 1. 背景

用户反馈：打开的弹窗上部被**打开前的页面组件**遮挡——列表页顶部固定条
（`document.querySelector("body > div:nth-child(2) > div.relative > div")`，
即 `div.fixed.z-max.w-full.bg-gradient-to-b.from-darkest`）盖在弹窗上方，
弹窗上部不可见。

## 2. 根因（Camoufox 实测）

探针 `.superpowers/camoufox-missav/probe-stack.py` 实测：

| 元素 | z-index | position |
|------|---------|----------|
| 列表页顶部条（fixed z-max，56px） | **2147483647**（CSS 整数最大值） | fixed |
| layer 弹窗（默认起始值） | **19891014** | fixed |

→ 顶部条 z-index 远大于 layer 弹窗，弹窗打开时顶部条渲染在弹窗之上。

由于 2147483647 已是 CSS 整数上限，**无法通过提高弹窗 z-index 覆盖**，
唯一可靠方案是**弹窗打开期间隐藏该顶部条，关闭时恢复**。

## 3. 方案

| 项 | 改动 |
|----|------|
| 顶部条选择器 | `TOP_BAR_SEL = 'div.fixed.z-max.w-full.bg-gradient-to-b.from-darkest'`（常量） |
| 打开时 | 非视频页（`!isVideoDetailPath`）→ 记录原 display 并设 `display:none` |
| 关闭时 | layer `end` 回调恢复原 display（layer-wrapper 不劫持 end，所有关闭路径触发） |
| 视频页守卫 | iframe 视频页内嵌套弹窗**不隐藏**顶部条（用户确认 doc/228「顶部条不隐藏」） |

```ts
// 核心逻辑
const TOP_BAR_SEL = 'div.fixed.z-max.w-full.bg-gradient-to-b.from-darkest';
let topBar: HTMLElement | null = null;
let topBarPrevDisplay = '';
if (!isVideoDetailPath(location.pathname)) {
    topBar = document.querySelector<HTMLElement>(TOP_BAR_SEL);
    if (topBar) {
        topBarPrevDisplay = topBar.style.display;
        topBar.style.display = 'none';
    }
}
layer.open({
    type: 2,
    content: url,
    scrollbar: false,
    area: [`${width}px`, '100%'],
    end: () => {
        if (topBar) topBar.style.display = topBarPrevDisplay;
    }
});
```

## 4. 实施（修改文件清单）

| 文件 | 变更 |
|------|------|
| `src/plugins/missav-video-preview/missav-video-preview-plugin.ts` | 新增 `TOP_BAR_SEL` 常量 + 弹窗打开期间隐藏顶部条 + `end` 回调恢复；import `isVideoDetailPath` |
| `vite.config.ts` | version 1.44.2 → 1.44.3（patch） |
| `doc/231-missav-video-preview-cover-top-bar.md` | 本文档 |

## 5. 执行验证记录

### 执行环境

Windows + Bun（构建/静态验证）；Camoufox 实测堆叠关系（`.superpowers/camoufox-missav/probe-stack.py`）。

### 验证命令

```text
$ bun run build
$ bun run lint
$ bun run test
$ bun run check:structure
```

### 实际输出

```text
$ bun run build
dist/monkey-jhs-disassemble.user.js  2,198.24 kB │ gzip: 509.60 kB
✓ built in ~1s（产物头部 @version 1.44.3 已核对）

$ bun run lint
（无输出 = 0 errors / 0 warnings）

$ bun run test
 Test Files  12 passed (12)
      Tests  177 passed (177)

$ bun run check:structure
check-structure: OK
```

### 前端或调用方验证（Camoufox 实测堆叠）

| 项 | 结果 | 结论 |
|----|------|------|
| 顶部条 z-index | 2147483647（fixed，56px） | 高于 layer 弹窗 19891014，确认遮挡根因 |
| layer 弹窗 z-index | 19891014（默认起始） | 无法通过 CSS 超越顶部条 |
| 隐藏方案 | 弹窗打开期间 `display:none` + `end` 恢复 | 唯一可靠方案 |

### 验证结论

✅ 通过。构建/lint/177 测试/结构门禁全绿，产物 `@version 1.44.3`。

### 已知限制（需用户浏览器实测）

1. 弹窗打开时列表页顶部条暂时隐藏、关闭后恢复（视觉上弹窗覆盖列表页）；
2. iframe 视频页内嵌套弹窗不隐藏顶部条（doc/228 用户确认保留）；
3. 若站点未来调整顶部条 class 或 z-index 策略需重新实测。