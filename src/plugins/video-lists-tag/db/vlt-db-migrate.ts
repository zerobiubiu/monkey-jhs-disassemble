/**
 * IndexedDB 数据层 —— 导入/导出迁移。
 *
 * 提取自 vlt-db.ts：
 * - importData：导入迁移数据（四个逻辑对象原子替换）
 * - isImported：检查是否已导入数据
 * - exportData：导出全量数据为 MigrationData 格式
 */
import { withState } from './vlt-db-core';
import type { MigrationData } from './vlt-db-core';

/** 导入迁移数据；四个逻辑对象原子替换。 */
export async function importData(
    data: MigrationData
): Promise<{ movies: number; inventory: number; movieInventory: number }> {
    return withState('readwrite', (state) => {
        const nextEpoch = state.meta.epoch + 1;
        state.movies = data.movies;
        state.inventory = data.inventory;
        state.movieInventory = data.movieInventory;
        state.meta = {
            version: data._version,
            exportedAt: data._exportedAt,
            importedAt: new Date().toISOString(),
            source: data._source,
            epoch: nextEpoch,
            listRevisions: {}
        };
        return {
            movies: Object.keys(data.movies).length,
            inventory: Object.keys(data.inventory).length,
            movieInventory: Object.keys(data.movieInventory).length
        };
    });
}

/** 检查是否已导入数据（meta 键是否包含 importedAt）。 */
export async function isImported(): Promise<boolean> {
    return withState('readonly', (state) => !!state.meta.importedAt);
}

/** 导出全量数据为 MigrationData 格式。 */
export async function exportData(): Promise<MigrationData> {
    return withState('readonly', (state) => ({
        _version: state.meta.version ?? 1,
        _exportedAt: state.meta.exportedAt ?? new Date().toISOString(),
        _source: 'IndexedDB (local export)',
        movies: state.movies,
        inventory: state.inventory,
        movieInventory: state.movieInventory
    }));
}
