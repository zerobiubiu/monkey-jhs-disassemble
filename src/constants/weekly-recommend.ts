/** 推荐浮层显隐变更；接收方读取当前 DOM 状态，不持久化打开状态。 */
export const WEEKLY_RECOMMEND_VISIBILITY_EVENT = 'jhs:weekly-recommend-visibility';
/** 推荐卡片身份或原生内容已更新，不随自身标签/徽标更新反复派发。 */
export const WEEKLY_RECOMMEND_ITEMS_EVENT = 'jhs:weekly-recommend-items';
/** 预加载配置已读完，筛选栏可以按真实开关状态构建。 */
export const PRELOAD_FILTER_READY_EVENT = 'jhs:preload-filter-ready';
/** 状态/个人评分索引已更新，各独立筛选范围可以重新计数。 */
export const STATUS_FILTER_DATA_EVENT = 'jhs:status-filter-data';
