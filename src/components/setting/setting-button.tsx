/**
 * SettingButton —— 面板操作按钮原子组件。
 *
 * 输出 `<a class="jhs-btn jhs-btn--{color}">`，语义色修饰符
 * 由 setting-plugin.css 的统一按钮系统提供（primary/success/danger/pink/mint）。id 供
 * jQuery 绑定。
 * jQuery 绑定。
 */

import type { ReactNode } from 'react';

/** SettingButton 的属性。 */
export interface SettingButtonProps {
    /** 元素 id（jQuery 事件绑定依赖）。 */
    id: string;
    /** 语义色修饰符。 */
    color: 'primary' | 'success' | 'danger' | 'pink' | 'mint';
    /** 按钮内容（文案/图标）。 */
    children: ReactNode;
}

/**
 * 渲染面板操作按钮。
 * @returns `.jhs-btn` JSX。
 */
export function SettingButton({ id, color, children }: SettingButtonProps) {
    return (
        <a id={id} className={`jhs-btn jhs-btn--${color}`}>
            {children}
        </a>
    );
}
