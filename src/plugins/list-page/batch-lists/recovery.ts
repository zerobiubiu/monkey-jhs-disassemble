import { TaskSupervisor } from '../../../core/task-supervisor';
import { getCsrfToken } from '../../../core/util/site/csrf';

import { isBatchListDialogOpen, runBatchListProgress } from './dialog';
import { runAutomaticBatchListRecovery } from './service';

/** 仅在脚本运行且联网时恢复；关页后的工作留待下次加载，不依赖常驻后台服务。 */
export function startBatchListRecovery(): () => void {
    const supervisor = new TaskSupervisor();
    let checking = false;
    const check = async (): Promise<void> => {
        if (checking || supervisor.aborted || isBatchListDialogOpen() ||
            document.visibilityState === 'hidden' || navigator.onLine === false || !getCsrfToken()) return;
        checking = true;
        try {
            // 必须先原子取得执行权，再展示恢复窗口；已有执行者时立即返回，不排队唤醒。
            await runAutomaticBatchListRecovery(async (work) => {
                if (supervisor.aborted || isBatchListDialogOpen() || document.visibilityState === 'hidden') return;
                await runBatchListProgress(work, '继续未完成的批量清单操作');
            });
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
