/**
 * SettingDialog —— 完整设置弹层（React 函数组件，JSX）。
 *
 * 左侧栏（backup/base/filter/domain/cache/vlt/missav/preload/diagnostics）
 * + 右侧各面板（拆分为 setting-panels/ 子组件）+ 底部保存/清理按钮。
 *
 * 各面板 JSX 已拆分至 `./setting-panels/` 子目录，本文件仅保留侧栏菜单、
 * 外层 flex 容器与底部按钮。面板组件返回的 DOM 结构（id/class/style/嵌套）
 * 与原内联 JSX 完全一致，jsxToString 输出不变。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 openSettingDialog 中
 * `layer.open({ content })` 消费时，需先用 `jsxToString` 转为 HTML 字符串：
 *   `layer.open({ content: jsxToString(<SettingDialog {...props} />), ... })`
 * 事件绑定（loadForm/bindClick/saveForm）仍由 openSettingDialog 持有。
 */

import { BackupPanel } from '.././setting-panels/backup-panel';
import { BasePanel } from '.././setting-panels/base-panel';
import { FilterPanel } from '.././setting-panels/filter-panel';
import { DomainPanel } from '.././setting-panels/domain-panel';
import { CachePanel } from '.././setting-panels/cache-panel';
import { SyncPanel } from '.././setting-panels/sync-panel';
import { ListManagerPanel } from '.././setting-panels/list-manager-panel';
import { FavSyncPanel } from '.././setting-panels/fav-sync-panel';
import { PreloadPanel } from '.././setting-panels/preload-panel';
import { DiagnosticsPanel } from '.././setting-panels/diagnostics-panel';
import { OpSyncPanel } from '.././setting-panels/op-sync-panel';

/** SettingDialog 的属性。 */
export interface SettingDialogProps {
    /** 当前激活面板名（默认 backup-panel），控制侧栏 active 类与各面板 display。 */
    panelName: string;
    /** 缓存项 HTML（预拼接，含清理/查看按钮），注入 cache-panel 网格。 */
    cacheItemsHtml: string;
    /** 画质选项 HTML（预拼接 option 串），注入 videoQuality 下拉。 */
    qualityOptionsHtml: string;
    /** 是否 JavDb 站点（控制高亮演员/分类标签项的 do-hide 类）。 */
    isJavdbSite: boolean;
}

/**
 * 渲染完整设置弹层的 JSX。
 * @param props.panelName 当前激活面板名
 * @param props.cacheItemsHtml 缓存项预拼接 HTML
 * @param props.qualityOptionsHtml 画质选项预拼接 HTML
 * @param props.isJavdbSite 是否 JavDb 站点
 * @returns 设置弹层 JSX，经 jsxToString 转 HTML 字符串后供 layer.open 消费。
 */
