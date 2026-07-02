# 评分按钮改用 javdb API 直连

**文档类型**：🔧开发指导  
**文档状态**：✅已执行  
**修改日期**：2026-07-01  
**修改文件**：`jhs.user.js`

## 1. 问题描述

### 现象
详情页快捷评分按钮（★0~★5、→已收藏）点击后：
- JHS IndexedDB 正确更新
- 但 javdb 原生评价状态错误——★N 按钮把状态变成"想看"而非"已观看+N星"
- 连续点击时部分操作"提示成功但没实际执行"

### 根因

**Bug 1：DOM form 误提交**  
`_triggerJavdbReview` 通过 DOM 操作（click 删除链接 + `rb.querySelector("form")` 找 form 提交）触发 javdb 评价。但 javdb "看過"走 modal 而非直接 form，`querySelector("form")` 误命中"想看" form，submit 后把状态设成了"想看"。

**Bug 2：innerHTML 替换丢失 UJS 事件**  
`_refreshReviewButtons` 用 `fetch` 重新 GET 页面 HTML + `innerHTML` 替换 `.review-buttons`，破坏了 Rails UJS 事件绑定，导致"修改"modal 按钮点不开。

**Bug 3：3 秒冷却阻断连续操作**  
`quickSetHasWatch`/`quickConvertToFav` 里 `if (this._wantWatchedSyncing) return;` + `setTimeout 3000` 重置。JHS 端 `saveCar` + `show.ok` 在阻断检查**之前**执行，javdb 端被跳过——提示成功但没执行。

## 2. 修改方案

### 2.1 改用 fetch API 直连（替代 DOM form 操作）

新增 `_javdbReviewApi(action, score)` 方法，通过 `fetch` 同源 POST javdb 原生评价 API：

| 操作 | API | body |
|------|-----|------|
| 设为已观看+N | `POST /v/{videoId}/reviews/{reviewId}` + `_method=patch`（编辑）或 `POST /v/{videoId}/reviews`（新建）| `video_review[status]=watched&video_review[score]=N` |
| 设为想看 | 先 `POST /v/{videoId}/reviews/{reviewId}` + `_method=delete`，再 `POST /v/{videoId}/reviews/want_to_watch` | `authenticity_token=...` |

均需 `meta[name=csrf-token]` 的 CSRF token + `X-CSRF-Token` header。

新增辅助方法：`_getCsrfToken()`、`_getVideoId()`、`_getReviewId()`。

### 2.2 _execRailsJs 替代 innerHTML 替换

新增 `_execRailsJs(jsText)` 方法：用 `<script>` 标签注入执行 API 返回的 JS（`text/javascript`），让 javdb 自己更新 DOM + 重绑定 UJS 事件。

每个 fetch 请求成功后执行 `_execRailsJs(await res.text())`，不再单独 fetch 页面 HTML。

### 2.3 Promise 链串行化（替代 3 秒冷却）

`quickSetHasWatch`/`quickConvertToFav` 改为：
```js
this._reviewChain = (this._reviewChain || Promise.resolve())
    .then(async () => {
        this._wantWatchedSyncing = true;
        try {
            await this._triggerJavdbReview(score);
            this._syncRatingBar();
        } finally {
            this._wantWatchedSyncing = false;
        }
    })
    .catch(() => {});
```

- 不跳过任何操作（排队执行）
- 操作期间 `_wantWatchedSyncing=true` 阻断 MutationObserver，完成后立即释放
- `_lastWantState` 在 `_javdbReviewApi` 末尾同步，防止 observer 误触发

## 3. 验证记录

### 3.1 API 直连验证
- `PATCH /v/Ebqv9/reviews/{reviewId}` + `video_review[status]=watched&video_review[score]=3` → HTTP 200，`checkedScore: "3"` ✓
- reviewId 不变（PATCH 铁证，非删除重建）✓

### 3.2 execRailsJs 验证
- API PATCH 后 `_execRailsJs` 执行 Rails JS → DOM 更新 ✓
- 点击"修改"modal 按钮 → `modalActive: true`（UJS 事件重绑定成功）✓
- 对比旧方案 `innerHTML` 替换 → `modalActive: false`（事件丢失）✓

### 3.3 串行化验证
- 连续 PATCH 评分 2→4→1，每步都正确执行：
  - 设为 2 → `actualScore: "2"` ✓
  - 设为 4 → `actualScore: "4"` ✓
  - 设为 1 → `actualScore: "1"` ✓
- 三步全部成功，没有跳过 ✓

