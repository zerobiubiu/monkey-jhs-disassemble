/**
 * SettingToggle —— iOS 风格开关行原子组件。
 *
 * SettingRow + `.jhs-toggle` 复选框（setting-plugin.css 提供 40×22 圆角滑块
 * 外观，选中态 #22c55e）。id 供 jQuery 绑定。
 */

import { SettingRow } from './setting-row';

/** SettingToggle 的属性。 */
export interface SettingToggleProps {
    /** 元素 id（jQuery 事件/取值绑定依赖）。 */
    id: string;
    /** 标签文案。 */
    label: string;
    /** 悬停提示文案（渲染为 data-tip 问号图标）。 */
    tooltip?: string;
    /** 附加在 .setting-item 上的类（如 do-hide）。 */
    className?: string;
}

/**
 * 渲染开关设置行。
 * @returns SettingRow 包裹的 `.jhs-toggle` 复选框 JSX。
 */
export function SettingToggle({ id, label, tooltip, className }: SettingToggleProps) {
    return (
        <SettingRow label={label} tooltip={tooltip} className={className}>
            <input id={id} type="checkbox" className="jhs-toggle" />
        </SettingRow>
    );
}
