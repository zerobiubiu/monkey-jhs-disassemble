/**
 * LpBatchSideBar / LpBatchToolbar / LpBatchCheckbox —— 列表页勾选式批量操作 UI。
 *
 * 三件套，按操作性质分层（doc/33）：
 * - `LpBatchCheckbox`：卡片左上角勾选框。原生 checkbox 视觉隐藏但保留键盘可达与语义，
 *   勾选态由 `.is-checked` 绘制**白色对号**（形状表态，不只靠颜色 —— DESIGN.md
 *   「状态至少用两种手段表态」）；同时卡片本体由 CSS 加选中描边，让选择有明确的页面级响应。
 * - `LpBatchSideBar`：**常驻**竖排选择组（请求列表 / 全选 / 反选 / 清空），固定在
 *   **视频流左侧、屏幕中部**，不随视频流滚动 —— 这类操作不依赖「先选了什么」。
 * - `LpBatchToolbar`：**浮出**操作条（选中 > 0 时出现），与详情页快捷评分条同构：
 *   五颗星（点第 N 颗 = 已读 N 星）+ 收藏 / 已读(0星) / 拉黑 —— 这类操作针对
 *   「已选中的视频内容」，随选择出现符合交互直觉。
 *
 * 操作按钮复用既有类名契约：选择组用 `a-normal-buttons.css` 的 `.a-normal`；
 * 操作组用 `rating-bar.css` 的 `.jhs-fav-btn` / `.jhs-read-btn` / `.jhs-block-btn`
 * 与 `.jhs-stars` / `.jhs-star`（列表页只做紧凑化覆盖，不新增色值）。
 *
 * 交互由 `list-page/lp-batch.tsx` 的委托监听处理；本组件只负责渲染
 * （`checked` 属性刻意不渲染，勾选态由 JS 同步）。
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

/**
 * 渲染视频流左侧常驻竖排选择组。
 *
 * @param props.hasSelection 是否已有勾选（决定「清空」禁用态）
 * 返回 **Fragment**：四枚按钮作为容器（`.jhs-lp-batch-side`，由控制器创建）的**直接子元素**。
 * 刻意不再自带一层同名容器 —— 否则会出现嵌套重复且内层再带一份列布局与固定定位
 * （实测反馈「显示结构还是错的」即此）。
 *
 * @param props.hasSelection 是否已有勾选（决定「清空」禁用态）
 * @returns 四枚按钮的 Fragment（按钮带 data-act）
 */
export function LpBatchSideBar({ hasSelection }: { hasSelection: boolean }) {
    return (
        <>
            <button type="button" className="jhs-lp-batch-side-btn" data-act="request-list">
                请求列表
            </button>
            <button type="button" className="jhs-lp-batch-side-btn" data-act="select-all">
                全选
            </button>
            <button type="button" className="jhs-lp-batch-side-btn" data-act="invert">
                反选
            </button>
            <button
                type="button"
                className="jhs-lp-batch-side-btn"
                data-act="clear"
                disabled={!hasSelection}
            >
                清空
            </button>
        </>
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
 * 渲染浮出操作条（选中 > 0 时出现）。
 *
 * 与详情页快捷评分条同构：`.jhs-stars` 容器 + 5 个 `.jhs-star`（data-score 1–5）+
 * 收藏 / 已读(0星) / 拉黑；样式契约由 `rating-bar.css` 提供，按列表页场景做紧凑化覆盖。
 *
 * @returns `.jhs-lp-batch-bar` JSX（按钮带 data-act / data-score）
 */
export function LpBatchToolbar({ count, busy }: LpBatchToolbarProps) {
    // 操作在「无选择」时禁用（没选任何卡片时执行无意义）
    const disabled = busy || count === 0;
    return (
        <div className="jhs-lp-batch-bar">
            <span className="jhs-lp-batch-count">
                已选 <strong>{count}</strong>
            </span>
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
        </div>
    );
}
