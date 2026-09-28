/**
 * OpSyncTable —— 操作同步记录表格（React 函数组件 + `renderOpSyncHtml` 便捷辅助）。
 *
 * 供设置面板「视频操作同步状态」展示与刷新：每行 = 一条（番号 × 操作）记录，
 * 同时给出**插件侧状态值**（本地写入的操作行为）与**网站侧同步状态**。
 *
 * 说明：组件只负责展示，不发起任何同步；重试/取消由设置面板的事件绑定调用
 * `list-page/lp-batch-sync.ts` 暴露的操作（doc/38）。
 */

import { jsxToString } from '../../core/jsx-to-string';

import type { OpSyncRecord, OpSyncKind, OpSyncState } from '../../plugins/setting/jhs-sync/op-sync-records';

/** OpSyncTable 的属性。 */
export interface OpSyncTableProps {
    /** 已按「最近更新倒序」排好的记录。 */
    rows: OpSyncRecord[];
    /** 仍在内存队列中的记录键集合（`番号::操作`），用于区分「排队中」与「已中断」。 */
    queuedKeys?: readonly string[];
}

/** 记录键（与存储层一致）。 */
function keyOf(carNum: string, kind: OpSyncKind): string {
    return `${carNum}::${kind}`;
}

/** 描述插件侧状态值（本地已写入的操作行为）。 */
function describeLocal(record: OpSyncRecord): string {
    switch (record.kind) {
        case 'favorite':
            return '♥ 收藏（想看）';
        case 'watched':
            return record.score > 0 ? `已读 ${record.score}★` : '已读（0 星）';
        case 'unwatch':
            return '取消已读（删评价）';
        case 'filter':
            return '🚫 拉黑（已读 0 星）';
        default:
            return record.kind;
    }
}

/** 描述网站侧同步状态。 */
function describeSite(record: OpSyncRecord, queued: boolean): string {
    switch (record.state) {
        case 'pending':
            return queued ? '待推送（排队中）' : '待推送（已中断）';
        case 'running':
            return '推送中…';
        case 'success':
            return '✅ 已同步';
        case 'failed':
            return record.error ? `❌ 失败：${record.error}` : '❌ 失败';
        case 'cancelled':
            return '⏹ 已取消';
        default:
            return record.state;
    }
}

/** 状态对应的行样式类（颜色 + 符号双重表态）。 */
function stateClass(state: OpSyncState): string {
    return `op-sync-row op-sync-row--${state}`;
}

/**
 * 渲染操作同步记录表格。
 * @param props.rows 记录（已排序）
 * @param props.queuedKeys 仍在队列中的键集合
 * @returns 表格 JSX
 */
export function OpSyncTable({ rows, queuedKeys = [] }: OpSyncTableProps) {
    if (rows.length === 0) {
        return (
            <p className="op-sync-empty">
                暂无同步记录 —— 列表页批量操作或详情页操作执行后会在此登记。
            </p>
        );
    }
    const queued = new Set(queuedKeys);
    return (
        <table className="op-sync-table">
            <thead>
                <tr>
                    <th scope="col">番号</th>
                    <th scope="col">插件侧状态</th>
                    <th scope="col">网站同步状态</th>
                    <th scope="col">尝试</th>
                    <th scope="col">更新时间</th>
                    <th scope="col">操作</th>
                </tr>
            </thead>
            <tbody>
                {rows.map((record) => (
                    <tr
                        key={keyOf(record.carNum, record.kind)}
                        className={stateClass(record.state)}
                        data-carnum={record.carNum}
                        data-kind={record.kind}
                    >
                        <td className="op-sync-carnum">{record.carNum}</td>
                        <td>{describeLocal(record)}</td>
                        <td className="op-sync-site">
                            {describeSite(record, queued.has(keyOf(record.carNum, record.kind)))}
                        </td>
                        <td>{record.attempts}</td>
                        <td>{new Date(record.updatedAt).toLocaleString()}</td>
                        <td className="op-sync-ops">
                            <button
                                type="button"
                                className="jhs-btn jhs-btn--ghost op-sync-action"
                                data-act="retry"
                                title="重新入队推送该操作到网站"
                            >
                                ↻ 重试
                            </button>
                            <button
                                type="button"
                                className="jhs-btn jhs-btn--ghost op-sync-action"
                                data-act="cancel"
                                title="取消该条同步记录（不回滚本地状态）"
                            >
                                ✕ 取消
                            </button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

/** 记录表格 HTML（`.ts` 调用方便捷辅助）。 */
export function renderOpSyncHtml(rows: OpSyncRecord[], queuedKeys: readonly string[] = []): string {
    return jsxToString(<OpSyncTable rows={rows} queuedKeys={queuedKeys} />);
}

/**
 * 状态摘要 HTML（面板顶部一行）。
 *
 * @param summary 各状态计数
 * @returns 摘要文本 HTML 片段
 */
export function renderOpSyncSummaryHtml(summary: Record<OpSyncState, number>): string {
    const parts = [
        `待推送 ${summary.pending}`,
        `推送中 ${summary.running}`,
        `已同步 ${summary.success}`,
        `失败 ${summary.failed}`,
        `已取消 ${summary.cancelled}`
    ];
    return parts.join(' · ');
}