/**
 * 插件诊断模块 — 渲染插件执行状态 + 注册 Tampermonkey 菜单命令。
 * 从 main.tsx 提取（doc/133），供设置面板「📊 插件诊断」面板复用。
 *
 * HTML 渲染经 DiagnosticsTable 组件（src/components/diagnostics-table.tsx）
 * + jsxToString 输出（doc/16 统一规定），不再手写模板字符串；插件名由
 * jsxToString 文本转义保护（等价原 escapeHtml，良构数据下 DOM 等价）。
 * 纯文本报告（renderDiagnosticsText）保持模板拼接不变。
 */
import { jsxToString } from './jsx-to-string';

import type { PluginManager } from '../plugins/plugin-manager';

import { DiagnosticsTable } from '../components/log/diagnostics-table';
import { DiagnosticsWrapper } from '../components/log/diagnostics-wrapper';

/** 渲染诊断表格 HTML（供 layer.open / 设置面板复用）。 */
export function renderDiagnosticsHtml(pluginManager: PluginManager): string {
    return jsxToString(<DiagnosticsTable data={pluginManager.getDiagnostics().handle} />);
}

/** 生成纯文本诊断报告（供复制到剪贴板）。 */
export function renderDiagnosticsText(pluginManager: PluginManager): string {
    const diag = pluginManager.getDiagnostics();
    const lines = diag.handle.map(
        (p) => `${p.status === 'fulfilled' ? '✅' : p.status === 'rejected' ? '❌' : '⏭️'} ${p.name}: ${p.status}${p.durationMs != null ? ` (${p.durationMs}ms)` : ''}`
    );
    const failed = diag.handle.filter((p) => p.status === 'rejected');
    const totalMs = diag.handle.reduce((sum, p) => sum + (p.durationMs ?? 0), 0);
    return `JavDB Power Tools 插件诊断\n共 ${diag.total} 个插件，${failed.length} 个失败，总耗时 ${totalMs}ms\n\n${lines.join('\n')}`;
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
