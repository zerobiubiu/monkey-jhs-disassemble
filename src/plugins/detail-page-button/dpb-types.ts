/** 「想看/已观看」状态推断结果（detectWantWatchedState 返回结构） */
export interface WantWatchedState {
    want: boolean;
    watched: boolean;
}

/** 「想看/已观看」同步广播载荷（broadcastWantWatchedSync / setupWantWatchedSyncListener）
 *  score 仅在 hasWatch+add 时携带（详情页标记已读/评分时已知星级），
 *  供 RatingDisplayPlugin 直接写入评分缓存，免去列表页悬停远程抓取详情页。 */
export interface WantWatchedSyncPayload {
    carNum: string;
    status: string;
    op: 'add' | 'remove';
    time?: number;
    /** 评分 1-5（仅 hasWatch+add 携带；0/未评分/想看/收藏不带） */
    score?: number;
}
