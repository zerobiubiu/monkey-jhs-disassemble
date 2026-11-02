/**
 * JavDB 清单对账模块。
 *
 * 仅在“服务端显示数量/当前影片勾选态”与本地 IDB 不一致时抓取全部分页。
 * 只有完整分页、总数、唯一性和二次首页稳定性全部通过后才允许写入本地。
 */

import { VltDb } from './vlt-db';
import type { ListReconcileSnapshot, MovieRecord } from './vlt-db';
import { showToast } from './vlt-toast';
import { enqueueAssociationTask, listAssociationKey } from './vlt-lock-queue';
import {
    getListInfo,
    getMovieInfo,
    setListDisplayedCount
} from './vlt-helpers';
import { postJavdbListMutation } from './server/vlt-server-api';
import { fetchCompleteListSnapshot } from './server/vlt-reconcile-snapshot';
import { readCurrentListIntent } from './server/vlt-intent';

const LOG_PREFIX = '[JavDB][清单对账]';

/** 自动对账巡检防抖延迟（ms）。默认 800；可由设置 autoReconcileDelay 经 setAutoReconcileDelay 调整（doc/206④）。 */
let autoReconcileDelay = 800;
/** 打开页面时自动将「本地有关联、服务器未勾选」的清单关系补推到 JavDB（doc/234）。默认开启；可由设置 autoServerSync 调整。 */
let autoServerSyncEnabled = true;

/**
 * 设置自动对账巡检防抖延迟（doc/206④，供 VLT 插件从设置注入）。
 * @param ms 延迟毫秒数（需 > 0）
 */
export function setAutoReconcileDelay(ms: number): void {
    if (Number.isFinite(ms) && ms > 0) autoReconcileDelay = ms;
}

/**
 * 设置打开页面时自动补推清单关系到 JavDB 的开关（doc/234，供 VLT 插件从设置注入）。
 * @param enabled 是否启用
 */
export function setAutoServerSyncEnabled(enabled: boolean): void {
    autoServerSyncEnabled = enabled;
}

interface ReconcileExpectation {
    expectedCount?: number;
    designation?: string;
    checked?: boolean;
    quiet?: boolean;
}

const reconcileQueues = new Map<string, Promise<boolean>>();
let automaticReconciliationInstalled = false;
let automaticReconciliationInstalling = false;
let automaticReconciliationTimer: ReturnType<typeof setTimeout> | null = null;
let automaticReconciliationRunning = false;

function normalizeText(value: string | null | undefined): string {
    return (value || '').replace(/\s+/g, ' ').trim();
}

function getDisplayedListCount(input: HTMLInputElement): number | null {
    const label = input.closest('label');
    const countText = label?.querySelector('span')?.textContent || label?.textContent || '';
    const match = countText.match(/\((\d+)\)/);
    if (!match) return null;
    const count = Number(match[1]);
    return Number.isSafeInteger(count) ? count : null;
}

function getDisplayedListName(input: HTMLInputElement): string {
    const labelText = normalizeText(input.closest('label')?.textContent);
    return labelText.replace(/\s*\(\d+\).*$/, '').trim();
}

function snapshotMatchesExpectation(
    snapshot: ListReconcileSnapshot,
    expectation: ReconcileExpectation
): boolean {
    if (
        expectation.expectedCount !== undefined &&
        snapshot.expectedCount !== expectation.expectedCount
    ) {
        return false;
    }
    if (expectation.designation !== undefined && expectation.checked !== undefined) {
        const contains = snapshot.movies.some(
            (movie) => movie.designation === expectation.designation
        );
        return contains === expectation.checked;
    }
    return true;
}

