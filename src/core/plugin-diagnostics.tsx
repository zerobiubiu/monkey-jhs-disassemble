/**
 * 插件诊断模块 — 渲染插件执行状态 + 注册 Tampermonkey 菜单命令。
 * 从 main.tsx 提取（doc/133），供设置面板「📊 插件诊断」面板复用。
 *
 * HTML 渲染经 DiagnosticsTable 组件（src/components/diagnostics-table.tsx）
 * + jsxToString 输出（doc/16 统一规定），不再手写模板字符串；插件名由
 * jsxToString 文本转义保护（等价原 escapeHtml，良构数据下 DOM 等价）。
 * 纯文本报告（renderDiagnosticsText）与表格同源 plugins 聚合数据，含两阶段
 * 状态/耗时/错误/页面类型/站点/Flag 字段。
 */
import { jsxToString } from './jsx-to-string';

import type { PluginManager } from '../plugins/plugin-manager';

import { DiagnosticsTable } from '../components/log/diagnostics-table';
import { DiagnosticsWrapper } from '../components/log/diagnostics-wrapper';

/** 渲染诊断表格 HTML（供 layer.open / 设置面板复用）。 */
export function renderDiagnosticsHtml(pluginManager: PluginManager): string {
    return jsxToString(<DiagnosticsTable data={pluginManager.getDiagnostics().plugins} />);
}

/** 生成纯文本诊断报告（供复制到剪贴板）。 */
export function renderDiagnosticsText(pluginManager: PluginManager): string {
    const diag = pluginManager.getDiagnostics();
    const plugins = diag.plugins;
    const cssOk = plugins.filter((p) => p.cssStatus === 'fulfilled').length;
    const handleOk = plugins.filter((p) => p.handleStatus === 'fulfilled').length;
    const failed = plugins.filter((p) => p.cssStatus === 'rejected' || p.handleStatus === 'rejected');
    const skipped = plugins.filter((p) => p.cssStatus === 'skipped' && p.handleStatus === 'skipped');
    const flagged = plugins.filter((p) => p.isFeatureFlagged);
    const totalMs = plugins.reduce((sum, p) => sum + (p.totalDurationMs ?? 0), 0);
    const lines = plugins.map((p) => {
        const icon =
            p.cssStatus === 'rejected' || p.handleStatus === 'rejected'
                ? '❌'
                : p.cssStatus === 'skipped' && p.handleStatus === 'skipped'
                  ? '⏭️'
                  : '✅';
        const parts = [
            `${icon} ${p.name}`,
            `CSS:${p.cssStatus}${p.cssDurationMs != null ? `(${p.cssDurationMs}ms)` : ''}`,
            `Handle:${p.handleStatus}${p.handleDurationMs != null ? `(${p.handleDurationMs}ms)` : ''}`,
            `总耗时:${p.totalDurationMs != null ? `${p.totalDurationMs}ms` : '-'}`
        ];
        if (p.pageTypes.length) parts.push(`页面:[${p.pageTypes.join(',')}]`);
        if (p.sites.length) parts.push(`站点:[${p.sites.join(',')}]`);
        if (p.isFeatureFlagged) parts.push(`Flag:${p.featureFlagName}`);
        if (p.cssError) parts.push(`CSS错误:${p.cssError}`);
        if (p.handleError) parts.push(`Handle错误:${p.handleError}`);
        return parts.join(' | ');
    });
    return [
        'JavDB Power Tools 插件诊断报告',
        `总计 ${diag.total} 个插件 | CSS ${cssOk}/${diag.total} | Handle ${handleOk}/${diag.total} | 总耗时 ${totalMs}ms`,
        `失败 ${failed.length} 个 | 跳过 ${skipped.length} 个 | Feature Flag ${flagged.length} 个`,
        '',
        ...lines
    ].join('\n');
}

/** 注册 Tampermonkey 菜单命令（main.tsx 启动序列末尾调用）。 */
export function registerDiagnosticsMenu(pluginManager: PluginManager): void {
    GM_registerMenuCommand('📊 插件诊断', () => {
        const diag = pluginManager.getDiagnostics();
        const failed = diag.handle.filter((p) => p.status === 'rejected');
        layer.open({
            type: 1,
            title: `插件诊断 — 共 ${diag.total} 个插件，${failed.length} 个失败`,
            area: ['600px', '70%'],
            content: jsxToString(<DiagnosticsWrapper html={renderDiagnosticsHtml(pluginManager)} />)
        });
    });
}
