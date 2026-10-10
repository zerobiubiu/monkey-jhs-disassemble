/**
 * ReviewConflictDialog —— 评价状态冲突选择弹窗（React 函数组件，JSX，doc/235）。
 *
 * 打开影片详情页自动校验同步时，若脚本记录与 JavDB 服务器状态均有数据但不一致
 * （如脚本已看 2 星 vs 服务器已看 4 星、脚本收藏 vs 服务器已看），弹出本弹窗让
 * 用户选择以哪一侧为准：
 * - 使用脚本记录（data-conflict-choice="local"）：按脚本记录推送/覆盖 JavDB
 * - 使用网站数据（data-conflict-choice="server"）：按服务器状态覆盖脚本本地记录
 * - 取消（data-conflict-choice="cancel"）：本次不处理
 *
 * 按钮事件由 dpb-review-sync.ts 的 confirmReviewConflict 在 layer.open success
 * 回调中绑定（data-conflict-choice 契约），本组件只产出 DOM 结构与文案。
 */

/** ReviewConflictDialog 的属性。 */
export interface ReviewConflictDialogProps {
    /** 番号（如 "MIDV-700"）。 */
    carNum: string;
    /** 脚本记录描述（如 "🔍 已看 2 星"）。 */
    localDesc: string;
    /** 服务器状态描述（如 "🔍 已看 4 星"）。 */
    serverDesc: string;
}

/**
 * 渲染冲突选择弹窗 JSX。
 * @param props.carNum 番号
 * @param props.localDesc 脚本记录描述
 * @param props.serverDesc 服务器状态描述
 * @returns 弹窗 JSX，经 jsxToString 转 HTML 字符串后供 layer.open type:1 消费。
 */
export function ReviewConflictDialog({ carNum, localDesc, serverDesc }: ReviewConflictDialogProps) {
    return (
        <div style={{ padding: '8px 4px 4px', fontSize: '14px', lineHeight: '1.8' }}>
            <p style={{ margin: '0 0 10px' }}>
                「{carNum}」的脚本记录与 JavDB 状态不一致，请选择以哪一侧为准：
            </p>
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '12px',
                    marginBottom: '8px'
                }}
            >
                <span style={{ color: '#6c757d' }}>脚本记录：</span>
                <strong>{localDesc}</strong>
            </div>
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '12px',
                    marginBottom: '14px'
                }}
            >
                <span style={{ color: '#6c757d' }}>网站数据：</span>
                <strong>{serverDesc}</strong>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                    type="button"
                    data-conflict-choice="local"
                    style={{
                        padding: '6px 14px',
                        border: '1px solid #2e8ded',
                        borderRadius: '3px',
                        background: '#2e8ded',
                        color: '#fff',
                        cursor: 'pointer'
                    }}
                >
                    使用脚本记录
                </button>
                <button
                    type="button"
                    data-conflict-choice="server"
                    style={{
                        padding: '6px 14px',
                        border: '1px solid #48c774',
                        borderRadius: '3px',
                        background: '#48c774',
                        color: '#fff',
                        cursor: 'pointer'
                    }}
                >
                    使用网站数据
                </button>
                <button
                    type="button"
                    data-conflict-choice="cancel"
                    style={{
                        padding: '6px 14px',
                        border: '1px solid #dedede',
                        borderRadius: '3px',
                        background: '#f1f1f1',
                        color: '#333',
                        cursor: 'pointer'
                    }}
                >
                    取消
                </button>
            </div>
            <p style={{ margin: '12px 0 0', fontSize: '12px', color: 'var(--jhs-color-text-secondary)' }}>
                选择后立即同步；冲突未处理前不会自动覆盖任一侧数据。
            </p>
        </div>
    );
}