/** 跨清单入口共享的最新用户意图；成功后仍保留以阻止旧日志反向重放。 */
export interface ListIntent {
    version: 1;
    videoId: string;
    listId: string;
    intentId: string;
    createdAt: number;
    desiredChecked: boolean;
    /** 逻辑组尚未选择该实体，只替代旧操作，不要求该成员最终含片或不含片。 */
    supersedeOnly?: boolean;
}

export interface ListIntentPublishOptions {
    /** 仅用于已可靠预写的新明确操作；同毫秒时按关联锁内发布顺序决定胜出者。 */
    explicit?: boolean;
    supersedeOnly?: boolean;
}
