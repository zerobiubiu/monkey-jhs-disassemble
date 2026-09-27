/**
 * LpBatchToolbar / LpBatchCheckbox —— 列表页勾选式批量操作 UI（React 函数组件，JSX）。
 *
 * - `LpBatchCheckbox`：卡片左上角勾选框。原生 checkbox 视觉隐藏但保留键盘可达与语义，
 *   勾选态由 `.is-checked` 绘制**白色对号**（形状表态，不只靠颜色 —— DESIGN.md
 *   「状态至少用两种手段表态」）；同时卡片本体由 CSS 加选中描边，让选择有明确的页面级响应。
 * - `LpBatchToolbar`：底部浮出工具栏，分「选择」与「操作」两组，中间用发丝线分隔；
 *   操作按钮复用系统既有的浅色语义按钮（`a-normal-buttons.css` 的 `.a-warning` /
 *   `.a-success` / `.a-danger`），不新增色值。
 *
 * 交互（阻止卡片跳转、勾选切换、批量执行、全选/反选）由 `list-page/lp-batch.tsx`
 * 的委托监听处理；本组件只负责渲染（`checked` 属性刻意不渲染，勾选态由 JS 同步，
 * 避免 `checked="false"` 仍被浏览器视为选中）。
 */

/** 已读星级档位（0 = 已读未评分）。 */
export const LP_BATCH_SCORES = [0, 1, 2, 3, 4, 5];

/** LpBatchCheckbox 属性。 */
export interface LpBatchCheckboxProps {
    /** 番号（写入 data 属性，供委托监听定位）。 */
    carNum: string;
    /** 是否已勾选（仅用于类名，不渲染 checked 属性）。 */
    checked: boolean;
    /** 无障碍名称（屏幕阅读器读出的操作对象）。 */
    label: string;
}

/**
 * 渲染单张卡片的勾选框。
 * @returns `.jhs-lp-batch-item` 标签 JSX（内含视觉隐藏的原生 checkbox）
 */
export function LpBatchCheckbox({ carNum, checked, label }: LpBatchCheckboxProps) {
    const cls = checked ? 'jhs-lp-batch-item is-checked' : 'jhs-lp-batch-item';
    return (
        <label className={cls} data-car-num={carNum} title={`选择 ${label}`}>
            <input
                type="checkbox"
                className="jhs-lp-batch-checkbox"
                aria-label={`选择 ${label}`}
                tabIndex={0}
            />
        </label>
    );
}

/** LpBatchToolbar 属性。 */
export interface LpBatchToolbarProps {
    /** 当前勾选数量。 */
    count: number;
    /** 当前页可选卡片总数（用于「已选 x / y」）。 */
    total: number;
    /** 是否正在执行批量写入（执行中禁用操作按钮）。 */
    busy: boolean;
}

/**
 * 渲染底部批量操作工具栏。
 * @returns `.jhs-lp-batch-bar` JSX（按钮带 data-act / data-score）
 */
export function LpBatchToolbar({ count, total, busy }: LpBatchToolbarProps) {
    const disabled = busy || count === 0;
    return (
        <div className="jhs-lp-batch-bar">
            <span className="jhs-lp-batch-count">
                已选 <strong>{count}</strong>
                <span className="jhs-lp-batch-total"> / {total}</span>
            </span>

            <span className="jhs-lp-batch-group">
                <button type="button" className="a-normal jhs-lp-batch-btn" data-act="select-all">
                    全选
                </button>
                <button type="button" className="a-normal jhs-lp-batch-btn" data-act="invert">
                    反选
                </button>
                <button
                    type="button"
                    className="a-normal jhs-lp-batch-btn"
                    data-act="clear"
                    disabled={count === 0}
                >
                    清空
                </button>
            </span>

            <span className="jhs-lp-batch-sep" aria-hidden="true" />

            <span className="jhs-lp-batch-group">
                <button
                    type="button"
                    className="a-warning jhs-lp-batch-btn"
                    data-act="favorite"
                    disabled={disabled}
                >
                    收藏
                </button>
                <span className="jhs-lp-batch-label">已读</span>
                {LP_BATCH_SCORES.map((score) => (
                    <button
                        type="button"
                        className="a-success jhs-lp-batch-btn jhs-lp-batch-star"
                        data-act="watched"
                        data-score={score}
                        disabled={disabled}
                        key={score}
                    >
                        {score}星
                    </button>
                ))}
                <button
                    type="button"
                    className="a-danger jhs-lp-batch-btn"
                    data-act="unwatch"
                    disabled={disabled}
                >
                    取消已读
                </button>
            </span>
        </div>
    );
}
