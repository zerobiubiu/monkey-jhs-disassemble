/**
 * 鉴定记录数据查询（提取自 history-plugin.tsx 的 getDataList）。
 *
 * 按状态/搜索词/排序从 storageManager 拉取并切片当前页数据，
 * 同时统计各状态计数并刷新下拉选项文案。
 *
 * 无循环值导入：本模块仅以 `import type` 依赖 HistoryPlugin（运行期擦除）。
 */
import {
    FILTER_ACTION,
    FAVORITE_ACTION,
    HAS_WATCH_ACTION,
    BLOCKED_TEXT,
    FAVORITED_TEXT,
    WATCHED_TEXT
} from '../../constants/status';

import type { CarRecord } from '../../core/storage-manager';

import type { HistoryPlugin } from '../history-plugin';

/**
 * 按状态/搜索词/排序从 storageManager 拉取并切片当前页数据。对应原 L6667-6752。
 *
 * @param plugin HistoryPlugin 实例（读写 allCount/filterCount/favoriteCount/hasWatchCount）
 * @param page 当前页码（从 1 起）
 * @param size 每页条数
 * @param sort 排序参数数组（取首项的 field/dir）
 * @returns { maxPage, dataList, totalCount } 供 Tabulator 远程分页使用
 */
export async function getDataList(
    plugin: HistoryPlugin,
    page: number,
    size: number,
    sort: Array<{ field: string; dir: string }>
): Promise<{ maxPage: number; dataList: CarRecord[]; totalCount: number }> {
    const carList = await storageManager.getCarList();
    plugin.allCount = carList.length;
    plugin.filterCount = 0;
    plugin.favoriteCount = 0;
    plugin.hasWatchCount = 0;
    carList.forEach((car: CarRecord) => {
        switch (car.status) {
            case FILTER_ACTION:
                plugin.filterCount++;
                break;
            case FAVORITE_ACTION:
                plugin.favoriteCount++;
                break;
            case HAS_WATCH_ACTION:
                plugin.hasWatchCount++;
        }
    });
    $('#dataType option[value="all"]').text(`所有 (${plugin.allCount})`);
    $('#dataType option[value="filter"]').text(`${BLOCKED_TEXT} (${plugin.filterCount})`);
    $('#dataType option[value="favorite"]').text(`${FAVORITED_TEXT} (${plugin.favoriteCount})`);
    $('#dataType option[value="hasWatch"]').text(`${WATCHED_TEXT} (${plugin.hasWatchCount})`);
    const selectedType = $('#dataType').val();
    let filtered: CarRecord[] =
        selectedType === 'all'
            ? carList
            : carList.filter((car: CarRecord) => car.status === selectedType);
    const searchText = String($('#searchCarNum').val() ?? '').trim();
    if (searchText) {
        const normalizedSearch = searchText
            .toLowerCase()
            .replace('-c', '')
            .replace('-uc', '')
            .replace('-4k', '');
        filtered = filtered.filter((row: CarRecord) => {
            const matchCar = row.carNum.toLowerCase().includes(normalizedSearch);
            const matchName = (row.names ? row.names : '')
                .toLowerCase()
                .includes(normalizedSearch);
            return matchCar || matchName;
        });
    }
    if (sort && sort.length > 0) {
        const sortConfig = sort[0];
        const field = sortConfig.field;
        const dir = sortConfig.dir;
        filtered.sort((rowA: CarRecord, rowB: CarRecord) => {
            const valA = rowA[field];
            const valB = rowB[field];
            const isEmptyA = valA == null || valA === '';
            const isEmptyB = valB == null || valB === '';
            if (isEmptyA && !isEmptyB) {
                return 1;
            } else if (!isEmptyA && isEmptyB) {
                return -1;
            } else if (isEmptyA && isEmptyB) {
                return 0;
            } else if ((valA as string) < (valB as string)) {
                if (dir === 'asc') {
                    return -1;
                } else {
                    return 1;
                }
            } else if ((valA as string) > (valB as string)) {
                if (dir === 'asc') {
                    return 1;
                } else {
                    return -1;
                }
            } else {
                return 0;
            }
        });
    }
    const totalCount = filtered.length;
    const maxPage = Math.ceil(totalCount / size);
    const start = (page - 1) * size;
    const end = start + size;
    filtered = filtered.slice(start, end);
    return {
        maxPage,
        dataList: filtered,
        totalCount
    };
}
