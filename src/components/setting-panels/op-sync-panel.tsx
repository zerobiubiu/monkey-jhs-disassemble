/**
 * OpSyncPanel —— 设置弹窗的「🔁 操作同步」面板（React 函数组件，JSX）。
 *
 * 展示**视频操作在插件与网站之间的同步状态**（doc/38）：
 * - 每条记录给出插件侧状态值（本地写入的操作行为）与网站侧同步状态；
 * - 支持重试单条 / 取消单条（表格行内按钮）、重试全部失败、清理已结束记录（工具条）；
 * - 内容区 `#op-sync-content` 由 `SettingPlugin.refreshOpSync()` 刷新
 *   （与 diagnostics-panel 同一范式：快照 + 刷新，不用 MutationObserver）。
 *
 * 只做展示与入口，业务动作在 `setting-form-bind.ts` 的事件绑定里调用。
 */

import { SettingSection } from '../setting/setting-section';

/** OpSyncPanel 的属性。 */
export interface OpSyncPanelProps {
    /** 当前激活面板名，控制面板 display。 */
    panelName: string;
}

/**
 * 渲染「操作同步」面板的 JSX。
 * @param props.panelName 当前激活面板名
 * @returns op-sync-panel JSX，经 jsxToString 转 HTML 字符串后供 SettingDialog 消费。
 */
export function OpSyncPanel({ panelName }: OpSyncPanelProps) {
    return (
        <div
            id="op-sync-panel"
            className="content-panel" role="tabpanel" aria-labelledby="tab-op-sync-panel"
            style={{
                display: panelName === 'op-sync-panel' ? 'block' : 'none',
                overflowY: 'auto'
            }}
        >
            <SettingSection title="视频操作同步状态" icon="🔁">
                <p className="op-sync-hint">
                    插件侧的状态先写本地库（立即生效），网站推送在后台排队进行。
                    这里可以查看每条操作的网站同步状态，并对失败或中断的记录重试 / 取消。
                </p>
                <div id="op-sync-summary" className="op-sync-summary" />
                <div className="op-sync-toolbar">
                    <button id="op-sync-refresh-btn" className="jhs-btn jhs-btn--primary" type="button">
                        🔄 刷新
                    </button>
                    <button id="op-sync-retry-all-btn" className="jhs-btn jhs-btn--ghost" type="button">
                        ↻ 重试全部失败
                    </button>
                    <button id="op-sync-clear-btn" className="jhs-btn jhs-btn--ghost" type="button">
                        🧹 清理已结束
                    </button>
                </div>
                <div id="op-sync-content" className="op-sync-content" />
                <div id="op-sync-status" className="op-sync-status" />
            </SettingSection>
        </div>
    );
}