/**
 * 跨标签页远程同步 —— GM_addValueChangeListener 接收广播并应用到本地状态。
 *
 * 提取自 vlt-sync.tsx：
 * - setupListMgmtBroadcastListener：监听清单管理广播（删除/改名），
 *   三重通道（GM / localStorage / CustomEvent）接收并分发回调。
 */

/** 日志前缀。 */
const LOG_PREFIX = '[JavDB]';

/** 清单管理广播键（独立通道，不与 jdb:last-sync 混用）。 */
const LIST_MGMT_KEY = 'jdb:list-mgmt';

/** 清单管理广播 payload 结构。 */
interface ListMgmtPayload {
    type?: string;
    listId?: string;
    newName?: string;
}

/**
 * 注册清单管理广播监听器（三重通道：GM / localStorage / CustomEvent）。
 *
 * 在详情页调用时，onDelete 移除对应清单 checkbox，onRename 更新标签文本；
 * 在列表页调用时，onDelete/onRename 均触发 refreshAllTags。
 *
 * @param onDelete 删除回调
 * @param onRename 改名回调
 */
export function setupListMgmtBroadcastListener(
    onDelete: (listId: string) => void,
    onRename: (listId: string, newName: string) => void
): void {
    /** 处理收到的广播 payload */
    const handlePayload = (payload: ListMgmtPayload | null): void => {
        if (!payload || !payload.type || !payload.listId) return;
        console.log(`${LOG_PREFIX} 收到清单管理广播:`, payload);
        if (payload.type === 'delete') {
            onDelete(payload.listId);
        } else if (payload.type === 'rename' && payload.newName) {
            onRename(payload.listId, payload.newName);
        }
    };

    // 1) 同脚本同页面（CustomEvent 即时）
    document.addEventListener(LIST_MGMT_KEY, (e: Event) => {
        handlePayload((e as CustomEvent).detail);
    });

    // 2) 跨脚本跨标签页（localStorage storage 事件，只在其他标签页触发）
    window.addEventListener('storage', (e: StorageEvent) => {
        if (e.key !== LIST_MGMT_KEY || !e.newValue) return;
        try {
            handlePayload(JSON.parse(e.newValue));
        } catch {}
    });

    // 3) 同脚本跨标签页（GM 原生通道）
    try {
        GM_addValueChangeListener(
            LIST_MGMT_KEY,
            (_name: string, _oldValue, newValue, _remote: boolean) => {
                if (!newValue) return;
                try {
                    handlePayload(JSON.parse(newValue));
                } catch {}
            }
        );
    } catch {}
}
