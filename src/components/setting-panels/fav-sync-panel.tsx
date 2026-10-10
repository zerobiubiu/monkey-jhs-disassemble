/**
 * FavSyncPanel —— 独立「收藏同步」设置面板（doc/214）。
 *
 * 从清单管理器中拆出，作为独立侧栏页。支持：
 * - 双向增量同步（JHS↔JavDB 想看/已看）
 * - 5 万+ 条目级别：分页抓取 + 断点续接 + 后台处理
 * - 进度条 + 阶段描述 + 结果报告（冲突/失败/跳过）
 */
import { SettingButton } from '../setting/setting-button';
import { SettingInput } from '../setting/setting-input';
import { SettingRow } from '../setting/setting-row';
import { SettingSection } from '../setting/setting-section';

/** FavSyncPanel 的属性。 */
export interface FavSyncPanelProps {
    /** 当前激活面板名，控制面板 display。 */
    panelName: string;
}

/**
 * 渲染收藏同步面板 JSX。
 * @returns 面板 JSX，经 jsxToString 转 HTML 字符串后供 SettingDialog 消费。
 */
export function FavSyncPanel({ panelName }: FavSyncPanelProps) {
    return (
        <div
            id="fav-sync-panel"
            className="content-panel" role="tabpanel" aria-labelledby="tab-fav-sync-panel" 
            style={{ display: panelName === 'fav-sync-panel' ? 'block' : 'none', overflowY: 'auto', height: '100%' }}
        >
            <SettingSection title="双向增量同步" icon="🔄">
                <p style={{ margin: '0 0 12px 0', color: '#6c757d', fontSize: '13px', lineHeight: '1.6' }}>
                    双向增量同步「想看」和「已看」：脚本有/网站无 → 补到网站；网站有/脚本无 → 补到脚本。
                    冲突（双方状态不一致）仅报告番号，不自动处理。
                    <br />
                    支持 5 万+ 条目：分页抓取、断点续接、后台处理。关闭弹窗不中断同步，重新打开自动恢复进度。
                    <br />
                    <span style={{ color: '#dc2626' }}>建议先备份数据。</span>
                </p>
                <SettingRow
                    label="同步请求间隔(毫秒):"
                    tooltip="逐个操作时的请求间隔；越大越温和、越慢（建议 300-1000）"
                >
                    <SettingInput id="favSyncInterval" type="number" min="100" max="5000" />
                </SettingRow>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '12px', flexWrap: 'wrap' }}>
                    <SettingButton id="fav-sync-start-btn" color="primary">
                        开始同步
                    </SettingButton>
                    <SettingButton id="fav-sync-resume-btn" color="mint">
                        继续同步
                    </SettingButton>
                    <SettingButton id="fav-sync-pause-btn" color="pink">
                        暂停
                    </SettingButton>
                    <SettingButton id="fav-sync-reset-btn" color="danger">
                        重置
                    </SettingButton>
                </div>
            </SettingSection>

            <SettingSection title="同步进度" icon="📊">
                {/* 进度条 */}
                <div style={{ marginBottom: '12px' }}>
                    <div
                        style={{
                            height: '8px',
                            borderRadius: '4px',
                            background: '#e2e8f0',
                            overflow: 'hidden'
                        }}
                    >
                        <div
                            id="fav-sync-progress-bar"
                            style={{
                                height: '100%',
                                width: '0%',
                                borderRadius: '4px',
                                background: '#48c774',
                                // 进度由 refreshUi 的 $bar.css({ width }) 驱动，宽度过渡是必要的；
                                // 改 transform: scaleX 会同时缩放 4px 圆角，破坏进度条形态。
                                transition: 'width 0.3s ease'
                            }}
                        />
                    </div>
                    <div
                        id="fav-sync-phase"
                        style={{ fontSize: '13px', color: '#6c757d', marginTop: '6px' }}
                    >
                        就绪
                    </div>
                </div>
                {/* 统计 */}
                <div
                    id="fav-sync-stats"
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: '8px',
                        fontSize: '13px',
                        marginBottom: '12px'
                    }}
                >
                    <div style={{ textAlign: 'center', padding: '8px', background: '#f0fdf4', borderRadius: '6px' }}>
                        <div id="fav-sync-stat-synced" style={{ fontSize: '18px', fontWeight: 700, color: '#16a34a' }}>0</div>
                        <div style={{ color: '#6c757d' }}>成功</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '8px', background: '#fef2f2', borderRadius: '6px' }}>
                        <div id="fav-sync-stat-failed" style={{ fontSize: '18px', fontWeight: 700, color: '#dc2626' }}>0</div>
                        <div style={{ color: '#6c757d' }}>失败</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '8px', background: '#f8fafc', borderRadius: '6px' }}>
                        <div id="fav-sync-stat-skipped" style={{ fontSize: '18px', fontWeight: 700, color: '#6b7280' }}>0</div>
                        <div style={{ color: '#6c757d' }}>跳过</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '8px', background: '#fffbeb', borderRadius: '6px' }}>
                        <div id="fav-sync-stat-conflicts" style={{ fontSize: '18px', fontWeight: 700, color: '#d97706' }}>0</div>
                        <div style={{ color: '#6c757d' }}>冲突</div>
                    </div>
                </div>
                {/* 详细报告 */}
                <div
                    id="fav-sync-report"
                    style={{
                        fontSize: '12px',
                        color: '#374151',
                        whiteSpace: 'pre-wrap',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        padding: '10px',
                        background: '#f9fafb',
                        borderRadius: '6px',
                        border: '1px solid #e5e7eb',
                        display: 'none'
                    }}
                />
            </SettingSection>
        </div>
    );
}