export function SettingDialog({
    panelName,
    cacheItemsHtml,
    qualityOptionsHtml,
    isJavdbSite
}: SettingDialogProps) {
    /**
     * 计算 `aria-selected` 值。
     *
     * 必须返回字符串（而非布尔）：`aria-selected` 不是 HTML 布尔属性，
     * 裸属性等价于空串、`false` 被省略则属性缺失，二者都不是合法 ARIA——
     * 读屏无法区分「未选中」与「属性不存在」。`jsxToString` 已按此约定
     * 处理 `aria-*`（见 core/jsx-to-string.ts），此处显式给字符串以对齐。
     */
    const ariaSelected = (id: string): 'true' | 'false' =>
        panelName === id ? 'true' : 'false';
    return (
        <div style={{ display: 'flex', height: '100%' }}>
            <div
                role="tablist"
                aria-orientation="vertical"
                aria-label="设置面板"
                style={{
                    width: '170px',
                    flexShrink: 0,
                    padding: '12px 0',
                    background: '#fbfcfd',
                    borderRight: '1px solid #e2e8f0',
                    overflowY: 'auto'
                }}
            >
                <button
                    type="button"
                    role="tab"
                    aria-selected={ariaSelected('backup-panel')}
                    tabIndex={panelName === 'backup-panel' ? 0 : -1}
                    className={`side-menu-item ${panelName === 'backup-panel' ? 'active' : ''}`}
                    id="tab-backup-panel" data-panel="backup-panel"
                >
                    <span aria-hidden="true">💾</span> 数据备份
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={ariaSelected('base-panel')}
                    tabIndex={panelName === 'base-panel' ? 0 : -1}
                    className={`side-menu-item ${panelName === 'base-panel' ? 'active' : ''}`}
                    id="tab-base-panel" data-panel="base-panel"
                >
                    <span aria-hidden="true">⚙️</span> 基础配置
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={ariaSelected('filter-panel')}
                    tabIndex={panelName === 'filter-panel' ? 0 : -1}
                    className={`side-menu-item ${panelName === 'filter-panel' ? 'active' : ''}`}
                    id="tab-filter-panel" data-panel="filter-panel"
                >
                    <span aria-hidden="true">🚫</span> 屏蔽配置
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={ariaSelected('domain-panel')}
                    tabIndex={panelName === 'domain-panel' ? 0 : -1}
                    className={`side-menu-item ${panelName === 'domain-panel' ? 'active' : ''}`}
                    id="tab-domain-panel" data-panel="domain-panel"
                    title="第三方视频资源域名配置"
                >
                    <span aria-hidden="true">🌐</span> 外部网站
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={ariaSelected('cache-panel')}
                    tabIndex={panelName === 'cache-panel' ? 0 : -1}
                    className={`side-menu-item ${panelName === 'cache-panel' ? 'active' : ''}`}
                    id="tab-cache-panel" data-panel="cache-panel"
                >
                    <span aria-hidden="true">🧹</span> 缓存管理
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={ariaSelected('vlt-panel')}
                    tabIndex={panelName === 'vlt-panel' ? 0 : -1}
                    className={`side-menu-item ${panelName === 'vlt-panel' ? 'active' : ''}`}
                    id="tab-vlt-panel" data-panel="vlt-panel"
                >
                    <span aria-hidden="true">📋</span> 清单管理器
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={ariaSelected('fav-sync-panel')}
                    tabIndex={panelName === 'fav-sync-panel' ? 0 : -1}
                    className={`side-menu-item ${panelName === 'fav-sync-panel' ? 'active' : ''}`}
                    id="tab-fav-sync-panel" data-panel="fav-sync-panel"
                    title="JHS ↔ JavDB 双向增量同步"
                >
                    <span aria-hidden="true">🔄</span> 收藏同步
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={ariaSelected('missav-panel')}
                    tabIndex={panelName === 'missav-panel' ? 0 : -1}
                    className={`side-menu-item ${panelName === 'missav-panel' ? 'active' : ''}`}
                    id="tab-missav-panel" data-panel="missav-panel"
                >
                    <span aria-hidden="true">🎬</span> MissAV 同步
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={ariaSelected('preload-panel')}
                    tabIndex={panelName === 'preload-panel' ? 0 : -1}
                    className={`side-menu-item ${panelName === 'preload-panel' ? 'active' : ''}`}
                    id="tab-preload-panel" data-panel="preload-panel"
                    title="视频流外部网站预加载配置"
                >
                    <span aria-hidden="true">⚡</span> 预加载配置
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={ariaSelected('diagnostics-panel')}
                    tabIndex={panelName === 'diagnostics-panel' ? 0 : -1}
                    className={`side-menu-item ${panelName === 'diagnostics-panel' ? 'active' : ''}`}
                    id="tab-diagnostics-panel" data-panel="diagnostics-panel"
                    title="插件执行状态诊断"
                >
                    <span aria-hidden="true">📊</span> 插件诊断
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={ariaSelected('op-sync-panel')}
                    tabIndex={panelName === 'op-sync-panel' ? 0 : -1}
                    className={`side-menu-item ${panelName === 'op-sync-panel' ? 'active' : ''}`}
                    id="tab-op-sync-panel" data-panel="op-sync-panel"
                    title="视频操作在插件与网站的同步状态"
                >
                    <span aria-hidden="true">🔁</span> 操作同步
                </button>
            </div>

            <div
                style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%'
                }}
            >
                <div
                    style={{
                        flex: 1,
                        margin: '0 10px',
                        paddingBottom: '20px',
                        overflow: 'hidden'
                    }}
                >
                    <BackupPanel panelName={panelName} />
                    <BasePanel panelName={panelName} qualityOptionsHtml={qualityOptionsHtml} isJavdbSite={isJavdbSite} />
                    <FilterPanel panelName={panelName} />
                    <DomainPanel panelName={panelName} />
                    <CachePanel panelName={panelName} cacheItemsHtml={cacheItemsHtml} />
                    <ListManagerPanel panelName={panelName} />
                    <FavSyncPanel panelName={panelName} />
                    <SyncPanel
                        panelId="missav-panel"
                        panelName={panelName}
                        title="MissAV 状态标签同步"
                        icon="🎬"
                        description={
                            <>
                                在 MissAV 站点显示 JHS 鉴定状态标签（已收藏/已观看/已屏蔽/已下载）。
                                <br />
                                数据通过油猴 GM 存储跨域同步，无需后端服务器。
                                <br />
                                <strong>立即同步</strong>：读取当前 car_list 并推送到 GM 存储。
                                <br />
                                <strong>导入</strong>：从后端服务器导出的 JSON 导入历史数据。
                                <br />
                                <strong>导出</strong>：将 MissAV 本地 IndexedDB 数据导出为 JSON（可走
                                WebDav 备份）。
                            </>
                        }
                        buttons={[
                            { id: 'missav-sync-btn', text: '立即同步', color: 'primary' },
                            { id: 'missav-import-btn', text: '导入数据', color: 'primary' },
                            { id: 'missav-export-btn', text: '导出数据', color: 'success' }
                        ]}
                        statusId="missav-status"
                        fileInputId="missav-file-input"
                    />
                    <PreloadPanel panelName={panelName} />
                </div>
                <DiagnosticsPanel panelName={panelName} />
                <OpSyncPanel panelName={panelName} />
                <div
                    style={{
                        flexShrink: 0,
                        padding: '14px 20px',
                        textAlign: 'right',
                        borderTop: '1px solid #e2e8f0',
                        background: '#fbfcfd',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '10px',
                        alignItems: 'center'
                    }}
                >
                    <button id="saveBtn" className="jhs-btn jhs-btn--success">
                        <span aria-hidden="true">🗃️</span> 保存设置
                    </button>
                    {/* 底栏只放「保存设置」。危险动作的入口属于它自己那个面板（见 cache-panel）。 */}
                </div>
            </div>
        </div>
    );
}
