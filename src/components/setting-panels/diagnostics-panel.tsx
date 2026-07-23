/**
 * DiagnosticsPanel —— 插件诊断面板（React 函数组件，JSX）。
 *
 * 动态注入内容容器（diagnostics-content）、复制诊断报告按钮，基于
 * setting/ 原子组件构建（分区容器包裹动态内容）。
 */

import { SettingSection } from '../setting/setting-section';

/** DiagnosticsPanel 的属性。 */
export interface DiagnosticsPanelProps {
    /** 当前激活面板名，控制面板 display。 */
    panelName: string;
}

/**
 * 渲染插件诊断面板的 JSX。
 * @returns diagnostics-panel JSX，经 jsxToString 转 HTML 字符串后供 SettingDialog 消费。
 */
export function DiagnosticsPanel({ panelName }: DiagnosticsPanelProps) {
    return (
        <div
            id="diagnostics-panel"
            className="content-panel"
            style={{
                display: panelName === 'diagnostics-panel' ? 'block' : 'none',
                overflowY: 'auto'
            }}
        >
            <SettingSection title="插件执行状态" icon="📊">
                <div id="diagnostics-content" />
                <div style={{ marginTop: '12px' }}>
                    <button id="copy-diagnostics-btn" className="jhs-setting-btn jhs-setting-btn--primary" type="button">
                        📋 复制诊断报告
                    </button>
                </div>
            </SettingSection>
        </div>
    );
}
