# 星星评分组件 + 清单平铺 + 隐藏原生元素

**文档类型**：🔧开发指导  
**文档状态**：✅已执行  
**修改日期**：2026-07-01  
**修改文件**：`jhs.user.js`

## 1. 概述

用星星评分组件替代旧的按钮式评分，将清单 modal 内容平铺到页面上，隐藏不再需要的原生元素。

## 2. 星星评分组件

### 2.1 组件结构

重写 `addQuickActionButtons` → 注入 `.jhs-rating-bar` 到 `.column` 上方：

```
[★][★][★][★][★]          ← 第一行：5 颗星，点击第 N 颗 = 已观看+N星
[♥ 收藏] [已读]            ← 第二行：收藏（想看）在前、已读（0星）在后
```

新增方法：
- `_buildRatingBar(nav)` — 构建 DOM + 绑定事件，插入 `.column.firstChild`
- `_injectRatingStyles()` — CSS 注入（星星 26px、hover 放大、按钮圆角阴影）
- `_syncRatingBar()` — 从 javdb DOM 检测状态，更新星星高亮/按钮激活
- `_setRatingBusy(busy)` — 操作期间禁用交互（`.is-busy`）

### 2.2 隐显控制

| 状态 | 星星 | 已读 | 收藏 |
|------|------|------|------|
| 已观看+N星 | 前 N 颗金色高亮 | N=0 时高亮 | 灰 |
| 想看 | 全灰禁用 | 灰 | 蓝色高亮 |
| 未评价 | 全灰可点 | 灰 | 灰 |

### 2.3 组件重建机制

组件在 `.review-buttons` 内部，Rails ajax 替换 `innerHTML` 时会被销毁。

- `addQuickActionButtons` 挂 MutationObserver 监听 `.review-buttons` 变化
- 变化时调 `_buildRatingBar` 重建 + `_syncRatingBar` 同步状态
- `_syncRatingBar` 在 `bar` 不存在时先调 `_buildRatingBar(nav)` 重建，再同步状态
- `_reviewChain` 完成后调 `_syncRatingBar`（此时组件刚被 Rails JS 销毁，需要重建）

### 2.4 动效

- 星星 hover 预览（前面的星亮起）+ `transform:scale(1.15)` 放大
- 点击星星/按钮有 `jhs-star-pop` 缩放动画
- 颜色过渡 `transition`

## 3. 清单平铺面板

### 3.1 问题
隐藏原生 `.buttons.are-small.review-buttons` 后，`#save-list-button`（存入清单按钮）也消失，无法打开清单 modal。

### 3.2 方案
- 在 `#otherSiteBox` 下方插入 `.jhs-list-panel` 容器
- 程序化 `#save-list-button.click()` 触发 Stimulus ajax 加载清单（modal 被 CSS 永久隐藏，DOM 保留）
- MutationObserver 监听 modal 内 `listContainer` → 克隆条目到 `.jhs-list-panel`（跳过"預設清單"）
- 事件代理：平铺面板 checkbox `change` → 按位置匹配 modal 内 checkbox → 同步 `checked` → 触发 `change` → Stimulus ajax

### 3.3 实现方法
- `_ensureListPanel(nav)` — 轮询等待 `#otherSiteBox` 出现（OtherSitePlugin 异步注入），创建面板 + 调 `_initListPanel` + 绑定事件代理
- `_initListPanel()` — 程序化触发 ajax 加载 + MutationObserver 克隆同步

### 3.4 验证
- CSS 隐藏 modal 后程序化 click 仍触发 ajax 加载（12 条清单）✓
- 克隆到平铺面板渲染成功 ✓
- 勾选同步到 modal checkbox 触发 Stimulus change ✓
- "預設清單"被过滤（11 条显示）✓

## 4. 隐藏原生元素

### 4.1 CSS 隐藏规则（兄弟选择器，跨页面稳定）

```css
/* 隐藏 review-buttons 内第二个 panel-block（下載/訂正磁力按钮） */
.review-buttons > .panel-block ~ .panel-block { display:none!important }
/* 隐藏 review-buttons 后紧跟的 panel-block（N人想看/看過统计） */
.review-buttons + .panel-block { display:none!important }
/* 隐藏原生评价状态标签和按钮（星星组件已替代） */
.review-buttons .review-title { display:none!important }
.review-buttons .buttons.are-small.review-buttons { display:none!important }
/* 永久隐藏清单 modal（DOM 保留供 Stimulus ajax 操作） */
#modal-save-list { display:none!important }
```

