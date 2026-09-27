/**
 * LpBatchToolbar / LpBatchCheckbox —— 列表页勾选式批量操作 UI（React 函数组件，JSX）。
 *
 * - `LpBatchCheckbox`：注入到每张卡片的勾选框（复用 status-tag 的注入点三级回退，
 *   绝对定位，与状态标签同一套定位上下文）；
 * - `LpBatchToolbar`：底部固定工具栏（勾选数 + 收藏 / 已读 0–5★ / 取消已读 / 清空选择）。
 *
 * 交互（阻止卡片跳转、勾选切换、批量执行）由 `list-page/lp-batch.ts` 的委托监听处理；
 * 本组件只负责渲染（`checked` 属性刻意不渲染，勾选态由 JS 同步，避免 `checked="false"`
 * 仍被浏览器视为选中）。
 */

/** 已读星级档位（0 = 已读未评分）。 */
export const LP_BATCH_SCORES = [0, 1, 2, 3, 4, 5];

/** LpBatchCheckbox 属性。 */
export interface LpBatchCheckboxProps {
    /** 番号（写入 data 属性，供委托监听定位）。 */
    carNum: string;
    /** 是否已勾选（仅用于类名，不渲染 checked 属性）。 */
    checked: boolean;
}

/**
 * 渲染单张卡片的勾选框。
 * @returns `.jhs-lp-batch-item` 标签 JSX（内含 checkbox；勾选态由 JS 设置）
 */
export function LpBatchCheckbox({ carNum, checked }: LpBatchCheckboxProps) {
    const cls = checked ? 'jhs-lp-batch-item is-checked' : 'jhs-lp-batch-item';
    return (
        <label className={cls} data-car-num={carNum} title="勾选以批量操作">
            <input type="checkbox" className="jhs-lp-batch-checkbox" />
        </label>
    );
}

/** LpBatchToolbar 属性。 */
export interface LpBatchToolbarProps {
    /** 当前勾选数量。 */
    count: number;
    /** 是否正在执行批量写入（执行中禁用按钮）。 */
    busy: boolean;
}

/**
 * 渲染底部批量操作工具栏。
 * @returns `.jhs-lp-batch-bar` JSX（按钮带 data-act / data-score）
 */
export function LpBatchToolbar({ count, busy }: LpBatchToolbarProps) {
    const disabled = busy || count === 0;
    return (
        <div className="jhs-lp-batch-bar">
            <span className="jhs-lp-batch-count">
                已选 <strong>{count}</strong> 项
            </span>
            <button type="button" className="jhs-lp-batch-btn" data-act="favorite" disabled={disabled}>
                收藏
            </button>
            <span className="jhs-lp-batch-group">
                <span className="jhs-lp-batch-label">已读</span>
                {LP_BATCH_SCORES.map((score) => (
                    <button
                        type="button"
                        className="jhs-lp-batch-btn jhs-lp-batch-star"
                        data-act="watched"
                        data-score={score}
                        disabled={disabled}
                        key={score}
                    >
                        {score}★
                    </button>
                ))}
            </span>
            <button type="button" className="jhs-lp-batch-btn" data-act="unwatch" disabled={disabled}>
                取消已读
            </button>
            <button type="button" className="jhs-lp-batch-btn" data-act="clear">
                清空选择
            </button>
        </div>
    );
}
