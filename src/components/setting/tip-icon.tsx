/**
 * TipIcon —— 行内问号提示图标（设置弹层与快捷浮层共用，唯一实现）。
 *
 * 此前 `.jhs-tooltip-icon`（设置行）与 `.jhs-qs-tip`（快捷面板）是两套逐字相同的
 * 标记 + 样式，且前者没有可访问名称（读屏只念「问号」）。现将两者收敛到本组件。
 *
 * 输出 `<span class="jhs-tip-icon" role="img" aria-label data-tip>?</span>`：
 * 视觉 tooltip 由 core/tooltip.ts 代理 `[data-tip]` 显示；可访问名称与视觉文案同源
 * （同一个 `tip` 变量同时喂 `aria-label` 与 `data-tip`，不存在第二份文案）。
 */

/** TipIcon 的属性。 */
export interface TipIconProps {
    /** 提示文案（同时作为可访问名称与视觉 tooltip 内容）。 */
    tip: string;
}

/**
 * 渲染问号提示图标。
 * @returns `.jhs-tip-icon` JSX。
 */
export function TipIcon({ tip }: TipIconProps) {
    return (
        <span className="jhs-tip-icon" role="img" aria-label={tip} data-tip={tip}>
            ?
        </span>
    );
}