/**
 * SettingRow —— 设置项原子行组件（标签列 + 控件列）。
 *
 * 输出 `.setting-item > .setting-label + .form-content` 结构，与
 * setting-plugin.css 统一表单网格（180px 标签列 + 1fr 控件列）配套。
 * 标签可携带行内问号提示图标（data-tip 由全局 tooltip.ts 代理显示）。
 */

import type { ReactNode } from 'react';

/** SettingRow 的属性。 */
export interface SettingRowProps {
    /** 标签文案。 */
    label: string;
    /** 悬停提示文案（渲染为 data-tip 问号图标）。 */
    tooltip?: string;
    /** 控件列内容。 */
    children: ReactNode;
    /** 附加在 .setting-item 上的类（如 do-hide）。 */
    className?: string;
}

/**
 * 渲染一行设置项：右侧对齐标签 + 控件列。
 * @returns `.setting-item` JSX。
 */
export function SettingRow({ label, tooltip, children, className }: SettingRowProps) {
    return (
        <div className={`setting-item${className ? ' ' + className : ''}`}>
            <span className="setting-label">
                {label}
                {tooltip ? (
                    <span className="jhs-tooltip-icon" data-tip={tooltip}>
                        ?
                    </span>
                ) : null}
            </span>
            <div className="form-content">{children}</div>
        </div>
    );
}
