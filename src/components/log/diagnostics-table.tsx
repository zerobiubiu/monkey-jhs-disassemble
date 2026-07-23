/**
 * DiagnosticsTable —— 插件诊断表格（React 函数组件，JSX）。
 *
 * 数据源：PluginManager.getDiagnostics().plugins（PluginDiagnostic[]），
 * 聚合 CSS/handle 两阶段状态、耗时、错误信息、页面类型/站点声明与
 * feature flag 门控信息（main.tsx 条件注册时经 register 第二参记录）。
 *
 * 布局：顶部汇总区（.jhs-setting-section 风格：总计/CSS 成功数/Handle
 * 成功数/总耗时 + 失败/跳过/Flag 门控计数）+ 明细表格（九列：#/插件名/
 * 页面类型/站点/CSS/Handle/耗时/错误信息/Flag）。排序：失败插件置顶，
 * 其余按总耗时降序（缺失耗时视为 0）。
 *
 * 样式全部内联（style 对象经 jsxToString 的 styleToCss 输出紧凑 CSS）：
 * 诊断面板与 layer 弹窗共享本组件，内联保证两处渲染一致且不依赖
 * setting-plugin.css 的加载时序；徽章/耗时分级/失败行高亮/错误截断
 * （ellipsis + title 全文 tooltip）均以行内声明表达。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 layer.open content /
 * 设置面板消费时，需先用 `jsxToString`（来自 ../core/jsx-to-string，轻量
 * JSX→HTML 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `jsxToString(<DiagnosticsTable data={pluginManager.getDiagnostics().plugins} />)`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。
 */
import type { CSSProperties } from 'react';

import type { PluginDiagnostic } from '../../plugins/plugin-manager';

/** 状态徽章基础样式（圆角小标签）。 */
const BADGE_BASE: CSSProperties = {
    display: 'inline-block',
    padding: '1px 6px',
    borderRadius: '3px',
    fontSize: '11px',
    lineHeight: '16px',
    margin: '1px',
    whiteSpace: 'nowrap'
};

/** 徽章配色：fulfilled→绿 / rejected→红 / skipped→灰 / 页面类型→靛 / 站点→琥珀 / flag→品红。 */
const BADGE_COLORS: Record<'ok' | 'fail' | 'skip' | 'page' | 'site' | 'flag', CSSProperties> = {
    ok: { background: '#dcfce7', color: '#166534' },
    fail: { background: '#fee2e2', color: '#991b1b' },
    skip: { background: '#f1f5f9', color: '#64748b' },
    page: { background: '#e0e7ff', color: '#3730a3' },
    site: { background: '#fef3c7', color: '#92400e' },
    flag: { background: '#fce7f3', color: '#9d174d' }
};

/** 耗时分级配色：<100ms 绿 / 100–500ms 黄 / >500ms 红。 */
const TIME_COLORS = { fast: '#16a34a', medium: '#ca8a04', slow: '#dc2626' } as const;

/** 汇总区统计数值（由 plugins 数组一次归约）。 */
interface DiagSummary {
    total: number;
    cssOk: number;
    handleOk: number;
    failed: number;
    skipped: number;
    flagged: number;
    totalMs: number;
}

/** 归约汇总统计：总计/CSS 成功/Handle 成功/失败/跳过/Flag 门控/总耗时。 */
function summarize(plugins: PluginDiagnostic[]): DiagSummary {
    return {
        total: plugins.length,
        cssOk: plugins.filter((p) => p.cssStatus === 'fulfilled').length,
        handleOk: plugins.filter((p) => p.handleStatus === 'fulfilled').length,
        failed: plugins.filter((p) => p.cssStatus === 'rejected' || p.handleStatus === 'rejected').length,
        skipped: plugins.filter((p) => p.cssStatus === 'skipped' && p.handleStatus === 'skipped').length,
        flagged: plugins.filter((p) => p.isFeatureFlagged).length,
        totalMs: plugins.reduce((sum, p) => sum + (p.totalDurationMs ?? 0), 0)
    };
}

/** 排序：失败插件置顶，其余按总耗时降序（缺失耗时视为 0）。 */
function sortRows(plugins: PluginDiagnostic[]): PluginDiagnostic[] {
    const isFailed = (p: PluginDiagnostic): boolean => p.cssStatus === 'rejected' || p.handleStatus === 'rejected';
    return [...plugins].sort((a, b) => {
        const failDiff = Number(isFailed(b)) - Number(isFailed(a));
        if (failDiff !== 0) return failDiff;
        return (b.totalDurationMs ?? 0) - (a.totalDurationMs ?? 0);
    });
}

/** 阶段状态徽章（✅/❌/⏭ + 阶段耗时）。 */
function StatusBadge({ status, durationMs }: { status: PluginDiagnostic['cssStatus']; durationMs: number | null }) {
    const tone = status === 'fulfilled' ? 'ok' : status === 'rejected' ? 'fail' : 'skip';
    const icon = status === 'fulfilled' ? '✅' : status === 'rejected' ? '❌' : '⏭';
    return (
        <span style={{ ...BADGE_BASE, ...BADGE_COLORS[tone] }}>
            {icon} {durationMs != null ? `${durationMs}ms` : status === 'skipped' ? '跳过' : '-'}
        </span>
    );
}

