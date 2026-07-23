/**
 * 演员黑名单数据查询（提取自 blacklist-plugin.tsx 的 getTableData）。
 *
 * 读取黑名单并按搜索/性别/状态/屏蔽类型过滤，附带聚合每个演员的番号列表，
 * 同时刷新数据类型下拉选项与当前番号总数统计。
 *
 * 无循环值导入：本模块仅以 `import type` 依赖 BlacklistPlugin（运行期擦除）。
 */
import { ACTOR, ACTRESS } from '../../constants/site';

import { jsxToString } from '../../core/jsx-to-string';
import type { CarRecord } from '../../core/storage-manager';

import type { BlacklistPlugin } from '../blacklist-plugin';

import { BlacklistDataTypeOptions } from '../../components/blacklist/blacklist-data-type-options';

/**
 * 读取黑名单并按搜索/性别/状态/屏蔽类型过滤，附带聚合每个演员的番号列表。
 * 对应原 L7510-7573。
 *
 * @param plugin BlacklistPlugin 实例（读取 checkBlacklist_ruleTime，写入 currentCarCount）
 * @returns 过滤后的行数据数组（每行含 carList/count）
 */
export async function getTableData(plugin: BlacklistPlugin) {
    const blacklist = await storageManager.getBlacklist();
    const blacklistCars = await storageManager.getBlacklistCarList();
    const searchValue = $('#searchValue').val();
    const statusType = $('#statusType').val();
    const $dataTypeSelect = $('#dataType');
    const dataType = $dataTypeSelect.val();
    const urlType = $('#urlType').val();
    const totalCount = blacklist.length;
    let actorCount = 0;
    let actressCount = 0;
    const enrichedList = blacklist
        .map((item) => {
            if (item.role === ACTOR) {
                actorCount++;
            } else if (item.role === ACTRESS) {
                actressCount++;
            }
            let isUnCheck = false;
            if (item.lastPublishTime) {
                isUnCheck = !utils.isUnnecessaryCheck(
                    item.lastPublishTime,
                    plugin.checkBlacklist_ruleTime
                );
            }
            return {
                ...item,
                isUnCheck
            };
        })
        .filter(
            (item) =>
                (!searchValue || !!item.name!.includes(searchValue)) &&
                (statusType !== 'normal' || !item.isUnCheck) &&
                (statusType !== 'stop' || !!item.isUnCheck) &&
                (dataType
                    ? item.role === dataType
                    : (urlType !== 'hasT' || !!item.url!.includes('t=')) &&
                      (urlType !== 'noT' || !item.url!.includes('t=')))
        );
    $dataTypeSelect.html(
        jsxToString(
            <BlacklistDataTypeOptions
                totalCount={totalCount}
                actorCount={actorCount}
                actressCount={actressCount}
            />
        )
    );
    $dataTypeSelect.val(dataType as string);
    const carsByStarId = new Map<string | undefined, CarRecord[]>();
    for (const carItem of blacklistCars) {
        const starId = carItem.starId;
        if (!carsByStarId.has(starId)) {
            carsByStarId.set(starId, []);
        }
        carsByStarId.get(starId)!.push(carItem);
    }
    const finalData = enrichedList.map((item) => {
        const starId = item.starId;
        const cars = carsByStarId.get(starId) || [];
        return {
            ...item,
            carList: cars,
            count: cars.length
        };
    });
    plugin.currentCarCount = finalData.reduce(
        (sum: number, row) => sum + (row.count || 0),
        0
    );
    return finalData;
}
