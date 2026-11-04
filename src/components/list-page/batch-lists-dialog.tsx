import type { BatchListChoice, BatchListProgress } from '../../types/batch-lists';

/** 默认保持原评价；只有显式选择已读时才提供星级。 */
function BatchRatingControls({ disabled }: { disabled: boolean }) {
    return (
        <div className="jhs-batch-lists-rating">
            <label className="jhs-batch-lists-rating-kind" htmlFor="jhs-batch-rating-kind">
                视频评价（可选）
                <select id="jhs-batch-rating-kind" disabled={disabled}>
                    <option value="unchanged">不修改评价</option>
                    <option value="favorite">收藏</option>
                    <option value="watched">已读</option>
                </select>
            </label>
            <label className="jhs-batch-lists-rating-score" htmlFor="jhs-batch-rating-score" hidden>
                已读评分
                <select id="jhs-batch-rating-score" disabled>
                    {[0, 1, 2, 3, 4, 5].map((score) => <option value={score} key={score}>{score === 0 ? '0星（不评分）' : `${score}星`}</option>)}
                </select>
            </label>
            <p className="jhs-batch-lists-rating-note">默认只修改清单；选择收藏或已读时，一次开始并同步网站评价。</p>
        </div>
    );
}

/** 目录已按详情页配置归组；仅展示逻辑名称，不读取或展开具体成员。 */
export function BatchListsPicker({ count, choices, loading, error, hasRecoverable = false }: {
    count: number;
    choices: BatchListChoice[];
    loading: boolean;
    error: string;
    hasRecoverable?: boolean;
}) {
    return (
        <>
            <p className="jhs-batch-lists-description">为选中的 <strong>{count}</strong> 部视频设置一个或多个清单，可同时修改评价。</p>
            <BatchRatingControls disabled={loading || choices.length === 0} />
            <fieldset className="jhs-batch-lists-direction" disabled={loading || choices.length === 0}>
                <legend>操作</legend>
                <label><input type="radio" name="jhs-batch-list-direction" value="add" checked /> 加入清单</label>
                <label><input type="radio" name="jhs-batch-list-direction" value="remove" /> 移出清单</label>
            </fieldset>
            <label className="jhs-batch-lists-search-label" htmlFor="jhs-batch-list-search">选择视频清单（可多选）</label>
            <input id="jhs-batch-list-search" type="search" placeholder="搜索清单名称" autoComplete="off" disabled={loading || choices.length === 0} />
            <div className="jhs-batch-lists-choices jhs-scrollbar" role="group" aria-label="网站视频清单" aria-busy={loading}>
                {loading && <p role="status">正在读取网站清单…</p>}
                {!loading && choices.length === 0 && !error && <p>网站暂无可用清单，请先在网站创建清单。</p>}
                {choices.map((choice) => (
                    <label className="jhs-batch-lists-choice" key={choice.id}>
                        <input type="checkbox" name="jhs-batch-list-choice" value={choice.id} />
                        <span>{choice.name}</span>
                        {choice.group && <span className="jhs-batch-lists-auto-label">自动分配</span>}
                    </label>
                ))}
                <p data-role="no-matches" hidden>没有匹配的清单，请修改搜索词。</p>
            </div>
            <p className="jhs-batch-lists-selected" data-role="selected-target" aria-live="polite">尚未选择清单</p>
            <p className="jhs-batch-lists-note" data-role="group-behavior" hidden />
            {error && <p className="jhs-batch-lists-error" role="alert">{error}</p>}
            <p className="jhs-batch-lists-note">按基础设置中的并发数处理视频；每部视频先处理评价，再处理全部所选清单。清单经网站确认后才更新本地关联，意外中断后自动核对并继续。</p>
            {hasRecoverable && !loading && <div className="jhs-batch-lists-recovery">
                <p>将按原恢复记录执行全部未完成操作（含手动停止的操作），不使用当前选择。</p>
                <button type="button" className="a-normal" data-list-act="resume">继续未完成操作</button>
            </div>}
            <div className="jhs-batch-lists-footer">
                <button type="button" className="a-normal" data-list-act="close">取消</button>
                <button type="button" className="a-primary" data-list-act="start" disabled>开始执行</button>
            </div>
        </>
    );
}

/** 展开与最小化视图共用结果口径，结束不等同于全部成功。 */
export function getBatchListProgressState(progress: BatchListProgress, running: boolean, error: string, stopping = false) {
    const incomplete = progress.pending > 0 || progress.ratingFailed > 0 || progress.failed > 0 ||
        (progress.ratingPending ?? 0) > 0 || progress.stopped === true || Boolean(error);
    const state = running ? stopping ? '正在停止，等待当前请求确认' : '执行中'
        : progress.stopped ? '已停止' : incomplete ? '仍有项目待完成' : '同步完成';
    return { incomplete, state };
}

