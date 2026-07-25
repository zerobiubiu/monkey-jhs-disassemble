# doc/197 — 修复 gmRequest 重定向检测误判（finalUrl 可选 + reject 缺 return）

> **文档类型**：🔧 开发指导
> **文档状态**：✅ 已执行

## 1. 背景

`src/core/gm-http.ts` 的 `gmRequest` 方法在 `onload` 回调中做重定向检测，
原实现（约 L320-323）存在两个缺陷：

```ts
try {
    if (followRedirect && response.finalUrl !== requestUrl) {
        reject('请求被重定向了,URL是:' + response.finalUrl);
    }
    if (response.status >= 200 && response.status < 300) {
        // ...
```

### 缺陷 1：`finalUrl` 为可选字段，缺失时恒判为重定向

`GmResponse.finalUrl` 声明为可选（`finalUrl?: string`，见 L27）。某些
Tampermonkey 版本 / 浏览器组合在 `GM_xmlhttpRequest` 响应中**不提供** `finalUrl`，
此时 `response.finalUrl` 为 `undefined`。

原条件 `response.finalUrl !== requestUrl` 在 `finalUrl` 为 `undefined` 时
退化为 `undefined !== requestUrl`，**恒为 `true`**。后果：所有携带
`followRedirect: true` 的请求（如 `get(url, ..., followRedirect=true)`）
即便未发生任何重定向，也会被 `reject('请求被重定向了...')` 拒绝，功能全面失效。

### 缺陷 2：`reject()` 后缺 `return`，执行流继续下落

`reject(...)` 之后没有 `return`，执行流会**继续进入**紧随其后的状态码判断分支
（`if (response.status >= 200 && response.status < 300)`）。虽然 Promise 一旦
settle 后续 `resolve`/`reject` 不再生效、最终结果不受影响，但逻辑上不干净：
重定向分支与成功/失败分支被无意义地串联执行，增加阅读与维护负担。

## 2. 修改方案

仅改动 `onload` 回调中的重定向检测块，不动其他逻辑：

1. 在重定向条件中增加 `response.finalUrl` **存在性检查**——`finalUrl` 缺失时
   跳过检测，避免将正常请求误判为重定向。
2. `reject()` 后补 `return`，阻止执行流继续进入状态码判断分支。

```diff
                             try {
-                                if (followRedirect && response.finalUrl !== requestUrl) {
+                                // finalUrl 为可选字段，部分 Tampermonkey 版本可能不返回；
+                                // 缺失时跳过重定向检测，避免将正常请求误判为重定向而拒绝
+                                if (followRedirect && response.finalUrl && response.finalUrl !== requestUrl) {
                                     reject('请求被重定向了,URL是:' + response.finalUrl);
+                                    // reject 后立即 return，防止执行流继续进入状态码判断分支
+                                    return;
                                 }
                                 if (response.status >= 200 && response.status < 300) {
```

### 行为变化说明

- **`finalUrl` 存在且偏离原 URL** → 仍按重定向拒绝（行为不变）。
- **`finalUrl` 存在且等于原 URL** → 不拒绝，进入状态码判断（行为不变）。
- **`finalUrl` 缺失（undefined）** → 旧版误判为重定向而拒绝；新版**跳过检测**，
  进入状态码判断（修复点）。这是有意的宽松化：宁可漏检重定向，也不因字段缺失
  而拒绝正常请求。

## 3. 修改文件清单（2 个）

- `src/core/gm-http.ts` — `gmRequest` 的 `onload` 重定向检测块（增加 `finalUrl`
  存在性检查 + `reject` 后补 `return` + 中文注释）
- `vite.config.ts` — `userscript.version` 递增 patch 位 `1.30.1` → `1.30.2`
  （依 AGENTS.md §6.1.1，bug 修复递增 patch）

## 4. 执行验证记录

执行 `bun run build`（= `tsc -b && vite build`）：

```
$ tsc -b && vite build
vite v8.1.3 building client environment for production...
✓ 380 modules transformed.
dist/monkey-jhs-disassemble.user.js  2,073.25 kB │ gzip: 479.35 kB
✓ built in 1.52s
```

- `tsc -b` 通过：无类型错误（`finalUrl` 存在性收窄与 `return` 均类型安全）。
- `vite build` 成功：产物正常生成。
- 输出中的 `[lightningcss minify] Unexpected token Semicolon` 为 layer.css 的
  IE hack（`*display` / `*zoom` 等），由 `css.lightningcss.errorRecovery: true`
  容错，属已知非致命警告（AGENTS.md §6.1），与本次改动无关。

## 5. 后续验证建议

- 在**不返回 `finalUrl`** 的 Tampermonkey 版本上，调用任意 `followRedirect: true`
  的 GET 请求（如依赖重定向检测的第三方站点探测），确认不再被误判为重定向拒绝。
- 在**返回 `finalUrl`** 的环境中，构造真实重定向（`finalUrl !== requestUrl`），
  确认仍正确 `reject('请求被重定向了...')`，重定向防护未失效。
- 确认 `finalUrl === requestUrl` 的正常请求照常返回解析后的响应体。
