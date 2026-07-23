/**
 * 插件管理器 PluginManager —— 对应原脚本 archetype/jhs.user.js L2942-3028。
 *
 * 负责插件注册（register）、CSS 注入（processCss）与执行调度（processPlugins），
 * 统一收集结构化结果，捕获并汇报失败项。
 *
 * 单字母局部变量（原 e/t/n）已语义化重命名。
 * 原始 register 中错误信息引用了未定义的 `name`（实为笔误，应为插件名变量），
 * 此处修正为实际插件名，控制流（重复即抛错）不变。
 */
import { pageContext } from '../core/page-context';

import type { BasePlugin } from './base-plugin';
import type { PluginMap } from './plugin-registry';

/** 插件处理结果记录（processCss / processPlugins 内部返回结构） */
export interface Plugin {
    name: string;
    status: 'fulfilled' | 'rejected' | 'skipped';
    error?: unknown;
    /** 执行耗时（毫秒）：processCss 记录 initCss()，processPlugins 记录 handle()。 */
    durationMs?: number;
}

/** 单插件聚合诊断条目（getDiagnostics().plugins 元素，供诊断面板/报告消费）。 */
export interface PluginDiagnostic {
    /** 插件名（getName()）。 */
    name: string;
    /** initCss 阶段状态。 */
    cssStatus: 'fulfilled' | 'rejected' | 'skipped';
    /** handle 阶段状态。 */
    handleStatus: 'fulfilled' | 'rejected' | 'skipped';
    /** initCss 耗时（毫秒），未执行/跳过为 null。 */
    cssDurationMs: number | null;
    /** handle 耗时（毫秒），未执行/跳过为 null。 */
    handleDurationMs: number | null;
    /** 两阶段耗时之和，均缺失为 null。 */
    totalDurationMs: number | null;
    /** initCss 失败原因（err.message），成功/跳过为 null。 */
    cssError: string | null;
    /** handle 失败原因（err.message），成功/跳过为 null。 */
    handleError: string | null;
    /** 插件声明的适用页面类型（plugin.pageTypes）。 */
    pageTypes: string[];
    /** 插件声明的适用站点（plugin.sites）。 */
    sites: string[];
    /** 是否受 feature flag 门控注册（main.tsx 条件注册）。 */
    isFeatureFlagged: boolean;
    /** 门控开关名（featureFlags 键），未门控为 null。 */
    featureFlagName: string | null;
}

export class PluginManager {
    private plugins: Map<string, BasePlugin> = new Map();
    /** 注册完成标记：register 阶段为 false，processCss 开始前置 true。 */
    private registrationComplete = false;
    /** 最近一次 processCss / processPlugins 的结果，供诊断菜单读取。 */
    private lastCssResults: Plugin[] = [];
    private lastHandleResults: Plugin[] = [];
    /** 插件名 → 门控开关名（register 第二参记录，main.tsx 条件注册传入）。 */
    private featureFlags: Map<string, string> = new Map();

    /** 检查插件是否匹配当前页面类型（空 pageTypes = 匹配所有）。 */
    private matchesPage(plugin: BasePlugin): boolean {
        const types = plugin.pageTypes;
        if (!types || types.length === 0) return true;
        return types.includes(pageContext.pageType);
    }

    /** 注册插件类：实例化、注入 pluginManager、按 getName() 去重。对应原 L2946-2957。 */
    register(pluginClass: new () => BasePlugin, featureFlag?: string): void {
        if (typeof pluginClass !== 'function') {
            throw new Error('插件必须是一个类');
        }
        const instance = new pluginClass();
        instance.pluginManager = this;
        const pluginName = instance.getName();
        if (this.plugins.has(pluginName)) {
            throw new Error(`插件"${pluginName}"已注册`);
        }
        if (featureFlag) {
            this.featureFlags.set(pluginName, featureFlag);
        }
        this.plugins.set(pluginName, instance);
    }

    /** 按名称获取插件实例（类型安全：已知名称返回精确类型）。对应原 L2958-2960。 */
    getBean<K extends string>(name: K): K extends keyof PluginMap ? PluginMap[K] : BasePlugin | undefined {
        const plugin = this.plugins.get(name);
        if (!plugin && this.registrationComplete) {
            clog.warn(`[PluginManager] getBean("${name}") 未找到已注册插件`);
        }
        return plugin as K extends keyof PluginMap ? PluginMap[K] : BasePlugin | undefined;
    }

