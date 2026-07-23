/**
 * MissavPanel —— MissAV 同步面板（React 函数组件，JSX）。
 *
 * 同步/导入/导出按钮、状态文本、隐藏文件输入，基于 setting/ 原子组件构建。
 */

import { SettingButton } from '../setting/setting-button';
import { SettingSection } from '../setting/setting-section';

/** MissavPanel 的属性。 */
export interface MissavPanelProps {
    /** 当前激活面板名，控制面板 display。 */
    panelName: string;
}

/**
 * 渲染 MissAV 同步面板的 JSX。
 * @returns missav-panel JSX，经 jsxToString 转 HTML 字符串后供 SettingDialog 消费。
 */
export function MissavPanel({ panelName }: MissavPanelProps) {
    return (
        <div
            id="missav-panel"
            className="content-panel"
            style={{
                display: panelName === 'missav-panel' ? 'block' : 'none'
            }}
        >
            <SettingSection title="MissAV 状态标签同步" icon="🎬">
                <p
                    style={{
                        margin: '0 0 16px 0',
                        color: '#6c757d',
                        fontSize: '13px',
                        lineHeight: '1.6'
                    }}
                >
                    在 MissAV 站点显示 JHS 鉴定状态标签（已收藏/已观看/已屏蔽/已下载）。
                    <br />
                    数据通过油猴 GM 存储跨域同步，无需后端服务器。
                    <br />
                    <strong>立即同步</strong>：读取当前 car_list 并推送到 GM 存储。
                    <br />
                    <strong>导入</strong>：从后端服务器导出的 JSON 导入历史数据。
                    <br />
                    <strong>导出</strong>：将 MissAV 本地 IndexedDB 数据导出为 JSON（可走
                    WebDav 备份）。
                </p>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                    <SettingButton id="missav-sync-btn" color="primary">
                        立即同步
                    </SettingButton>
                    <SettingButton id="missav-import-btn" color="primary">
                        导入数据
                    </SettingButton>
                    <SettingButton id="missav-export-btn" color="success">
                        导出数据
                    </SettingButton>
                </div>
                <div
                    id="missav-status"
                    style={{ fontSize: '13px', color: '#6c757d', marginTop: '8px' }}
                />
                <input
                    type="file"
                    id="missav-file-input"
                    accept=".json,application/json"
                    style={{ display: 'none' }}
                />
            </SettingSection>
        </div>
    );
}
