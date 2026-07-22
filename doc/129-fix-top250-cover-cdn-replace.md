# doc/129 — 修复 Top250/热播榜单封面图加载失败

> 文档类型：bug 修复
> 文档状态：✅ 已执行

## 背景

用户反馈 `https://javdb.com/advanced_search?handleTop=1&period=daily`（Top250 榜单页）
封面图片加载失败。

排查发现：`HitShowMovieItem` 组件（`src/components/hit-show-movie-item.tsx`）中封面
`cover_url` 的 CDN 域名替换使用了**硬编码字面量**：

```ts
movie.cover_url.replace('https://tp-iu.cmastd.com/rhe951l4q', 'https://c0.jdbstatic.com')
```

而 `src/constants/api.ts` 中的 `_updateImgServer` 已使用**域名无关正则**：

```ts
str.replace(/https:\/\/.*?\/rhe951l4q/g, 'https://c0.jdbstatic.com')
```

新版参考脚本 `archetype/jhs.3.3.6.027.user.js:661` 同样使用正则形式。
当 API 返回的 `cover_url` 域名从 `tp-iu.cmastd.com` 轮换为其他 host（路径仍含
`/rhe951l4q`）时，字面量 replace 不匹配、不替换，`<img src>` 指向已失效的旧域名，
导致封面图加载失败。

Top250 榜单（`handleTop=1`）和热播榜单（`handlePlayback=1`）均通过
`HitShowPlugin.markDataListHtml` → `HitShowMovieItem` 渲染封面，因此两个榜单
均受影响。

## 方案

将 `HitShowMovieItem` 中的硬编码字面量替换改为调用 `_updateImgServer`（从
`../constants/api` 导入），与 `api.ts` 内 `markDataListHtml` 及新版参考脚本
行为一致，兼容 CDN 域名轮换。

## 实施

|文件|变更|
|---|---|
|`src/components/hit-show-movie-item.tsx`|导入 `_updateImgServer`；`src` 属性改为 `_updateImgServer(movie.cover_url \|\| '')`；更新文件头注释|
|`vite.config.ts`|version `1.20.0` → `1.20.1`（patch：bug 修复）|

## 执行验证

```
$ bun run build
tsc -b && vite build
✓ 220 modules transformed.
dist/monkey-jhs-disassemble.user.js  1,993.49 kB │ gzip: 459.50 kB
✓ built in 1.25s
```

tsc 零错误，vite build 成功（lightningcss IE hack 警告为既有 errorRecovery 容错，
非本次引入）。

## 后续验证建议

1. 安装构建产物，访问 `https://javdb.com/advanced_search?handleTop=1&period=daily`，
   确认 Top250 榜单封面图正常加载。
2. 访问 `https://javdb.com/advanced_search?handlePlayback=1&period=daily`，
   确认热播榜单封面图正常加载。
3. 打开 DevTools Network 面板，确认封面图请求域名为 `c0.jdbstatic.com`。
