/**
 * 增量载荷形状路由（跨站 flag 不对称静默丢增量修复，doc/189）。
 *
 * 背景：javdb 发布端在 featureFlags.crossSiteSyncProtocol 开时把
 * GM_KEY_CAR_STATUS_DELTA 写成**数组 journal**，关时写成**单对象**
 * `{action,items,ts}`；missav 消费端原本按**本地** flag 选解析器——
 * flag 关时 `consumeDelta` 只认单对象的 `.action`，收到数组时
 * `delta.action === undefined`，两个分支都不进，直接掉到 `processAll()`，
 * 不写库、不报错、无「增量更新」日志 = 静默丢弃。flag 存 localStorage 按域名
 * 隔离、GM 存储跨域共享，故 javdb=ON / missav=OFF 必触发静默丢。
 *
 * 修复：消费端改按**载荷形状**路由，而非按本地 flag。数组无条件走 journal
 * 消费器（`readDeltaJournal` 兼容数组 + 单对象）；单对象维持原逻辑（本地 flag
 * 开→journal 消费器，关→旧 `consumeDelta`）。flag 对称时行为逐字节不变。
 *
 * 本模块为纯函数 seam（无 GM/IDB/DOM 依赖），供监听器与初始化共用，并可单测。
 */

/** 增量消费路由：journal（新协议消费器）或 legacy（旧单对象消费器）。 */
export type DeltaRoute = 'journal' | 'legacy';

/**
 * 判定增量载荷应走哪条消费路径。
 *
 * - 数组 → 无条件 `'journal'`：旧 `consumeDelta` 处理不了数组（`delta.action`
 *   为 undefined，两分支皆不进 → 静默丢）；journal 消费器经 `readDeltaJournal`
 *   兼容数组与单对象。空数组也判 `'journal'`——形状是数组即新协议发布端所写，
 *   `readDeltaJournal([])` 过滤为 `[]`，消费器空转无副作用；若判 `'legacy'`
 *   会把数组塞给只认单对象的 `consumeDelta`，正是本修复要消灭的静默丢路径。
 * - 单对象 → 按本地 flag：开→`'journal'`（`readDeltaJournal` 把单对象包成
 *   `[value]` 再过滤），关→`'legacy'`（flag 对称的旧路径，逐字节不变）。
 * - null/undefined/字符串等非对象 → `'legacy'`：非数组即非新协议 journal；
 *   `readDeltaJournal` 对 falsy 返回 `[]`，而旧路径在监听器 `newValue` 真值守卫
 *   与初始化 `Array.isArray` 形状判定下根本不会收到这些值，判 `'legacy'` 保持
 *   与修复前逐字节一致。
 *
 * @param newValue GM 增量键的最新值（数组 journal 或单对象载荷）
 * @param localFlagOn 消费端本地 featureFlags.crossSiteSyncProtocol
 */
export function deltaRoute(newValue: unknown, localFlagOn: boolean): DeltaRoute {
    if (Array.isArray(newValue)) return 'journal';
    return localFlagOn ? 'journal' : 'legacy';
}
