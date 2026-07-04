# 插件类骨架模板（单文件版）

> 用法：复制下方代码块内容到 `src/plugins/<plugin-name>-plugin.tsx`，替换所有 `<占位符>` 为实际值。
>
> 本文件为 markdown 模板，不参与 TypeScript 类型检查（避免占位符 `<pluginName>` 被解析为 JSX）。

```tsx
/**
 * <插件名> 插件 <PluginName>Plugin —— 集成自 archetype/<name>.user.js
 * （原脚本整体 L1-XXX，独立油猴脚本 `<脚本名>` vX.Y）。
 *
 * 功能：<一句话描述>。
 *
 * 集成方式：作为 BasePlugin 子类注册到 PluginManager，仅在 javdb 站点注册
 * （main.tsx 的 `if (isJavdbSite)` 块）。原脚本的 GM_addStyle 改走 initCss()
 * 机制，GM_* API 保留（vite.config grant 已补，globals.d.ts 已声明）。
 *
 * 模块拆分：<说明单文件或子目录；子目录列出各模块职责>
 *
 * 控制流保留要点：
 * 1. <要点 1，如"双写缓存：localStorage 主 + IDB 寄生备份">
 * 2. <要点 2>
 */
import { BasePlugin } from '../base-plugin';
import <pluginName>CssRaw from '../../styles/<plugin-name>.css?raw';
// import { jsxToString } from '../../core/jsx-to-string';  // 需要 TSX 渲染时启用

/**
 * <插件名>插件主类。
 *
 * 原脚本对应行号：L<起>-L<止>。
 */
export class <PluginName>Plugin extends BasePlugin {
    /**
     * 返回插件名，供 PluginManager 注册去重。
     *
     * @returns "<PluginName>Plugin"
     */
    getName(): string {
        return '<PluginName>Plugin';
    }

    /**
     * 注入插件 CSS。由 PluginManager.processCss 在 handle 之前调用。
     * 原脚本用 GM_addStyle，此处走 initCss 机制返回 CSS 字符串。
     *
     * @returns <plugin-name>.css 全文
     */
    async initCss(): Promise<string> {
        return <pluginName>CssRaw;
    }

    /**
     * 主处理逻辑。对应原 L<起>-L<止>。
     *
     * @returns Promise<void>；无显式抛出
     */
    async handle(): Promise<void> {
        // 主逻辑：注册事件监听 / 初始化 DOM / 启动主流程
        // 原脚本 IIFE 顶层的代码迁到此处
    }
}
```
