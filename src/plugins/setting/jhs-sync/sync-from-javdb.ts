/**
 * JavDB → JHS 方向同步（doc/213）。
 *
 * 包含两个子方向：
 * 1. 想看同步：JavDB 想看但 JHS 无 FAVORITE_ACTION → saveCar(FAVORITE_ACTION)
 * 2. 已看同步：JavDB 已看但 JHS 无 HAS_WATCH_ACTION → saveCar(HAS_WATCH_ACTION)
 *
 * 安全策略：JHS 已有同状态跳过；JHS 状态与 JavDB 不一致记为冲突（不自动处理）。
 * 评分说明：JavDB 列表页不显示评分，JavDB→JHS 已看同步仅标记状态，不带评分。
 */
import { FAVORITE_ACTION, HAS_WATCH_ACTION } from '../../../constants/status';

import type { SyncOptions, SyncResult } from './sync-common';
import { createEmptyResult, extractVideoId, fetchVideoMap, syncSleep } from './sync-common';

/** JHS carList 中按状态分组后的索引结构。 */
interface JhsIndex {
    /** videoId → carNum（FAVORITE_ACTION）。 */
    wantByVideoId: Map<string, string>;
    /** videoId → carNum（HAS_WATCH_ACTION）。 */
    watchedByVideoId: Map<string, string>;
    /** carNum → status（全部记录，用于冲突检测）。 */
    statusByCarNum: Map<string, string>;
}

/** 构建 JHS 本地索引（一次 getCarList，按状态分桶）。 */
async function buildJhsIndex(): Promise<JhsIndex> {
    const carList = await storageManager.getCarList();
    const wantByVideoId = new Map<string, string>();
    const watchedByVideoId = new Map<string, string>();
    const statusByCarNum = new Map<string, string>();
    for (const car of carList) {
        const videoId = extractVideoId(car.url);
        if (car.status) statusByCarNum.set(car.carNum, car.status);
        if (!videoId) continue;
        if (car.status === FAVORITE_ACTION) wantByVideoId.set(videoId, car.carNum);
        else if (car.status === HAS_WATCH_ACTION) watchedByVideoId.set(videoId, car.carNum);
    }
    return { wantByVideoId, watchedByVideoId, statusByCarNum };
}

/**
 * JavDB 想看 → JHS 收藏（doc/213 D4）。
 * JavDB 想看但 JHS 无 FAVORITE_ACTION → saveCar；JHS 已看 → 冲突。
 */
export async function syncWantFromJavdb(options: SyncOptions): Promise<SyncResult> {
    const { interval, signal, onProgress } = options;
    const result = createEmptyResult('JavDB→JHS 想看');

    onProgress('正在获取 JavDB「想看」列表…');
    const javdbWantMap = await fetchVideoMap('/users/want_watch_videos');
    if (signal.aborted) { result.aborted = true; return result; }

    onProgress('正在读取 JHS 本地记录…');
    const idx = await buildJhsIndex();

    const toSync: { carNum: string; videoId: string }[] = [];
    for (const [videoId, carNum] of javdbWantMap) {
        if (!carNum) continue;
        if (idx.wantByVideoId.has(videoId)) {
            result.skipped++;
        } else if (idx.watchedByVideoId.has(videoId)) {
            result.conflicts.push({
                carNum,
                videoId,
                jhsStatus: '已看',
                javdbStatus: '想看'
            });
        } else {
            toSync.push({ carNum, videoId });
        }
    }

    onProgress(`待同步 ${toSync.length} 部（跳过 ${result.skipped}，冲突 ${result.conflicts.length}）`);
    for (let i = 0; i < toSync.length; i++) {
        if (signal.aborted) { result.aborted = true; break; }
        const { carNum, videoId } = toSync[i];
        onProgress(`想看同步 ${i + 1}/${toSync.length}：${carNum}`);
        try {
            await storageManager.saveCar({
                carNum,
                url: `/v/${videoId}`,
                actionType: FAVORITE_ACTION
            });
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
 * JavDB 已看 → JHS 已看（doc/213 D3）。
 * JavDB 已看但 JHS 无 HAS_WATCH_ACTION → saveCar；JHS 想看 → 冲突。
 * 注：JavDB 列表页不含评分，仅同步状态。
 */
export async function syncWatchedFromJavdb(options: SyncOptions): Promise<SyncResult> {
    const { interval, signal, onProgress } = options;
    const result = createEmptyResult('JavDB→JHS 已看');

    onProgress('正在获取 JavDB「已看」列表…');
    const javdbWatchedMap = await fetchVideoMap('/users/watched_videos');
    if (signal.aborted) { result.aborted = true; return result; }

    onProgress('正在读取 JHS 本地记录…');
    const idx = await buildJhsIndex();

    const toSync: { carNum: string; videoId: string }[] = [];
    for (const [videoId, carNum] of javdbWatchedMap) {
        if (!carNum) continue;
        if (idx.watchedByVideoId.has(videoId)) {
            result.skipped++;
        } else if (idx.wantByVideoId.has(videoId)) {
            result.conflicts.push({
                carNum,
                videoId,
                jhsStatus: '想看',
                javdbStatus: '已看'
            });
        } else {
            toSync.push({ carNum, videoId });
        }
    }

    onProgress(`待同步 ${toSync.length} 部（跳过 ${result.skipped}，冲突 ${result.conflicts.length}）`);
    for (let i = 0; i < toSync.length; i++) {
        if (signal.aborted) { result.aborted = true; break; }
        const { carNum, videoId } = toSync[i];
        onProgress(`已看同步 ${i + 1}/${toSync.length}：${carNum}`);
        try {
            await storageManager.saveCar({
                carNum,
                url: `/v/${videoId}`,
                actionType: HAS_WATCH_ACTION,
                score: 0
            });
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
