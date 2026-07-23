/**
 * BackupPanel —— 数据备份面板（React 函数组件，JSX）。
 *
 * 导入/导出按钮、WebDav 配置、备份口令、自动备份设置。基于 setting/
 * 原子组件构建；密码输入依赖浏览器原生显示/隐藏按钮（无自定义切换）。
 */

import { SettingButton } from '../setting/setting-button';
import { SettingCheckbox } from '../setting/setting-checkbox';
import { SettingInput } from '../setting/setting-input';
import { SettingRow } from '../setting/setting-row';
import { SettingSection } from '../setting/setting-section';
import { SettingSelect } from '../setting/setting-select';

/** BackupPanel 的属性。 */
export interface BackupPanelProps {
    /** 当前激活面板名，控制面板 display。 */
    panelName: string;
}

/**
 * 渲染数据备份面板的 JSX。
 * @returns backup-panel JSX，经 jsxToString 转 HTML 字符串后供 SettingDialog 消费。
 */
export function BackupPanel({ panelName }: BackupPanelProps) {
    return (
        <div
            id="backup-panel"
            className="content-panel"
            style={{
                display: panelName === 'backup-panel' ? 'block' : 'none'
            }}
        >
            <SettingSection>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <SettingButton id="importBtn" color="pink">
                        📥 导入数据
                    </SettingButton>
                    <SettingButton id="exportBtn" color="mint">
                        📤 导出数据
                    </SettingButton>
                </div>
            </SettingSection>

            <SettingSection title="WebDav 备份" icon="☁️">
                <SettingRow label="WebDav备份">
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <SettingButton id="webdavBackupListBtn" color="primary">
                            查看备份
                        </SettingButton>
                        <SettingButton id="webdavBackupBtn" color="success">
                            备份数据
                        </SettingButton>
                    </div>
                </SettingRow>
                <SettingRow label="服务地址:">
                    <SettingInput id="webDavUrl" />
                </SettingRow>
                <SettingRow label="用户名:">
                    <SettingInput id="webDavUsername" />
                </SettingRow>
                <SettingRow label="密码:">
                    <SettingInput id="webDavPassword" type="password" />
                </SettingRow>
                <SettingRow label="备份口令:">
                    <SettingInput
                        id="backupPassword"
                        type="password"
                        placeholder="加密备份的口令（V2 格式）"
                    />
                </SettingRow>
            </SettingSection>

            <SettingSection title="自动备份" icon="⏰">
                <SettingRow label="启用自动备份">
                    <SettingCheckbox id="enableAutoBackup" label="开启后按频率自动备份到 WebDav" />
                </SettingRow>
                <SettingRow label="备份频率:">
                    <SettingSelect id="autoBackupFrequency">
                        <option value="daily">每天第一次打开（推荐）</option>
                        <option value="everyOpen">每次打开</option>
                        <option value="disabled">不自动备份</option>
                    </SettingSelect>
                </SettingRow>
                <SettingRow label="本机凭证:">
                    <SettingInput
                        id="credentialIdDisplay"
                        readOnly
                        style={{ fontSize: '11px', fontFamily: 'monospace' }}
                    />
                </SettingRow>
            </SettingSection>
        </div>
    );
}
