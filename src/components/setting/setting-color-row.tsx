/**
 * SettingColorRow —— 数值 + 颜色组合设置行原子组件。
 *
 * 用于「分类标签|高亮演员-边框样式」：边框宽度数值输入 + 原生颜色选择器 +
 * 实时预览标签（jQuery 依 highlightedTagNumber/Color 更新其 border）。
 */

import { SettingRow } from './setting-row';

/** SettingColorRow 的属性。 */
export interface SettingColorRowProps {
    /** 数值输入框 id（边框宽度）。 */
    numberId: string;
    /** 颜色选择器 id（边框颜色）。 */
    colorId: string;
    /** 预览标签 id（jQuery 动态更新 border）。 */
    labelId: string;
    /** 行标签文案。 */
    label: string;
    /** 附加在 .setting-item 上的类（如 do-hide）。 */
    className?: string;
}

/**
 * 渲染数值 + 颜色组合设置行。
 * @returns SettingRow 包裹的 flex 组合控件 JSX。
 */
export function SettingColorRow({ numberId, colorId, labelId, label, className }: SettingColorRowProps) {
    return (
        <SettingRow label={label} className={className}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input id={numberId} type="number" style={{ width: '80px', flexShrink: 0 }} />
                <input id={colorId} type="color" style={{ flexShrink: 0 }} />
                <span
                    id={labelId}
                    style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        borderRadius: '4px',
                        fontSize: '13px',
                        border: '1px solid #ce2222'
                    }}
                >
                    示例标签
                </span>
            </div>
        </SettingRow>
    );
}
