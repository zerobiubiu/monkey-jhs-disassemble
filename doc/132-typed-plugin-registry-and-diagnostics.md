# doc/132 — 类型安全插件注册表 + 插件诊断菜单 + 预存类型错误修复

> 文档类型：🔧开发指导
> 文档状态：✅已执行

## 背景

doc/130 审计发现 `BasePlugin.getBean()` 返回 `any` 是类型安全的核心盲区：
66 处 getBean 调用全部丧失类型检查，方法名拼写错误、参数类型不匹配等
问题在编译期完全不可见。同时用户要求追加功能性扩展和结构性重构。

## 方案

### 1. 类型安全插件注册表（结构性重构）

**新建 `src/plugins/plugin-registry.ts`**：

```typescript
export interface PluginMap {
    ActressInfoPlugin: ActressInfoPlugin;
    AutoPagePlugin: AutoPagePlugin;
    // ... 40 个插件名 → 具体类映射
}
```

全部使用 `import type`（零运行时开销，纯类型擦除）。

**PluginManager.getBean 泛型化**：

```typescript
getBean<K extends string>(name: K): K extends keyof PluginMap ? PluginMap[K] : BasePlugin | undefined
```

- 已知插件名（PluginMap 中的 40 个）→ 返回精确类型（非空）
- 未知名称（如 Beyond60Plugin）→ 返回 `BasePlugin | undefined`

**BasePlugin.getBean 同步泛型化**：委托 PluginManager，签名一致。

**时序诊断**：`registrationComplete` 标记在 `processCss()` 开始前置 true，
之后 getBean 未命中时 `console.warn` 输出诊断信息（注册阶段不 warn，
因为插件尚未全部注册）。

### 2. 插件诊断菜单（功能性扩展）

`main.tsx` 启动序列末尾注册 `GM_registerMenuCommand('📊 插件诊断', ...)`：

- 读取 `pluginManager.getDiagnostics()`（注册数 + CSS/handle 结果数组）
- `layer.open` 弹窗展示表格：状态图标（✅/❌/⏭️）+ 插件名 + 执行结果
- 标题显示总数和失败数

**PluginManager 增强**：
- `processCss()` / `processPlugins()` 返回 `Plugin[]`（原 `void`）
- 内部存储 `lastCssResults` / `lastHandleResults`
- 新增 `getDiagnostics()` 公开方法

### 3. 预存类型错误修复

getBean 去 `any` 后暴露 6 个预存类型错误（之前被 `any` 掩盖）：

| 文件 | 错误 | 修复 |
|------|------|------|
| auto-page-plugin.ts L188/200 | Beyond60Plugin 方法不在 BasePlugin 上 | 类型断言为交叉类型（忠实死路径） |
| blacklist-plugin.tsx L694 | 同上 | 同上 |
| detail-page-button-plugin.tsx L234 | `carNum: string \| null` 传给 `string` 参数 | `carNum ?? ''` |
| fc2-by-123av-plugin.ts L41 | `getAv123Url` 不存在于 OtherSitePlugin | 移除死调用，直接用默认域名 |
| preview-video-plugin.tsx L653 | `favoriteOne(event)` 多传参数（签名无参） | 移除多余参数 |

## 实施（修改文件清单）

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/plugins/plugin-registry.ts` | 新建 | PluginMap 40 插件类型映射 |
| `src/plugins/plugin-manager.ts` | 修改 | 泛型 getBean + registrationComplete + getDiagnostics + 返回 Plugin[] |
| `src/plugins/base-plugin.ts` | 修改 | 泛型 getBean 委托 |
| `src/main.tsx` | 修改 | 诊断菜单 + 去冗余 as 断言 |
| `src/plugins/auto-page-plugin.ts` | 修改 | Beyond60 类型断言 |
| `src/plugins/blacklist-plugin.tsx` | 修改 | Beyond60 类型断言 |
| `src/plugins/detail-page-button-plugin.tsx` | 修改 | carNum null 安全 |
| `src/plugins/fc2-by-123av-plugin.ts` | 修改 | 移除死 getAv123Url 调用 |
| `src/plugins/preview-video-plugin.tsx` | 修改 | favoriteOne 去多余参数 |

## 执行验证记录

```
$ bun run build
tsc -b && vite build
✓ 221 modules transformed.
dist/monkey-jhs-disassemble.user.js  1,994.30 kB │ gzip: 460.18 kB
✓ built in 1.57s
```

tsc 零错误。产物 +1.52 kB（注册表类型擦除零开销，增量为诊断菜单 UI 代码）。

## 设计决策

- **`!` vs `?.` 策略**：所有 40 个插件在 main.tsx 中无条件注册，getBean 对
  已知名称返回非空类型。无需 `!` 或 `?.`——条件类型直接解析为非空。
  Beyond60Plugin（从未注册）保持 `if` 守卫 + 类型断言。
- **import type 零运行时**：plugin-registry.ts 全部 `import type`，
  编译后完全擦除，不增加 bundle 体积。
- **诊断菜单用 layer.open**：复用项目已有的弹窗基础设施，无需额外 CSS。
