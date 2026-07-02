# 删除 settingSiteBtn 设置按钮

**文档类型**：🔧开发指导  
**文档状态**：✅已执行  
**修改日期**：2026-07-01  
**修改文件**：`jhs.user.js`

## 1. 问题描述

`OtherSitePlugin` 精简为只保留 MissAv + SupJav 两个站点后，`#settingSiteBtn`（设置按钮）和 `#settingsArea`（站点勾选区域）不再需要——只有两个站点没什么好设置的。

## 2. 修改方案

### 2.1 删除模板里的设置按钮和设置区域

`OtherSitePlugin.loadOtherSite` 的模板字符串里删除：
- `<a id="settingSiteBtn" class="site-btn"><span>设置</span></a>` 按钮
- `<div id="settingsArea" class="panel-block" ...>...</div>` 整块区域

### 2.2 删除点击监听

`OtherSitePlugin.setupEventListeners` 里删除 `settingSiteBtn` 的点击监听（展开/折叠 `#settingsArea` 的逻辑）。

### 2.3 死代码保护

`renderSettingsArea` 和 `setupEventListeners` 变为死代码（操作的 DOM 元素已不存在）：
- `renderSettingsArea`：`document.getElementById("siteCheckboxes")` 返回 null，`if (t)` 跳过，不报错
- `setupEventListeners`：`document.getElementById("settingsArea")` 返回 null，`e?.addEventListener` 可选链跳过，不报错

## 3. 代码修改前后对比

### 3.1 `loadOtherSite` 模板修改前后

**修改前（含 settingSiteBtn + settingsArea）：**
```html
<div id="otherSiteBox" class="panel-block" ...>
    <div style="display: flex;gap: 5px;flex-wrap: wrap">
        ${siteConfigs.map(...).join("")}
        <a id="settingSiteBtn" class="site-btn"><span>设置</span></a>  ← 删除
    </div>
</div>

<div id="settingsArea" class="panel-block" style="display: none; ...">  ← 整块删除
    <div id="siteCheckboxes" style="display: flex;gap: 5px;flex-wrap: wrap">
    </div>
</div>
```

**修改后（只保留站点按钮）：**
```html
<div id="otherSiteBox" class="panel-block" ...>
    <div style="display: flex;gap: 5px;flex-wrap: wrap">
        ${siteConfigs.map(...).join("")}
    </div>
</div>
```

### 3.2 `setupEventListeners` 修改前后

**修改前（含 settingSiteBtn 点击监听）：**
```js
setupEventListeners() {
    const e = document.getElementById("settingsArea");
    document.addEventListener("click", (t) => {
        if (t.target.id === "settingSiteBtn" || t.target.closest("#settingSiteBtn")) {  ← 删除
            const t = e.style.display === "none" || e.style.display === "";
            e.style.display = t ? "block" : "none";
        }
    });
    e.addEventListener("change", (t) => {  ← 改为 e?.addEventListener
        ...
    });
}
```

**修改后（删除点击监听 + 可选链保护）：**
```js
setupEventListeners() {
    const e = document.getElementById("settingsArea");  // ← 返回 null（DOM 已删）
    e?.addEventListener("change", (t) => {  // ← 可选链，e 为 null 时跳过
        ...
    });
}
```

### 3.3 死代码保护机制

`renderSettingsArea()` 和 `setupEventListeners()` 变为死代码（操作的 DOM 已不存在）：
- `renderSettingsArea`：`document.getElementById("siteCheckboxes")` 返回 null → `if (t)` 跳过 → 不报错
- `setupEventListeners`：`document.getElementById("settingsArea")` 返回 null → `e?.addEventListener` 可选链跳过 → 不报错

这两个方法仍在 `loadOtherSite` 末尾被调用（`this.renderSettingsArea(); this.setupEventListeners();`），但静默失败，不影响功能。

## 4. 验证

- `grep settingSiteBtn` → 0 匹配 ✓
- `#otherSiteBox` 里只剩 MissAv 和 SupJav 两个站点按钮 ✓
- 无语法错误 ✓

## 5. 影响范围

- `OtherSitePlugin.loadOtherSite`：模板删除设置按钮和设置区域
- `OtherSitePlugin.setupEventListeners`：删除点击监听
