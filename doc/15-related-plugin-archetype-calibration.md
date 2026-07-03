# 15. RelatedPlugin 对照 archetype 校准

> **文档类型**：🔧开发指导
> **文档状态**：✅已执行
> **对应原版**：`archetype/jhs.user.js` L10585-10708（RelatedPlugin 完整类，commit `66b2fdf`）
> **关联文档**：`13-remaining-html-components.md`（review/related 组件提取，✅已执行）

## 1. 问题描述

`archetype/jhs.user.js` L10585-10708 在 commit `66b2fdf` 应用完整 `RelatedPlugin`
类后，重构项目 `src/plugins/related-plugin.ts` + `src/components/related-*.ts`
此前按「原版文档要点 + ReviewPlugin 对称模式」构建（当时 archetype 未含
RelatedPlugin 原始代码），需对照 archetype 精确校准文案、DOM ID、条目字段、
HTML 结构/类名/内联 style、折叠头。逐项对比发现 8 处偏差。

## 2. 修复方案

### 2.1 文案（related-header.ts）

- 头部 `<span style="padding: 0 10px;">📁 相关清单</span>` → `相关清单`
  （archetype L10602 无 📁 emoji）。

### 2.2 链接色（related-header.ts / related-error.ts）

- 折叠头 `#relatedFold` 链接色 `#1890ff` → `#1897ff`（archetype L10602）。
- 重试 `#retryFetchRelateds` 链接色 `#1890ff` → `#1897ff`（archetype L10651）。

### 2.3 条目内联 style（related-item.ts，对照 archetype L10702）

- 创建时间 span：`class="time"` → `style="position:absolute;bottom:5px;right:10px;color:#999;font-size:12px;"`。
- 名称链接 `<a>`：补 `style="color:#2e8abb"`。
- 视频个数 `<p>`：补 `style="margin-top: 5px;"`。
- 收藏/查看 `<p>`：补 `style="margin-top: 5px;"`。

### 2.4 默认折叠状态（related-plugin.ts）

- `storageManager.getSetting("enableLoadRelated", YES)` → `NO`
  （archetype L10598 默认 `C`=`NO`，默认折叠、首次展开才拉取；重构原依
  ReviewPlugin 对称取 `YES`，archetype 校正为 `NO`）。
- 保留对称增强：`簽名已過期` 提示 + `clog.error`（与 `review-plugin.ts` 一致；
  archetype 仅有 `console.error`，此为项目对称约定，不回退）。

### 2.5 无需改动（已与 archetype 一致）

- DOM ID：`relatedFold` / `relatedContainer` / `relatedFooter` / `relatedLoading` /
  `retryFetchRelateds` / `loadMoreRelateds` / `relatedEnd` 全部一致。
- 文案：`获取清单中...` / `获取清单失败`+`重试` / `加载更多清单` /
  `已加载全部清单` / `无清单` / `加载中...` / `加载失败, 请点击重试` 一致。
- `related-containers` / `related-empty` / `related-end` / `related-load-more` /
  `related-loading` 模板字符串一致。
- 条目字段：`#序号`(floorIndex++) / `创建时间: {createTime}` /
  `/lists/{relatedId}`+`{name}` / `视频个数: {movieCount}` /
  `收藏次数: {collectionCount} 被查看次数: {viewCount}` 一致。

## 3. 执行验证记录

### 3.1 构建

```
$ pnpm run build   # tsc -b && vite build
✓ 163 modules transformed
dist/monkey-jhs-disassemble.user.js  483.49 kB │ gzip: 118.66 kB
✓ built in 435ms
```

`tsc -b` 类型检查通过，`vite build` 打包通过。

### 3.2 提交

```
$ git --no-pager log --oneline -3
ec41b55 (HEAD -> master) 对照 archetype 校准 RelatedPlugin 文案/字段
66b2fdf 应用 10/11 文档到 archetype
96d8182 同步原版:删除 filterMovieList 的 [g]: new Set() 引用
```

校准提交 `ec41b55`，仅改 4 文件：`src/components/related-header.ts`、
`src/components/related-error.ts`、`src/components/related-item.ts`、
`src/plugins/related-plugin.ts`（+21 / -17）。