    /** 并发执行所有插件 initCss，注入样式并汇报失败项。对应原 L2961-2997。 */
    async processCss(): Promise<Plugin[]> {
        this.registrationComplete = true;
        const results = await Promise.all(
            Array.from(this.plugins).map(async ([name, plugin]): Promise<Plugin> => {
                if (!this.matchesPage(plugin)) {
                    return { name, status: 'skipped' as const };
                }
                const start = performance.now();
                try {
                    if (typeof plugin.initCss === 'function') {
                        const css = await plugin.initCss();
                        if (css) {
                            utils.insertStyle(css);
                        }
                        return { name, status: 'fulfilled', durationMs: Math.round(performance.now() - start) };
                    }
                    return { name, status: 'skipped' };
                } catch (err) {
                    clog.error(`插件 ${name} 加载 CSS 失败`, err);
                    return { name, status: 'rejected', error: err, durationMs: Math.round(performance.now() - start) };
                }
            })
        );
        this.lastCssResults = results;
        const failed = results.filter((result) => result.status === 'rejected');
        if (failed.length) {
            clog.error(
                '以下插件的 CSS 加载失败：',
                failed.map((result) => result.name)
            );
        }
        return results;
    }

    /** 并发执行所有插件 handle，汇报失败项。对应原 L2998-3027。 */
    async processPlugins(): Promise<Plugin[]> {
        const results = await Promise.all(
            Array.from(this.plugins).map(async ([name, plugin]): Promise<Plugin> => {
                if (!this.matchesPage(plugin)) {
                    return { name, status: 'skipped' as const };
                }
                const start = performance.now();
                try {
                    if (typeof plugin.handle === 'function') {
                        await plugin.handle();
                        return { name, status: 'fulfilled', durationMs: Math.round(performance.now() - start) };
                    }
                    return { name, status: 'skipped' };
                } catch (err) {
                    clog.error(`插件 ${name} 执行失败`, err);
                    return { name, status: 'rejected', error: err, durationMs: Math.round(performance.now() - start) };
                }
            })
        );
        this.lastHandleResults = results;
        const failed = results.filter((result) => result.status === 'rejected');
        if (failed.length) {
            clog.error(
                '以下插件执行失败：',
                failed.map((result) => result.name)
            );
        }
        return results;
    }

    /** 获取插件诊断信息（注册数 + CSS/handle 原始结果 + 逐插件聚合条目）。 */
    getDiagnostics(): { total: number; css: Plugin[]; handle: Plugin[]; plugins: PluginDiagnostic[] } {
        const cssByName = new Map(this.lastCssResults.map((result) => [result.name, result]));
        const handleByName = new Map(this.lastHandleResults.map((result) => [result.name, result]));
        const plugins: PluginDiagnostic[] = Array.from(this.plugins).map(([name, plugin]) => {
            const css = cssByName.get(name);
            const handle = handleByName.get(name);
            const cssDurationMs = css?.durationMs ?? null;
            const handleDurationMs = handle?.durationMs ?? null;
            const featureFlagName = this.featureFlags.get(name) ?? null;
            return {
                name,
                cssStatus: css?.status ?? 'skipped',
                handleStatus: handle?.status ?? 'skipped',
                cssDurationMs,
                handleDurationMs,
                totalDurationMs:
                    cssDurationMs == null && handleDurationMs == null
                        ? null
                        : (cssDurationMs ?? 0) + (handleDurationMs ?? 0),
                cssError: css?.status === 'rejected' ? (css.error instanceof Error ? css.error.message : String(css.error)) : null,
                handleError:
                    handle?.status === 'rejected'
                        ? (handle.error instanceof Error ? handle.error.message : String(handle.error))
                        : null,
                pageTypes: [...plugin.pageTypes],
                sites: [...plugin.sites],
                isFeatureFlagged: featureFlagName != null,
                featureFlagName
            };
        });
        return {
            total: this.plugins.size,
            css: this.lastCssResults,
            handle: this.lastHandleResults,
            plugins
        };
    }

    /** 销毁所有已注册插件（调用各插件的 destroy() 钩子）。 */
    destroyAll(): void {
        for (const [name, plugin] of this.plugins) {
            try {
                plugin.destroy();
            } catch (err) {
                clog.error(`插件 ${name} 销毁失败`, err);
            }
        }
    }
}
