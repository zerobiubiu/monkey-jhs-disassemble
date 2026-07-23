/**
 * SettingSection —— 面板分区原子组件。
 *
 * 输出 `.jhs-setting-section`（顶部分隔线 + 主色分区标题），替代原渐变
 * `<hr>` 分隔线。首个分区自动去除上边距与分隔线（:first-child）。
 */

import type { ReactNode } from 'react';

/** SettingSection 的属性。 */
export interface SettingSectionProps {
    /** 分区标题（省略则仅作为分组容器）。 */
    title?: string;
    /** 标题前缀图标（emoji 等）。 */
    icon?: string;
    /** 分区内容（SettingRow 等）。 */
    children: ReactNode;
}

/**
 * 渲染面板分区。
 * @returns `.jhs-setting-section` JSX。
 */
export function SettingSection({ title, icon, children }: SettingSectionProps) {
    return (
        <div className="jhs-setting-section">
            {title ? (
                <div className="jhs-setting-section-title">
                    {icon ? <span>{icon}</span> : null}
                    {title}
                </div>
            ) : null}
            {children}
        </div>
    );
}
