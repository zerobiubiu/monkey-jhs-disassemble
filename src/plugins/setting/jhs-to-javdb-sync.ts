/**
 * JHS 收藏 → JavDB 想看 批量同步（doc/210）。
 *
 * 修复 doc/208/209 之前自动收藏只写 JHS IDB、JavDB 端触发失败造成的积压：
 * 将「JHS 已收藏（FAVORITE_ACTION）但 JavDB 无状态」的番号批量设为 JavDB「想看」。
 *
 * 安全策略（D2/D5）：先拉 JavDB「想看」「已看」列表，已想看跳过、JavDB 已看跳过并列出
 * （绝不把已看降级为想看），其余逐个 POST /v/{id}/reviews/want_to_watch（限速 D4）。
 * 入口为清单管理器「同步 JHS 收藏到 JavDB」按钮（handleJhsSyncClick）。
 */
import { isJavdbSite } from '../../constants/site';
import { FAVORITE_ACTION } from '../../constants/status';

/** 抓取 want/watched 列表的最大页数保护。 */
const SYNC_PAGE_LIMIT = 200;

/** 同步中止信号（模块级，供中止按钮置位）。 */
let jhsSyncSignal: { aborted: boolean } = { aborted: false };

/** 读取 CSRF token（meta[name=csrf-token]）。 */
function getCsrfToken(): string | null {
    const meta = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null;
    return meta ? meta.content : null;
}