## 4. 新增/修改方法签名

| 方法 | 签名 | 用途 |
|------|------|------|
| `_getCsrfToken()` | → `string\|null` | 从 `meta[name=csrf-token]` 获取 CSRF token |
| `_getVideoId()` | → `string\|null` | 从 URL `/v/{videoId}` 提取 videoId |
| `_getReviewId()` | → `string\|null` | 从 `.review-buttons a[data-method=delete][href*=\/reviews\/]` 提取 reviewId |
| `_execRailsJs(jsText)` | `(string) → void` | 用 `<script>` 标签注入执行 Rails 返回的 JS，保留 UJS 事件绑定 |
| `_javdbReviewApi(action, score)` | `('watched'\|'wanted', number) → Promise<void>` | fetch POST javdb 评价 API，成功后 execRailsJs + 同步 _lastWantState |
| `_triggerJavdbReview(score)` | `(number) → Promise<void>` | 简化为 `await this._javdbReviewApi("watched", score)` |
| `_triggerJavdbWant()` | `() → Promise<void>` | 简化为 `await this._javdbReviewApi("wanted")` |

### `_javdbReviewApi` 关键逻辑

```js
async _javdbReviewApi(action, score = 0) {
    const token = this._getCsrfToken();
    const videoId = this._getVideoId();
    const reviewId = this._getReviewId();
    const headers = { "Content-Type": "application/x-www-form-urlencoded", "X-CSRF-Token": token };
    const tokenParam = `authenticity_token=${encodeURIComponent(token)}`;

    if (action === "watched") {
        // 有 reviewId → PATCH 改状态；无 → POST 新建
        const url = reviewId ? `/v/${videoId}/reviews/${reviewId}` : `/v/${videoId}/reviews`;
        const methodParam = reviewId ? "&_method=patch" : "";
        const body = `${tokenParam}${methodParam}&video_review[status]=watched&video_review[score]=${score}&video_review[content]=`;
        const res = await fetch(url, { method: "POST", headers, body, credentials: "same-origin" });
        if (!res.ok) throw new Error(`设为已观看失败: HTTP ${res.status}`);
        this._execRailsJs(await res.text());
    } else if (action === "wanted") {
        // 想看与已评价互斥：已有 review 先删除再建想看
        if (reviewId) {
            const delRes = await fetch(`/v/${videoId}/reviews/${reviewId}`, { method: "POST", headers, body: `${tokenParam}&_method=delete`, credentials: "same-origin" });
            if (!delRes.ok) throw new Error(`删除旧评价失败: HTTP ${delRes.status}`);
            this._execRailsJs(await delRes.text());
        }
        const res = await fetch(`/v/${videoId}/reviews/want_to_watch`, { method: "POST", headers, body: tokenParam, credentials: "same-origin" });
        if (!res.ok) throw new Error(`设为想看失败: HTTP ${res.status}`);
        this._execRailsJs(await res.text());
    }

    // 同步 _lastWantState 防止 MutationObserver 误触发
    const rb = document.querySelector(".review-buttons");
    if (rb && this._wantWatchedObserved) {
        this._lastWantState = this.detectWantWatchedState(rb);
    }
}
```

### `quickSetHasWatch` 修改前后对比

**修改前（3 秒冷却阻断）：**
```js
if (this._wantWatchedSyncing) return;  // ← 3秒内连续点击，这里直接 return
this._wantWatchedSyncing = true;
try {
    await this._triggerJavdbReview(score);
} finally {
    setTimeout(() => { this._wantWatchedSyncing = false; }, 3000);  // ← 3秒后才释放
}
```

**修改后（Promise 链串行化）：**
```js
this._reviewChain = (this._reviewChain || Promise.resolve())
    .then(async () => {
        this._wantWatchedSyncing = true;
        try {
            await this._triggerJavdbReview(score);
            this._syncRatingBar();
        } finally {
            this._wantWatchedSyncing = false;  // ← 完成后立即释放
        }
    })
    .catch(() => {});
```

## 5. 影响范围

- `DetailPageButtonPlugin`：新增 `_getCsrfToken`/`_getVideoId`/`_getReviewId`/`_execRailsJs`/`_javdbReviewApi`，重写 `_triggerJavdbReview`/`_triggerJavdbWant`，修改 `quickSetHasWatch`/`quickConvertToFav`
- `_waitForDomChange`/`_waitForEl` 变为死代码（保留未删）
- 参考实现：`reference/javdb-enhanced-reference.js` 的 `updateReviewStatus` 方法
