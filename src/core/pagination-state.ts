/**
 * 瀑布流分页状态机（Runtime V2）。
 * 将 auto/click 两种加载模式统一为明确的状态转换，
 * 保证有下一页时按钮持续存在。
 */

/** 分页状态枚举。 */
export type PaginationPhase =
    | 'idle'       // 空闲，等待触发
    | 'loading'    // 正在加载下一页
    | 'error'      // 加载失败，可重试
    | 'exhausted'; // 无更多页面

export class PaginationStateMachine {
    private _phase: PaginationPhase = 'idle';
    private _hasMore = false;

    get phase(): PaginationPhase { return this._phase; }
    get hasMore(): boolean { return this._hasMore; }
    get canLoad(): boolean { return this._phase === 'idle' && this._hasMore; }
    get isLoading(): boolean { return this._phase === 'loading'; }

    /** 初始化：设置是否有更多页面。 */
    init(hasMore: boolean): void {
        this._hasMore = hasMore;
        this._phase = hasMore ? 'idle' : 'exhausted';
    }

    /** 开始加载：idle → loading。返回 false 表示当前不可加载。 */
    startLoading(): boolean {
        if (!this.canLoad) return false;
        this._phase = 'loading';
        return true;
    }

    /** 加载成功：loading → idle/exhausted。 */
    loadSuccess(hasMore: boolean): void {
        this._hasMore = hasMore;
        this._phase = hasMore ? 'idle' : 'exhausted';
    }

    /** 加载失败：loading → error。 */
    loadError(): void {
        this._phase = 'error';
    }

    /** 重试：error → idle（允许再次加载）。 */
    retry(): void {
        if (this._phase === 'error') {
            this._phase = 'idle';
        }
    }

    /** 重置为初始状态。 */
    reset(): void {
        this._phase = 'idle';
        this._hasMore = false;
    }
}
