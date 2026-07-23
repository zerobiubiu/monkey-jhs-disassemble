/**
 * SettingSelect —— 设置项下拉框原子组件。
 *
 * 纯 `<select>` 包装：样式由 setting-plugin.css 的 `.setting-item select`
 * 统一规则接管。支持 children（option 列表）或 dangerouslySetInnerHTML
 * （预拼接 option 串，如画质选项）。
 */

import type { ReactNode } from 'react';

/** SettingSelect 的属性。 */
export interface SettingSelectProps {
    /** 元素 id（jQuery 事件/取值绑定依赖）。 */
    id: string;
    /** option 子节点列表。 */
    children?: ReactNode;
    /** 预拼接 option HTML 串（与 children 二选一）。 */
    dangerouslySetInnerHTML?: { __html: string };
}

/**
 * 渲染设置项下拉框。
 * @returns `<select>` JSX。
 */
export function SettingSelect({ id, children, dangerouslySetInnerHTML }: SettingSelectProps) {
    return (
        <select id={id} dangerouslySetInnerHTML={dangerouslySetInnerHTML}>
            {children}
        </select>
    );
}
