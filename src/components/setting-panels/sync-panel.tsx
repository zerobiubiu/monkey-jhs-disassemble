/**
 * SyncPanel —— 通用同步/导入导出面板（React 函数组件，JSX）。
 *
 * 合并 VltPanel / MissavPanel：标题分区 + 描述 + 按钮组 + 状态文本 + 隐藏文件输入，
 * 基于 setting/ 原子组件构建。所有 DOM id / 文案 / 按钮由调用方注入。
 */

import type { ReactNode } from 'react';

import { SettingButton } from '../setting/setting-button';
import { SettingSection } from '../setting/setting-section';

/** SyncPanel 按钮配置。 */
export interface SyncPanelButton {
    /** 按钮 DOM id（jQuery 事件绑定依赖）。 */
    id: string;
    /** 按钮文案。 */
    text: string;
    /** 语义色修饰符。 */
    color: 'primary' | 'success' | 'danger' | 'pink' | 'mint';
}

/** SyncPanel 的属性。 */
export interface SyncPanelProps {
    /** 面板 DOM id（如 "vlt-panel" / "missav-panel"）。 */
    panelId: string;
    /** 当前激活面板名，控制面板 display。 */
    panelName: string;
    /** 分区标题。 */
    title: string;
    /** 标题前缀图标（emoji）。 */
    icon: string;
    /** 描述内容（支持 JSX）。 */
    description: ReactNode;
    /** 按钮列表。 */
    buttons: SyncPanelButton[];
    /** 状态文本 DOM id。 */
    statusId: string;
    /** 隐藏文件输入 DOM id。 */
    fileInputId: string;
}

/**
 * 渲染通用同步/导入导出面板的 JSX。
 * @returns 面板 JSX，经 jsxToString 转 HTML 字符串后供 SettingDialog 消费。
 */
export function SyncPanel({
    panelId,
    panelName,
    title,
    icon,
    description,
    buttons,
    statusId,
    fileInputId
}: SyncPanelProps) {
    return (
        <div
            id={panelId}
            className="content-panel"
            style={{
                display: panelName === panelId ? 'block' : 'none'
            }}
        >
            <SettingSection title={title} icon={icon}>
                <p
                    style={{
                        margin: '0 0 16px 0',
                        color: '#6c757d',
                        fontSize: '13px',
                        lineHeight: '1.6'
                    }}
                >
                    {description}
                </p>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                    {buttons.map((btn) => (
                        <SettingButton key={btn.id} id={btn.id} color={btn.color}>
                            {btn.text}
                        </SettingButton>
                    ))}
                </div>
                <div
                    id={statusId}
                    style={{ fontSize: '13px', color: '#6c757d', marginTop: '8px' }}
                />
                <input
                    type="file"
                    id={fileInputId}
                    accept=".json,application/json"
                    style={{ display: 'none' }}
                />
            </SettingSection>
        </div>
    );
}
