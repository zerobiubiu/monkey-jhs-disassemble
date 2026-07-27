/**
 * 收藏同步面板事件绑定与 UI 刷新（doc/214）。
 *
 * 将面板按钮（开始/继续/暂停/重置）连接到 sync-engine，
 * 并订阅引擎状态变更实时刷新进度条、统计、报告。
 */

import { isJavdbSite } from '../../../constants/site';

import {
    getPhaseLabel,
    getProgress,
    hasResumableSession,
    isRunning,
    onSyncChange,
    pauseSync,
    resetSync,
    resumeSync,
    startSync
} from './sync-engine';
import type { SyncSession } from './sync-session';

/** 是否已绑定（防重复绑定）。 */
let bound = false;

/** 刷新面板 UI 状态。 */
function refreshUi(session: SyncSession): void {
    const progress = getProgress();
    const $bar = $('#fav-sync-progress-bar');
    const $phase = $('#fav-sync-phase');
    const $report = $('#fav-sync-report');

    // 进度条
    if (progress >= 0) {
        $bar.css({ width: `${progress}%`, background: '#48c774' });
    } else {
        $bar.css({ width: '100%', background: '#f14668' });
    }

    // 阶段描述
    $phase.text(getPhaseLabel());

    // 统计
    $('#fav-sync-stat-synced').text(String(session.synced));
    $('#fav-sync-stat-failed').text(String(session.failed.length));
    $('#fav-sync-stat-skipped').text(String(session.skipped));
    $('#fav-sync-stat-conflicts').text(String(session.conflicts.length));

    // 报告（完成/有冲突/有失败时显示）
    const hasReport = session.conflicts.length > 0 || session.failed.length > 0 || session.phase === 'done';
    if (hasReport) {
        let text = '';
        if (session.conflicts.length > 0) {
            text += '⚠ 冲突（需手动处理）：\n';
            text += session.conflicts.map((c) => `  ${c.carNum}（脚本${c.jhsStatus} / 网站${c.javdbStatus}）`).join('\n');
            text += '\n\n';
        }
        if (session.failed.length > 0) {
            text += '✗ 失败：\n';
            text += session.failed.map((f) => `  ${f}`).join('\n');
            text += '\n\n';
        }
        if (session.phase === 'done') {
            text += `✓ 同步完成：成功 ${session.synced}，失败 ${session.failed.length}，跳过 ${session.skipped}，冲突 ${session.conflicts.length}`;
        }
        $report.text(text).show();
    } else {
        $report.hide();
    }

    // 按钮状态
    const running = isRunning();
    $('#fav-sync-start-btn').css({ 'pointer-events': running ? 'none' : '', opacity: running ? '0.5' : '' });
    $('#fav-sync-resume-btn').css({
        'pointer-events': running || !hasResumableSession() ? 'none' : '',
        opacity: running || !hasResumableSession() ? '0.5' : ''
    });
    $('#fav-sync-pause-btn').css({ 'pointer-events': running ? '' : 'none', opacity: running ? '' : '0.5' });
}

/** 绑定收藏同步面板按钮事件（仅首次调用生效）。 */
export function bindFavSyncPanel(): void {
    if (bound) return;
    bound = true;

    // 订阅引擎状态变更
    onSyncChange((session) => refreshUi(session));

    // 开始同步
    $('#fav-sync-start-btn').on('click', () => {
        if (!isJavdbSite) {
            show.error('请在 JavDB 站点下执行此同步');
            return;
        }
        utils.q(
            null,
            '确定开始双向增量同步？<br>' +
                '将分页抓取 JavDB 想看/已看列表，对比后增量同步。<br>' +
                '支持暂停/继续，关闭弹窗不中断。<br>' +
                '<span style="color:#f40">建议先备份数据。</span>',
            () => {
                const interval = Number($('#favSyncInterval').val()) || 500;
                startSync(interval);
            }
        );
    });

    // 继续同步（断点续接）
    $('#fav-sync-resume-btn').on('click', () => {
        if (!isJavdbSite) {
            show.error('请在 JavDB 站点下执行此同步');
            return;
        }
        const interval = Number($('#favSyncInterval').val()) || 500;
        if (!resumeSync(interval)) {
            show.error('没有可恢复的同步会话');
        }
    });

    // 暂停
    $('#fav-sync-pause-btn').on('click', () => {
        pauseSync();
        show.ok('同步已暂停，可稍后继续');
    });

    // 重置
    $('#fav-sync-reset-btn').on('click', () => {
        utils.q(null, '确定重置同步？将清除所有进度和会话数据。', () => {
            resetSync();
            $('#fav-sync-report').hide();
            show.ok('同步已重置');
        });
    });

    // 初始化 UI 状态（如果有未完成会话则显示）
    const resumable = hasResumableSession();
    if (resumable) {
        resumeSync(Number($('#favSyncInterval').val()) || 500);
        // 立即暂停（仅恢复状态显示，不自动执行）
        pauseSync();
    }
}
