/**
 * PreloadQueuePanel —— 「批量预加载请求列表」浮层内容（React 函数组件，JSX）。
 *
 * 展示 other-site 预加载队列的实时情况（执行中 / 排队中 / 失败 / 已取消），
 * 并提供手动干预入口：置顶、取消、重试、清空已结束。
 *
 * 渲染方式：返回 JSX，经 jsxToString 转 HTML 字符串后写入浮层容器；
 * 每次刷新重建内容（列表规模小，且与既有徽标实时更新互不干扰）。
 * 交互由 `osp-preload-panel.tsx` 的容器级事件委托处理（按钮带 data-act / data-key）。
 */

import type {
    PreloadTaskCounts,
    PreloadTaskStatus
} from '../../plugins/other-site/osp-preload-tasks';
import { PRELOAD_TASK_STATUS_TEXT } from '../../plugins/other-site/osp-preload-tasks';

/** 面板中的一行。 */
export interface PreloadQueueRow {
    /** 业务键（`${carNum}_${siteId}`）。 */
    key: string;
    /** 番号。 */
    carNum: string;
    /** 站点显示名。 */
    siteLabel: string;
    /** 展示状态。 */
    status: PreloadTaskStatus;
    /** 是否处于队列中（排队或执行中）——决定「置顶 / 取消」是否可用。 */
    inQueue: boolean;
    /** 是否正在执行（不可置顶）。 */
    running: boolean;
}

/** PreloadQueuePanel 属性。 */
export interface PreloadQueuePanelProps {
    /** 行数据（队列顺序在前，终态记录在后）。 */
    rows: PreloadQueueRow[];
    /** 各状态计数。 */
    counts: PreloadTaskCounts;
    /** 当前并发上限。 */
    concurrency: number;
}

/**
 * 渲染请求列表浮层内容。
 *
 * @returns `.jhs-pqp` 面板 JSX（含表头、行列表、空态提示）。
 */
export function PreloadQueuePanel({ rows, counts, concurrency }: PreloadQueuePanelProps) {
    const terminalCount = counts.failed + counts.cancelled;
    return (
        <div className="jhs-pqp">
            <div className="jhs-pqp-header">
                <span className="jhs-pqp-title">预加载请求列表</span>
                <span className="jhs-pqp-summary">
                    执行中 {counts.requesting} · 排队 {counts.queued} · 失败 {counts.failed}
                    {counts.cancelled > 0 ? ` · 已取消 ${counts.cancelled}` : ''}
                </span>
                <span className="jhs-pqp-concurrency" title="当前预加载并发上限">
                    并发 {concurrency}
                </span>
                <div className="jhs-pqp-header-actions">
                    <button
                        type="button"
                        className="jhs-pqp-btn"
                        data-act="retry-failed"
                        disabled={counts.failed === 0}
                    >
                        全部重试
                    </button>
                    <button
                        type="button"
                        className="jhs-pqp-btn"
                        data-act="clear-terminal"
                        disabled={terminalCount === 0}
                    >
                        清空已结束
                    </button>
                    <button type="button" className="jhs-pqp-btn jhs-pqp-close" data-act="close">
                        ×
                    </button>
                </div>
            </div>
            {rows.length === 0 ? (
                <div className="jhs-pqp-empty">队列为空 —— 当前页无需预加载的卡片</div>
            ) : (
                <ul className="jhs-pqp-list">
                    {rows.map((row) => (
                        <li className="jhs-pqp-row" data-key={row.key} key={row.key}>
                            <span className={`jhs-pqp-status jhs-pqp-st-${row.status}`}>
                                {PRELOAD_TASK_STATUS_TEXT[row.status]}
                            </span>
                            <span className="jhs-pqp-car">{row.carNum}</span>
                            <span className="jhs-pqp-site">{row.siteLabel}</span>
                            <span className="jhs-pqp-row-actions">
                                {row.inQueue && !row.running ? (
                                    <button
                                        type="button"
                                        className="jhs-pqp-btn"
                                        data-act="prioritize"
                                        data-key={row.key}
                                    >
                                        置顶
                                    </button>
                                ) : null}
                                {row.inQueue ? (
                                    <button
                                        type="button"
                                        className="jhs-pqp-btn"
                                        data-act="cancel"
                                        data-key={row.key}
                                    >
                                        取消
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            className="jhs-pqp-btn"
                                            data-act="retry"
                                            data-key={row.key}
                                        >
                                            重试
                                        </button>
                                        <button
                                            type="button"
                                            className="jhs-pqp-btn"
                                            data-act="remove"
                                            data-key={row.key}
                                        >
                                            移除
                                        </button>
                                    </>
                                )}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
