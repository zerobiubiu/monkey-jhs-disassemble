/**
 * JHS → JavDB 方向同步（doc/213）。
 *
 * 包含两个子方向：
 * 1. 想看同步：JHS FAVORITE_ACTION 但 JavDB 无状态 → POST want_to_watch
 * 2. 已看同步：JHS HAS_WATCH_ACTION 但 JavDB 无状态 → POST reviews(watched+score)
 *
 * 安全策略：JavDB 已有同状态跳过；JavDB 状态与 JHS 不一致记为冲突（不自动处理）。
 */
import { FAVORITE_ACTION, HAS_WATCH_ACTION } from '../../../constants/status';

import type { SyncOptions, SyncResult } from './sync-common';
import {
    createEmptyResult,
    extractVideoId,
    fetchVideoMap,
    postWantToWatch,
    postWatched,
    readRatingCacheMap,
    syncSleep
} from './sync-common';

/**
 * JHS 想看 → JavDB 想看（原 doc/210 逻辑迁移）。
 * JHS FAVORITE_ACTION 且 JavDB 无状态 → 设为想看；JavDB 已看 → 冲突。
 */
export async function syncWantToJavdb(options: SyncOptions): Promise<SyncResult> {
    const { interval, signal, onProgress } = options;
    const result = createEmptyResult('JHS→JavDB 想看');

    onProgress('正在读取 JHS 收藏记录…');
    const carList = await storageManager.getCarList();
    const jhsFavs: { carNum: string; videoId: string }[] = [];
    for (const car of carList) {
        if (car.status !== FAVORITE_ACTION) continue;
        const videoId = extractVideoId(car.url);
        if (videoId) jhsFavs.push({ carNum: car.carNum, videoId });
    }

    onProgress('正在获取 JavDB「想看」列表…');
    const wantMap = await fetchVideoMap('/users/want_watch_videos');
    if (signal.aborted) { result.aborted = true; return result; }
    onProgress('正在获取 JavDB「已看」列表…');
    const watchedMap = await fetchVideoMap('/users/watched_videos');
    if (signal.aborted) { result.aborted = true; return result; }

    const toSync: { carNum: string; videoId: string }[] = [];
    for (const item of jhsFavs) {
        if (wantMap.has(item.videoId)) {
            result.skipped++;
        } else if (watchedMap.has(item.videoId)) {
            result.conflicts.push({
                carNum: item.carNum,
                videoId: item.videoId,
                jhsStatus: '想看',
                javdbStatus: '已看'
            });
        } else {
            toSync.push(item);
        }
    }

    onProgress(`待同步 ${toSync.length} 部（跳过 ${result.skipped}，冲突 ${result.conflicts.length}）`);
    for (let i = 0; i < toSync.length; i++) {
        if (signal.aborted) { result.aborted = true; break; }
        const { carNum, videoId } = toSync[i];
        onProgress(`想看同步 ${i + 1}/${toSync.length}：${carNum}`);
        try {
            await postWantToWatch(videoId);
            result.synced++;
            result.syncedList.push(carNum);
        } catch (err) {
            result.failed++;
            result.failedList.push(`${carNum}（${err instanceof Error ? err.message : '失败'}）`);
        }
        if (i + 1 < toSync.length && !signal.aborted) await syncSleep(interval);
    }

    return result;
}

/**
 * JHS 已看 → JavDB 已看（含评分，doc/213 D2/D6）。
 * JHS HAS_WATCH_ACTION 且 JavDB 无状态 → POST watched + score；
 * JavDB 想看 → 冲突（不自动降级/升级）。
 * 评分来源优先级：car.score > localStorage 评分缓存 > 0。
 */
export async function syncWatchedToJavdb(options: SyncOptions): Promise<SyncResult> {
    const { interval, signal, onProgress } = options;
    const result = createEmptyResult('JHS→JavDB 已看');

    onProgress('正在读取 JHS 已看记录…');
    const carList = await storageManager.getCarList();
    const ratingCache = readRatingCacheMap();
    const jhsWatched: { carNum: string; videoId: string; score: number }[] = [];
    for (const car of carList) {
        if (car.status !== HAS_WATCH_ACTION) continue;
        const videoId = extractVideoId(car.url);
        if (!videoId) continue;
        const score = (typeof car.score === 'number' && car.score > 0)
            ? car.score
            : (ratingCache.get(car.carNum) ?? 0);
        jhsWatched.push({ carNum: car.carNum, videoId, score });
    }

    onProgress('正在获取 JavDB「已看」列表…');
    const watchedMap = await fetchVideoMap('/users/watched_videos');
    if (signal.aborted) { result.aborted = true; return result; }
    onProgress('正在获取 JavDB「想看」列表…');
    const wantMap = await fetchVideoMap('/users/want_watch_videos');
    if (signal.aborted) { result.aborted = true; return result; }

    const toSync: { carNum: string; videoId: string; score: number }[] = [];
    for (const item of jhsWatched) {
        if (watchedMap.has(item.videoId)) {
            result.skipped++;
        } else if (wantMap.has(item.videoId)) {
            result.conflicts.push({
                carNum: item.carNum,
                videoId: item.videoId,
                jhsStatus: '已看',
                javdbStatus: '想看'
            });
        } else {
            toSync.push(item);
        }
    }

    onProgress(`待同步 ${toSync.length} 部（跳过 ${result.skipped}，冲突 ${result.conflicts.length}）`);
    for (let i = 0; i < toSync.length; i++) {
        if (signal.aborted) { result.aborted = true; break; }
        const { carNum, videoId, score } = toSync[i];
        onProgress(`已看同步 ${i + 1}/${toSync.length}：${carNum}${score > 0 ? ` ★${score}` : ''}`);
        try {
            await postWatched(videoId, score);
            result.synced++;
            result.syncedList.push(score > 0 ? `${carNum}(★${score})` : carNum);
        } catch (err) {
            result.failed++;
            result.failedList.push(`${carNum}（${err instanceof Error ? err.message : '失败'}）`);
        }
        if (i + 1 < toSync.length && !signal.aborted) await syncSleep(interval);
    }

    return result;
}
