/**
 * IndexedDB 数据层 —— 寄生 JAV-JHS/appData 仓库。
 *
 * 实现已拆分至 db/ 子目录：
 * - db/vlt-db-core.ts — 连接 + 事务 + 基础 CRUD
 * - db/vlt-db-reconcile.ts — 清单对账状态操作
 * - db/vlt-db-migrate.ts — 导入/导出迁移
 *
 * 本文件仅做 re-export，保持外部导入路径不变。
 */

export type {
    MovieRecord,
    InventoryRecord,
    SyncResult,
    MigrationData,
    ListReconcileSnapshot,
    ListReconcileGuard,
    ListReconcileState,
    ListReconcileResult
} from './db/vlt-db-core';

import {
    sync,
    queryMoviesLists,
    check,
    getAllInventory,
    deleteList,
    renameList
} from './db/vlt-db-core';
import {
    getListReconcileState,
    getListAssociationCounts,
    reconcileListSnapshot
} from './db/vlt-db-reconcile';
import { importData, isImported, exportData } from './db/vlt-db-migrate';

/** VLT 数据库操作类。 */
export class VltDb {
    /**
     * 影片 upsert + 清单 upsert + 关联 add/remove，全部在一个事务中提交。
     */
    static sync = sync;

    /** 批量查询番号所属的清单列表。 */
    static queryMoviesLists = queryMoviesLists;

    /** 检查影片/清单/关联是否存在。 */
    static check = check;

    /**
     * 获取清单对账守卫和真实关联数。fingerprint 可发现旧版本或外部代码绕过 revision
     * 直接写 movie_inventory 的情况。
     */
    static getListReconcileState = getListReconcileState;

    /** 返回每个已登记清单的真实关联数（不信任 inventory.count）。 */
    static getListAssociationCounts = getListAssociationCounts;

    /**
     * 用已经完整验证的 JavDB 清单快照替换单个清单的关联集合。
     * 抓取期间若本地发生了写入，返回 conflict 且零写入，调用方可重新抓取。
     */
    static reconcileListSnapshot = reconcileListSnapshot;

    /** 导入迁移数据；四个逻辑对象原子替换。 */
    static importData = importData;

    /** 检查是否已导入数据（meta 键是否包含 importedAt）。 */
    static isImported = isImported;

    /** 获取全部清单。 */
    static getAllInventory = getAllInventory;

    /** 删除清单和其全部关联；不删除影片记录。 */
    static deleteList = deleteList;

    /** 重命名清单，不改变关联。 */
    static renameList = renameList;

    /** 导出全量数据为 MigrationData 格式。 */
    static exportData = exportData;
}
