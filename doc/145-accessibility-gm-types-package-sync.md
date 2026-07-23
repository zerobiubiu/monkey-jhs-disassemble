# doc/145 — 无障碍基础样式 + GM API 类型化 + 元数据同步

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

批次 5（UI/UX V2）和批次 6（体积/类型/工具链）的基础项目。
本轮实施零运行时风险的基础设施改进。

## 方案

### 1. 无障碍基础样式（src/styles/accessibility.css）

```css
/* 键盘导航焦点环 */
:focus-visible { outline: 2px solid #5d87c2; outline-offset: 2px; }

/* 减少动态效果 */
@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
    }
}
```

在 main.tsx 中通过 `injectCss(accessibilityCssRaw)` 全局注入。

### 2. GM API 类型化（src/types/globals.d.ts）

6 个 Tampermonkey Grant API 从 `declare const X: any` 升级为精确类型：

| API | 类型 |
|-----|------|
| `GM_xmlhttpRequest` | `(details: GMXmlHttpRequestDetails) => { abort: () => void }` |
| `GM_openInTab` | `(url, options?) => { close: () => void }` |
| `GM_setValue` | `(key: string, value: string \| number \| boolean \| object) => void` |
| `GM_getValue` | `<T>(key: string, defaultValue?: T) => T` |
| `GM_addValueChangeListener` | `(key, callback) => number` |
| `GM_registerMenuCommand` | `(name, callback, accessKey?) => number` |

新增 `GMXmlHttpRequestDetails` 接口（method/url/headers/data/timeout/
responseType/anonymous/fetch/nocache + 6 个回调）。

### 3. StorageRevision 跨会话修复

修订号每会话从 0 开始（不持久化），长运行标签页的修订号可能远大于
新标签页。修复为：任何远程消息都触发缓存失效（senderId 已排除自身），
修订号仅作元数据（取 max 保持本地递增）。

### 4. package.json 同步

- `version`: `1.0.0` → `1.27.0`（与 vite.config.ts 一致）
- `description`: 更新为 JavDB Power Tools 品牌名

### 5. 调用点修复

GM API 类型化后暴露 4 个调用点类型不匹配：
- `common-util.ts` L187 / `top250-plugin.tsx` L280：`insert: 0` → `insert: false`
- `backup-extra-storage.ts` L139：`GM_setValue` 值类型断言
- `globals.d.ts`：`data` 类型扩展为 `Record<string, unknown>`

## 实施（修改文件清单）

| 文件 | 操作 |
|------|------|
| `src/styles/accessibility.css` | 新建 |
| `src/main.tsx` | 修改：import + injectCss |
| `src/types/globals.d.ts` | 修改：GM API 类型化 |
| `src/core/common-util.ts` | 修改：insert: false |
| `src/plugins/top250-plugin.tsx` | 修改：insert: false |
| `src/core/backup-extra-storage.ts` | 修改：GM_setValue 类型断言 |
| `src/core/storage-revision.ts` | 修改：跨会话修复 |
| `package.json` | 修改：version + description |

## 执行验证记录

```
$ bun run build
tsc -b && vite build
✓ 227 modules transformed.
dist/monkey-jhs-disassemble.user.js  2,018.33 kB │ gzip: 466.02 kB
✓ built in 1.22s
```

tsc 零错误。产物 +0.87 kB（accessibility.css + 类型声明零运行时开销）。
