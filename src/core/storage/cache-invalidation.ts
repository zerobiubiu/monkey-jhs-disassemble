/**
 * 远程存储变更 → 本地缓存失效映射（doc/39）。
 *
 * 背景：修订号原设计只有一条，`main.tsx` 的 `onRemoteChange` 里对**任何**变更都
 * 顺带清掉设置缓存。于是出现实测反馈的阻塞链条：
 *
 * 1. 详情页（列表页 iframe 弹窗）里点收藏/已读 → 写 car_list → 修订号广播；
 * 2. 父页收到广播 → **设置缓存被清**；
 * 3. 用户点下一张卡片 → `lp-dom` 的打开路径 `await storageManager.getSetting('dialogOpenDetail')`
 *    因缓存未命中而落到 IndexedDB 读；
 * 4. 同源 IndexedDB 读写串行 → 这次读排在 iframe 的写事务之后；
 * 5. 表现为「打开新视频弹窗必须等旧视频操作落库完成」。
 *
 * 修法：按写入类型分流 —— 数据写入只清数据缓存，设置写入只清设置缓存。
 * 设置写入走独立的 `storageRevision.incrementSettings()`（见 core/storage-revision.ts）。
 */

/** 远程变更类型。 */
export type RemoteChangeKind = 'data' | 'settings';

/** 需要失效的缓存接口（取 StorageManager 的相关子集，便于测试注入替身）。 */
export interface CacheTarget {
    /** car_list 缓存。 */
    clearCarListCache(): void;
    /** 设置对象缓存。 */
    clearSettingCache(): void;
    /** 屏蔽用演员/番号清单缓存。 */
    clearFilterActorActressCarListCache(): void;
}

/**
 * 按变更类型失效对应缓存。
 *
 * @param kind 变更类型（`data` = car_list / 清单等写入；`settings` = 设置对象写入）
 * @param target 存储管理器（或其替身）
 * @returns 已失效的缓存名列表（供日志与测试断言）
 */
export function invalidateCachesFor(kind: RemoteChangeKind, target: CacheTarget): string[] {
    if (kind === 'settings') {
        target.clearSettingCache();
        return ['setting'];
    }
    target.clearCarListCache();
    target.clearFilterActorActressCarListCache();
    return ['carList', 'filterActorActressCarList'];
}