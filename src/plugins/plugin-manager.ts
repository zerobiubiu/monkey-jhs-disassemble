/**
 * 插件管理器 PluginManager —— 对应原脚本 archetype/jhs.user.js L2942-3028。
 *
 * 负责插件注册（register）、CSS 注入（processCss）与执行调度（processPlugins），
 * 统一以 Promise.allSettled 收集结果，捕获并汇报失败项。
 *
 * 单字母局部变量（原 e/t/n）已语义化重命名。
 * 原始 register 中错误信息引用了未定义的 `name`（实为笔误，应为插件名变量），
 * 此处修正为实际插件名，控制流（重复即抛错）不变。
 */
import type { BasePlugin } from './base-plugin';

/** 插件处理结果记录（processCss / processPlugins 内部返回结构） */
export interface Plugin {
    name: string;
    status: string;
    error?: any;
}

export class PluginManager {
    private plugins: Map<string, BasePlugin> = new Map();

    /** 注册插件类：实例化、注入 pluginManager、按 getName() 去重。对应原 L2946-2957。 */
    register(pluginClass: new () => BasePlugin): void {
        if (typeof pluginClass !== 'function') {
            throw new Error('插件必须是一个类');
        }
        const instance = new pluginClass();
        instance.pluginManager = this;
        const pluginName = instance.getName();
        if (this.plugins.has(pluginName)) {
            throw new Error(`插件"${pluginName}"已注册`);
        }
        this.plugins.set(pluginName, instance);
    }

    /** 按名称获取插件实例。对应原 L2958-2960。 */
    getBean(name: string): BasePlugin | undefined {
        return this.plugins.get(name);
    }

    /** 并发执行所有插件 initCss，注入样式并汇报失败项。对应原 L2961-2997。 */
    async processCss(): Promise<void> {
        const failed = (
            await Promise.allSettled(
                Array.from(this.plugins).map(async ([name, plugin]): Promise<Plugin> => {
                    try {
                        if (typeof plugin.initCss === 'function') {
                            const css = await plugin.initCss();
                            if (css) {
                                utils.insertStyle(css);
                            }
                            return { name, status: 'fulfilled' };
                        }
                        return { name, status: 'skipped' };
                    } catch (err) {
                        console.error(`插件 ${name} 加载 CSS 失败`, err);
                        return { name, status: 'rejected', error: err };
                    }
                })
            )
        ).filter((result: any) => result.status === 'rejected');
        if (failed.length) {
            console.error(
                '以下插件的 CSS 加载失败：',
                failed.map((result: any) => result.value.name)
            );
        }
    }

    /**
     * 并发执行所有插件 handle，汇报失败项。对应原 L2998-3027。
     * 注：原逻辑中未实现 handle 的插件会让回调贯穿返回 undefined
     * （与 processCss 返回 "skipped" 不同），此处保留该控制流。
     */
    async processPlugins(): Promise<void> {
        const failed = (
            await Promise.allSettled(
                Array.from(this.plugins).map(
                    async ([name, plugin]): Promise<Plugin | undefined> => {
                        try {
                            if (typeof plugin.handle === 'function') {
                                await plugin.handle();
                                return { name, status: 'fulfilled' };
                            }
                        } catch (err) {
                            clog.error(`插件 ${name} 执行失败`, err);
                            return { name, status: 'rejected', error: err };
                        }
                    }
                )
            )
        ).filter((result: any) => result.status === 'rejected');
        if (failed.length) {
            console.error(
                '以下插件执行失败：',
                failed.map((result: any) => result.value.name)
            );
        }
    }
}
