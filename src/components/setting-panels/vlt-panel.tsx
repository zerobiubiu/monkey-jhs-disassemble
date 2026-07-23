/**
 * VltPanel —— 收藏清单关系面板（React 函数组件，JSX）。
 *
 * 导入/导出按钮、状态文本、隐藏文件输入，基于 setting/ 原子组件构建。
 */

import { SettingButton } from '../setting/setting-button';
import { SettingSection } from '../setting/setting-section';

/** VltPanel 的属性。 */
export interface VltPanelProps {
    /** 当前激活面板名，控制面板 display。 */
    panelName: string;
}

/**
 * 渲染收藏清单关系面板的 JSX。
 * @returns vlt-panel JSX，经 jsxToString 转 HTML 字符串后供 SettingDialog 消费。
 */
export function VltPanel({ panelName }: VltPanelProps) {
    return (
        <div
            id="vlt-panel"
            className="content-panel"
            style={{
                display: panelName === 'vlt-panel' ? 'block' : 'none'
            }}
        >
            <SettingSection title="收藏清单关系" icon="📋">
                <p
                    style={{
                        margin: '0 0 16px 0',
                        color: '#6c757d',
                        fontSize: '13px',
                        lineHeight: '1.6'
                    }}
                >
                    管理影片与清单的关联数据（本地 IndexedDB，随 WebDav 备份）。
                    <br />
                    <strong>导入</strong>：从 JSON 文件导入数据（如 PostgreSQL 迁移数据）。
                    <br />
                    <strong>导出</strong>：将当前数据导出为 JSON 文件（备份/迁移）。
                </p>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                    <SettingButton id="vlt-import-btn" color="primary">
                        导入数据
                    </SettingButton>
                    <SettingButton id="vlt-export-btn" color="success">
                        导出数据
                    </SettingButton>
                </div>
                <div
                    id="vlt-status"
                    style={{ fontSize: '13px', color: '#6c757d', marginTop: '8px' }}
                />
                <input
                    type="file"
                    id="vlt-file-input"
                    accept=".json,application/json"
                    style={{ display: 'none' }}
                />
            </SettingSection>
        </div>
    );
}
