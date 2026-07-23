/**
 * DomainPanel —— 外部网站域名配置面板（React 函数组件，JSX）。
 *
 * MissAv / SupJav 域名输入，基于 setting/ 原子组件构建。
 */

import { SettingInput } from '../setting/setting-input';
import { SettingRow } from '../setting/setting-row';
import { SettingSection } from '../setting/setting-section';

/** DomainPanel 的属性。 */
export interface DomainPanelProps {
    /** 当前激活面板名，控制面板 display。 */
    panelName: string;
}

/**
 * 渲染域名配置面板的 JSX。
 * @returns domain-panel JSX，经 jsxToString 转 HTML 字符串后供 SettingDialog 消费。
 */
export function DomainPanel({ panelName }: DomainPanelProps) {
    return (
        <div
            id="domain-panel"
            className="content-panel"
            style={{
                display: panelName === 'domain-panel' ? 'block' : 'none'
            }}
        >
            <SettingSection title="第三方视频资源域名" icon="🌐">
                <SettingRow label="域名 - MissAv:">
                    <SettingInput id="missAvUrl" />
                </SettingRow>
                <SettingRow label="域名 - SupJav:">
                    <SettingInput id="supJavUrl" />
                </SettingRow>
            </SettingSection>
        </div>
    );
}