/** 耗时单元格：等宽字体 + 分级配色（绿 <100ms / 黄 100–500ms / 红 >500ms）。 */
function DurationCell({ ms }: { ms: number | null }) {
    if (ms == null) {
        return <span style={{ color: '#94a3b8', fontSize: '11px' }}>-</span>;
    }
    const color = ms < 100 ? TIME_COLORS.fast : ms <= 500 ? TIME_COLORS.medium : TIME_COLORS.slow;
    return <span style={{ fontFamily: 'monospace', fontSize: '11px', color }}>{ms}ms</span>;
}

/** 徽章列表单元格：空声明显示「全部」灰字。 */
function BadgeListCell({ values, tone }: { values: string[]; tone: 'page' | 'site' }) {
    if (values.length === 0) {
        return <span style={{ color: '#94a3b8', fontSize: '11px' }}>全部</span>;
    }
    return (
        <>
            {values.map((value) => (
                <span key={value} style={{ ...BADGE_BASE, ...BADGE_COLORS[tone] }}>
                    {value}
                </span>
            ))}
        </>
    );
}

/** DiagnosticsTable 的属性。 */
export interface DiagnosticsTableProps {
    /** 逐插件聚合诊断条目（PluginManager.getDiagnostics().plugins）。 */
    data: PluginDiagnostic[];
}

/**
 * 渲染插件诊断报告（汇总区 + 明细表格）的 JSX。
 * @param props.data 逐插件聚合诊断条目数组
 * @returns 诊断报告 JSX，经 jsxToString 转 HTML 字符串后供
 *          `layer.open content` / 设置面板消费。
 */
export function DiagnosticsTable({ data }: DiagnosticsTableProps) {
    const summary = summarize(data);
    const rows = sortRows(data);
    const th: CSSProperties = {
        padding: '8px 6px',
        textAlign: 'left',
        fontWeight: 600,
        borderBottom: '2px solid #e2e8f0',
        background: '#f1f5f9',
        whiteSpace: 'nowrap'
    };
    const td: CSSProperties = { padding: '6px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' };
    return (
        <div style={{ fontSize: '13px' }}>
            <div
                className="jhs-diag-summary"
                style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    marginBottom: '12px',
                    lineHeight: 1.8
                }}
            >
                <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>📊 插件诊断报告</div>
                <div>
                    总计: <b>{summary.total}</b> 个插件 | ✅ CSS: {summary.cssOk}/{summary.total} | ✅ Handle:{' '}
                    {summary.handleOk}/{summary.total} | ⏱ 总耗时: <b>{summary.totalMs}ms</b>
                </div>
                <div>
                    <span style={{ color: summary.failed > 0 ? '#dc2626' : '#64748b' }}>❌ 失败: {summary.failed} 个插件</span>{' '}
                    | ⏭ 跳过: {summary.skipped} 个插件 | 🚩 Feature Flag: {summary.flagged} 个
                </div>
            </div>
            <table className="jhs-diag-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                    <tr>
                        <th style={th}>#</th>
                        <th style={th}>插件名</th>
                        <th style={th}>页面类型</th>
                        <th style={th}>站点</th>
                        <th style={th}>CSS</th>
                        <th style={th}>Handle</th>
                        <th style={th}>耗时</th>
                        <th style={th}>错误信息</th>
                        <th style={th}>Flag</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((p, index) => {
                        const failed = p.cssStatus === 'rejected' || p.handleStatus === 'rejected';
                        const error = p.cssError ?? p.handleError;
                        return (
                            <tr
                                key={p.name}
                                className={failed ? 'jhs-diag-failed' : undefined}
                                style={failed ? { background: 'rgba(239,68,68,0.04)' } : undefined}
                            >
                                <td style={{ ...td, color: '#94a3b8' }}>{index + 1}</td>
                                <td style={{ ...td, fontWeight: failed ? 600 : 400 }}>{p.name}</td>
                                <td style={td}>
                                    <BadgeListCell values={p.pageTypes} tone="page" />
                                </td>
                                <td style={td}>
                                    <BadgeListCell values={p.sites} tone="site" />
                                </td>
                                <td style={td}>
                                    <StatusBadge status={p.cssStatus} durationMs={p.cssDurationMs} />
                                </td>
                                <td style={td}>
                                    <StatusBadge status={p.handleStatus} durationMs={p.handleDurationMs} />
                                </td>
                                <td style={td}>
                                    <DurationCell ms={p.totalDurationMs} />
                                </td>
                                <td style={td}>
                                    {error ? (
                                        <span
                                            className="jhs-diag-error"
                                            title={error}
                                            style={{
                                                color: '#dc2626',
                                                fontSize: '11px',
                                                display: 'inline-block',
                                                maxWidth: '200px',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                verticalAlign: 'bottom'
                                            }}
                                        >
                                            {error.length > 60 ? `${error.slice(0, 60)}…` : error}
                                        </span>
                                    ) : (
                                        <span style={{ color: '#94a3b8', fontSize: '11px' }}>-</span>
                                    )}
                                </td>
                                <td style={td}>
                                    {p.isFeatureFlagged ? (
                                        <span style={{ ...BADGE_BASE, ...BADGE_COLORS.flag }}>🚩 {p.featureFlagName}</span>
                                    ) : null}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
