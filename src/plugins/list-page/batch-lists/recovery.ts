import { TaskSupervisor } from '../../../core/task-supervisor';
import { getCsrfToken } from '../../../core/util/site/csrf';

import { isBatchListDialogOpen, runBatchListProgress } from './dialog';
import { isBatchListJobPending, readBatchListJobs } from './journal';
import { recoverBatchListJobs } from './service';

/** 仅在脚本运行且联网时恢复；关页后的工作留待下次加载，不依赖常驻后台服务。 */
export function startBatchListRecovery(): () => void {
    const supervisor = new TaskSupervisor();
    let checking = false;
    const check = async (): Promise<void> => {
        if (checking || supervisor.aborted || isBatchListDialogOpen() ||
            document.visibilityState === 'hidden' || navigator.onLine === false || !getCsrfToken()) return;
        checking = true;
        try {
            const jobs = readBatchListJobs();
            if (!jobs.some((job) => !job.paused && isBatchListJobPending(job) && job.retryAt <= Date.now())) return;
            const locks = await navigator.locks?.query();
            if (supervisor.aborted || locks?.held?.some((lock) => lock.name === 'jhs:batch-lists:' + window.location.origin)) return;
            await runBatchListProgress((notify, signal) => recoverBatchListJobs(notify, false, signal), '继续未完成的批量清单操作');
        } catch (error: unknown) {
            clog.error('[批量清单] 自动恢复暂未完成', error);
        } finally {
            checking = false;
        }
    };
    supervisor.setTimeout(() => { void check(); }, 1000);
    supervisor.setInterval(() => { void check(); }, 30000);
    supervisor.addEventListener(window, 'online', () => { void check(); });
    supervisor.addEventListener(document, 'visibilitychange', () => { void check(); });
    return () => supervisor.abort();
}
