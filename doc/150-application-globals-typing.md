# doc/150 — 应用全局类型化 + 69 处隐藏类型错误修复

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

globals.d.ts 中 6 个应用运行时全局声明为 `any`，导致所有 40 个插件
通过 `utils.*`、`storageManager.*`、`gmHttp.*`、`show.*`、`clog.*`、
`pluginManager.*` 调用时无类型检查，数百处类型不匹配被掩盖。

## 方案

### 1. 应用全局类型化（globals.d.ts）

```typescript
// 之前
declare const show: any;
declare const utils: any;
declare const storageManager: any;
declare const clog: any;
declare const gmHttp: any;
declare const pluginManager: any;

// 之后
declare const show: typeof import('../core/toast').show;
declare const utils: import('../core/common-util').CommonUtil;
declare const storageManager: import('../core/storage-manager').StorageManager;
declare const clog: import('../core/logger').Logger;
declare const gmHttp: import('../core/gm-http').GmHttp;
declare const pluginManager: import('../plugins/plugin-manager').PluginManager;
```

使用 ambient `.d.ts` 内联 `import()` 类型语法（ts-import-type 规则的
ambient 例外条款）。

### 2. 隐藏类型错误修复（69 处，12 个文件）

类型化暴露了被 `any` 掩盖的类型不匹配：

| 文件 | 错误数 | 修复模式 |
|------|--------|----------|
| detail-page-button-plugin.tsx | 35 | `carNum!` 非空断言 + `?? undefined` |
| api.ts | 5 | `null`→`undefined` + `RequestHeaders` 索引签名 |
| auto-page-plugin.ts | 3 | `Number(pageNum)` 转换 |
| blacklist-plugin.tsx | 4 | `as unknown as MouseEvent` + `?? undefined` + `Number()` |
| new-video-plugin.tsx | 3 | `as FavoriteActressRecord[]` + `null`→`undefined` |
| list-page-plugin.tsx | 5 | `?? ''` + `Number()` |
| list-page-button-plugin.tsx | 2 | `carInfo.url!` |
| history-plugin.tsx | 2 | `null`→`undefined` + `Number()` |
| favorite-actresses-plugin.tsx | 2 | `as FavoriteActress[]` |
| gm-http.ts | 2 | `!` 非空断言 + 删除未使用变量 |
| storage-manager.ts | 2 | `?? []` 空值合并 |
| 其他 6 个文件 | 各 1 处 | `null`→`undefined` / `show.success`→`show.ok` / `as string` |

### 3. RequestHeaders 索引签名

```typescript
interface RequestHeaders {
    'user-agent': string;
    'accept-language': string;
    host: string;
    authorization: string;
    jdsignature: string;
    [key: string]: string;  // 新增：兼容 Record<string, string>
}
```

## 实施（修改文件清单）

| 文件 | 操作 |
|------|------|
| `src/types/globals.d.ts` | 修改：6 个全局 any→精确类型 |
| `src/constants/api.ts` | 修改：null→undefined + 索引签名 |
| `src/core/gm-http.ts` | 修改：非空断言 + 删除未使用变量 |
| `src/core/storage-manager.ts` | 修改：?? [] 空值合并 |
| `src/core/gfriends.ts` | 修改：as string |
| `src/plugins/detail-page-button-plugin.tsx` | 修改：35 处非空断言 + ?? undefined |
| `src/plugins/auto-page-plugin.ts` | 修改：Number() 转换 |
| `src/plugins/blacklist-plugin.tsx` | 修改：类型断言 + ?? undefined |
| `src/plugins/new-video-plugin.tsx` | 修改：类型断言 + null→undefined |
| `src/plugins/other-site-plugin.tsx` | 修改：null→undefined |
| `src/plugins/fc2-plugin.ts` | 修改：null→undefined |
| `src/plugins/fc2-by-123av-plugin.ts` | 修改：null→undefined |
| `src/plugins/history-plugin.tsx` | 修改：null→undefined + Number() |
| `src/plugins/list-page-plugin.tsx` | 修改：?? '' + Number() |
| `src/plugins/list-page-button-plugin.tsx` | 修改：非空断言 |
| `src/plugins/favorite-actresses-plugin.tsx` | 修改：类型断言 |
| `src/plugins/want-and-watched-videos-plugin.tsx` | 修改：null→undefined + show.ok |
| `src/plugins/top250-plugin.tsx` | 修改：null→undefined |
| `src/plugins/setting-plugin.tsx` | 修改：getNowStr 参数修复 |
| `src/plugins/preview-video-plugin.tsx` | 修改：null→undefined |

## 执行验证记录

```
$ bun run build
tsc -b && vite build
✓ 229 modules transformed.
dist/monkey-jhs-disassemble.user.js  2,022.87 kB │ gzip: 466.92 kB
✓ built in 1.19s

$ bun run lint
✖ 805 problems (0 errors, 805 warnings)
```

tsc 零错误。ESLint 0 errors / 805 warnings（全部为 `no-explicit-any`，
来自 jQuery/layer/DOM 回调的 `any`，需第三方库类型声明才能消除）。
