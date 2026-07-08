# 66. 修复繁→简替换破坏 DOM 选择器导致番号丢失等问题

**文档类型**：🔧开发指导
**文档状态**：✅已执行

## 背景

### 问题描述

用户反馈：访问外部网站时番号丢失，无法跳转。

### 根因

doc/59（commit `bcf046c`）执行了全局繁→简字符替换，将代码中所有
繁体中文改为简体。但 JavDB 服务端返回的 DOM 文本和 API 错误消息
**仍然是繁体**，导致 jQuery 选择器 / `includes()` 匹配 / `replace()`
等字符串操作全部失配。

## 修复清单

### 功能性 bug（DOM 选择器/匹配 — 必须还原为繁体）

| 文件 | 行 | 原繁体 | 被改为简体 | 影响 |
|------|----|--------|-----------|------|
| `base-plugin.ts` | `getPageInfo` | `a[title="複製番號"]` | `a[title="複制番号"]` | **番号丢失**（选择器匹配不到 DOM 元素） |
| `base-plugin.ts` | `getActressPageInfo` | `'無碼'` | `'无码'` | 无码类型检测失效 |
| `actress-info-plugin.tsx` | `handle` | `strong:contains("演員")` | `strong:contains("演员")` | 演员信息插入位置失效 |
| `actress-info-plugin.tsx` | `getAge` | `th:contains('現年齢')` | `th:contains('现年齢')` | 维基年龄提取失效 |
| `list-page-plugin.tsx` | `addBlacklist` | `'(無碼)'` | `'(无码)'` | 演员名无码标签清除失效 |
| `storage-manager.ts` | `UNCENSORED_TAG` | `'(無碼)'` | `'(无码)'` | 收藏演员无码标签匹配失效 |
| `related-plugin.tsx` | `fetchAndDisplay` | `'簽名已過期'` | `'簽名已过期'` | API 签名过期错误检测失效 |
| `review-plugin.tsx` | `fetchAndDisplayReviews` | `'簽名已過期'` | `'簽名已过期'` | 同上 |

### 显示文本还原（生成的 DOM 输出 — 还原为繁体与 JavDB 原版一致）

| 文件 | 还原内容 |
|------|---------|
| `hit-show-movie-item.tsx` | `含中字磁鏈` / `含磁鏈` / `无磁鏈` |
| `nav-search-box.tsx` | `演員` / `番號` / `清單` / `輸入影片番號...` / `進階檢索` |
| `preview-video-container.tsx` | `預告片` |
| `top250-pagination.tsx` | `上一頁` / `下一頁` |
| `top250-tool-bar.tsx` | `含中字磁鏈` |
| `want-watched-hint-span.tsx` | `看過` |
| `fc2-plugin.ts` | `右鍵點擊...` / `個文件` / `複製` |
| `detail-page-button-plugin.tsx` | 注释 `看過` |

## 实施

### 修改文件

| 文件 | 变更 |
|------|------|
| `src/plugins/base-plugin.ts` | `複制番号`→`複製番號`、`无码`→`無碼` |
| `src/plugins/actress-info-plugin.tsx` | `演员`→`演員`、`现年齢`→`現年齢` |
| `src/plugins/list-page-plugin.tsx` | `(无码)`→`(無碼)` |
| `src/plugins/related-plugin.tsx` | `簽名已过期`→`簽名已過期` |
| `src/plugins/review-plugin.tsx` | `簽名已过期`→`簽名已過期` |
| `src/core/storage-manager.ts` | `(无码)`→`(無碼)` |
| `src/components/hit-show-movie-item.tsx` | `磁链`→`磁鏈` |
| `src/components/nav-search-box.tsx` | 多处繁体还原 |
| `src/components/preview-video-container.tsx` | `预告片`→`預告片` |
| `src/components/top250-pagination.tsx` | `上一页/下一页`→`上一頁/下一頁` |
| `src/components/top250-tool-bar.tsx` | `磁链`→`磁鏈` |
| `src/components/want-watched-hint-span.tsx` | `看过`→`看過` |
| `src/plugins/fc2-plugin.ts` | 多处繁体还原 |
| `src/plugins/detail-page-button-plugin.tsx` | 注释繁体还原 |
| `vite.config.ts` | 版本 1.7.4 → 1.7.5 |

## 执行验证记录

### 构建验证

```
$ bun run build
$ tsc -b && vite build
✓ 213 modules transformed.
✓ built in 1.13s
dist/monkey-jhs-disassemble.user.js  1,842.88 kB │ gzip: 421.75 kB
```

### DOM 实测

```
a[title="複製番號"]  → 匹配 1 个元素，data-clipboard-text = "JAC-236" ✅
a[title="複制番号"]  → 匹配 0 个元素（简体，不匹配 DOM） ❌（已改回繁体）
```
