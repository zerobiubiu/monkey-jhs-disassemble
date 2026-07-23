/**
 * SettingCheckbox —— 复选框 + 文字标签原子组件。
 *
 * 输出 `.jhs-checkbox-label`（16px 主色复选框 + 13px 标签文字），用于
 * 站点启用等多选场景。id 供 jQuery 绑定。
 */

/** SettingCheckbox 的属性。 */
export interface SettingCheckboxProps {
    /** 元素 id（jQuery 事件/取值绑定依赖）。 */
    id: string;
    /** 复选框后的文字标签。 */
    label: string;
}

/**
 * 渲染复选框 + 文字标签。
 * @returns `.jhs-checkbox-label` JSX。
 */
export function SettingCheckbox({ id, label }: SettingCheckboxProps) {
    return (
        <label className="jhs-checkbox-label">
            <input id={id} type="checkbox" />
            <span>{label}</span>
        </label>
    );
}
