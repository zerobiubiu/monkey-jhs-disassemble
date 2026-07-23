/**
 * SettingInput —— 设置项输入框原子组件。
 *
 * 纯 `<input>` 包装：样式由 setting-plugin.css 的 `.setting-item input[...]`
 * 统一规则接管（36px 高、#d1d5db 边框、聚焦主色描边）。id 供 jQuery 绑定。
 */

import type { CSSProperties } from 'react';

/** SettingInput 的属性。 */
export interface SettingInputProps {
    /** 元素 id（jQuery 事件/取值绑定依赖）。 */
    id: string;
    /** input 类型，默认 text。 */
    type?: string;
    /** 占位文案。 */
    placeholder?: string;
    /** 是否只读（配合 readonly 样式）。 */
    readOnly?: boolean;
    /** min/max/step 等数值约束。 */
    min?: string;
    max?: string;
    step?: string;
    /** 内联样式覆盖（如定宽）。 */
    style?: CSSProperties;
}

/**
 * 渲染设置项输入框。
 * @returns `<input>` JSX。
 */
export function SettingInput({
    id,
    type = 'text',
    placeholder,
    readOnly,
    min,
    max,
    step,
    style
}: SettingInputProps) {
    return (
        <input
            id={id}
            type={type}
            placeholder={placeholder}
            readOnly={readOnly}
            min={min}
            max={max}
            step={step}
            style={style}
        />
    );
}
