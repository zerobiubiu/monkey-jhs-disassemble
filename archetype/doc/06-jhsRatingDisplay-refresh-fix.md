# jhsRatingDisplay 刷新机制修复

**文档类型**：🔧开发指导  
**文档状态**：✅已执行  
**修改日期**：2026-07-01  
**修改文件**：`jhsRatingDisplay.user.js`

## 1. 问题描述

### 现象
- 详情页改评分后，列表页的评分标签不刷新
- 从"已观看"改为"收藏"后，列表页卡片仍显示"已看"标签（没取消）
- 跨标签页刷新不实时（要等 `visibilitychange` 才刷新）

### 根因

**Bug 1：`_invalidateCards` 找不到卡片**  
原用 `.item[data-code="${code}"]` 属性选择器查找卡片，但未处理过的卡片没有 `data-code` 属性（`data-code` 是 `processItem` → `Utils.getCode` 首次调用时才设置的），导致永远找不到。

**Bug 2：`watchedMap` 不更新**  
`_invalidateCards` 重处理卡片时 `watchedMap` 是 `init` 时的快照不更新。"已观看→收藏"后 `watchedMap` 里还有这个番号，`processItem` 检测到在 `watchedMap` 里，又显示了已看标签。

**Bug 3：`processItem` 不清理旧标签**  
番号不在 `watchedMap` 里时直接 `return`，不移除已显示的标签。

**Bug 4：跨标签页刷新不实时**  
`storage` 事件只标记 `_dirty`，要等 `visibilitychange` 才刷新。

## 2. 修改方案

### 2.1 `_invalidateCards` 改用遍历匹配

```js
_invalidateCards(code, status, op) {
    // 根据 status/op 直接更新 watchedMap 快照
    if (status === "hasWatch" && op === "add") {
        if (!this.watchedMap.has(code)) {
            this.watchedMap.set(code, { carNum: code, status: "hasWatch" });
        }
    } else {
        this.watchedMap.delete(code);
    }
    // 清评分缓存 + 遍历所有卡片用 Utils.getCode 匹配
    delete RatingCache._data[code];
    RatingCache.save();
    document.querySelectorAll(CONFIG.ITEM_SELECTOR).forEach((item) => {
        if (Utils.getCode(item) === code) {
            Renderer.removeFrom(item);
            delete item.dataset.jhsrdLoaded;
            delete item.dataset.jhsrdFromCache;
            item.dataset.jhsrdProcessed = "false";
            this.processItem(item);
        }
    });
}
```

### 2.2 `processItem` 不在 watchedMap 时移除标签

```js
if (!this.watchedMap.has(code)) {
    Renderer.removeFrom(item);  // 先移除旧标签 + 恢复原生 span
    return;
}
```

### 2.3 跨标签页精确刷新

`storage` 事件解析 `newValue` 的 `carNum`+`status`+`op`，直接调 `_invalidateCards` 精确刷新对应卡片（不再只标记 `_dirty` 等 `visibilitychange`）。

### 2.4 广播监听器传 status/op

CustomEvent 和 storage 事件都把 `status`/`op` 传给 `_invalidateCards`。

## 3. 验证记录

| 测试 | 预期 | 结果 |
|------|------|------|
| 已观看→收藏 (favorite+add) | watchedMap 移除 | `before:true → after:false` ✓ |
| 收藏→已观看 (hasWatch+add) | watchedMap 加入 | `after:true` ✓ |
| 已观看→删除 (remove) | watchedMap 移除 | `after:false` ✓ |
| 不在 watchedMap → processItem | 标签移除 + 原生 span 恢复 | `pass:true` ✓ |

## 4. 联动机制

详情页改评分 → `quickSetHasWatch` 调 `broadcastWantWatchedSync({carNum, status, op})` → 三重通道广播（CustomEvent + localStorage + GM_setValue）→ jhsRatingDisplay 收到后：
- 同标签页：CustomEvent → `_invalidateCards(code, status, op)` 精确刷新
- 跨标签页：storage 事件 → 解析 `carNum`+`status`+`op` → `_invalidateCards` 精确刷新

