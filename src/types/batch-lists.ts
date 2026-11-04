/** 批量清单操作的界面、执行器与持久日志共享契约。 */
export interface BatchListChoice {
    id: string;
    name: string;
    url: string;
    /** 按详情页规则合并的逻辑清单；未合并条目不带此字段。 */
    group?: { base: string; pattern: string; excludeNames: string[] };
    members?: { id: string; name: string; num: number }[];
}

/** 网站操作前持久化的具体路由；创建结果不确定时只回查，不重复创建。 */
export interface BatchListRoute {
    listIds: string[];
    createName?: string;
    createAttempted?: boolean;
    /** 具体加入请求可能已发出，确认其结果前不得改投另一成员。 */
    uncertain?: boolean;
}

export interface BatchListApplyContext {
    createdAt: number;
    route?: BatchListRoute;
    saveRoute(route: BatchListRoute): Promise<void>;
    signal?: AbortSignal;
}

export interface BatchListItem {
    carNum: string;
    url: string;
    videoId: string;
    publishTime?: string;
    names?: string;
}

/** 清单窗口可选的同批评价；未选择时保持原评价。 */
export interface BatchRatingChoice {
    kind: 'favorite' | 'watched';
    score: number;
}

/** 组合任务的评价准备阶段；稳定身份防止恢复被当作一次新评分。 */
export interface BatchRatingIntent {
    revision: string;
    requestedAt: number;
    baseline: string;
    before: { status: string; score: number };
    phase: 'pending' | 'applying' | 'registered' | 'success' | 'superseded';
}

export interface BatchListProgress {
    total: number;
    done: number;
    succeeded: number;
    failed: number;
    pending: number;
    superseded?: number;
    /** 本轮实际同时处理的视频数量。 */
    concurrency?: number;
    stopped?: boolean;
    phase: 'ratings' | 'lists' | 'done';
    current: string;
    ratingTotal: number;
    ratingDone: number;
    ratingFailed: number;
    /** 评价尚未全部确认的视频数；清单成功不能掩盖这部分未完成责任。 */
    ratingPending?: number;
}

export interface BatchListJournalOperation {
    listId: string;
    state: 'pending' | 'success' | 'superseded';
    error: string;
    route?: BatchListRoute;
}

export interface BatchListJournalItem extends BatchListItem {
    state: 'pending' | 'success' | 'superseded';
    error: string;
    operations: BatchListJournalOperation[];
    ratingsComplete: boolean;
    rating?: BatchRatingIntent;
}

export interface BatchListJob {
    version: 2;
    id: string;
    origin: string;
    lists: BatchListChoice[];
    rating?: BatchRatingChoice;
    desiredChecked: boolean;
    createdAt: number;
    updatedAt: number;
    attempts: number;
    retryAt: number;
    ratingsComplete: boolean;
    /** 用户手动停止的任务仅在明确继续时恢复，意外中断仍自动恢复。 */
    paused?: boolean;
    /** 暂停指令修订号，较早排队的继续请求不能清除较新的停止。 */
    pauseRevision?: number;
    items: BatchListJournalItem[];
}
