# 74：修复列表页封面图未加载时点击走原生跳转

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行

## 背景

### 现象

用户反馈：在首页 `https://javdb.com/`（以及任何列表页），当 item 的封面图片
尚未加载完成时，点击该 item 会走 JavDB 网站默认逻辑——`<a href="/v/xxx">`
打开新网页，而不是脚本期望的 layer iframe 弹窗（`utils.openPage`）。

图片加载完成后点击则正常弹出 iframe。

### 根因

`ListPagePlugin.bindClick()` 使用 jQuery 事件委托绑定点击：

```js
$(selectorConfig.boxSelector).on('click', '.item img', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    ...
    utils.openPage(aHref, carNum, true, event);
});
```

选择器是 **`.item img`**——只有点击 `<img>` 元素本身才匹配。

JavDB 的 item DOM 结构（archetype L4685）：

```html
<div class="item">
  <a class="box" href="/v/xxx">
    <div class="cover">             ← CSS min-height:350px / padding-top:142%，始终有面积
      <img loading="lazy" src>     ← 原生懒加载，未加载时 <img> 无尺寸
    </div>
    <div class="video-title">...</div>
    ...
  </a>
</div>
```

- `<img>` 使用 `loading="lazy"` 原生懒加载，图片未加载时 `<img>` 无尺寸
  （`object-fit:cover` 无效），不覆盖 `.cover` 全部面积
- 用户实际点中的是 `.cover` div 或 `<a>` 父元素，而非 `<img>`
- 事件委托 `.item img` 不匹配 `.cover` div → 不触发 handler →
  `event.preventDefault()` 未执行 → 走 JavDB 原生 `<a>` 跳转

图片加载后 `<img>` 有尺寸覆盖 `.cover`，点击 `<img>` 匹配选择器，正常走 iframe 弹窗。

### 影响

所有 JavDB 列表页（首页、搜索页、演员页等），图片未加载时点击封面无法弹出
iframe 详情弹窗，用户体验退化到原生跳转。

## 方案

将事件委托选择器从 `.item img` 改为 **`.item .cover`**。

- `.cover` 有 CSS `min-height: 350px` / `padding-top: 142%` 撑开面积，
  即使图片未加载也始终可点击
- `<img>` 在 `.cover` 内，点击 `<img>` 时事件冒泡也能匹配 `.item .cover`
  （jQuery 事件委托检查 `event.target` 的祖先链是否匹配选择器）
- 不影响 `.item video`（视频播放）、`.item .video-title`（标题点击）的单独委托
- 不影响 `div.meta-buttons` 排除逻辑（`$(event.target).closest('div.meta-buttons')`）

contextmenu（右键屏蔽）同理：`.item img, .item video` → `.item .cover, .item video`。

## 实施

### 修改文件

| 文件 | 修改 |
|------|------|
| `src/plugins/list-page-plugin.tsx` | `bindClick()` L518 click 委托 `.item img` → `.item .cover`；L560-561 contextmenu 委托 `.item img, .item video` → `.item .cover, .item video`；方法注释补充选择器变更说明 |

### 不修改的文件

- `archetype/jhs.user.js`：原始脚本也用 `.item img`，本修复是对原始脚本的改进，不追溯修改 archetype
- `src/plugins/base-plugin.ts` `getSelector()`：`coverImgSelector: '.cover img'` 仍用于 `replaceHdImg()` 和 hover 预览，不需要改

## 执行验证记录

```
$ bun run build
$ tsc -b && vite build
vite v8.1.3 building client environment for production...
✓ 214 modules transformed.
[lightningcss minify] Unexpected token Semicolon  ← layer.css IE hack 容错（errorRecovery:true，已知）
...
computing gzip size...
dist/monkey-jhs-disassemble.user.js  1,854.23 kB │ gzip: 424.22 kB
✓ built in 1.14s
```

- `tsc -b` 类型检查通过（无错误）
- `vite build` 打包成功，产物 1,854.23 kB（gzip 424.22 kB）
- lightningcss Semicolon 警告为 layer.css IE hack（`*display:inline` 等），
  由 `css.lightningcss.errorRecovery: true` 容错处理，不影响产物

## 后续验证建议

1. 在 JavDB 首页（`https://javdb.com/`）刷新页面后，不等图片加载完成，
   立即点击 item 封面区域，确认弹出 iframe 弹窗而非新标签页
2. 图片加载完成后点击封面，确认行为不变（iframe 弹窗）
3. 右键点击封面区域（含图片未加载时），确认弹出屏蔽确认框
4. 点击 `.video-title` 区域，确认非 FC2 番号仍走原生跳转（未改变）
5. 点击视频缩略图（`.item video`），确认视频播放/暂停正常