### 4.2 删除 settingSiteBtn
- 删除模板里的 `<a id="settingSiteBtn">设置</a>` 按钮 + `#settingsArea` 整块
- 删除 `setupEventListeners` 里的 `settingSiteBtn` 点击监听
- `renderSettingsArea`/`setupEventListeners` 变为死代码（操作的 DOM 已不存在，null 检查 + 可选链保护，不报错）

## 5. 新增方法签名

| 方法 | 签名 | 用途 |
|------|------|------|
| `_buildRatingBar(nav)` | `(HTMLElement) → void` | 构建 DOM + 绑定事件，插入 `.column.firstChild`；幂等（已有则跳过） |
| `_injectRatingStyles()` | `() → void` | 注入 `#jhs-rating-styles` CSS；幂等 |
| `_syncRatingBar()` | `() → void` | 检测 javdb DOM 状态 → 更新星星/按钮显示；bar 不存在时先调 `_buildRatingBar` 重建 |
| `_setRatingBusy(busy)` | `(boolean) → void` | 切换 `.is-busy` 禁用交互 |
| `_ensureListPanel(nav)` | `(HTMLElement) → void` | 轮询等待 `#otherSiteBox` 出现，创建 `.jhs-list-panel` + 调 `_initListPanel` + 绑定事件代理；`_listPanelEnsured` 标记只执行一次 |
| `_initListPanel()` | `() → void` | 程序化 `#save-list-button.click()` 触发 ajax + MutationObserver 监听 `listContainer` 克隆到 `.jhs-list-panel`（跳过「預設清單」）；`_listPanelIniting` 标记只执行一次 |

### `_buildRatingBar` HTML 模板

```html
<div class="jhs-rating-bar">
    <div class="jhs-stars" data-score="0">
        <span class="jhs-star" data-score="1">★</span>
        <span class="jhs-star" data-score="2">★</span>
        <span class="jhs-star" data-score="3">★</span>
        <span class="jhs-star" data-score="4">★</span>
        <span class="jhs-star" data-score="5">★</span>
    </div>
    <div class="jhs-rating-actions">
        <button class="jhs-fav-btn" title="设为想看（收藏）">♥ 收藏</button>
        <button class="jhs-read-btn" title="设为已观看（0星）">已读</button>
    </div>
</div>
```

### CSS 完整内容（`_injectRatingStyles` 注入）

```css
/* 隐藏 review-buttons 内第二个 panel-block（下載/訂正磁力按钮） */
.review-buttons > .panel-block ~ .panel-block{display:none!important}
/* 隐藏 review-buttons 后紧跟的 panel-block（N人想看/看過统计） */
.review-buttons + .panel-block{display:none!important}
/* 隐藏原生评价状态标签和按钮（星星组件已替代） */
.review-buttons .review-title{display:none!important}
.review-buttons .buttons.are-small.review-buttons{display:none!important}
/* 永久隐藏清单 modal（DOM 保留供 Stimulus ajax 操作） */
#modal-save-list{display:none!important}
/* 星星评分组件 */
.jhs-rating-bar{display:flex;flex-direction:column;gap:6px;margin:4px 0 12px;user-select:none}
.jhs-stars{display:inline-flex;gap:6px;align-items:center}
.jhs-star{font-size:26px;line-height:1.2;padding:2px 4px;cursor:pointer;color:#d0d0d0;transition:color .15s,transform .15s}
.jhs-star:hover{transform:scale(1.15)}
.jhs-star.is-preview{color:#f5b301}
.jhs-star.is-active{color:#f5b301}
.jhs-star.is-active:hover{color:#ffce3a}
.jhs-star.is-popping{animation:jhs-star-pop .3s ease}
@keyframes jhs-star-pop{0%{transform:scale(1)}40%{transform:scale(1.4)}100%{transform:scale(1)}}
.jhs-stars.is-disabled .jhs-star{cursor:default;opacity:.4;pointer-events:none}
.jhs-rating-actions{display:flex;gap:8px;align-items:center}
.jhs-read-btn,.jhs-fav-btn{border:1px solid #dbdbdb;border-radius:6px;padding:5px 16px;font-size:14px;background:#fff;cursor:pointer;transition:all .15s;white-space:nowrap}
.jhs-read-btn:hover,.jhs-fav-btn:hover{border-color:#b5b5b5;box-shadow:0 1px 4px rgba(0,0,0,.08)}
.jhs-read-btn.is-active{background:#48c774;border-color:#48c774;color:#fff}
.jhs-fav-btn.is-active{background:#3273dc;border-color:#3273dc;color:#fff}
.jhs-read-btn.is-popping,.jhs-fav-btn.is-popping{animation:jhs-star-pop .3s ease}
.jhs-rating-bar.is-busy{pointer-events:none;opacity:.6}
/* 清单平铺面板（位于 #otherSiteBox 下方） */
.jhs-list-panel{display:flex;flex-wrap:wrap;gap:8px 16px;margin:8px 0;padding:8px 12px;background:#fafafa;border-radius:6px;min-height:36px}
.jhs-list-panel:empty{display:none}
.jhs-list-panel .control{margin:0}
.jhs-list-panel .checkbox{display:inline-flex;align-items:center;gap:4px;font-size:13px;cursor:pointer}
.jhs-list-panel .checkbox input{margin:0}
```