## 5. 代码修改前后对比

### 5.1 `_invalidateCards` 修改前后

**修改前（找不到卡片 + watchedMap 不更新）：**
```js
_invalidateCards(code) {
    document.querySelectorAll(`.item[data-code="${code}"]`).forEach((item) => {
        Renderer.removeFrom(item);
        delete item.dataset.jhsrdLoaded;
        item.dataset.jhsrdProcessed = "false";
        this.processItem(item);
    });
    this._dirty = true;
}
```

**修改后（遍历匹配 + watchedMap 实时更新）：**
```js
_invalidateCards(code, status, op) {
    // 直接用广播信息更新 watchedMap 快照
    if (status === "hasWatch" && op === "add") {
        if (!this.watchedMap.has(code)) {
            this.watchedMap.set(code, { carNum: code, status: "hasWatch" });
        }
    } else {
        this.watchedMap.delete(code);
    }
    // 清评分缓存 + 遍历所有卡片用 Utils.getCode 匹配
    delete RatingCache._data[code];
    RatingCache.save();
    document.querySelectorAll(CONFIG.ITEM_SELECTOR).forEach((item) => {
        if (Utils.getCode(item) === code) {
            Renderer.removeFrom(item);
            delete item.dataset.jhsrdLoaded;
            delete item.dataset.jhsrdFromCache;
            item.dataset.jhsrdProcessed = "false";
            this.processItem(item);
        }
    });
    this._dirty = true;
}
```

### 5.2 `processItem` 修改前后

**修改前（不在 watchedMap 直接 return，不移除旧标签）：**
```js
if (!this.watchedMap.has(code)) return;
```

**修改后（先移除标签再 return）：**
```js
if (!this.watchedMap.has(code)) {
    Renderer.removeFrom(item);  // 移除旧标签 + 恢复原生 span
    return;
}
```

### 5.3 CustomEvent 监听器修改前后

**修改前：**
```js
document.addEventListener("jdb:want-watched-sync", (e) => {
    const { carNum, status, op } = e.detail || {};
    if (!carNum || !status || !op) return;
    const code = Utils.normalizeCode(carNum);
    delete RatingCache._data[code];
    RatingCache.save();
    this._invalidateCards(code);  // ← 没传 status/op
});
```

**修改后：**
```js
document.addEventListener("jdb:want-watched-sync", (e) => {
    const { carNum, status, op } = e.detail || {};
    if (!carNum || !status || !op) return;
    const code = Utils.normalizeCode(carNum);
    this._invalidateCards(code, status, op);  // ← 传了 status/op
});
```

### 5.4 `storage` 事件监听器修改前后

**修改前（只标记 _dirty，等 visibilitychange 才刷新）：**
```js
window.addEventListener("storage", (e) => {
    if (e.key === "jdb:want-watched-sync" && e.newValue) {
        this._dirty = true;  // ← 不实时
    }
});
```

**修改后（解析 payload 精确刷新）：**
```js
window.addEventListener("storage", (e) => {
    if (e.key === "jdb:want-watched-sync" && e.newValue) {
        try {
            const payload = JSON.parse(e.newValue);
            if (payload && payload.carNum && payload.status && payload.op) {
                const code = Utils.normalizeCode(payload.carNum);
                this._invalidateCards(code, payload.status, payload.op);  // ← 精确刷新
            }
        } catch (_) {
            this._dirty = true;  // ← fallback
        }
    }
});
```

## 6. 影响范围

- `jhsRatingDisplay.user.js`：`_invalidateCards` 接收 status/op 更新 watchedMap；`processItem` 不在 watchedMap 时移除标签；广播监听器传 status/op；storage 事件精确刷新
