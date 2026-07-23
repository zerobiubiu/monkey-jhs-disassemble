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
import { VltPanel } from '.././setting-panels/vlt-panel';
import { MissavPanel } from '.././setting-panels/missav-panel';
import { PreloadPanel } from '.././setting-panels/preload-panel';
import { DiagnosticsPanel } from '.././setting-panels/diagnostics-panel';

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
    return (
        <div style={{ display: 'flex', height: '100%' }}>
            <div
                style={{
                    width: '170px',
                    flexShrink: 0,
                    padding: '12px 0',
                    background: '#fbfcfd',
                    borderRight: '1px solid #e2e8f0',
                    overflowY: 'auto'
                }}
            >
                <div
                    className={`side-menu-item ${panelName === 'backup-panel' ? 'active' : ''}`}
                    data-panel="backup-panel"
                >
                    💾 数据备份
                </div>
                <div
                    className={`side-menu-item ${panelName === 'base-panel' ? 'active' : ''}`}
                    data-panel="base-panel"
                >
                    ⚙️ 基础配置
                </div>
                <div
                    className={`side-menu-item ${panelName === 'filter-panel' ? 'active' : ''}`}
                    data-panel="filter-panel"
                >
                    🚫 屏蔽配置
                </div>
                <div
                    className={`side-menu-item ${panelName === 'domain-panel' ? 'active' : ''}`}
                    data-panel="domain-panel"
                    title="第三方视频资源域名配置"
                >
                    🌐 外部网站
                </div>
                <div
                    className={`side-menu-item ${panelName === 'cache-panel' ? 'active' : ''}`}
                    data-panel="cache-panel"
                >
                    🧹 缓存管理
                </div>
                <div
                    className={`side-menu-item ${panelName === 'vlt-panel' ? 'active' : ''}`}
                    data-panel="vlt-panel"
                >
                    📋 收藏清单关系
                </div>
                <div
                    className={`side-menu-item ${panelName === 'missav-panel' ? 'active' : ''}`}
                    data-panel="missav-panel"
                >
                    🎬 MissAV 同步
                </div>
                <div
                    className={`side-menu-item ${panelName === 'preload-panel' ? 'active' : ''}`}
                    data-panel="preload-panel"
                    title="视频流外部网站预加载配置"
                >
                    ⚡ 预加载配置
                </div>
                <div
                    className={`side-menu-item ${panelName === 'diagnostics-panel' ? 'active' : ''}`}
                    data-panel="diagnostics-panel"
                    title="插件执行状态诊断"
                >
                    📊 插件诊断
                </div>
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
                    <VltPanel panelName={panelName} />
                    <MissavPanel panelName={panelName} />
                    <PreloadPanel panelName={panelName} />
                </div>
                <DiagnosticsPanel panelName={panelName} />
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
                    <button id="saveBtn" className="jhs-setting-btn jhs-setting-btn--success">
                        💾 保存设置
                    </button>
                    <button id="clean-all" className="jhs-setting-btn jhs-setting-btn--danger" style={{ display: 'none' }}>
                        ♾️ 清理全部缓存
                    </button>
                </div>
            </div>
        </div>
    );
}
