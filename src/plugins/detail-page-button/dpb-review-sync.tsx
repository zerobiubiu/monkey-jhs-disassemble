/**
 * 详情页评价状态自动校验同步模块（doc/234）。
 *
 * 背景：点击「评分/已读/收藏」时，脚本先写本地 IndexedDB（JHS），再推送 JavDB。
 * 网络抖动等情况下可能出现「脚本已写入、服务器未写入」的数据错位。再次打开
 * 该影片详情页时，本模块核实服务器（.review-buttons DOM）与脚本（car_list）
 * 的状态匹配，并按「脚本记录优先」向 JavDB 自动补推；服务器有而脚本无时反向
 * 拉取补齐；双方均有但状态不一致（冲突）时弹窗让用户选择以哪一侧为准（doc/235）。
 *
 * 开关：设置面板「对账校准」新增 autoServerSync（默认开启），关闭后不再自动校验。
 */
import { FAVORITE_ACTION, FILTER_ACTION, HAS_WATCH_ACTION } from '../../constants/status';

import { jsxToString } from '../../core/jsx-to-string';

import type { DetailPageButtonPlugin } from '../detail-page-button-plugin';

import { ReviewConflictDialog } from '../../components/dpb/review-conflict-dialog';

/** 等待 .review-buttons 出现的最大时间（ms）。 */
const REVIEW_SYNC_TIMEOUT_MS = 10000;
/** 注入后延迟执行（ms），避开页面初始渲染与评分组件注入竞速。 */
const REVIEW_SYNC_START_DELAY_MS = 1200;

/** 服务器端评价状态（从 javdb 原生 .review-buttons DOM 读取）。 */
export interface ServerReviewState {
    /** 想看 */
    want: boolean;
    /** 已看 */
    watched: boolean;
    /** 已看评分 0-5（0 表示未评分） */
    score: number;
}

/**
 * 从 javdb 原生 .review-buttons DOM 读取当前评价状态。
 * 与 _syncRatingBar 使用同一组选择器（.tag.is-info.is-light=想看、
 * .tag.is-success.is-light=已看、checked 的 score input）。
 * @returns 服务器端评价状态
 */
export function readServerReviewState(): ServerReviewState {
    const rb = document.querySelector('.review-buttons');
    if (!rb) return { want: false, watched: false, score: 0 };
    const want = !!rb.querySelector("a[href='/users/want_watch_videos'] .tag.is-info.is-light");
    const watched = !!rb.querySelector(
        "a[href='/users/watched_videos'] .tag.is-success.is-light"
    );
    const checked = rb.querySelector(
        'input[name="video_review[score]"][checked]'
    ) as HTMLInputElement | null;
    const score = checked ? Number(checked.value) : 0;
    return { want, watched, score: Number.isFinite(score) ? score : 0 };
}

/**
 * 注册详情页评价状态自动校验：等待 .review-buttons 出现后执行一次比对同步。
 * 通过 plugin._autoSyncChecked 保证单页只执行一次。
 * @param plugin 详情页按钮插件实例
 * @param enabled 设置开关（autoServerSync，默认开启）
 */
export function setupAutoReviewSync(plugin: DetailPageButtonPlugin, enabled: boolean): void {
    if (!enabled || plugin._autoSyncChecked) return;
    const startedAt = Date.now();
    const ensure = () => {
        if (!document.querySelector('.review-buttons')) {
            if (Date.now() - startedAt > REVIEW_SYNC_TIMEOUT_MS) {
                plugin._autoSyncChecked = true;
                clog.warn('[JHS] 评价状态自动校验：等待 .review-buttons 超时，本次跳过');
                return;
            }
            setTimeout(ensure, 400);
            return;
        }
        plugin._autoSyncChecked = true;
        autoSyncReviewState(plugin).then();
    };
    setTimeout(ensure, REVIEW_SYNC_START_DELAY_MS);
}

/**
 * 核实脚本与服务器的评价状态并自动同步。
 * 方向 1：脚本有记录、服务器完全没有评价 → 推送脚本 → 服务器（首选方向）。
 * 方向 2：服务器有评价、脚本无记录 → 拉取服务器 → 本地（反向）。
 * 方向 3：双方均有但状态不一致（冲突）→ 弹窗让用户选择以哪一侧为准（doc/235）。
 * @param plugin 详情页按钮插件实例
 */
