# 子目录拆分模板

复杂脚本（≥ 200 行或多职责）按此模板拆分。参考样本：`src/plugins/rating-display/`。

## 文件树

```
src/plugins/<plugin-name>/
├── <plugin-name>-config.ts        # CONFIG 常量
├── <plugin-name>-utils.ts         # Utils 工具
├── <plugin-name>-cache.ts         # 缓存（IDB/localStorage）
├── <plugin-name>-net.ts           # 网络请求（限流 + 解析 + fetch）
├── <plugin-name>-renderer.tsx     # DOM 操作（jsxToString 生成 innerHTML）
└── <plugin-name>-plugin.tsx       # Core 主流程 + 插件入口（extends BasePlugin）

src/styles/<plugin-name>.css       # 样式（?raw import via initCss）
```

## 各模块职责

### <plugin-name>-config.ts
```typescript
/** <插件名> 配置常量。对应原脚本 CONFIG 段 L<起>-L<止>。 */

/** <插件名> 配置接口 */
export interface <PluginName>Config {
    /** 调试模式（控制日志输出） */
    DEBUG_MODE: boolean;
    /** IDB 库名 / 仓库名 / 键名 */
    idbName: string;
    idbStore: string;
    idbKey: string;
    /** 选择器 */
    selectors: {
        item: string;
        cover: string;
    };
    /** 请求控制 */
    maxConcurrent: number;
    debounceMs: number;
}

/** <插件名> 运行时配置 */
export const <PLUGIN_NAME>_CONFIG: <PluginName>Config = {
    DEBUG_MODE: false,
    // ...
};
```

### <plugin-name>-utils.ts
```typescript
/** <插件名> 工具函数。对应原脚本 Utils 段 L<起>-L<止>。 */

export class <PluginName>Utils {
    /** 日志（DEBUG_MODE 控制是否输出） */
    static log(msg: string, ...args: any[]): void { /* ... */ }
    /** 防抖 */
    static debounce(fn: (...args: any[]) => void, ms: number): () => void { /* ... */ }
    /** 并发限流器 */
    static createLimiter(max: number) { /* ... */ }
    /** 其他辅助：getSafeUrl / normalizeCode / getCode / getAnchor 等 */
}
```

### <plugin-name>-cache.ts
```typescript
/** <插件名> 缓存（IDB + localStorage）。对应原脚本 JhsDB + RatingCache 段。 */

/** 打开寄生 IDB（storageManager.forage 无法访问时用） */
export function openIdb(): Promise<IDBDatabase> { /* ... */ }

/** 构建已看集合（复用 storageManager 或原生 IDB） */
export async function buildWatchedMap(): Promise<Map<string, any>> { /* ... */ }

/** 缓存读写 */
export class <PluginName>Cache {
    async load(): Promise<Record<string, any>> { /* localStorage 优先 → IDB 兜底 */ }
    async save(data: Record<string, any>): Promise<void> { /* 双写：localStorage + IDB */ }
    async get(key: string): Promise<any> { /* ... */ }
    async set(key: string, val: any): Promise<void> { /* ... */ }
    async clear(): Promise<void> { /* ... */ }
    async size(): Promise<number> { /* ... */ }
}
```

### <plugin-name>-net.ts
```typescript
/** <插件名> 网络请求（限流 + 解析 + fetch）。对应原脚本 Net 段。 */
import { <PluginName>Utils } from './<plugin-name>-utils';

const limiter = <PluginName>Utils.createLimiter(<PLUGIN_NAME>_CONFIG.maxConcurrent);

/** 原始请求（直接用全局 GM_xmlhttpRequest，不复用 gmRequest） */
export function request(url: string): Promise<string> { /* ... */ }

/** 解析响应 HTML */
export function parseRating(html: string): number | null { /* ... */ }

/** 抓取单个番号的评分 */
export async function fetchRating(carNum: string): Promise<number | null> { /* ... */ }
```

### <plugin-name>-renderer.tsx
```typescript
/** <插件名> DOM 渲染（jsxToString 生成 innerHTML）。对应原脚本 Renderer 段。 */
import { jsxToString } from '../../core/jsx-to-string';

/** 评分标签组件 */
function RatingTag({ score }: { score: number }) {
    return <span className="jhs-rating">{'★'.repeat(score)}</span>;
}

export class <PluginName>Renderer {
    static showRating(el: HTMLElement, score: number): void {
        el.innerHTML = jsxToString(<RatingTag score={score} />);
    }
    static showPlaceholder(el: HTMLElement): void { /* ... */ }
    static removeFrom(el: HTMLElement): void { /* ... */ }
}
```

### <plugin-name>-plugin.tsx
```typescript
/** <插件名> 插件主类（Core 主流程 + 插件入口）。对应原脚本 Core 段。 */
import { BasePlugin } from '../base-plugin';
import { <PluginName>Renderer } from './<plugin-name>-renderer';
import { <PluginName>Cache } from './<plugin-name>-cache';
import { fetchRating } from './<plugin-name>-net';
import <pluginName>CssRaw from '../../styles/<plugin-name>.css?raw';
import { <PLUGIN_NAME>_CONFIG } from './<plugin-name>-config';

export class <PluginName>Plugin extends BasePlugin {
    getName(): string { return '<PluginName>Plugin'; }
    async initCss(): Promise<string> { return <pluginName>CssRaw; }
    async handle(): Promise<void> { /* 启动主流程 */ }
    // Core 主流程方法：processItem / refreshAll / clearCache / loadAll 等
}
```

## 依赖方向（无循环）

```
<plugin-name>-plugin ──→ <plugin-name>-net ──→ <plugin-name>-renderer ──→ <plugin-name>-utils ──→ <plugin-name>-config
        │                   └──→ <plugin-name>-cache ──────────────┘
        ├──→ <plugin-name>-cache
        ├──→ <plugin-name>-renderer
        └──→ <plugin-name>-utils
```

## 拆分原则

1. **职责单一**：每模块只做一件事（config 存常量、utils 存纯函数、cache 存读写、net 存请求、renderer 存 DOM、plugin 存流程）
2. **无循环依赖**：依赖方向单向，config 是最底层
3. **复用优先**：能复用 storageManager/gmHttp/utils 的就复用，不重复造轮子
4. **零偏差**：拆分后控制流必须与原脚本一致，仅是物理位置变化
5. **TSX 仅在 renderer**：只有 renderer.tsx 用 jsxToString，其他模块用 .ts