/** 从番号记录的 url 提取 JavDB videoId（/v/{id}）。 */
function extractVideoId(url: string | undefined): string | null {
    if (!url) return null;
    const m = url.match(/\/v\/([^/?#]+)/);
    return m ? m[1] : null;
}

/** 同源抓取页面 HTML。 */
async function fetchPageHtml(url: string): Promise<string> {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
}

/** 抓取 /users/want_watch_videos 或 /users/watched_videos 全部页的 videoId 集合。 */
async function fetchVideoIdSet(startPath: string): Promise<Set<string>> {
    const ids = new Set<string>();
    let url: string | null = startPath;
    const visited = new Set<string>();
    for (let page = 0; url && page < SYNC_PAGE_LIMIT; page++) {
        const absUrl = new URL(url, window.location.origin).href;
        if (visited.has(absUrl)) break;
        visited.add(absUrl);
        const html = await fetchPageHtml(absUrl);
        const doc = new DOMParser().parseFromString(html, 'text/html');
        doc.querySelectorAll('.movie-list .item a[href*="/v/"]').forEach((a) => {
            const m = (a.getAttribute('href') || '').match(/\/v\/([^/?#]+)/);
            if (m) ids.add(m[1]);
        });
        const next = doc.querySelector('a.pagination-next');
        url = next ? next.getAttribute('href') : null;
    }
    return ids;
}

/** 将单个影片设为 JavDB 想看（POST /v/{id}/reviews/want_to_watch）。 */
async function postWantToWatch(videoId: string): Promise<void> {
    const token = getCsrfToken();
    if (!token) throw new Error('无法获取 CSRF token');
    const res = await fetch(`/v/${videoId}/reviews/want_to_watch`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRF-Token': token
        },
        body: `authenticity_token=${encodeURIComponent(token)}`,
        credentials: 'same-origin'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** 同步结果。 */
export interface JhsSyncResult {
    /** JHS 收藏总数。 */
    totalFavorites: number;
    /** 本次成功设为想看数。 */
    synced: number;
    /** 失败数。 */
    failed: number;
    /** 失败明细（番号+原因）。 */
    failedList: string[];
    /** JavDB 已想看（跳过）数。 */
    alreadyWant: number;
    /** JavDB 已看（跳过，绝不降级）的番号。 */
    conflictWatched: string[];
    /** 是否被中止。 */
    aborted: boolean;
}

/** 同步选项。 */
export interface JhsSyncOptions {
    /** 每步间隔（ms，限速）。 */
    interval: number;
    /** 中止信号。 */
    signal: { aborted: boolean };
    /** 进度回调。 */
    onProgress: (message: string) => void;
}

/**
 * 将 JHS 已收藏但 JavDB 无状态的番号批量同步为 JavDB 想看（D1–D6）。
 * @param options 同步选项
 * @returns 同步结果
 */
export async function syncJhsFavoritesToJavdb(options: JhsSyncOptions): Promise<JhsSyncResult> {
    const { interval, signal, onProgress } = options;
    const result: JhsSyncResult = {
        totalFavorites: 0,
        synced: 0,
        failed: 0,
        failedList: [],
        alreadyWant: 0,
        conflictWatched: [],
        aborted: false
    };

    // 1. 读 JHS 收藏（D1：仅 FAVORITE_ACTION）
    onProgress('正在读取 JHS 收藏记录…');
    const carList = await storageManager.getCarList();
    const jhsFavs: { carNum: string; videoId: string }[] = [];
    for (const car of carList) {
        if (car.status !== FAVORITE_ACTION) continue;
        result.totalFavorites++;
        const videoId = extractVideoId(car.url);
        if (videoId) jhsFavs.push({ carNum: car.carNum, videoId });
    }

    // 2. 拉 JavDB 想看/已看集合（D2 安全检查）
    onProgress('正在获取 JavDB「想看」列表…');
    const wantSet = await fetchVideoIdSet('/users/want_watch_videos');
    if (signal.aborted) {
        result.aborted = true;
        return result;
    }
    onProgress('正在获取 JavDB「已看」列表…');
    const watchedSet = await fetchVideoIdSet('/users/watched_videos');
    if (signal.aborted) {
        result.aborted = true;
        return result;
    }

    // 3. 分类：已想看跳过 / JavDB 已看跳过并记录（D5）/ 其余待同步
    const toSync: { carNum: string; videoId: string }[] = [];
    for (const item of jhsFavs) {
        if (wantSet.has(item.videoId)) result.alreadyWant++;
        else if (watchedSet.has(item.videoId)) result.conflictWatched.push(item.carNum);
        else toSync.push(item);
    }

    // 4. 逐个同步（D4 限速）
    onProgress(
        `待同步 ${toSync.length} 部（已想看跳过 ${result.alreadyWant}，JavDB 已看跳过 ${result.conflictWatched.length}）`
    );
    for (let i = 0; i < toSync.length; i++) {
        if (signal.aborted) {
            result.aborted = true;
            break;
        }
        const { carNum, videoId } = toSync[i];
        onProgress(`同步 ${i + 1}/${toSync.length}：${carNum}`);
        try {
            await postWantToWatch(videoId);
            result.synced++;
        } catch (err) {
            result.failed++;
            result.failedList.push(`${carNum}（${err instanceof Error ? err.message : '失败'}）`);
        }
        if (i + 1 < toSync.length && !signal.aborted) await sleep(interval);
    }

    return result;
}

/** 清单管理器「同步 JHS 收藏到 JavDB」按钮点击处理。 */
export function handleJhsSyncClick(): void {
    if (!isJavdbSite) {
        show.error('请在 JavDB 站点下执行此同步');
        return;
    }
    utils.q(
        null,
        '确定将「JHS 已收藏但 JavDB 无状态」的番号批量同步为 JavDB 想看？<br>' +
            '会先核对 JavDB 想看/已看列表：已想看跳过，JavDB 已看跳过并列出（绝不降级）。<br>' +
            '<span style="color:#f40">建议先备份数据。</span>',
        () => {
            void runJhsSync();
        }
    );
}

/** 执行同步并刷新状态区（供按钮回调）。 */
async function runJhsSync(): Promise<void> {
    const $status = $('#jhs-sync-status');
    const $btn = $('#jhs-sync-btn');
    const $abortWrap = $('#jhs-sync-abort-wrap');
    jhsSyncSignal = { aborted: false };
    $btn.css({ 'pointer-events': 'none', opacity: '0.6' });
    $abortWrap.show();
    const interval = Number($('#jhsSyncInterval').val()) || 500;
    try {
        const result = await syncJhsFavoritesToJavdb({
            interval,
            signal: jhsSyncSignal,
            onProgress: (msg) => $status.text(msg)
        });
        let summary =
            `${result.aborted ? '【已中止】' : '同步完成：'}` +
            `成功 ${result.synced}，失败 ${result.failed}，已想看跳过 ${result.alreadyWant}，` +
            `JavDB 已看跳过 ${result.conflictWatched.length}（JHS 收藏共 ${result.totalFavorites}）`;
        if (result.conflictWatched.length > 0) {
            summary += `\nJavDB 已看（未同步）：${result.conflictWatched.join('、')}`;
        }
        if (result.failedList.length > 0) {
            summary += `\n失败：${result.failedList.join('、')}`;
        }
        $status.text(summary);
    } catch (err) {
        $status.text('同步出错：' + (err instanceof Error ? err.message : String(err)));
    } finally {
        $btn.css({ 'pointer-events': '', opacity: '' });
        $abortWrap.hide();
    }
}

/** 中止按钮：置位中止信号。 */
export function abortJhsSync(): void {
    jhsSyncSignal.aborted = true;
}
