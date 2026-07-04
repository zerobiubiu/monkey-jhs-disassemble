/**
 * OtherSiteCheckbox —— 第三方站点启用复选框（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/other-site-plugin.ts 的 renderSettingsArea（L400-403）map
 * 回调：每个站点产出 `<div>` 含 checkbox + label，由 checkboxContainer.innerHTML
 * 拼接消费。isJavdbSite 决定 align-items（center / flex-start）。
 *
 * 保留原 id/data-site-id/checked/label/内联 style 原样不动；
 * siteConfig.id / isEnabled / isJavdbSite 通过 prop 注入。
 * `<label for="...">` 的 for 属性因 React JSX 类型保留字限制（LabelHTMLAttributes
 * 仅声明 htmlFor，无 for），用 `{...{ for: ... } as Record<string, string>}` 展开
 * 注入（TypeScript 对 index signature 展开跳过属性检查，jsxToString 原样输出
 * for="..."，与原模板一致）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 renderSettingsArea 循环拼接
 * checkboxContainer.innerHTML 时，需先用 `jsxToString`（来自 ../core/jsx-to-string，
 * 轻量 JSX→HTML 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串再拼接：
 *   `html += jsxToString(<OtherSiteCheckbox id={...} isEnabled={...} isJavdbSite={...} />)`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义。
 */

/** OtherSiteCheckbox 的属性。 */
export interface OtherSiteCheckboxProps {
    /** 站点 id（checkbox id = "checkbox-<id>"，label 显示名去 "Btn" 后缀）。 */
    id: string;
    /** 是否启用（checked 属性）。 */
    isEnabled: boolean;
    /** 是否 JavDb 站点（决定 align-items）。 */
    isJavdbSite: boolean;
}

/**
 * 渲染单个站点启用复选框的 JSX。
 * @returns checkbox div JSX，经 jsxToString 转 HTML 字符串后供 innerHTML 拼接。
 */
export function OtherSiteCheckbox({ id, isEnabled, isJavdbSite }: OtherSiteCheckboxProps) {
    return (
        <div
            style={{
                marginRight: '15px',
                display: 'flex',
                alignItems: isJavdbSite ? 'center' : 'flex-start'
            }}
        >
            <input
                type="checkbox"
                id={`checkbox-${id}`}
                data-site-id={id}
                checked={isEnabled}
                style={{ marginRight: '8px', cursor: 'pointer' }}
            />
            <label
                {...({ for: `checkbox-${id}` } as Record<string, string>)}
                style={{
                    color: '#333',
                    fontWeight: '500',
                    cursor: 'pointer'
                }}
            >
                {id.replace('Btn', '')}
            </label>
        </div>
    );
}
