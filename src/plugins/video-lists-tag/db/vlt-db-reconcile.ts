/**
 * IndexedDB 数据层 —— 清单对账状态操作。
 *
 * 提取自 vlt-db.ts：
 * - getListReconcileState：获取清单对账守卫和真实关联数
 * - getListAssociationCounts：返回每个已登记清单的真实关联数
 * - reconcileListSnapshot：用已验证的 JavDB 清单快照替换关联集合
 */
import {
    associationDesignations,
    bumpListRevision,
    listFingerprint,
    randomBootstrapStyle,
    validateSnapshot,
    withState
} from './vlt-db-core';
import type {
    ListReconcileGuard,
    ListReconcileResult,
    ListReconcileSnapshot,
    ListReconcileState
} from './vlt-db-core';

/**
 * 获取清单对账守卫和真实关联数。fingerprint 可发现旧版本或外部代码绕过 revision
 * 直接写 movie_inventory 的情况。
 */
export async function getListReconcileState(
    listId: string,
    designation?: string
): Promise<ListReconcileState> {
    return withState('readonly', (state) => ({
        inventory: state.inventory[listId] || null,
        actualCount: associationDesignations(state.movieInventory, listId).length,
        hasDesignation:
            designation === undefined
                ? null
                : !!state.movieInventory[`${designation}::${listId}`],
        guard: {
            epoch: state.meta.epoch,
            revision: state.meta.listRevisions[listId] || 0,
            fingerprint: listFingerprint(state.movieInventory, listId)
        }
    }));
}

/** 返回每个已登记清单的真实关联数（不信任 inventory.count）。 */
export async function getListAssociationCounts(): Promise<Record<string, number>> {
    return withState('readonly', (state) => {
        const counts: Record<string, number> = {};
        for (const listId of Object.keys(state.inventory)) counts[listId] = 0;
        for (const key of Object.keys(state.movieInventory)) {
            if (!state.movieInventory[key]) continue;
            const separator = key.indexOf('::');
            if (separator < 0) continue;
            const listId = key.slice(separator + 2);
            counts[listId] = (counts[listId] || 0) + 1;
        }
        return counts;
    });
}

/**
 * 用已经完整验证的 JavDB 清单快照替换单个清单的关联集合。
 * 抓取期间若本地发生了写入，返回 conflict 且零写入，调用方可重新抓取。
 */
export async function reconcileListSnapshot(
    snapshot: ListReconcileSnapshot,
    guard: ListReconcileGuard
): Promise<ListReconcileResult> {
    validateSnapshot(snapshot);
    return withState('readwrite', (state) => {
        const currentGuard: ListReconcileGuard = {
            epoch: state.meta.epoch,
            revision: state.meta.listRevisions[snapshot.listId] || 0,
            fingerprint: listFingerprint(state.movieInventory, snapshot.listId)
        };
        if (
            currentGuard.epoch !== guard.epoch ||
            currentGuard.revision !== guard.revision ||
            currentGuard.fingerprint !== guard.fingerprint
        ) {
            return { status: 'conflict' };
        }

        const previous = new Set(
            associationDesignations(state.movieInventory, snapshot.listId)
        );
        const incoming = new Set(snapshot.movies.map((movie) => movie.designation));
        const now = new Date().toISOString();

        for (const movie of snapshot.movies) {
            const existing = state.movies[movie.designation];
            state.movies[movie.designation] = existing
                ? {
                      ...existing,
                      href: movie.href || existing.href,
                      title: movie.title ?? existing.title,
                      coverSrc: movie.coverSrc ?? existing.coverSrc,
                      score: movie.score ?? existing.score,
                      releaseDate: movie.releaseDate ?? existing.releaseDate,
                      series: movie.series ?? existing.series,
                      code: movie.code ?? existing.code,
                      createdAt: existing.createdAt ?? movie.createdAt ?? now
                  }
                : { ...movie, createdAt: movie.createdAt ?? now };
        }

        const suffix = `::${snapshot.listId}`;
        for (const key of Object.keys(state.movieInventory)) {
            if (key.endsWith(suffix)) delete state.movieInventory[key];
        }
        for (const designation of incoming) {
            state.movieInventory[`${designation}::${snapshot.listId}`] = true;
        }

        const existingList = state.inventory[snapshot.listId];
        state.inventory[snapshot.listId] = {
            listId: snapshot.listId,
            name: snapshot.name,
            url: snapshot.url,
            count: snapshot.expectedCount,
            style: existingList?.style ?? randomBootstrapStyle()
        };
        bumpListRevision(state.meta, snapshot.listId);

        let added = 0;
        let removed = 0;
        for (const designation of incoming) if (!previous.has(designation)) added++;
        for (const designation of previous) if (!incoming.has(designation)) removed++;
        return { status: 'applied', added, removed, count: snapshot.expectedCount };
    });
}