/** 本地与服务端影片的并集覆盖所有会被本次全量替换改变的关联。 */
function snapshotRespectsLatestIntents(snapshot: ListReconcileSnapshot, currentMovies: MovieRecord[]): boolean {
    const included = new Set(snapshot.movies.map((movie) => movie.href.match(/\/v\/([^/?#]+)/)?.[1]));
    for (const movie of [...snapshot.movies, ...currentMovies]) {
        const videoId = movie.href?.match(/\/v\/([^/?#]+)/)?.[1];
        if (!videoId) return false;
        const latest = readCurrentListIntent(videoId, snapshot.listId);
        if (latest && !latest.supersedeOnly && latest.desiredChecked !== included.has(videoId)) return false;
    }
    return true;
}

async function performReconciliation(
    listId: string,
    expectation: ReconcileExpectation
): Promise<boolean> {
    try {
        for (let attempt = 0; attempt < 2; attempt++) {
            const state = await VltDb.getListReconcileState(listId);
            const snapshot = await fetchCompleteListSnapshot(listId);
            if (!snapshotMatchesExpectation(snapshot, expectation)) {
                throw new Error('服务端清单状态已变化，与触发对账时的状态不一致');
            }

            const result = await VltDb.reconcileListSnapshot(snapshot, state.guard,
                (currentMovies) => snapshotRespectsLatestIntents(snapshot, currentMovies));
            if (result.status === 'conflict') {
                console.warn(`${LOG_PREFIX} 本地数据在抓取期间变化，准备重试 listId=${listId}`);
                continue;
            }

            console.log(
                `${LOG_PREFIX} 完成 listId=${listId} count=${result.count} added=${result.added} removed=${result.removed}`
            );
            if (!expectation.quiet && (result.added > 0 || result.removed > 0)) {
                showToast(
                    `✓ 已按 JavDB 校准「${snapshot.name}」：新增 ${result.added}，移除 ${result.removed}`,
                    'success'
                );
            }
            return true;
        }
        throw new Error('本地清单持续变化，两次对账均发生冲突');
    } catch (error) {
        clog.error(`${LOG_PREFIX} 失败 listId=${listId}`, error);
        if (!expectation.quiet) {
            const message = error instanceof Error ? error.message : String(error);
            showToast(`⚠ 清单自动校准失败：${message}`, 'warning');
        }
        return false;
    }
}

/** 同一清单的对账任务串行执行，避免多处同时触发分页抓取。 */
export function reconcileListWithJavdb(
    listId: string,
    expectation: ReconcileExpectation = {}
): Promise<boolean> {
    const previous = reconcileQueues.get(listId) || Promise.resolve(true);
    const current = previous
        .catch(() => false)
        .then(() => performReconciliation(listId, expectation));
    reconcileQueues.set(listId, current);
    current.finally(() => {
        if (reconcileQueues.get(listId) === current) reconcileQueues.delete(listId);
    });
    return current;
}

/**
 * 用户切换某个清单前做轻量检查；只有数量或当前影片归属不一致才抓全量分页。
 */
export async function reconcileListBeforeMutation(
    input: HTMLInputElement,
    designation: string,
    checkedBeforeMutation: boolean
): Promise<void> {
    const listId = input.dataset.listId || '';
    const serverCount = getDisplayedListCount(input);
    if (!listId || serverCount === null) return;

    const state = await VltDb.getListReconcileState(listId, designation);
    if (!state.inventory) return;
    if (
        state.actualCount === serverCount &&
        state.hasDesignation === checkedBeforeMutation
    ) {
        return;
    }

    console.warn(
        `${LOG_PREFIX} 检测到差异 listId=${listId} local=${state.actualCount} server=${serverCount} ` +
            `localChecked=${state.hasDesignation} serverChecked=${checkedBeforeMutation}`
    );
    await reconcileListWithJavdb(listId, {
        expectedCount: serverCount,
        designation,
        checked: checkedBeforeMutation,
        quiet: true
    });
}

/** JavDB 已成功写入但本地出现异常时，按服务端完整快照强制修复。 */
export function reconcileAfterConfirmedMutation(
    listId: string,
    designation: string,
    checked: boolean
): Promise<boolean> {
    return reconcileListWithJavdb(listId, { designation, checked, quiet: false });
}

/**
 * 将「本地有关联、服务器未勾选」的清单关系补推到 JavDB（doc/234）。
 * 修复脚本已写入本地镜像但服务器未写入的数据错位：本地记录优先，补推失败时
 * 保留本地记录并提示，避免被反向校准覆盖。
 * @param listId 清单 ID
 * @param designation 番号
 */
async function pushLocalOnlyAssociation(listId: string, designation: string): Promise<void> {
    const videoIdMatch = window.location.pathname.match(/\/v\/([^/?#]+)/);
    const videoId = videoIdMatch?.[1];
    if (!videoId) return;
    const movieInfo = getMovieInfo(videoId);
    const listInfo = getListInfo(listId);
    if (!movieInfo || !listInfo.info.name) return;

    await enqueueAssociationTask(listAssociationKey(videoId, listId), async () => {
        try {
            // 进入锁前的 DOM/本地快照可能已经过期，不能据此反向重放旧关联。
            const latest = readCurrentListIntent(videoId, listId);
            if (latest?.supersedeOnly || latest?.desiredChecked === false) return;
            const before = await VltDb.getListReconcileState(listId, designation);
            const checkedIntent = readCurrentListIntent(videoId, listId);
            if (!before.hasDesignation || checkedIntent?.supersedeOnly || checkedIntent?.desiredChecked === false) return;
            const result = await postJavdbListMutation(videoId, listId, true);
            if (result.kind === 'confirmed') {
                const state = await VltDb.getListReconcileState(listId);
                if (state.inventory && state.actualCount !== null) {
                    setListDisplayedCount(listId, state.actualCount);
                }
                console.log(
                    `${LOG_PREFIX} 已补推本地独有关联：${designation} → ${listInfo.info.name} (listId=${listId})`
                );
                showToast(`✓ [${designation}] 已补推至「${listInfo.info.name}」（服务器未同步）`, 'success');
            } else {
                showToast(
                    `⚠ [${designation}] 补推至「${listInfo.info.name}」未确认：${result.message}`,
                    'warning'
                );
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`${LOG_PREFIX} 补推本地独有关联失败：${designation} → ${listId}`, error);
            showToast(`⚠ [${designation}] 补推至「${listInfo.info.name}」失败：${message}`, 'warning');
        }
    });
}

async function runAutomaticReconciliation(designation: string): Promise<void> {
    if (automaticReconciliationRunning) return;
    automaticReconciliationRunning = true;
    try {
        const inputs = Array.from(
            document.querySelectorAll(
                '#modal-save-list input[type="checkbox"][data-list-id][data-action="change->list#listCheckboxChanged"]'
            )
        ) as HTMLInputElement[];

        for (const input of inputs) {
            const listId = input.dataset.listId || '';
            const serverCount = getDisplayedListCount(input);
            if (!listId || serverCount === null) continue;
            const state = await VltDb.getListReconcileState(listId, designation);
            // 未登记过的清单沿用按用户操作逐条建立本地镜像，避免首次运行下载全部清单。
            if (!state.inventory) continue;

            const membershipOk = state.hasDesignation === input.checked;
            if (membershipOk) {
                if (state.actualCount === serverCount) continue;
                // 数量不一致但当前影片归属一致 → 既有全量校准（服务器 → 本地）
                console.warn(
                    `${LOG_PREFIX} 页面加载发现差异「${getDisplayedListName(input)}」 ` +
                        `local=${state.actualCount} server=${serverCount}`
                );
                await reconcileListWithJavdb(listId, {
                    expectedCount: serverCount,
                    designation,
                    checked: input.checked,
                    quiet: true
                });
                continue;
            }

            if (state.hasDesignation && !input.checked) {
                // 本地有关联、服务器未勾选 → 本地 → 服务器 补推（doc/234：脚本已写入但服务器未写入）
                if (autoServerSyncEnabled) {
                    console.warn(
                        `${LOG_PREFIX} 页面加载发现本地独有关联「${getDisplayedListName(input)}」 ` +
                            `${designation} local=关联 server=未勾选，补推 JavDB`
                    );
                    await pushLocalOnlyAssociation(listId, designation);
                } else {
                    console.warn(
                        `${LOG_PREFIX} 自动补推已关闭，跳过本地独有关联「${getDisplayedListName(input)}」 ${designation}`
                    );
                }
                continue;
            }

            // 服务器已勾选、本地无关联 → 既有全量校准（服务器 → 本地）
            console.warn(
                `${LOG_PREFIX} 页面加载发现差异「${getDisplayedListName(input)}」 ` +
                    `local=${state.actualCount} server=${serverCount}`
            );
            await reconcileListWithJavdb(listId, {
                expectedCount: serverCount,
                designation,
                checked: input.checked,
                quiet: true
            });
        }
    } finally {
        automaticReconciliationRunning = false;
    }
}

/** 在详情页清单 AJAX 内容稳定后自动检查数量和当前影片归属。 */
export function setupAutomaticListReconciliation(designation: string): void {
    if (automaticReconciliationInstalled || automaticReconciliationInstalling) return;
    automaticReconciliationInstalling = true;

    const schedule = (): void => {
        if (automaticReconciliationTimer) clearTimeout(automaticReconciliationTimer);
        automaticReconciliationTimer = setTimeout(() => {
            automaticReconciliationTimer = null;
            runAutomaticReconciliation(designation).then();
        }, autoReconcileDelay);
    };

    const attach = (): void => {
        const modal = document.querySelector('#modal-save-list');
        if (!modal) {
            setTimeout(attach, 250);
            return;
        }
        automaticReconciliationInstalling = false;
        automaticReconciliationInstalled = true;
        const observer = new MutationObserver(schedule);
        observer.observe(modal, { childList: true, subtree: true });
        schedule();
    };
    attach();
}
