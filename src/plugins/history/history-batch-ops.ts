/**
 * 鉴定记录批量状态变更处理（提取自 history-plugin.tsx 的 bindClick 批量分支）。
 *
 * 对应工具栏批量按钮（.multiple-history-deleteBtn / -filterBtn / -favoriteBtn /
 * -hasWatchBtn）对已勾选行的处理：确认后批量移除或批量改状态。
 *
 * 无循环值导入：本模块仅以 `import type` 依赖 HistoryPlugin（运行期擦除）。
 */
import {
    FILTER_ACTION,
    FAVORITE_ACTION,
    HAS_WATCH_ACTION
} from '../../constants/status';

import type { CarRecord } from '../../core/storage-manager';

import type { HistoryPlugin } from '../history-plugin';

/**
 * 处理批量操作按钮点击：依按钮类名确定动作，确认后批量移除/改状态。
 * 对应原 L6549-6666 的批量分支。
 *
 * @param plugin HistoryPlugin 实例（读取 tableObj 选中行、reloadTable 刷新）
 * @param event 触发点击事件（用于 utils.q 定位确认框）
 * @param btn 触发按钮的 jQuery 包装（判定动作类名）
 */
export function handleBatchAction(plugin: HistoryPlugin, event: Event, btn: JQuery): void {
    event.preventDefault();
    event.stopPropagation();
    const selectedRows = plugin.tableObj.getSelectedData();
    let actionLabel = '';
    let actionType = '';
    if (btn.hasClass('multiple-history-filterBtn')) {
        actionLabel = '屏蔽';
        actionType = FILTER_ACTION;
    } else if (btn.hasClass('multiple-history-favoriteBtn')) {
        actionLabel = '收藏';
        actionType = FAVORITE_ACTION;
    } else if (btn.hasClass('multiple-history-hasWatchBtn')) {
        actionLabel = '已观看';
        actionType = HAS_WATCH_ACTION;
    } else if (btn.hasClass('multiple-history-deleteBtn')) {
        actionLabel = '移除';
        actionType = 'delete';
    }
    utils.q(
        event as MouseEvent,
        `当前已勾选${selectedRows.length}条数据, 是否全标记为 ${actionLabel}?`,
        async () => {
            const loader = loading();
            try {
                if (actionType === 'delete') {
                    const carNums = selectedRows.map((row: CarRecord) => row.carNum);
                    const removed = await storageManager.batchRemoveCars(carNums);
                    if (Number(removed) > 0) {
                        show.ok(`已成功删除 ${removed} 个番号`);
                    } else if (removed === false) {
                        show.error('提供的番号中没有一个存在于列表中。');
                    }
                } else {
                    const updates = JSON.parse(JSON.stringify(selectedRows));
                    updates.forEach((item: CarRecord) => {
                        item.actionType = actionType;
                    });
                    await storageManager.saveCarList(updates);
                    show.ok('操作成功');
                }
                plugin.tableObj.deselectRow();
                plugin.reloadTable().then();
            } catch (err: unknown) {
                clog.error('批量操作失败:', err);
                show.error('操作失败: ' + (err instanceof Error ? err.message : String(err)));
            } finally {
                loader.close();
            }
        }
    );
}
