/**
 * JHS ↔ JavDB 双向同步 —— UI 编排与入口（doc/213）。
 *
 * 提供清单管理器「双向同步」按钮的点击处理、进度展示、中止、
 * 以及各方向独立按钮的兼容入口（原 doc/210 单向按钮保留）。
 */
import type { FullSyncResult, SyncResult } from './sync-common';
import { ensureJavdbSite } from './sync-common';
import { syncWantFromJavdb, syncWatchedFromJavdb } from './sync-from-javdb';
import { syncWantToJavdb, syncWatchedToJavdb } from './sync-to-javdb';

/** 模块级中止信号（供中止按钮置位）。 */
let syncSignal: { aborted: boolean } = { aborted: false };

/** 格式化单个方向结果为文本。 */
function formatResult(r: SyncResult): string {
    let s = `【${r.direction}】成功 ${r.synced}，跳过 ${r.skipped}，失败 ${r.failed}`;
    if (r.conflicts.length > 0) s += `，冲突 ${r.conflicts.length}`;
    if (r.syncedList.length > 0) s += `\n  已同步：${r.syncedList.join('、')}`;
    if (r.conflicts.length > 0) {
        s += '\n  ⚠ 冲突（需手动处理）：' + r.conflicts.map((c) => `${c.carNum}(脚本${c.jhsStatus}/网站${c.javdbStatus})`).join('、');
    }
    if (r.failedList.length > 0) s += `\n  ✗ 失败：${r.failedList.join('、')}`;
    return s;
}

/** 格式化全量结果。 */
function formatFullResult(result: FullSyncResult): string {
    const parts = result.results.map(formatResult);
    const header = result.aborted ? '【已中止】部分同步结果：' : '双向同步完成：';
    return header + '\n' + parts.join('\n\n');
}

/** 执行全量双向同步（四个方向顺序执行）。 */
async function runFullSync(): Promise<void> {
    const $status = $('#jhs-sync-status');
    const $btn = $('#jhs-sync-full-btn');
    const $abortWrap = $('#jhs-sync-abort-wrap');
    syncSignal = { aborted: false };
    $btn.css({ 'pointer-events': 'none', opacity: '0.6' });
    $abortWrap.show();
    const interval = Number($('#jhsSyncInterval').val()) || 500;
    const opts = { interval, signal: syncSignal, onProgress: (msg: string) => $status.text(msg) };

    try {
        const results: SyncResult[] = [];

        $status.text('=== 阶段 1/4：JHS→JavDB 想看 ===');
        results.push(await syncWantToJavdb(opts));
        if (syncSignal.aborted) { showFullResult($status, results, true); return; }

        $status.text('=== 阶段 2/4：JHS→JavDB 已看 ===');
        results.push(await syncWatchedToJavdb(opts));
        if (syncSignal.aborted) { showFullResult($status, results, true); return; }

        $status.text('=== 阶段 3/4：JavDB→JHS 想看 ===');
        results.push(await syncWantFromJavdb(opts));
        if (syncSignal.aborted) { showFullResult($status, results, true); return; }

        $status.text('=== 阶段 4/4：JavDB→JHS 已看 ===');
        results.push(await syncWatchedFromJavdb(opts));

        showFullResult($status, results, syncSignal.aborted);
    } catch (err) {
        $status.text('同步出错：' + (err instanceof Error ? err.message : String(err)));
    } finally {
        $btn.css({ 'pointer-events': '', opacity: '' });
        $abortWrap.hide();
    }
}

/** 将结果渲染到状态区。 */
function showFullResult($status: JQuery, results: SyncResult[], aborted: boolean): void {
    $status.text(formatFullResult({ results, aborted }));
}

/** 清单管理器「双向同步」按钮点击处理。 */
export function handleFullSyncClick(): void {
    if (!ensureJavdbSite()) return;
    utils.q(
        null,
        '确定执行双向增量同步？<br>' +
            '将按顺序执行：JHS→JavDB 想看、JHS→JavDB 已看、JavDB→JHS 想看、JavDB→JHS 已看。<br>' +
            '冲突（双方状态不一致）仅报告不自动处理。<br>' +
            '<span style="color:#f40">建议先备份数据。</span>',
        () => {
            void runFullSync();
        }
    );
}

/** 原 doc/210 单向同步兼容入口（仅 JHS 想看→JavDB）。 */
export function handleJhsSyncClick(): void {
    if (!ensureJavdbSite()) return;
    utils.q(
        null,
        '确定将「JHS 已收藏但 JavDB 无状态」的番号批量同步为 JavDB 想看？<br>' +
            '会先核对 JavDB 想看/已看列表：已想看跳过，JavDB 已看跳过并列出（绝不降级）。<br>' +
            '<span style="color:#f40">建议先备份数据。</span>',
        () => {
            void runSingleSync();
        }
    );
}

/** 执行单向同步（兼容原 doc/210 按钮）。 */
async function runSingleSync(): Promise<void> {
    const $status = $('#jhs-sync-status');
    const $btn = $('#jhs-sync-btn');
    const $abortWrap = $('#jhs-sync-abort-wrap');
    syncSignal = { aborted: false };
    $btn.css({ 'pointer-events': 'none', opacity: '0.6' });
    $abortWrap.show();
    const interval = Number($('#jhsSyncInterval').val()) || 500;
    try {
        const result = await syncWantToJavdb({
            interval,
            signal: syncSignal,
            onProgress: (msg) => $status.text(msg)
        });
        $status.text(formatResult(result));
    } catch (err) {
        $status.text('同步出错：' + (err instanceof Error ? err.message : String(err)));
    } finally {
        $btn.css({ 'pointer-events': '', opacity: '' });
        $abortWrap.hide();
    }
}

/** 中止按钮：置位中止信号。 */
export function abortSync(): void {
    syncSignal.aborted = true;
}
