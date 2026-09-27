/**
 * LpBatchToolbar / LpBatchCheckbox —— 列表页勾选式批量操作 UI（React 函数组件，JSX）。
 *
 * - `LpBatchCheckbox`：卡片左上角勾选框。原生 checkbox 视觉隐藏但保留键盘可达与语义，
 *   勾选态由 `.is-checked` 绘制**白色对号**（形状表态，不只靠颜色 —— DESIGN.md
 *   「状态至少用两种手段表态」）；同时卡片本体由 CSS 加选中描边，让选择有明确的页面级响应。
 *
 * - `LpBatchToolbar`：**常驻**在筛选栏右侧（不再用浮出工具栏 —— 用户反馈
 *   「不能在选中后才出现」），三段结构：
 *   1. 选择组：全选 / 反选 / 清空（中性）；
 *   2. 操作组（与详情页快捷评分条同构，`rating-bar-html.tsx`）：
 *      「收藏」（想看）｜「已读」（已看 0 星）｜「拉黑」（屏蔽）+ 一排**五颗星**
 *      （点第 N 颗 = 已读 N 星；hover 预览由 CSS `:hover` 实现，与详情页一致）；
 *   3. 计数：已选 x / y。
 *
 * 操作按钮复用详情页快捷评分条的既有类名契约（`jhs-fav-btn` / `jhs-read-btn` /
 * `jhs-block-btn`，样式见 `rating-bar.css`），列表页只做紧凑化覆盖，不新增色值。
 *
 * 交互（阻止卡片跳转、勾选切换、批量执行、全选/反选）由 `list-page/lp-batch.tsx`
 * 的委托监听处理；本组件只负责渲染（`checked` 属性刻意不渲染，勾选态由 JS 同步，
 * 避免 `checked="false"` 仍被浏览器视为选中）。
 */

/** 已读星级档位（点第 N 颗星 = 已读 N 星）。 */
export const LP_BATCH_SCORES = [1, 2, 3, 4, 5];

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
    /** 是否正在执行批量写入（执行中禁用操作按钮与星星）。 */
    busy: boolean;
}

/**
 * 渲染常驻批量操作条。
 *
 * 星星条与详情页快捷评分条同构：`.jhs-stars` 容器 + 5 个 `.jhs-star`（data-score 1–5），
 * 样式契约由 `rating-bar.css` 提供，这里按列表页场景做尺寸/禁用覆盖。
 *
 * @returns `.jhs-lp-batch-bar` JSX（按钮带 data-act / data-score）
 */
export function LpBatchToolbar({ count, busy }: LpBatchToolbarProps) {
    // 操作在「无选择」时禁用（没选任何卡片时执行无意义）；「全选/反选」不受限，否则无法开始选择
    const disabled = busy || count === 0;
    return (
        <span className="jhs-lp-batch-bar">
            <span className="jhs-lp-batch-group" data-role="select">
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

            <span className="jhs-lp-batch-group" data-role="actions">
                <span
                    className={`jhs-stars${busy ? ' is-disabled' : ''}`}
                    title="点第 N 颗星 = 已读 N 星"
                >
                    {LP_BATCH_SCORES.map((score) => (
                        <button
                            type="button"
                            className="jhs-star jhs-lp-batch-star"
                            data-act="watched"
                            data-score={score}
                            disabled={disabled}
                            key={score}
                        >
                            ★
                        </button>
                    ))}
                </span>
                <button
                    type="button"
                    className="jhs-fav-btn jhs-lp-batch-btn"
                    data-act="favorite"
                    disabled={disabled}
                >
                    收藏
                </button>
                <button
                    type="button"
                    className="jhs-read-btn jhs-lp-batch-btn"
                    data-act="watched"
                    data-score={0}
                    disabled={disabled}
                >
                    已读
                </button>
                <button
                    type="button"
                    className="jhs-block-btn jhs-lp-batch-btn"
                    data-act="filter"
                    disabled={disabled}
                >
                    拉黑
                </button>
            </span>

            <span className="jhs-lp-batch-count">
                已选 <strong>{count}</strong>
            </span>
        </span>
    );
}