export async function autoSyncReviewState(plugin: DetailPageButtonPlugin): Promise<void> {
    const pageInfo = plugin.getPageInfo();
    const carNum = pageInfo.carNum;
    if (!carNum) return;
    const server = readServerReviewState();
    const carRecord = await storageManager.getCar(carNum);
    const localStatus = carRecord?.status;
    const localScore = typeof carRecord?.score === 'number' ? carRecord.score : 0;

    // 已完全一致 → 无需处理
    if (server.want && localStatus === FAVORITE_ACTION) return;
    if (server.watched && localStatus === HAS_WATCH_ACTION && server.score === localScore) return;

    // 方向 1：脚本有记录、服务器完全没有评价 → 推送脚本 → 服务器
    if (!server.want && !server.watched) {
        if (localStatus === FAVORITE_ACTION) {
            await enqueuePush(plugin, carNum, 'want');
        } else if (localStatus === HAS_WATCH_ACTION) {
            await enqueuePush(plugin, carNum, 'review', localScore);
        }
        return;
    }

    // 方向 2：服务器有评价、脚本无记录 → 拉取服务器 → 本地（反向同步）
    if (!localStatus) {
        if (server.watched) {
            await storageManager.saveCar({
                carNum,
                url: pageInfo.url ?? undefined,
                names: pageInfo.actress ?? undefined,
                actionType: HAS_WATCH_ACTION,
                publishTime: pageInfo.publishTime ?? undefined,
                score: server.score || 0
            });
            plugin.broadcastWantWatchedSync({
                carNum,
                status: HAS_WATCH_ACTION,
                op: 'add',
                score: server.score || 0
            });
            clog.log(`[JHS] 评价状态自动校验：已从服务器补齐本地已看记录 ${carNum}（${server.score} 星）`);
            plugin.showStatus(carNum).then();
        } else if (server.want) {
            await storageManager.saveCar({
                carNum,
                url: pageInfo.url ?? undefined,
                names: pageInfo.actress ?? undefined,
                actionType: FAVORITE_ACTION,
                publishTime: pageInfo.publishTime ?? undefined
            });
            plugin.broadcastWantWatchedSync({
                carNum,
                status: FAVORITE_ACTION,
                op: 'add'
            });
            clog.log(`[JHS] 评价状态自动校验：已从服务器补齐本地收藏记录 ${carNum}`);
            plugin.showStatus(carNum).then();
        }
        return;
    }

    // 方向 3：双方均有但状态不一致（冲突）→ 弹窗让用户选择以哪一侧为准（doc/235）
    const localDesc =
        localStatus === FAVORITE_ACTION
            ? '⭐ 已收藏（想看）'
            : localStatus === HAS_WATCH_ACTION
              ? `🔍 已看${localScore > 0 ? ` ${localScore} 星` : ''}`
              : localStatus === FILTER_ACTION
                ? '🚫 已拉黑'
                : localStatus || '无记录';
    const serverDesc = server.want
        ? '⭐ 想看'
        : server.watched
          ? `🔍 已看${server.score > 0 ? ` ${server.score} 星` : ''}`
          : '无评价';
    const choice = await confirmReviewConflict(carNum, localDesc, serverDesc);
    if (choice === 'local') {
        // 使用脚本记录 → 推送脚本 → 服务器（拉黑映射为已读 0 星，同 quickBlock 语义）
        if (localStatus === FAVORITE_ACTION) {
            await enqueuePush(plugin, carNum, 'want');
        } else if (localStatus === HAS_WATCH_ACTION) {
            await enqueuePush(plugin, carNum, 'review', localScore);
        } else if (localStatus === FILTER_ACTION) {
            await enqueuePush(plugin, carNum, 'review', 0);
        }
    } else if (choice === 'server') {
        // 使用网站数据 → 拉取服务器 → 本地
        if (server.watched) {
            await storageManager.saveCar({
                carNum,
                url: pageInfo.url ?? undefined,
                names: pageInfo.actress ?? undefined,
                actionType: HAS_WATCH_ACTION,
                publishTime: pageInfo.publishTime ?? undefined,
                score: server.score || 0
            });
            plugin.broadcastWantWatchedSync({
                carNum,
                status: HAS_WATCH_ACTION,
                op: 'add',
                score: server.score || 0
            });
            clog.log(`[JHS] 评价状态冲突：已按网站数据更新本地已看记录 ${carNum}（${server.score} 星）`);
            plugin.showStatus(carNum).then();
        } else if (server.want) {
            await storageManager.saveCar({
                carNum,
                url: pageInfo.url ?? undefined,
                names: pageInfo.actress ?? undefined,
                actionType: FAVORITE_ACTION,
                publishTime: pageInfo.publishTime ?? undefined
            });
            plugin.broadcastWantWatchedSync({
                carNum,
                status: FAVORITE_ACTION,
                op: 'add'
            });
            clog.log(`[JHS] 评价状态冲突：已按网站数据更新本地收藏记录 ${carNum}`);
            plugin.showStatus(carNum).then();
        }
    }
    // choice === null（取消）→ 本次不处理，下次打开页面再校验
}