### `_syncRatingBar` 状态检测逻辑

```js
_syncRatingBar() {
    let bar = document.querySelector(".jhs-rating-bar");
    // 组件被 Rails ajax innerHTML 替换销毁 → 重建
    if (!bar) {
        const nav = document.querySelector("...nav");
        if (nav) this._buildRatingBar(nav);
        bar = document.querySelector(".jhs-rating-bar");
    }
    if (!bar) return;
    const rb = document.querySelector(".review-buttons");
    const want = !!rb?.querySelector("a[href='/users/want_watch_videos'] .tag.is-info.is-light");
    const watched = !!rb?.querySelector("a[href='/users/watched_videos'] .tag.is-success.is-light");
    const checked = rb?.querySelector('input[name="video_review[score]"][checked]');
    const score = checked ? +checked.value : 0;
    // want: 星星全灰禁用，收藏高亮
    // watched: 前 N 星高亮，N=0 时已读高亮
    // none: 全灰可点
}
```

### `_ensureListPanel` + `_initListPanel` 关键逻辑

```js
_ensureListPanel(nav) {
    if (this._listPanelEnsured) return;
    const otherSite = nav.querySelector("#otherSiteBox");
    if (!otherSite) { setTimeout(() => this._ensureListPanel(nav), 400); return; }  // 轮询等待
    this._listPanelEnsured = true;
    // 创建面板
    if (!nav.querySelector(".jhs-list-panel")) {
        const listPanel = document.createElement("div");
        listPanel.className = "jhs-list-panel";
        otherSite.insertAdjacentElement("afterend", listPanel);
    }
    self._initListPanel();
    // 事件代理：平铺面板 checkbox change → 同步到 modal 内 checkbox
    listPanel.addEventListener("change", (e) => {
        if (e.target.type !== "checkbox") return;
        const listContainer = modal?.querySelector('[data-list-target="listContainer"]');
        const panels = Array.from(listPanel.querySelectorAll('input[type="checkbox"]'));
        const idx = panels.indexOf(e.target);
        const target = listContainer.querySelectorAll('input[type="checkbox"]')[idx];
        if (target) { target.checked = e.target.checked; target.dispatchEvent(new Event("change", {bubbles:true})); }
    });
}

_initListPanel() {
    if (this._listPanelIniting) return;
    this._listPanelIniting = true;
    // 程序化触发 ajax 加载清单
    btn.click();
    // MutationObserver 监听 listContainer → 克隆到 .jhs-list-panel（跳过「預設清單」）
    const sync = () => {
        Array.from(listContainer.children).forEach((child) => {
            if (child.textContent.includes("預設清單")) return;
            panel.appendChild(child.cloneNode(true));
        });
    };
    new MutationObserver(sync).observe(listContainer, {childList:true, subtree:true, attributes:true, attributeFilter:["checked","disabled"]});
}
```

## 6. 影响范围

- `DetailPageButtonPlugin`：重写 `addQuickActionButtons`，新增 `_buildRatingBar`/`_injectRatingStyles`/`_syncRatingBar`/`_setRatingBusy`/`_ensureListPanel`/`_initListPanel`
- `quickSetHasWatch`/`quickConvertToFav`：操作后调 `_syncRatingBar()`
- CSS：新增 `.jhs-rating-bar`/`.jhs-stars`/`.jhs-star`/`.jhs-rating-actions`/`.jhs-list-panel` 等样式