/** 进度表示已处理数；成功数独立列出，失败与待完成不会充当成功。 */
export function BatchListsProgress({ progress, running, error, stopping = false }: {
    progress: BatchListProgress;
    running: boolean;
    error: string;
    stopping?: boolean;
}) {
    const { incomplete, state } = getBatchListProgressState(progress, running, error, stopping);
    const value = progress.done;
    const total = progress.total;
    return (
        <div className={`jhs-batch-lists-progress${!running && incomplete ? ' is-incomplete' : ''}`} aria-busy={running}>
            <h3 tabIndex={-1} data-role="progress-heading">{state}</h3>
            <p className="jhs-batch-lists-current" role="status" aria-live="polite">{stopping && running ? '正在停止，等待当前请求确认' : progress.current || '正在准备执行…'}</p>
            <label htmlFor="jhs-batch-list-progress">视频处理：{value} / {total}</label>
            <progress id="jhs-batch-list-progress" max={Math.max(total, 1)} value={value} />
            <dl className="jhs-batch-lists-summary">
                <div><dt>视频确认完成</dt><dd>{progress.succeeded}</dd></div>
                <div><dt>视频待完成</dt><dd>{progress.pending}</dd></div>
                <div><dt>视频本轮失败</dt><dd>{progress.failed}</dd></div>
                {(progress.superseded ?? 0) > 0 && <div><dt>后续操作已替代</dt><dd>{progress.superseded}</dd></div>}
            </dl>
            <p className="jhs-batch-lists-note">{progress.concurrency
                ? `按视频并发执行，最多同时处理 ${progress.concurrency} 部视频；每部依次处理评价和全部所选清单。`
                : '按视频并发执行；每部依次处理评价和全部所选清单。'}</p>
            {progress.ratingTotal > 0 && <p className="jhs-batch-lists-note">本次所选视频评价已处理 {progress.ratingDone} / {progress.ratingTotal}，失败 {progress.ratingFailed}；其他视频仍在后台同步。</p>}
            {(progress.ratingPending ?? 0) > 0 && <p className="jhs-batch-lists-note">本次评价待确认 {progress.ratingPending} 项。</p>}
            {error && <p className="jhs-batch-lists-error" role="alert">{error}</p>}
            <p className="jhs-batch-lists-note">{running
                ? stopping ? '已请求停止后续执行；当前请求确认后即可关闭进度窗口。' : '可停止后续执行；已发出的请求会先完成确认，请保持此页面打开。'
                : progress.stopped ? '未完成记录已保留，不会自动继续；点击“继续执行”后恢复。'
                : stopping && error ? '停止请求未完整完成，请查看错误原因并保留当前页面以核对结果。'
                : error ? '请查看错误原因；已登记但未完成的操作会自动核对并继续。'
                    : incomplete ? '未完成项目保留恢复记录，将自动校验并继续；也可以立即重试。' : '网站确认成功的清单关联已写入脚本数据。'}</p>
            <div className="jhs-batch-lists-footer">
                {running && <button type="button" className="a-normal" data-list-act="stop" disabled={stopping}>{stopping ? '正在停止…' : '停止执行'}</button>}
                {!running && <button type="button" className="a-normal" data-list-act="close">关闭</button>}
                {!running && incomplete && <button type="button" className="a-primary" data-list-act="retry">{progress.stopped ? '继续执行' : '立即重试'}</button>}
            </div>
        </div>
    );
}

export function BatchListsFloatingButton() {
    return (
        <button type="button" className="jhs-batch-lists-floating" data-list-act="restore" hidden
            aria-controls="jhs-batch-list-dialog" aria-expanded="false" title="展开批量任务进度">
            <span>批量任务</span>
            <strong data-role="floating-state" aria-live="polite" />
            <span data-role="floating-progress" />
        </button>
    );
}

export function BatchListsDialogShell({ title, canMinimize = false }: { title: string; canMinimize?: boolean }) {
    return (
        <>
            <div className="jhs-batch-lists-header">
                <h2 id="jhs-batch-list-title">{title}</h2>
                {canMinimize && <button type="button" className="a-normal" data-list-act="minimize"
                    title="收起进度，任务继续执行">最小化</button>}
            </div>
            <div data-role="batch-list-body" />
        </>
    );
}