/**
 * 弹出「脚本记录 vs 网站数据」冲突选择弹窗（doc/235）。
 * layer.js 仅原生支持两个按钮回调，故用 type:1 内容弹窗 + success 回调绑定
 * 三个自绘按钮（data-conflict-choice 契约），关闭/ESC/遮罩均视为取消。
 * @param carNum 番号
 * @param localDesc 脚本记录描述
 * @param serverDesc 服务器状态描述
 * @returns 选择结果：'local' 使用脚本记录 / 'server' 使用网站数据 / null 取消
 */
function confirmReviewConflict(
    carNum: string,
    localDesc: string,
    serverDesc: string
): Promise<'local' | 'server' | null> {
    return new Promise((resolve) => {
        let settled = false;
        const settle = (choice: 'local' | 'server' | null): void => {
            if (settled) return;
            settled = true;
            resolve(choice);
        };
        layer.open({
            type: 1,
            title: `评价状态冲突 - ${carNum}`,
            area: ['520px', 'auto'],
            content: jsxToString(
                <ReviewConflictDialog carNum={carNum} localDesc={localDesc} serverDesc={serverDesc} />
            ),
            success: (layerEl: HTMLElement, layerIndex: number) => {
                const $layer = $(layerEl);
                $layer.find('[data-conflict-choice="local"]').on('click', function () {
                    layer.close(layerIndex);
                    settle('local');
                });
                $layer.find('[data-conflict-choice="server"]').on('click', function () {
                    layer.close(layerIndex);
                    settle('server');
                });
                $layer.find('[data-conflict-choice="cancel"]').on('click', function () {
                    layer.close(layerIndex);
                    settle(null);
                });
            },
            // 关闭钮 / ESC（layer 包装自动挂 setupEscClose）/ 遮罩关闭 → 视为取消
            cancel: () => {
                settle(null);
            }
        });
    });
}

/**
 * 将脚本记录推送到 JavDB（串行化 + 阻断 MutationObserver 防递归）。
 * @param plugin 详情页按钮插件实例
 * @param carNum 番号
 * @param kind 推送类型（want=想看 / review=已看评分）
 * @param score 评分（仅 review 有效，0-5）
 */
function enqueuePush(
    plugin: DetailPageButtonPlugin,
    carNum: string,
    kind: 'want' | 'review',
    score = 0
): Promise<void> {
    return new Promise<void>((resolve) => {
        plugin._reviewChain = (plugin._reviewChain || Promise.resolve())
            .then(async () => {
                plugin._wantWatchedSyncing = true;
                try {
                    if (kind === 'want') {
                        await plugin._triggerJavdbWant();
                        show.ok(`${carNum} 已同步收藏到 JavDB`);
                    } else {
                        await plugin._triggerJavdbReview(score);
                        show.ok(
                            `${carNum} 已同步${score > 0 ? `评分 ${score} 星` : '已读'}到 JavDB`
                        );
                    }
                    plugin._syncRatingBar();
                } catch (err) {
                    clog.error(`[JHS] 评价状态自动校验：推送失败 ${carNum}`, err);
                    show.error(
                        `同步失败: ${carNum} ` +
                            (err instanceof Error ? err.message : String(err))
                    );
                } finally {
                    plugin._wantWatchedSyncing = false;
                }
            })
            .catch(() => {})
            .finally(() => resolve());
    });
}